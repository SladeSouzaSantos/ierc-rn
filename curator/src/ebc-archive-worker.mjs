/**
 * Opt-in EBC category archive discovery for the EXISTING DEV auto-publisher.
 * Discovery never writes to Strapi/Redis or calls models. Article evidence
 * must pass the existing per-article rights reader before reaching the worker.
 */
import {URL as NodeURL} from 'node:url';
import {archiveSource,fetchEbcArchiveListing,parseEbcArchive} from './ebc-archive.mjs';
import {relevanceAssessment,rankArticles} from './relevance.mjs';
import {sanitizeArticleEvidenceError} from './article-evidence.mjs';

const EBC_HOST='agenciabrasil.ebc.com.br';
const MIN_DELAY_MS=10000;
const SECTION='educacao';

/**
 * Use the same wrapper for RSS, archive list and full article EBC fetches
 * within the activated worker run. The official robots.txt asks crawlers
 * for >=10 seconds between EBC requests. No global timer, no other hosts
 * slowed, no untrusted URLs constructed.
 */
export function createPacedEbcFetch(fetchImpl,{
  now=()=>Date.now(),
  sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
}={}){
  if(typeof fetchImpl!=='function'||typeof now!=='function'||typeof sleep!=='function')
    throw new Error('Valid fetch and clock required for EBC rate limit');
  let lastStart=null;
  // Serializes requests to the same EBC host to enforce the delay
  // even if future pipelines introduce parallel fetches.
  let queue=Promise.resolve();
  return async function pacedFetch(url,options){
    let host;
    try{host=new NodeURL(url).hostname;}catch{throw new Error('Invalid worker request URL');}
    if(host!==EBC_HOST)return fetchImpl(url,options);
    const work=queue.catch(()=>{}).then(async()=>{
      const current=now();
      if(lastStart!==null){
        const delay=Math.max(0,MIN_DELAY_MS-(current-lastStart));
        if(delay)await sleep(delay);
      }
      lastStart=now();
      return fetchImpl(url,options);
    });
    queue=work.then(()=>{},()=>{});
    return work;
  };
}

function validEvidence(e,source,url){
  return e?.verified===true&&e?.mode==='full_article'&&e.sourceUrl===url&&
    e.sourceId===source.id&&e.licenseReference===source.fullTextAccess.reference&&
    typeof e.digest==='string'&&/^[a-f0-9]{64}$/.test(e.digest)&&
    Array.isArray(e.blocks)&&e.blocks.length>=3&&
    e.blocks.every(b=>/^E\d{2}$/.test(b.id)&&typeof b.text==='string'&&b.text.length>=25);
}
const reasonFor=e=>{
  const message=String(e?.message||'');
  if(message==='archive_http_error')return 'http_error';
  if(message==='archive_unexpected_redirect')return 'redirect_blocked';
  if(message==='archive_invalid_html')return 'invalid_listing';
  if(message==='archive_too_large')return 'size_limit';
  if(e?.name==='TimeoutError')return 'timeout';
  return 'network_or_parser_error';
};

/**
 * Returns transient vetted candidates and evidence keyed by canonical URL.
 * Scope is deliberately one EBC section and max two pages/two article reads
 * per slot. Caller provides a host-paced fetch for the entire worker.
 */
export async function collectEbcArchiveCandidates({
  source,fetchImpl,articleReader,now=Date.now(),logger=()=>{},
  pages=2,maxEvidence=2,
}={}){
  if(!source||source.id!=='agencia-brasil-educacao'||
     archiveSource(SECTION,[source])!==source)
    throw new Error('Archive worker only accepts licensed EBC Education source');
  if(typeof fetchImpl!=='function'||typeof articleReader!=='function'||
    !Number.isInteger(pages)||pages<1||pages>2||
    !Number.isInteger(maxEvidence)||maxEvidence<1||maxEvidence>2)
    throw new Error('Invalid bounded archive collection parameters');
  const listed=new Map();
  for(let page=0;page<pages;page++){
    try{
      const html=await fetchEbcArchiveListing(SECTION,page,fetchImpl);
      const parsed=parseEbcArchive(html,{section:SECTION,now,ageDays:45});
      for(const item of parsed)if(!listed.has(item.url))listed.set(item.url,item);
      logger({event:'archive_page_checked',section:SECTION,page,
        entries:parsed.length,hints:parsed.filter(x=>x.discoveryHint).length});
    }catch(error){
      logger({event:'archive_page_unavailable',section:SECTION,page,
        reason:reasonFor(error)});
    }
  }
  const likely=[...listed.values()].filter(x=>x.discoveryHint)
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||
      a.url.localeCompare(b.url));
  const candidates=[],evidenceByUrl=new Map();
  for(const item of likely.slice(0,maxEvidence)){
    try{
      const evidence=await articleReader(source,item,{fetchImpl});
      if(!validEvidence(evidence,source,item.url))
        throw new Error('Unverified archive article evidence');
      const body=evidence.blocks.map(x=>x.text).join(' ');
      // Headlines like "acessibilidade" alone NEVER qualify a report.
      const direct=relevanceAssessment({title:'',summary:body},source);
      if(!direct.relevant||direct.editorialFocus!=='visual_direta'){
        logger({event:'archive_candidate_skipped',source:source.id,
          reason:'no_direct_visual_evidence'});
        continue;
      }
      const ranked=rankArticles([{
        ...item,summary:body,source:source.name,country:source.country,
        language:source.language,
      }],source);
      if(ranked.length!==1)continue;
      const article={...ranked[0],summary:''};
      candidates.push(article);
      evidenceByUrl.set(item.url,evidence);
      logger({event:'archive_candidate_verified',source:source.id,
        articleKey:item.dedupeKey.slice(0,12),focus:'visual_direta'});
    }catch(error){
      logger({event:'archive_candidate_skipped',source:source.id,
        reason:sanitizeArticleEvidenceError(error)});
    }
  }
  logger({event:'archive_discovery_completed',source:source.id,
    pages,items:listed.size,titleHints:likely.length,verified:candidates.length});
  return {candidates,evidenceByUrl};
}

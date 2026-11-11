/**
 * Official Agência Brasil public category-listing discovery.
 * Intentionally read-only: NEVER provides a CMS or LLM client, and never
 * treats discovery as publication permission. Robots: crawl-delay 10s.
 */
import {createHash} from 'node:crypto';
import {load} from 'cheerio';
import {SOURCES} from './feeds.mjs';
import {fetchArticleEvidence,sanitizeArticleEvidenceError} from './article-evidence.mjs';
import {relevanceAssessment} from './relevance.mjs';

const HOST='agenciabrasil.ebc.com.br';
const ALLOWED=Object.freeze({
  educacao:'agencia-brasil-educacao',
  'direitos-humanos':'agencia-brasil-direitos',
  esportes:'agencia-brasil-esportes',
  internacional:'agencia-brasil-internacional',
});
const MAX_HTML=300000;
const MIN_DELAY_MS=10000;
// This title screen is a discovery hint, NOT the publication relevance gate.
const TITLE_HINT=/(?:braille|braile|baixa\s+vis[aã]o|cegueira|pessoas?\s+cegas?|defici[eê]ncia|acessibilidade|tecnologia\s+assistiva|audiodescri[cç][aã]o|paral[ií]mpic[oa]|goalball|inclus[aã]o|esporte\s+adaptado|leitura\s+t[aá]til)/i;
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const safeReason=e=>{
  const s=String(e?.message||'');
  return s==='archive_http_error'?'http_error':s==='archive_unexpected_redirect'?'redirect_blocked':
    s==='archive_invalid_html'?'invalid_listing':
    s==='archive_too_large'?'size_limit':
    e?.name==='TimeoutError'?'timeout':'network_or_parser_error';
};

export function archiveSource(section,catalog=SOURCES){
  const id=ALLOWED[section];
  if(!id)throw new Error('Unsupported official EBC archive section');
  const source=catalog.find(s=>s.id===id);
  if(!source||source.section!==section||source.hostname!==HOST||
    source.mode!=='rss'||source.previewOnly===true||
    source.fullTextAccess?.status!=='approved'||source.fullTextAccess?.basis!=='published-reproduction-policy')
    throw new Error('Official EBC source authorization missing');
  return source;
}
export function archivePageUrl(section,page){
  archiveSource(section);
  if(!Number.isInteger(page)||page<0||page>1)
    throw new Error('Only the first two public archive pages are permitted');
  return 'https://'+HOST+'/'+section+(page?'?page='+page:'');
}
function officialLink(href,section){
  let u;
  try{u=new URL(href);}catch{return null;}
  if(u.protocol!=='https:'||u.hostname!==HOST||u.port||
    u.username||u.password||u.hash||
    !new RegExp('^/'+section+'/noticia/20\\d{2}-(?:0[1-9]|1[0-2])/[a-z0-9-]+/?$').test(u.pathname)||
    [...u.searchParams.keys()].some(k=>!/^utm_|^fbclid$|^gclid$/i.test(k)))return null;
  u.search='';u.pathname=u.pathname.replace(/\/+$/,'');
  return u.toString();
}
function brasiliaDate(raw){
  const m=norm(raw).match(/(?:^|,\s*)(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2}):(\d{2})$/);
  if(!m)return null;
  const [day,month,year,hour,minute]=m.slice(1).map(Number);
  if(year<2020||month<1||month>12||day<1||day>31||hour>23||minute>59)return null;
  const naive=new Date(Date.UTC(year,month-1,day,hour,minute));
  if(naive.getUTCFullYear()!==year||naive.getUTCMonth()!==month-1||
    naive.getUTCDate()!==day)return null;
  // Official listing is displayed in Brasília local time (UTC-03, 2026).
  return new Date(naive.getTime()+3*60*60*1000).toISOString();
}
/** Extract only dated public editorial cards; never trust headlined hero cards
 * without explicit dates or text from unrelated navigation. */
export function parseEbcArchive(html,{section,now=Date.now(),ageDays=45}={}){
  archiveSource(section);
  if(typeof html!=='string'||html.length>MAX_HTML)throw new Error('archive_too_large');
  if(!Number.isInteger(ageDays)||ageDays<1||ageDays>45)
    throw new Error('Invalid EBC archive age window');
  const $=load(html);
  const cards=$('.ultima-noticia');
  if(!cards.length)throw new Error('archive_invalid_html');
  const output=[],seen=new Set();
  cards.slice(0,35).each((_,element)=>{
    const card=$(element);
    const a=card.find('a.titulo-noticia').first();
    const title=norm(a.text());
    const url=officialLink(a.attr('href'),section);
    const publishedAt=brasiliaDate(card.find('.data-publicacao .data').first().text());
    if(!url||!title||title.length<14||title.length>200||!publishedAt||
      seen.has(url)||Date.parse(publishedAt)<now-ageDays*86400000||
      Date.parse(publishedAt)>now+86400000)return;
    seen.add(url);
    output.push(Object.freeze({title,url,publishedAt,
      dedupeKey:createHash('sha256').update(url).digest('hex'),
      discoveryHint:TITLE_HINT.test(title)}));
  });
  return output.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||
    a.url.localeCompare(b.url));
}
async function publicListing(section,page,fetchImpl){
  const u=archivePageUrl(section,page);
  const response=await fetchImpl(u,{method:'GET',
    headers:{Accept:'text/html','User-Agent':'IERC-RN-Official-EBC-Archive/0.1'},
    redirect:'manual',signal:AbortSignal.timeout(12000)});
  if([301,302,303,307,308].includes(response.status))
    throw new Error('archive_unexpected_redirect');
  if(!response.ok)throw new Error('archive_http_error');
  if(!/text\/html/i.test(response.headers.get('content-type')||''))
    throw new Error('archive_invalid_html');
  if(Number(response.headers.get('content-length')||0)>MAX_HTML)
    throw new Error('archive_too_large');
  const body=await response.text();
  if(body.length>MAX_HTML)throw new Error('archive_too_large');
  return body;
}
/** Manual, bounded diagnostic; all outbound GETs spaced by >=10 seconds.
 * No article blocks ever reach logs, files, CMS, or provider prompts. */
export async function inspectEbcArchive({section='educacao',pages=2,
  maxEvidence=2,now=Date.now(),fetchImpl=fetch,sleepImpl=ms=>new Promise(r=>setTimeout(r,ms)),
  articleReader=fetchArticleEvidence,log=e=>console.log(JSON.stringify(e))}={}){
  const source=archiveSource(section);
  if(!Number.isInteger(pages)||pages<1||pages>2||
    !Number.isInteger(maxEvidence)||maxEvidence<0||maxEvidence>2)
    throw new Error('Archive diagnostic limits exceeded');
  const events=[],items=new Map();
  let requests=0;
  const pacedFetch=async(url,options)=>{
    // Avoid reusing this helper for arbitrary URLs, including CMS/private IPs.
    const allowed=url===archivePageUrl(section,0)||url===archivePageUrl(section,1)||
      (typeof url==='string'&&officialLink(url,section)===url);
    if(!allowed)throw new Error('Blocked archive request URL');
    if(requests>0)await sleepImpl(MIN_DELAY_MS);
    requests++;
    return fetchImpl(url,options);
  };
  for(let page=0;page<pages;page++){
    try{
      const html=await publicListing(section,page,pacedFetch);
      const entries=parseEbcArchive(html,{section,now});
      for(const entry of entries)if(!items.has(entry.url))items.set(entry.url,entry);
      const event={event:'ebc_archive_page_checked',section,page,
        datedEntries:entries.length,titleHints:entries.filter(x=>x.discoveryHint).length};
      events.push(event);log(event);
    }catch(error){
      const event={event:'ebc_archive_page_unavailable',section,page,
        reason:safeReason(error)};
      events.push(event);log(event);
    }
  }
  const candidates=[...items.values()].filter(x=>x.discoveryHint)
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
  let evidenceChecked=0,visualVerified=0;
  for(const item of candidates.slice(0,maxEvidence)){
    let event;
    try{
      const evidence=await articleReader(source,item,{fetchImpl:pacedFetch});
      if(evidence?.verified!==true||evidence?.mode!=='full_article'||
        evidence.sourceUrl!==item.url||
        evidence.licenseReference!==source.fullTextAccess.reference)
        throw new Error('Invalid full article evidence');
      const text=evidence.blocks.map(x=>x.text).join(' ');
      // A discovery headline cannot qualify as verified full-text evidence.
      // Require explicit visual anchors in extracted body paragraphs alone.
      const assessment=relevanceAssessment({title:'',summary:text},source);
      const visual=assessment.editorialFocus==='visual_direta'&&
        assessment.relevant===true;
      if(visual)visualVerified++;
      event={event:'ebc_archive_candidate_checked',section,
        title:item.title,url:item.url,publishedAt:item.publishedAt,
        status:visual?'visual_evidence_verified_for_review':'visual_evidence_not_found',
        // "verified" means extraction+per-article rights gate, NOT publication approval.
        rightsCheck:'source_article_verified',visualEvidence:visual};
    }catch(error){
      event={event:'ebc_archive_candidate_checked',section,
        title:item.title,url:item.url,publishedAt:item.publishedAt,
        status:'article_evidence_unavailable',rightsCheck:'not_verified',
        reason:sanitizeArticleEvidenceError(error)};
    }
    evidenceChecked++;events.push(event);log(event);
  }
  const completed={event:'ebc_archive_completed',section,
    readOnly:true,cmsWrites:false,aiUsed:false,published:false,
    pagesChecked:events.filter(e=>e.event==='ebc_archive_page_checked').length,
    uniqueDatedItems:items.size,titleHints:candidates.length,
    evidenceChecked,visualVerified,requests};
  log(completed);
  return {events,completed};
}

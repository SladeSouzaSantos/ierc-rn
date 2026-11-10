import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';

// Only curated, public RSS/Atom endpoints. Never crawl arbitrary article URLs.
export const EBC_REUSE_POLICY=Object.freeze({
  status:'approved',basis:'published-reproduction-policy',
  reference:'https://agenciabrasil.ebc.com.br/sobre',
  authorizationDetails:'https://www.gov.br/pt-br/servicos/acessar-noticias-em-tempo-real-gratuitamente?id=5351&origem=servico',
  verifiedDate:'2026-11-10',usage:'journalistic-noncommercial',
});
// Published Agência Brasil RSS feed categories; the full-text reader still
// rejects partner agencies/Reuters, rights warnings and missing EBC bylines.
const EBC=(id,section)=>Object.freeze({
  id,section,mode:'rss',name:'Agência Brasil (EBC)',
  country:'Brasil',language:'pt-BR',hostname:'agenciabrasil.ebc.com.br',
  feed:'https://agenciabrasil.ebc.com.br/rss/'+section+'/feed.xml',
  previewOnly:false,readiness:'feed_official_endpoint_runtime_validation_pending',
  fullTextAccess:EBC_REUSE_POLICY,
});
export const SOURCES = Object.freeze([
  EBC('agencia-brasil-direitos','direitos-humanos'),
  EBC('agencia-brasil-educacao','educacao'),
  EBC('agencia-brasil-esportes','esportes'),
  EBC('agencia-brasil-internacional','internacional'),
  {id:'w3c-wai',mode:'rss',name:'W3C Web Accessibility Initiative',
   country:'Internacional',language:'en',feed:'https://www.w3.org/WAI/feed.xml',
   hostname:'www.w3.org',previewOnly:false,readiness:'feed_verified'},
  {id:'perkins',mode:'rss',name:'Perkins School for the Blind',
   country:'Estados Unidos',language:'en',feed:'https://www.perkins.org/feed/',
   hostname:'www.perkins.org',previewOnly:false,readiness:'feed_verified'},
  // Explicitly preview-only: RNIB terms prohibit republication without written consent.
  {id:'rnib',mode:'html',name:'RNIB — Royal National Institute of Blind People',
   country:'Reino Unido',language:'en',feed:'https://www.rnib.org.uk/news/',
   hostname:'www.rnib.org.uk',articlePath:'/news/',previewOnly:true,
   readiness:'listing_verified_reuse_permission_pending'},
  // Public listing has titles/dates but no verified synopsis suitable for AI publication.
  {id:'ibsa',mode:'html',name:'IBSA — International Blind Sports Federation',
   country:'Internacional',language:'en',feed:'https://ibsasport.org/news/',
   hostname:'ibsasport.org',articlePath:'/news/',previewOnly:true,
   readiness:'listing_verified_summary_pending'},
  // Genuine RSS 200 confirmed, currently zero <item> entries.
  {id:'wbu',mode:'rss',name:'World Blind Union',
   country:'Internacional',language:'en',feed:'https://wbu.ngo/feed/',
   hostname:'wbu.ngo',previewOnly:true,readiness:'feed_verified_empty'},
]);
const xml = new XMLParser({ignoreAttributes:false, attributeNamePrefix:'@_',textNodeName:'#text',processEntities:true});
const asText=(value)=>typeof value==='string'?value:
  value && typeof value==='object' ? String(value['#text']||''):'';
export function plain(value,max=1000) {
  return String(value||'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|#160);/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,max);
}
export function canonicalLink(raw,source) {
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.hostname!==source.hostname)return null;
    url.hash='';
    for(const key of [...url.searchParams.keys()])
      if(/^utm_|^fbclid$|^gclid$|^ref$/i.test(key))url.searchParams.delete(key);
    url.pathname=url.pathname.replace(/\/+$/,'')||'/';
    return url.toString();
  }catch{return null;}
}
function feedLink(value) {
  if(typeof value==='string')return value;
  if(Array.isArray(value)){
    const item=value.find(x=>x?.['@_rel']==='alternate')||value.find(x=>x?.['@_href']);
    return item?.['@_href']||asText(item)||'';
  }
  return value?.['@_href']||asText(value)||'';
}
export function parseFeed(body,source,now=Date.now(),ageDays=45) {
  if(typeof body!=='string'||body.length>700000)throw new Error('Feed too large');
  const doc=xml.parse(body);
  if(!doc?.rss?.channel && !doc?.feed) throw new Error('Invalid RSS/Atom document');
  const rss=doc?.rss?.channel?.item;
  const atom=doc?.feed?.entry;
  const entries=Array.isArray(rss)?rss:Array.isArray(atom)?atom:rss?[rss]:atom?[atom]:[];
  const oldest=now-ageDays*86400000;
  const accepted=[];
  for(const item of entries.slice(0,45)){
    const title=plain(asText(item.title),200);
    const href=canonicalLink(feedLink(item.link),source);
    const published=Date.parse(asText(item.pubDate)||asText(item.published)||asText(item.updated)||'');
    if(!title||!href||!Number.isFinite(published)||published<oldest||published>now+86400000)continue;
    const summary=plain(asText(item.description)||asText(item.summary)||asText(item.content),900);
    if(!summary)continue;
    accepted.push({title,url:href,summary,publishedAt:new Date(published).toISOString(),
      source:source.name,country:source.country,language:source.language,
      dedupeKey:createHash('sha256').update(href).digest('hex')});
  }
  return accepted;
}
// Backward-compatible lexical check; scoring and editorial ranking live in relevance.mjs.
export { relevanceAssessment, rankArticles } from './relevance.mjs';
import { relevanceAssessment } from './relevance.mjs';
export function relevant(item){return relevanceAssessment(item).relevant;}
// Allow at most one HTTPS redirect preserving the approved host and feed path.
const feedPath = url => url.pathname.replace(/\/+$/, '') || '/';
export async function fetchSource(source, fetchImpl=fetch) {
  const isHtml = source.mode === 'html';
  if (isHtml && source.previewOnly !== true)
    throw new Error('HTML listings require explicit preview-only policy');
  const limit = isHtml ? 1300000 : 700000;
  const approved = new URL(source.feed);
  if (approved.protocol !== 'https:' || approved.hostname !== source.hostname ||
      approved.username || approved.password || approved.port)
    throw new Error('Invalid source configuration');
  let requestUrl=approved.toString();
  let response;
  for (let hop=0; hop<2; hop++) {
    response=await fetchImpl(requestUrl,{
      method:'GET',headers:{
        Accept:isHtml?'text/html':'application/atom+xml, application/rss+xml, application/xml, text/xml',
        'User-Agent':'IERC-RN-Editorial-Curator/0.1',
      },redirect:'manual',signal:AbortSignal.timeout(12000),
    });
    if(![301,302,303,307,308].includes(response.status)) break;
    if(hop>0) throw new Error('Unsafe source redirect');
    const location=response.headers.get('location');
    if(!location) throw new Error('Unsafe source redirect');
    let next;
    try {next=new URL(location,requestUrl);} catch {throw new Error('Unsafe source redirect');}
    if(next.protocol!=='https:' || next.hostname!==source.hostname ||
       next.username || next.password || next.port ||
       feedPath(next)!==feedPath(approved) ||
       next.search!==approved.search || next.hash)
      throw new Error('Unsafe source redirect');
    requestUrl=next.toString();
  }
  if(!response.ok)throw new Error('Source HTTP '+response.status);
  if(Number(response.headers.get('content-length')||0)>limit)
    throw new Error('Source exceeds size limit');
  const body=await response.text();
  if(body.length>limit)throw new Error('Source exceeds size limit');
  return body;
}

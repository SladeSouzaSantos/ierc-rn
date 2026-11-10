import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';

// Only curated, public RSS/Atom endpoints. Never crawl arbitrary article URLs.
export const SOURCES = Object.freeze([
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
export async function fetchSource(source, fetchImpl = fetch) {
  const isHtml = source.mode === 'html';
  if (isHtml && source.previewOnly !== true)
    throw new Error('HTML listings require explicit preview-only policy');
  const limit = isHtml ? 1300000 : 700000;
  const response = await fetchImpl(source.feed, {
    method: 'GET',
    headers: {
      Accept: isHtml ? 'text/html' :
        'application/atom+xml, application/rss+xml, application/xml, text/xml',
      'User-Agent': 'IERC-RN-Editorial-Curator/0.1',
    },
    redirect: 'error', signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Source HTTP ' + response.status);
  if (Number(response.headers.get('content-length') || 0) > limit)
    throw new Error('Source exceeds size limit');
  const body = await response.text();
  if (body.length > limit) throw new Error('Source exceeds size limit');
  return body;
}

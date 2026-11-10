import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';

// Only curated, public RSS/Atom endpoints. Never crawl arbitrary article URLs.
export const SOURCES = Object.freeze([
  {id:'w3c-wai',name:'W3C Web Accessibility Initiative',country:'Internacional',
   language:'en',feed:'https://www.w3.org/WAI/feed.xml',hostname:'www.w3.org'},
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
const topics=/\b(accessib(?:le|ility)|braille|blind(?:ness)?|low vision|visual impairment|screen reader|assistive technology|disabilit(?:y|ies)|inclusi(?:on|ve)|goalball|visually impaired|tactile)\b/i;
export function relevant(item){return topics.test(item.title+' '+item.summary);}
export async function fetchSource(source,fetchImpl=fetch){
  const response=await fetchImpl(source.feed,{method:'GET',
    headers:{Accept:'application/atom+xml, application/rss+xml, application/xml, text/xml',
      'User-Agent':'IERC-RN-Editorial-Curator/0.1'},
    redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Feed HTTP '+response.status);
  if(Number(response.headers.get('content-length')||0)>700000)throw new Error('Feed too large');
  return response.text();
}

/**
 * Manual, read-only Agência Brasil RSS readiness check.
 * No Strapi, Redis, LLM, credential, article-body fetch or state mutation.
 * An RSS match is not proof of per-article rights or permission to publish.
 */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SOURCES,fetchSource,parseFeed} from './feeds.mjs';
import {rankArticles} from './relevance.mjs';
import {AUTO_PUBLISH_LICENSED_SOURCES} from './auto-config.mjs';

export const EBC_DISCOVERY_SECTIONS=Object.freeze({
  'agencia-brasil-direitos':'direitos-humanos',
  'agencia-brasil-educacao':'educacao',
  'agencia-brasil-esportes':'esportes',
  'agencia-brasil-internacional':'internacional',
  'agencia-brasil-justica':'justica',
  'agencia-brasil-politica':'politica',
  'agencia-brasil-saude':'saude',
  'agencia-brasil-geral':'geral',
});
const safeReason=error=>{
  const message=String(error?.message||'');
  return /^Source HTTP \d{3}$/.test(message)?'http_error':
    message==='Unsafe source redirect'?'redirect_blocked':
    message==='Invalid RSS/Atom document'?'invalid_feed':
    message==='Source exceeds size limit'?'size_limit':
    error?.name==='TimeoutError'?'timeout':'network_or_parser_error';
};

export async function scanEbcReadiness({catalog=SOURCES,fetchImpl=fetch,
  now=Date.now(),log=event=>console.log(JSON.stringify(event))}={}){
  if(!Number.isFinite(now))throw new Error('Invalid scan date');
  const events=[];
  for(const [id,section] of Object.entries(EBC_DISCOVERY_SECTIONS)){
    const source=catalog.find(s=>s.id===id);
    if(!source||source.hostname!=='agenciabrasil.ebc.com.br'||
      source.mode!=='rss'||source.section!==section||
      source.feed!=='https://agenciabrasil.ebc.com.br/rss/'+section+'/feed.xml')
      throw new Error('EBC discovery catalog is not the approved RSS catalog');
    const candidateForRightsCheck=!source.previewOnly&&!source.paused&&
      AUTO_PUBLISH_LICENSED_SOURCES.includes(id)&&
      source.fullTextAccess?.status==='approved';
    const policy=candidateForRightsCheck?'requires_article_rights_check':'discovery_only';
    if(source.paused){
      const event={event:'ebc_source_paused',source:id,policy,reason:'source_paused'};
      events.push(event);log(event);continue;
    }
    try{
      const xml=await fetchSource(source,fetchImpl);
      const inYear=parseFeed(xml,source,now,365);
      const recent=parseFeed(xml,source,now,45);
      const candidates=rankArticles(recent,source);
      // Only link/title/date metadata. The full article is NEVER fetched here.
      const event={event:'ebc_source_checked',source:id,policy,
        previewOnly:source.previewOnly===true,
        itemsLastYear:inYear.length,itemsLast45Days:recent.length,
        relevant:candidates.length,
        visualDirect:candidates.filter(x=>x.relevance.editorialFocus==='visual_direta').length,
        candidateLinks:candidates.slice(0,3).map(x=>({
          title:x.title,url:x.url,publishedAt:x.publishedAt,
          editorialFocus:x.relevance.editorialFocus,
        })),
      };
      events.push(event);log(event);
    }catch(error){
      const event={event:'ebc_source_unavailable',source:id,policy,
        reason:safeReason(error)};
      events.push(event);log(event);
    }
  }
  const completed={event:'ebc_readiness_completed',readOnly:true,
    cmsWrites:false,aiUsed:false,published:false,
    checked:events.filter(x=>x.event==='ebc_source_checked').length,
    unavailable:events.filter(x=>x.event==='ebc_source_unavailable').length,
    paused:events.filter(x=>x.event==='ebc_source_paused').length,
    relevant:events.reduce((n,x)=>n+(x.relevant||0),0),
    potentialRightsChecks:events.reduce((n,x)=>
      n+(x.policy==='requires_article_rights_check'?(x.relevant||0):0),0)};
  log(completed);
  return {events,completed};
}

// Importing this module in tests does not perform network calls.
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
  await scanEbcReadiness();

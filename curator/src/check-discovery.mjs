/**
 * Operator-only read-only feed smoke. No CMS, Redis, keys, LLM or persistence.
 * Run via the isolated monitor Docker service; never elevate source rights.
 */
import {SOURCES,fetchSource,parseFeed} from './feeds.mjs';
import {parseListing} from './listings.mjs';
import {rankArticles} from './relevance.mjs';

const DEFAULT_IDS=Object.freeze([
  'diario-pcd','jornalista-inclusivo','fundacao-dorina',
  'ebu','iapb','rnib',
]);
const ids=process.argv.slice(2).length?process.argv.slice(2):DEFAULT_IDS;
if(ids.some(id=>!DEFAULT_IDS.includes(id))||new Set(ids).size!==ids.length)
  throw new Error('Only listed preview-only discovery sources may be checked');
for(const id of ids){
  const source=SOURCES.find(s=>s.id===id);
  if(!source||source.previewOnly!==true||source.fullTextAccess)
    throw new Error('Discovery smoke requires an unlicensed preview-only source');
  try{
    const body=await fetchSource(source);
    const parse=source.mode==='html'?parseListing:parseFeed;
    const now=Date.now();
    const withinWindow=parse(body,source,now,45);
    const withinYear=parse(body,source,now,365);
    const relevant=rankArticles(withinWindow,source);
    // No copied excerpts, article bodies, credentials, or CMS access.
    console.log(JSON.stringify({event:'discovery_source_checked',source:id,
      previewOnly:true,mode:source.mode,withinYear:withinYear.length,
      recent:withinWindow.length,relevant:relevant.length,
      newest:withinWindow.map(x=>x.publishedAt).sort().at(-1)||null,
      topRelevant:relevant.slice(0,3).map(({title,url,publishedAt})=>({title,url,publishedAt}))}));
  }catch(error){
    const message=String(error?.message||'');
    const reason=/^Source HTTP [0-9]{3}$/.test(message)?'http_error':
      message==='Unsafe source redirect'?'redirect_blocked':
      message==='Invalid RSS/Atom document'?'invalid_feed':
      message==='Source exceeds size limit'?'size_limit':
      error?.name==='TimeoutError'?'timeout':'network_or_parser_error';
    console.log(JSON.stringify({event:'discovery_source_unavailable',source:id,reason}));
  }
}

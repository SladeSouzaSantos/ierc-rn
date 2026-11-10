import { SOURCES,parseFeed,relevant,fetchSource } from './feeds.mjs';
import {processArticle} from './editorial.mjs';

export async function runOnce({sources=SOURCES,fetchImpl=fetch,router,store,cms,
  now=Date.now(),maxArticles=3,dryRun=true,logger=()=>{}}) {
  const results=[];
  let remaining=maxArticles;
  for(const source of sources) {
    let articles;
    try {
      articles=parseFeed(await fetchSource(source,fetchImpl),source,now).filter(relevant);
      logger({event:'feed_checked',source:source.id,candidates:articles.length});
    } catch {
      logger({event:'feed_unavailable',source:source.id});
      continue;
    }
    for(const article of articles) {
      if(remaining<=0)break;
      const result=await processArticle(article,{router,store,cms,dryRun,logger});
      results.push({source:source.id,status:result.status,
        ...(dryRun?{title:result.article}:{})});
      if(!['seen','already_in_cms','locked'].includes(result.status))remaining--;
    }
  }
  return {results,preview:dryRun,count:results.length};
}

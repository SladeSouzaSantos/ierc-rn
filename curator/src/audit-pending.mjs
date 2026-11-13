import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {cmsPublisher} from './cms-publish.mjs';
import {encryptedEditorialProgressStore} from './editorial-progress.mjs';
import {auditPendingDraft} from './editorial-audit.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';

// Private, one-off terminal command. No LLM is instantiated and no
// write-capable method (CMS or Redis) is ever invoked by this audit.
async function main(){
  const env=process.env;
  const documentId=process.argv[2],flag=process.argv[3];
  if(env.CURATOR_INSTANCE_KIND!=='dev'||!env.CURATOR_EDITORIAL_PROGRESS_KEY||
     !/^[a-zA-Z0-9]{12,90}$/.test(documentId||'')||
     process.argv.length>4||
     (flag!==undefined&&flag!=='--include-draft'))
    throw new Error('DEV audit requires a single documentId and optional --include-draft');
  const allowedSources=(env.CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES||'')
    .split(',').map(x=>x.trim()).filter(Boolean);
  if(allowedSources.length===0||
     allowedSources.some(x=>!x.startsWith('agencia-brasil-')))
    throw new Error('DEV audit requires explicit licensed EBC allowlist');
  const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL||'redis://redis:6379');
  try{
    const publisher=cmsPublisher({
      baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
      token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
      draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
    });
    const progressStore=encryptedEditorialProgressStore({
      redis,secret:env.CURATOR_EDITORIAL_PROGRESS_KEY,instanceKind:'dev',
    });
    const report=await auditPendingDraft({
      documentId,publisher,progressStore,allowedSources,
      articleReader:(source,article)=>fetchArticleEvidence(source,article,{
        fetchImpl:createPacedEbcFetch(fetch),
      }),
      includeDraft:flag==='--include-draft',
    });
    console.log(JSON.stringify(report,null,2));
  }finally{
    await closeQuotaRedis(redis);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    // No URLs, tokens, Redis values, article content or LLM outputs on failure.
    const allow=[
      'DEV audit requires a single documentId and optional --include-draft',
      'DEV audit requires explicit licensed EBC allowlist',
      'DEV read-only audit prerequisites missing',
      'Article is already published',
      'Draft is not an unchanged AI-review-pending candidate',
      'Pending article fails licensed-source or recency checks',
      'Pending Draft editorial integrity failed',
      'Current complete licensed evidence unavailable',
      'Private editorial progress integrity failed',
    ];
    const message=allow.includes(error?.message)?error.message:
      'Audit failed: check DEV CMS Reader, source evidence and Redis connectivity';
    console.error('EDITORIAL_AUDIT_DENIED: '+message);
    process.exitCode=1;
  });
}

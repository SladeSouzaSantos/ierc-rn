import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cmsPublisher} from './cms-publish.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {settingsFromEnv} from './providers.mjs';
import {FreeLlmRouter} from './router.mjs';
import {prodSyntheticDiagnosticPolicy} from './diagnose-review-schema-prod.mjs';
import {runEnemAiProd} from './enem-ai-prod.mjs';
import {safeEnemProdDenial} from './publish-enem-ai-prod.mjs';

// One LIVE review of the original licensed EBC source, but ZERO CMS writes,
// no repair, no publication, and no access to the publication one-shot key.
// Only Groq may be selected so the previous terminal event is reproducible.
// A separate one-shot probe key prevents repeated decision shopping.
async function main(){
  if(process.argv.length!==2)
    throw new Error('This diagnostic accepts no document IDs or flags');
  const env=process.env;
  const providers=prodSyntheticDiagnosticPolicy(env,'groq');
  const publisher=cmsPublisher({
    baseUrl:env.CURATOR_CMS_URL,token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
    draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
  });
  const articleReader=(source,article)=>fetchArticleEvidence(source,article,{
    fetchImpl:createPacedEbcFetch(fetch),
  });
  const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL);
  try{
    const router=new FreeLlmRouter({
      providers,state:new RedisQuotaState(redis,settingsFromEnv(env)),
      settings:{...settingsFromEnv(env),maxAttempts:1},
      logger:event=>console.log(JSON.stringify(event)),
    });
    const result=await runEnemAiProd({
      mode:'probe',publisher,articleReader,router,redis,
      allowedSources:['agencia-brasil-educacao'],
      logger:event=>console.log(JSON.stringify(event)),
    });
    console.log(JSON.stringify(result));
  }finally{
    await closeQuotaRedis(redis);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    // Static codes only; never print private CMS source fields, provider
    // body, token, or stack. This command cannot publish.
    console.error('ENEM_PROD_REVIEW_PROBE_DENIED: '+safeEnemProdDenial(error));
    process.exitCode=1;
  });
}

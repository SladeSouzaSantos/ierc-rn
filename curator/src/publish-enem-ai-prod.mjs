import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {routerFromEnv} from './router.mjs';
import {cmsPublisher} from './cms-publish.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';
import {autoPublishSettingsFromEnv} from './auto-config.mjs';
import {runEnemAiProd} from './enem-ai-prod.mjs';

async function main(){
  const env=process.env;
  const mode=process.argv[2];
  if(!['preview','publish'].includes(mode)||process.argv.length!==3)
    throw new Error('Use only preview or publish; target PROD ENEM ID is fixed');
  if(env.CURATOR_INSTANCE_KIND!=='prod'||
     env.CURATOR_ENABLED!=='true'||env.CURATOR_WRITE_DRAFTS!=='true'||
     env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED'||
     env.CURATOR_CMS_URL!=='http://cms:1337'||
     env.CURATOR_REDIS_URL!=='redis://redis:6379')
    throw new Error('Dedicated acknowledged PROD environment required');
  const policy=autoPublishSettingsFromEnv(env,'once',{dryRun:false});
  if(!policy.autoPublish||!policy.allowedSources.includes('agencia-brasil-educacao')||
     env.CURATOR_ONCE_LIMIT!=='1')
    throw new Error('Explicit one-item licensed EBC PROD AI approval required');

  const publisher=cmsPublisher({
    baseUrl:env.CURATOR_CMS_URL,token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
    draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
  });
  const reader=(source,article)=>fetchArticleEvidence(source,article,{
    fetchImpl:createPacedEbcFetch(fetch),
  });
  const logger=event=>console.log(JSON.stringify({
    ts:new Date().toISOString(),...event,
  }));
  let redis=null;
  try{
    if(mode==='publish')
      redis=await connectQuotaRedis(env.CURATOR_REDIS_URL);
    const router=redis?routerFromEnv({
      env,state:new RedisQuotaState(redis,(await import('./providers.mjs')).settingsFromEnv(env)),
      logger,
    }):null;
    const result=await runEnemAiProd({
      mode,publisher,router,redis,articleReader:reader,
      allowedSources:policy.allowedSources,logger,
    });
    console.log(JSON.stringify(result));
  }finally{
    if(redis)await closeQuotaRedis(redis);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{
    // Do not disclose CMS response bodies, private Draft or provider content.
    console.error('ENEM_PROD_AI_DENIED: check confirmed PROD policy, article evidence, one-shot journal, editorial status and quotas');
    process.exitCode=1;
  });
}

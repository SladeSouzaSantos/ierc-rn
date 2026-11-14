import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {providersFromEnv,settingsFromEnv} from './providers.mjs';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {runSyntheticReviewDiagnostic} from './diagnose-review-schema.mjs';
import {autoPublishSettingsFromEnv} from './auto-config.mjs';

// One synthetic, nonpublishing review-contract call. Does not import CMS clients,
// read articles, touch the one-shot Enem marker or change scheduler slots.
// It DOES consume one normal free-provider quota reservation in PROD Redis.
export function prodSyntheticDiagnosticPolicy(env,provider){
  if(!['groq','gemini','openrouter'].includes(provider))
    throw new Error('Expected one explicitly selected free provider');
  if(env.CURATOR_INSTANCE_KIND!=='prod'||
     env.CURATOR_ENABLED!=='true'||env.CURATOR_WRITE_DRAFTS!=='true'||
     env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED'||
     env.CURATOR_CMS_URL!=='http://cms:1337'||
     env.CURATOR_REDIS_URL!=='redis://redis:6379')
    throw new Error('Dedicated PROD environment required for synthetic diagnostic');
  const {autoPublish,allowedSources}=autoPublishSettingsFromEnv(env,'once',
    {dryRun:false});
  if(!autoPublish||!allowedSources.includes('agencia-brasil-educacao')||
     env.CURATOR_ONCE_LIMIT!=='1')
    throw new Error('Dedicated licensed PROD editorial policy required');
  const configured=providersFromEnv(env);
  const selected=configured.filter(p=>p.id===provider);
  if(selected.length!==1)
    throw new Error('Selected provider is unavailable under PROD free-tier settings');
  return selected;
}

async function main(){
  const provider=process.argv[2];
  if(process.argv.length!==3)throw new Error('Expected one provider');
  const env=process.env;
  const providers=prodSyntheticDiagnosticPolicy(env,provider);
  const settings=settingsFromEnv(env);
  const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL);
  try{
    const state=new RedisQuotaState(redis,settings);
    const report=await runSyntheticReviewDiagnostic({
      providers,state,settings,logger:entry=>
        console.log(JSON.stringify(entry)),
    });
    console.log(JSON.stringify({
      event:'prod_review_schema_diagnostic_completed',
      synthetic:true,provider,attempts:report.length,cmsWrites:0,
      articleReads:0,publicationAttempts:0,
    }));
  }finally{
    await closeQuotaRedis(redis);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(()=>{
    console.error('PROD_SYNTHETIC_DIAGNOSTIC_UNAVAILABLE: verify authorized free provider and Redis');
    process.exitCode=1;
  });
}

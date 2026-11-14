import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {cmsPublisher} from './cms-publish.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {providersFromEnv,settingsFromEnv} from './providers.mjs';
import {FreeLlmRouter} from './router.mjs';
import {autoPublishSettingsFromEnv} from './auto-config.mjs';
import {
  runEnemAiProd,enemRecoveryKeys,ENEM_PROD_DOCUMENT_ID,
} from './enem-ai-prod.mjs';
import {safeEnemProdDenial} from './publish-enem-ai-prod.mjs';

// A narrowly scoped technical recovery for a documented pre-review
// outage (Groq local quota reached). It does NOT forgive reviewer HOLDS.
// Never reset or delete the previous immutable publication/probe markers.
export function recoveryProvidersFromEnv(env){
  if(env.CURATOR_INSTANCE_KIND!=='prod'||
     env.CURATOR_ENABLED!=='true'||
     env.CURATOR_WRITE_DRAFTS!=='true'||
     env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED'||
     env.CURATOR_CMS_URL!=='http://cms:1337'||
     env.CURATOR_REDIS_URL!=='redis://redis:6379'||
     env.CURATOR_ONCE_LIMIT!=='1')
    throw new Error('Dedicated acknowledged PROD environment required');
  const policy=autoPublishSettingsFromEnv(env,'once',{dryRun:false});
  if(!policy.autoPublish||!policy.allowedSources.includes('agencia-brasil-educacao'))
    throw new Error('Explicit one-item licensed EBC PROD AI approval required');
  const all=providersFromEnv(env);
  const selected=all.filter(provider=>
    provider.id==='gemini'||provider.id==='openrouter');
  if(selected.length!==2||selected[0].id!=='gemini'||
     selected[1].id!=='openrouter')
    throw new Error('ENEM PROD technical recovery requires two free-tier providers');
  return {providers:selected,allowedSources:policy.allowedSources};
}

function safeTtl(ms){
  if(ms===-2)return 0;
  if(!Number.isSafeInteger(ms)||ms<0||ms>2678400000)
    throw new Error('ENEM PROD technical recovery quota metadata invalid');
  return ms;
}

// Read-only Redis quota inspection: never reserve calls in a dry check.
// Publication reserves quotas through the existing atomic RedisQuotaState.
export async function checkEnemRecoveryCapacity(redis,settings,providers,keys){
  if(typeof redis?.get!=='function'||typeof redis?.pttl!=='function'||
     !Array.isArray(providers)||providers.length!==2||
     providers[0]?.id!=='gemini'||providers[1]?.id!=='openrouter')
    throw new Error('ENEM PROD technical recovery quota prerequisites missing');

  const [original,probe,recovery]=await Promise.all([
    redis.get(keys.previous),redis.get(keys.diagnostic),
    redis.get(keys.recovery),
  ]);
  const historicalClaimsValid=original==='claimed'&&probe==='claimed';
  const recoveryUnused=recovery===null;
  const globalUsed=Number((await redis.get('ierc:curator:llm:global'))??0);
  if(!Number.isSafeInteger(globalUsed)||globalUsed<0)
    throw new Error('ENEM PROD technical recovery quota metadata invalid');

  const providerState=[];
  for(const p of providers){
    const base='ierc:curator:llm:'+p.id;
    const [rawUsed,shared,phase]=await Promise.all([
      redis.get(base),
      redis.pttl(base+':cooldown'),
      redis.pttl(base+'_review:cooldown'),
    ]);
    const used=Number(rawUsed??0);
    if(!Number.isSafeInteger(used)||used<0)
      throw new Error('ENEM PROD technical recovery quota metadata invalid');
    providerState.push({
      provider:p.id,remaining:Math.max(0,p.maxCalls-used),
      cooldownActive:safeTtl(shared)>0||safeTtl(phase)>0,
    });
  }
  const globalRemaining=Math.max(0,settings.globalMax-globalUsed);
  const canRecover=historicalClaimsValid&&recoveryUnused&&globalRemaining>0&&
    providerState.some(p=>p.remaining>0&&!p.cooldownActive);
  return {
    status:'enem_prod_recovery_check',
    documentIdHash:'400257654ced',
    historicalClaimsValid,recoveryUnused,canRecover,
    globalRemaining,
    providerAvailability:providerState,
    cmsWrites:0,llmCalls:0,
  };
}

async function main(){
  const mode=process.argv[2];
  if(!['check','publish'].includes(mode)||process.argv.length!==3)
    throw new Error('Exactly one recovery check or publish mode is required');
  const env=process.env;
  const {providers,allowedSources}=recoveryProvidersFromEnv(env);
  const settings=settingsFromEnv(env);
  const publisher=cmsPublisher({
    baseUrl:env.CURATOR_CMS_URL,
    token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
    draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
  });
  const articleReader=(source,article)=>fetchArticleEvidence(source,article,{
    fetchImpl:createPacedEbcFetch(fetch),
  });
  const logger=event=>console.log(JSON.stringify({
    ts:new Date().toISOString(),...event,
  }));
  const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL);
  try{
    const preview=await runEnemAiProd({
      mode:'preview',publisher,articleReader,allowedSources,
    });
    const keys=enemRecoveryKeys(ENEM_PROD_DOCUMENT_ID,
      preview.proposalDigest,preview.evidenceDigest);
    const check=await checkEnemRecoveryCapacity(redis,settings,providers,keys);
    if(mode==='check'){
      console.log(JSON.stringify(check));
      return;
    }
    if(!check.canRecover)
      throw new Error('ENEM PROD technical recovery is not eligible');
    // Explicit, single operator action. No Groq is included. All billing,
    // cooldowns and per-provider caps remain unchanged.
    const router=new FreeLlmRouter({
      providers,state:new RedisQuotaState(redis,settings),settings,logger,
    });
    const result=await runEnemAiProd({
      mode:'recover',publisher,router,redis,articleReader,
      allowedSources,logger,
    });
    console.log(JSON.stringify(result));
  }finally{
    await closeQuotaRedis(redis);
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    // Neither provider responses nor private CMS/news data leave this gate.
    const staticReason=error?.message==='ENEM PROD technical recovery is not eligible'
      ? 'recovery_not_eligible'
      :error?.message==='ENEM PROD technical recovery requires two free-tier providers'
        ? 'free_providers_not_configured'
        :error?.message==='ENEM PROD technical recovery source/proposal digest mismatch'
          ? 'recovery_digest_mismatch'
          :error?.message==='ENEM PROD technical recovery quota metadata invalid'
            ? 'quota_state_invalid'
            :safeEnemProdDenial(error);
    console.error('ENEM_PROD_RECOVERY_DENIED: '+staticReason);
    process.exitCode=1;
  });
}

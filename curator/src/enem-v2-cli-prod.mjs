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
import {encryptedProdEditorialAudit} from './editorial-audit-prod.mjs';
import {runEnemV2} from './enem-editorial-v2-prod.mjs';
import {safeEnemProdDenial} from './publish-enem-ai-prod.mjs';

export function enemV2ProdPolicy(env,mode){
  if(!['check','publish','inspect'].includes(mode)||
     env.CURATOR_INSTANCE_KIND!=='prod'||
     env.CURATOR_ENABLED!=='true'||
     env.CURATOR_WRITE_DRAFTS!=='true'||
     env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED'||
     env.CURATOR_CMS_URL!=='http://cms:1337'||
     env.CURATOR_REDIS_URL!=='redis://redis:6379'||
     env.CURATOR_ONCE_LIMIT!=='1')
    throw new Error('Dedicated acknowledged PROD environment required');
  const policy=autoPublishSettingsFromEnv(env,'once',{dryRun:false});
  if(!policy.autoPublish||
     !policy.allowedSources.includes('agencia-brasil-educacao'))
    throw new Error('Explicit one-item licensed EBC PROD AI approval required');
  if(mode==='inspect'&&
     env.CURATOR_PROD_AUDIT_INSPECT_ACK!=='PRINT_PRIVATE_EDITORIAL_NOTES')
    throw new Error('Private PROD editorial inspection requires explicit ACK');
  // A new, unrelated 256-bit audit key, NEVER a CMS or LLM API token.
  if(!/^[0-9a-fA-F]{64}$/.test(env.CURATOR_PROD_EDITORIAL_AUDIT_KEY||''))
    throw new Error('Dedicated PROD editorial audit key required');
  const all=providersFromEnv(env);
  const selected=all.filter(x=>
    ['groq','gemini','openrouter'].includes(x.id));
  if(selected.length!==3||
     selected.map(p=>p.id).join(',')!=='groq,gemini,openrouter')
    throw new Error('Exactly three confirmed free editorial models required');
  return selected;
}

async function main(){
  const mode=process.argv[2];
  if(process.argv.length!==3)
    throw new Error('Expected exactly check, publish or inspect');
  const env=process.env;
  const providers=enemV2ProdPolicy(env,mode);
  const settings=settingsFromEnv(env);
  const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL);
  try{
    const auditStore=encryptedProdEditorialAudit({
      redis,secret:env.CURATOR_PROD_EDITORIAL_AUDIT_KEY,instanceKind:'prod',
    });
    const logger=event=>console.log(JSON.stringify({
      ts:new Date().toISOString(),...event,
    }));
    if(mode==='inspect'){
      const record=await runEnemV2({mode,redis,auditStore});
      console.log(JSON.stringify(record===null?
        {status:'no_private_audit_record'}:
        {status:'private_editorial_audit',...record}));
      return;
    }
    const publisher=cmsPublisher({
      baseUrl:env.CURATOR_CMS_URL,
      token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
      draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
    });
    const articleReader=(source,article)=>fetchArticleEvidence(source,article,{
      fetchImpl:createPacedEbcFetch(fetch),
    });
    const router=mode==='publish'?new FreeLlmRouter({
      providers,state:new RedisQuotaState(redis,settings),settings,logger,
    }):null;
    const result=await runEnemV2({
      mode,publisher,articleReader,redis,providers,settings,
      router,auditStore,logger,
    });
    console.log(JSON.stringify(result));
  }finally{
    await closeQuotaRedis(redis);
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    const staticReasons=new Map([
      ['Dedicated PROD editorial audit key required','audit_key_missing'],
      ['Exactly three confirmed free editorial models required','free_models_missing'],
      ['Private PROD editorial inspection requires explicit ACK','inspect_ack_missing'],
      ['ENEM v2 new editorial publication is not authorized','v2_check_not_eligible'],
      ['ENEM v2 licensed evidence or original proposal changed','evidence_digest_mismatch'],
      ['ENEM v2 source evidence changed','source_digest_changed'],
      ['ENEM v2 prior editorial history missing','prior_journal_missing'],
      ['ENEM v2 reviewer contract mismatch','model_contract_mismatch'],
      ['PROD audit refuses non-production instance','audit_instance_mismatch'],
    ]);
    const reason=staticReasons.get(error?.message)||
      safeEnemProdDenial(error);
    console.error('ENEM_V2_PROD_DENIED: '+reason);
    process.exitCode=1;
  });
}

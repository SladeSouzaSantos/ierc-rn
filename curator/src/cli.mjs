import {connectQuotaRedis, closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {providersFromEnv,settingsFromEnv} from './providers.mjs';
import {FreeLlmRouter} from './router.mjs';
import {cmsClient} from './editorial.mjs';
import {cmsPublisher} from './cms-publish.mjs';
import {cmsNewsReadOnly,previewDeduper} from './duplicate-check.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {publishingPolicyForCommand} from './auto-config.mjs';
import {runOnce} from './pipeline.mjs';
import {retryPendingDraft} from './retry-pending.mjs';
import {scheduleDraftLimitFromEnv} from './schedule-config.mjs';
import {summarizeRunForLog} from './run-summary.mjs';

const cmd=process.argv[2];
if(!['preview','generate-preview','review-preview','review-full-preview','once','schedule','retry-pending'].includes(cmd)){
  console.error('Use: node src/cli.mjs preview|generate-preview|review-preview|review-full-preview|once|schedule|retry-pending <documentId>');
  process.exitCode=2;
}else{
  const env=process.env;
  if(!['preview','generate-preview','review-preview','review-full-preview'].includes(cmd)&&env.CURATOR_ENABLED!=='true') {
    console.log('Curator disabled. Enable explicitly only after environment-specific preflight.');
    process.exit(0);
  }
  if(!['dev','prod'].includes(env.CURATOR_INSTANCE_KIND))
    throw new Error('Curator must run with an explicit dev or prod instance kind');
  // PROD preview is read-only. Every write-capable mode requires the separate
  // production acknowledgment, checked before Redis, CMS or LLM I/O.
  const readOnlyCmd=['preview','generate-preview','review-preview','review-full-preview'].includes(cmd);
  if(env.CURATOR_INSTANCE_KIND==='prod'&&!readOnlyCmd&&
      env.CURATOR_WRITE_DRAFTS==='true'&&
      env.CURATOR_PROD_WRITE_ACK!=='PROD_WRITES_APPROVED')
    throw new Error('PROD draft writes require explicit local acknowledgment');
  const settings=settingsFromEnv(env);
  const log=(event)=>console.log(JSON.stringify({ts:new Date().toISOString(),...event}));
  // Explicit one-shot AI preview is independent of the write activation flags.
  // Even CURATOR_WRITE_DRAFTS=true must not grant write access to this mode.
  const aiPreview=cmd==='generate-preview'||cmd==='review-preview'||cmd==='review-full-preview';
  const reviewPreview=cmd==='review-preview'||cmd==='review-full-preview';
  const fullArticlePreview=cmd==='review-full-preview';
  const dryRun=cmd==='preview'||aiPreview||env.CURATOR_WRITE_DRAFTS!=='true';
  // Explicit retry uses the exact live ONCE publication policy, but never
  // creates a new article. Validate the ID and production scope before I/O.
  const retryPending=cmd==='retry-pending';
  if(retryPending && (env.CURATOR_INSTANCE_KIND!=='prod'||
      !/^[a-zA-Z0-9]{12,90}$/.test(process.argv[3]||'')||process.argv.length!==4))
    throw new Error('Pending recovery requires PROD and one explicit documentId');
  const publicationCmd=retryPending?'once':cmd;
  // Read-only previews must not be blocked by the independently authorized
  // live auto-publisher. Write commands still go through the strict gate.
  const {autoPublish,allowedSources,archiveDiscovery}=
    publishingPolicyForCommand(env,publicationCmd,{dryRun});
  if(retryPending&&!autoPublish)
    throw new Error('Pending recovery requires approved PROD autonomous publishing');
  // Wait for a fully ready Redis BEFORE using any quota-bearing operation.
  // No model calls are made if the connection cannot be established.
  const redis=cmd==='preview'?null:await connectQuotaRedis(
    env.CURATOR_REDIS_URL||'redis://redis:6379');
  try{
    const providers=dryRun&&!aiPreview?[]:providersFromEnv(env);
    if((!dryRun||aiPreview)&&!providers.length)throw new Error('At least one confirmed free provider is required');
    const quota=redis?new RedisQuotaState(redis,settings):null;
    const router=redis?new FreeLlmRouter({providers,state:quota,settings,logger:log}):null;
    const cms=!dryRun?cmsClient({baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
      token:env.CURATOR_STRAPI_DRAFT_TOKEN}):null;
    // Only review:preview sees the duplicate gate. Its CMS adapter exposes
    // GET-only methods; Redis is used here solely for EXISTS (LLM quota
    // metering independently updates Redis counters as designed).
    const previewLookup=reviewPreview?previewDeduper({
      redis,
      cms:cmsNewsReadOnly({
        baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
        token:env.CURATOR_STRAPI_READ_TOKEN||env.CURATOR_STRAPI_DRAFT_TOKEN,
      }),
    }):null;
    const publisher=autoPublish?cmsPublisher({
      baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
      token:env.CURATOR_STRAPI_PUBLISH_TOKEN,
      draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,
    }):null;
    // A longer HISTORY window is for preview only. Live worker keeps 45-day recency.
    const previewDays=Number(env.CURATOR_PREVIEW_DAYS||120);
    if(cmd==='preview'&&(!Number.isInteger(previewDays)||previewDays<1||previewDays>365))
      throw new Error('CURATOR_PREVIEW_DAYS must be 1..365');
    const previewLimit=Number(env.CURATOR_PREVIEW_LIMIT||6);
    if(cmd==='preview'&&(!Number.isInteger(previewLimit)||previewLimit<1||previewLimit>30))
      throw new Error('CURATOR_PREVIEW_LIMIT must be 1..30');
    // AI previews consume the same Redis quotas/fallback as live generation,
    // but NEVER construct a CMS client or pass the store for article persistence.
    const aiPreviewLimit=Number(env.CURATOR_AI_PREVIEW_LIMIT||1);
    const aiPreviewDays=Number(env.CURATOR_AI_PREVIEW_DAYS||45);
    // One-off DEV acceptance can cap writing to a single draft without enabling cron.
    const scheduleLimit=cmd==='schedule'?scheduleDraftLimitFromEnv(env):1;
    const onceLimit=Number(env.CURATOR_ONCE_LIMIT||3);
    if(cmd==='once'&&(!Number.isInteger(onceLimit)||onceLimit<1||onceLimit>3))
      throw new Error('CURATOR_ONCE_LIMIT must be 1..3');
    if(aiPreview&&(!Number.isInteger(aiPreviewLimit)||aiPreviewLimit<1||aiPreviewLimit>2))
      throw new Error('CURATOR_AI_PREVIEW_LIMIT must be 1..2');
    if(aiPreview&&(!Number.isInteger(aiPreviewDays)||aiPreviewDays<1||aiPreviewDays>120))
      throw new Error('CURATOR_AI_PREVIEW_DAYS must be 1..120');
    const execute=async()=>runOnce({router,store:aiPreview?null:redis,cms,dryRun,aiPreview,reviewPreview,
      previewLookup,fullArticlePreview,articleReader:fullArticlePreview||autoPublish?fetchArticleEvidence:null,
      autoPublish,publisher,autoPublishSources:allowedSources,archiveDiscovery,logger:log,
      maxAgeDays:cmd==='preview'?previewDays:aiPreview?aiPreviewDays:45,
      // Auto mode never processes more than one candidate per run.
      maxArticles:autoPublish?1:cmd==='preview'?previewLimit:aiPreview?aiPreviewLimit:cmd==='once'?onceLimit:scheduleLimit});
    const slot=()=>{
      const parts=new Intl.DateTimeFormat('en-GB',{
        timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23',
      }).formatToParts(new Date());
      const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      return {id:v.year+'-'+v.month+'-'+v.day+':'+v.hour,
        hour:v.hour,minute:v.minute};
    };
    if(retryPending){
      const result=await retryPendingDraft({documentId:process.argv[3],publisher,router,
        store:redis,allowedSources,logger:log});
      console.log(JSON.stringify({results:[result],preview:false,count:1}));
    }else if(cmd==='preview'||cmd==='generate-preview'||cmd==='review-preview'||cmd==='review-full-preview'||cmd==='once'){
      const report=await execute();
      console.log(JSON.stringify(report));
    }else{
      const hours=['08','13','19'];
      log({event:'schedule_started',timezone:'America/Fortaleza',hours,
        writeDrafts:!dryRun,autoPublish,archiveDiscovery});
      const tick=async()=>{
        const current=slot();
        if(!hours.includes(current.hour)||Number(current.minute)>2)return;
        const key='ierc:curator:job:'+current.id;
        const acquired=await redis.set(key,'1','EX',172800,'NX');
        if(acquired!=='OK')return;
        try{
          const report=await execute();
          log({event:'run_completed',count:report.count,preview:dryRun,
            ...summarizeRunForLog(report)});
        }catch{log({event:'run_failed'});}
      };
      await tick();
      setInterval(()=>tick().catch(()=>log({event:'schedule_error'})),30000);
    }
  }finally{
    if(cmd!=='schedule')await closeQuotaRedis(redis);
  }
}

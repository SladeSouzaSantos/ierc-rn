import {connectQuotaRedis, closeQuotaRedis} from './redis-connection.mjs';
import {RedisQuotaState} from './quota.mjs';
import {providersFromEnv,settingsFromEnv} from './providers.mjs';
import {FreeLlmRouter} from './router.mjs';
import {cmsClient} from './editorial.mjs';
import {cmsPublisher} from './cms-publish.mjs';
import {runOnce} from './pipeline.mjs';

const cmd=process.argv[2];
if(!['preview','generate-preview','once','schedule'].includes(cmd)){
  console.error('Use: node src/cli.mjs preview|generate-preview|once|schedule');
  process.exitCode=2;
}else{
  const env=process.env;
  if(!['preview','generate-preview'].includes(cmd)&&env.CURATOR_ENABLED!=='true') {
    console.log('Curator disabled. Set CURATOR_ENABLED=true only after DEV homologation.');
    process.exit(0);
  }
  if(!['preview'].includes(cmd)&&env.CURATOR_INSTANCE_KIND!=='dev')
    throw new Error('Automatic PROD ingestion is not approved');
  const settings=settingsFromEnv(env);
  const log=(event)=>console.log(JSON.stringify({ts:new Date().toISOString(),...event}));
  // Explicit one-shot AI preview is independent of the write activation flags.
  // Even CURATOR_WRITE_DRAFTS=true must not grant write access to this mode.
  const aiPreview=cmd==='generate-preview';
  const dryRun=cmd==='preview'||aiPreview||env.CURATOR_WRITE_DRAFTS!=='true';
  const autoPublish=env.CURATOR_AUTO_PUBLISH_ENABLED==='true';
  if(autoPublish){
    if(env.CURATOR_INSTANCE_KIND!=='dev'||dryRun||
       !['once','schedule'].includes(cmd)||
       env.CURATOR_AUTO_PUBLISH_ACK!=='RSS_ONLY_REVIEW_ACCEPTED')
      throw new Error('Auto publication requires explicit DEV RSS-only review acknowledgment and live write mode');
  }
  const allowedSources=autoPublish?(env.CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES||'')
    .split(',').map(x=>x.trim()).filter(Boolean):[];
  if(autoPublish&&(!allowedSources.length||
     !allowedSources.every(x=>['perkins','w3c-wai'].includes(x))||
     new Set(allowedSources).size!==allowedSources.length))
    throw new Error('Explicit verified source allowlist required for auto publication');
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
    const onceLimit=Number(env.CURATOR_ONCE_LIMIT||3);
    if(cmd==='once'&&(!Number.isInteger(onceLimit)||onceLimit<1||onceLimit>3))
      throw new Error('CURATOR_ONCE_LIMIT must be 1..3');
    if(aiPreview&&(!Number.isInteger(aiPreviewLimit)||aiPreviewLimit<1||aiPreviewLimit>2))
      throw new Error('CURATOR_AI_PREVIEW_LIMIT must be 1..2');
    if(aiPreview&&(!Number.isInteger(aiPreviewDays)||aiPreviewDays<1||aiPreviewDays>120))
      throw new Error('CURATOR_AI_PREVIEW_DAYS must be 1..120');
    const execute=async()=>runOnce({router,store:aiPreview?null:redis,cms,dryRun,aiPreview,
      autoPublish,publisher,autoPublishSources:allowedSources,logger:log,
      maxAgeDays:cmd==='preview'?previewDays:aiPreview?aiPreviewDays:45,
      // Auto mode never processes more than one candidate per run.
      maxArticles:autoPublish?1:cmd==='preview'?previewLimit:aiPreview?aiPreviewLimit:cmd==='once'?onceLimit:3});
    const slot=()=>{
      const parts=new Intl.DateTimeFormat('en-GB',{
        timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23',
      }).formatToParts(new Date());
      const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      return {id:v.year+'-'+v.month+'-'+v.day+':'+v.hour,
        hour:v.hour,minute:v.minute};
    };
    if(cmd==='preview'||cmd==='generate-preview'||cmd==='once'){
      const report=await execute();
      console.log(JSON.stringify(report));
    }else{
      const hours=['08','13','19'];
      log({event:'schedule_started',timezone:'America/Fortaleza',hours,writeDrafts:!dryRun,autoPublish});
      const tick=async()=>{
        const current=slot();
        if(!hours.includes(current.hour)||Number(current.minute)>2)return;
        const key='ierc:curator:job:'+current.id;
        const acquired=await redis.set(key,'1','EX',172800,'NX');
        if(acquired!=='OK')return;
        try{
          const report=await execute();
          log({event:'run_completed',count:report.count,preview:dryRun});
        }catch{log({event:'run_failed'});}
      };
      await tick();
      setInterval(()=>tick().catch(()=>log({event:'schedule_error'})),30000);
    }
  }finally{
    if(cmd!=='schedule')await closeQuotaRedis(redis);
  }
}

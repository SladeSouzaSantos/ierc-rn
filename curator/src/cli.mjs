import Redis from 'ioredis';
import {RedisQuotaState} from './quota.mjs';
import {providersFromEnv,settingsFromEnv} from './providers.mjs';
import {FreeLlmRouter} from './router.mjs';
import {cmsClient} from './editorial.mjs';
import {runOnce} from './pipeline.mjs';

const cmd=process.argv[2];
if(!['preview','once','schedule'].includes(cmd)){
  console.error('Use: node src/cli.mjs preview|once|schedule');
  process.exitCode=2;
}else{
  const env=process.env;
  if(cmd!=='preview'&&env.CURATOR_ENABLED!=='true')
    throw new Error('CURATOR_ENABLED=true required for live or scheduled execution');
  if(cmd!=='preview'&&env.CURATOR_INSTANCE_KIND!=='dev')
    throw new Error('Automatic PROD ingestion is not approved');
  const settings=settingsFromEnv(env);
  const log=(event)=>console.log(JSON.stringify({ts:new Date().toISOString(),...event}));
  const dryRun=cmd==='preview'||env.CURATOR_WRITE_DRAFTS!=='true';
  const redis=cmd==='preview'?null:new Redis(env.CURATOR_REDIS_URL||'redis://redis:6379',{
    enableOfflineQueue:false,maxRetriesPerRequest:1,
  });
  if(redis)redis.on('error',()=>{}); // Never expose credentials in logs.
  try{
    if(redis)await redis.ping();
    const providers=dryRun?[]:providersFromEnv(env);
    if(!dryRun&&!providers.length)throw new Error('At least one confirmed free provider is required');
    const quota=redis?new RedisQuotaState(redis,settings):null;
    const router=redis?new FreeLlmRouter({providers,state:quota,settings,logger:log}):null;
    const cms=!dryRun?cmsClient({baseUrl:env.CURATOR_CMS_URL||'http://cms:1337',
      token:env.CURATOR_STRAPI_DRAFT_TOKEN}):null;
    const execute=async()=>runOnce({router,store:redis,cms,dryRun,logger:log});
    const slot=()=>{
      const parts=new Intl.DateTimeFormat('en-GB',{
        timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23',
      }).formatToParts(new Date());
      const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));
      return {id:v.year+'-'+v.month+'-'+v.day+':'+v.hour,
        hour:v.hour,minute:v.minute};
    };
    if(cmd==='preview'||cmd==='once'){
      const report=await execute();
      console.log(JSON.stringify(report));
    }else{
      const hours=['08','13','19'];
      log({event:'schedule_started',timezone:'America/Fortaleza',hours,writeDrafts:!dryRun});
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
    if(cmd!=='schedule'&&redis)await redis.quit();
  }
}

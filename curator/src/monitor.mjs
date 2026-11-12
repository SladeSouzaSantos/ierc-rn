/**
 * Standalone RSS monitor. It has no CMS or LLM client, and it cannot publish.
 * The MiniMac Docker service supplies no editorial or AI secrets.
 */
import {connectQuotaRedis,closeQuotaRedis} from './redis-connection.mjs';
import {runOnce} from './pipeline.mjs';
import {monitorSlot,MONITOR_HOURS,buildMonitoringReport,persistMonitoringReport} from './monitor-report.mjs';

const env=process.env;
if(env.CURATOR_MONITOR_READ_ONLY!=='true'||env.CURATOR_INSTANCE_KIND!=='dev'||
   env.CURATOR_WRITE_DRAFTS==='true'||env.CURATOR_ENABLED==='true'||
   env.CURATOR_AUTO_PUBLISH_ENABLED==='true'||
   Object.keys(env).some(k=>(k.startsWith('CURATOR_STRAPI_')||
     k.startsWith('CURATOR_OPENROUTER_')||k.startsWith('CURATOR_GEMINI_')||
     k.startsWith('CURATOR_GROQ_'))&&!!env[k]))
  throw new Error('Monitor must be isolated from CMS, LLM keys and write modes');

const limit=Number(env.CURATOR_MONITOR_MAX_ARTICLES||20);
const age=Number(env.CURATOR_MONITOR_MAX_AGE_DAYS||45);
if(!Number.isInteger(limit)||limit<1||limit>30||!Number.isInteger(age)||age<1||age>120)
  throw new Error('Invalid monitoring bounds');
const reportDir=env.CURATOR_MONITOR_REPORT_DIR||'/reports';
const log=event=>console.log(JSON.stringify({ts:new Date().toISOString(),...event}));
const redis=await connectQuotaRedis(env.CURATOR_REDIS_URL||'redis://redis:6379');
let running=false;
async function scan(reason,slot=null){
  if(running)return;
  running=true;
  const started=new Date();
  const events=[];
  try{
    const result=await runOnce({dryRun:true,aiPreview:false,reviewPreview:false,
      store:null,cms:null,router:null,maxArticles:limit,maxAgeDays:age,
      logger:event=>{events.push(event);log(event);}});
    const report=buildMonitoringReport({at:started,reason,slot,scan:result,events});
    const saved=await persistMonitoringReport(report,{directory:reportDir});
    log({event:'monitor_completed',reason,slot,report:saved.filename,...report.summary});
  }catch{
    // Deliberately suppress network/credential details in operational logs.
    log({event:'monitor_failed',reason,slot});
  }finally{running=false;}
}
async function scheduledTick(){
  const slot=monitorSlot(new Date());
  if(!slot||running)return;
  const key='ierc:monitor:slot:'+slot;
  // Prevent duplicate runs after process/container restarts in the same slot.
  const acquired=await redis.set(key,'1','EX',259200,'NX');
  if(acquired==='OK')await scan('scheduled',slot);
}
log({event:'monitor_started',timezone:'America/Fortaleza',
  hours:MONITOR_HOURS,mode:'read-only',writeDrafts:false,autoPublish:false});
if(env.CURATOR_MONITOR_BOOT_SCAN!=='false')await scan('startup');
await scheduledTick();
const timer=setInterval(()=>scheduledTick().catch(()=>log({event:'monitor_schedule_error'})),30000);
let closing=false;
async function shutdown(){
  if(closing)return;
  closing=true;
  clearInterval(timer);
  await closeQuotaRedis(redis).catch(()=>{});
  process.exit(0);
}
process.on('SIGINT',()=>void shutdown());
process.on('SIGTERM',()=>void shutdown());

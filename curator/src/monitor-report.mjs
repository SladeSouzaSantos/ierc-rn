import {mkdir,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export const MONITOR_HOURS=Object.freeze(['08','13','19']);
const zone='America/Fortaleza';

/** Return a scheduled slot only in the first three minutes, local Natal time. */
export function monitorSlot(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23',
  }).formatToParts(date);
  const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  if(!MONITOR_HOURS.includes(p.hour)||Number(p.minute)>2)return null;
  return p.year+'-'+p.month+'-'+p.day+':'+p.hour;
}

/** A report contains only public RSS metadata; never CMS content, tokens or LLM text. */
export function buildMonitoringReport({at=new Date(),reason,slot=null,scan,events}){
  if(scan?.preview!==true||scan.aiGenerated!==false||
     !Array.isArray(scan.results)||!Array.isArray(events))
    throw new Error('Monitoring requires a pure read-only preview');
  const allowedEvents=new Set(['feed_checked','feed_unavailable','source_paused',
    'source_skipped_by_policy','cross_feed_duplicate_skipped']);
  const sources=events.filter(e=>allowedEvents.has(e.event)).map(e=>({
    event:e.event,source:e.source,
    ...(e.reason?{reason:e.reason}:{}),
    ...(e.validLastYear!==undefined?{validLastYear:e.validLastYear}:{}),
    ...(e.withinWindow!==undefined?{withinWindow:e.withinWindow}:{}),
    ...(e.candidates!==undefined?{candidates:e.candidates}:{}),
    ...(e.noCandidatesReason?{noCandidatesReason:e.noCandidatesReason}:{}),
  }));
  const articles=scan.results.filter(item=>item.status==='preview').map(item=>({
    source:item.source,title:item.title,publishedAt:item.publishedAt,
    url:item.originalUrl,
    coverageTrack:item.coverageTrack,coverageScope:item.coverageScope,
    relevanceScore:item.relevanceScore,topics:item.topics,
    ...(item.editorialFocus?{editorialFocus:item.editorialFocus}:{}),
    previewOnly:item.previewOnly===true,
  })).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||
    a.url.localeCompare(b.url));
  return {version:1,generatedAt:at.toISOString(),timezone:zone,reason,slot,
    mode:'read-only-monitor',published:false,aiUsed:false,cmsWrites:false,
    summary:{articles:articles.length,feedsChecked:sources.filter(x=>x.event==='feed_checked').length,
      feedsUnavailable:sources.filter(x=>x.event==='feed_unavailable').length,
      feedsPaused:sources.filter(x=>x.event==='source_paused').length,
      editorialFocus:{
        visualDirect:articles.filter(x=>x.editorialFocus==='visual_direta').length,
        contextual:articles.filter(x=>x.editorialFocus==='contextual').length,
        generalInclusion:articles.filter(x=>x.editorialFocus==='inclusao_geral').length,
      }},
    sources,articles};
}

/** Atomic local report with bounded retention; report volume is not the CMS volume. */
export async function persistMonitoringReport(report,{directory='/reports',keep=90}={}){
  if(!Number.isInteger(keep)||keep<1||keep>365)throw new Error('Invalid report retention');
  if(!report||report.mode!=='read-only-monitor'||report.cmsWrites!==false)
    throw new Error('Refusing to persist an editorial write report');
  await mkdir(directory,{recursive:true,mode:0o700});
  const safeTime=report.generatedAt.replace(/[-:.]/g,'').replace(/[^0-9TZ]/g,'');
  const name='monitor-'+safeTime+'.json';
  const payload=JSON.stringify(report,null,2)+'\n';
  async function atomicWrite(filename){
    const temp=join(directory,'.'+filename+'.'+randomUUID()+'.tmp');
    try{
      await writeFile(temp,payload,{flag:'wx',mode:0o600});
      await rename(temp,join(directory,filename));
    }catch(error){
      await unlink(temp).catch(()=>{});
      throw error;
    }
  }
  await atomicWrite(name);
  await atomicWrite('latest.json');
  const old=(await readdir(directory)).filter(file=>/^monitor-\d{8}T\d{6}\d*Z\.json$/.test(file))
    .sort().reverse().slice(keep);
  for(const file of old)await unlink(join(directory,file));
  return {filename:name,latest:'latest.json'};
}

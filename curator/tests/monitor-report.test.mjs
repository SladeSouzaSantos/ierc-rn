import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {monitorSlot,MONITOR_HOURS,buildMonitoringReport,persistMonitoringReport} from '../src/monitor-report.mjs';
import {runOnce} from '../src/pipeline.mjs';

test('08, 13 and 19 in America/Fortaleza are deterministic and bounded to minute 00..02',()=>{
 assert.deepEqual(MONITOR_HOURS,['08','13','19']);
 for(const [utc,slot] of [
  ['2026-11-11T11:00:00Z','2026-11-11:08'],
  ['2026-11-11T16:01:55Z','2026-11-11:13'],
  ['2026-11-11T22:02:59Z','2026-11-11:19'],
  ['2026-11-12T11:00:00Z','2026-11-12:08'],
 ]){
  assert.equal(monitorSlot(new Date(utc)),slot);
 }
 for(const utc of ['2026-11-11T11:03:00Z','2026-11-11T10:59:00Z',
   '2026-11-11T18:00:00Z']){
   assert.equal(monitorSlot(new Date(utc)),null);
 }
});
test('read-only monitoring captures only public RSS news metadata and source availability',async()=>{
 const item={id:'w3c-wai',mode:'rss',name:'W3C',country:'Internacional',language:'en',
   hostname:'www.w3.org',feed:'https://www.w3.org/WAI/feed.xml'};
 const body='<rss><channel><item>'+
   '<title>Access technology for blind students</title>'+
   '<description>Accessibility education and screen readers supporting students with visual disabilities.</description>'+
   '<link>https://www.w3.org/WAI/news/example</link>'+
   '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
   '</item></channel></rss>';
 const events=[];let modelCalls=0,cmsWrites=0;
 const scan=await runOnce({sources:[item],dryRun:true,maxArticles:20,
   now:Date.parse('2026-11-11T11:00:00Z'),
   fetchImpl:async()=>new Response(body),
   logger:x=>events.push(x),
   router:{async complete(){modelCalls++;throw Error('should never call LLM');}},
   cms:{async create(){cmsWrites++;throw Error('should never write CMS');}},
 });
 assert.equal(modelCalls,0);assert.equal(cmsWrites,0);
 assert.equal(scan.aiGenerated,false);
 assert.equal(scan.results[0].originalUrl,'https://www.w3.org/WAI/news/example');
 const report=buildMonitoringReport({at:new Date('2026-11-11T11:00:00Z'),
   reason:'scheduled',slot:'2026-11-11:08',scan,events});
 assert.equal(report.mode,'read-only-monitor');
 assert.equal(report.published,false);
 assert.equal(report.cmsWrites,false);
 assert.equal(report.summary.feedsChecked,1);
 assert.equal(report.summary.articles,1);
 assert.equal(report.articles[0].url,'https://www.w3.org/WAI/news/example');
 assert.equal(report.sources[0].source,'w3c-wai');
 assert.equal(JSON.stringify(report).includes('CURATOR_STRAPI_DRAFT_TOKEN'),false);
});
test('monitor report requires pure preview; cannot accept generated AI or live CMS results',()=>{
 const values={results:[],preview:true,aiGenerated:false};
 assert.throws(()=>buildMonitoringReport({scan:{...values,preview:false},events:[]}),/pure read-only/);
 assert.throws(()=>buildMonitoringReport({scan:{...values,aiGenerated:true},events:[]}),/pure read-only/);
});
test('monitor writes local JSON atomically and bounds retention, without writing Strapi or Redis',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ierc-monitor-'));
 try{
  for(let n=1;n<=4;n++){
   const report=buildMonitoringReport({
     at:new Date(Date.UTC(2026,10,n,11,0,0)),
     reason:'scheduled',slot:'2026-11-0'+n+':08',
     scan:{preview:true,aiGenerated:false,results:[]},events:[],
   });
   await persistMonitoringReport(report,{directory:dir,keep:2});
  }
  const files=await readdir(dir);
  assert.equal(files.filter(x=>x.startsWith('monitor-')&&x.endsWith('.json')).length,2);
  assert.equal(files.filter(x=>x.startsWith('.')&&x.endsWith('.tmp')).length,0);
  const latest=JSON.parse(await readFile(join(dir,'latest.json'),'utf8'));
  assert.equal(latest.generatedAt,'2026-11-04T11:00:00.000Z');
  assert.equal(latest.mode,'read-only-monitor');
  await assert.rejects(persistMonitoringReport({mode:'live',cmsWrites:true},{directory:dir}),/Refusing/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('MiniMac Compose monitors with no public ports, CMS env or credentials',async()=>{
 const {readFile}=await import('node:fs/promises');
 const compose=await readFile(new URL('../../compose.curator.monitor.yml',import.meta.url),'utf8');
 assert.match(compose,/command: \["node","src\/monitor\.mjs"\]/);
 assert.match(compose,/CURATOR_MONITOR_READ_ONLY: "true"/);
 assert.match(compose,/CURATOR_WRITE_DRAFTS: "false"/);
 assert.match(compose,/CURATOR_AUTO_PUBLISH_ENABLED: "false"/);
 assert.match(compose,/restart: unless-stopped/);
 assert.match(compose,/monitor_reports:\/reports/);
 assert.equal(/ports:\s*\n\s*-/.test(compose),false);
 assert.equal(compose.includes('env_file:'),false);
 assert.equal(compose.includes('cms_dev_private'),false);
 assert.equal(compose.includes('CURATOR_STRAPI_DRAFT_TOKEN:'),false);
});

test('monitor report sorts published dates descending without altering preview-only status',()=>{
 const scan={preview:true,aiGenerated:false,results:[
  {status:'preview',source:'perkins',title:'Old news',originalUrl:'https://www.perkins.org/old',
   publishedAt:'2026-10-13T10:00:00Z',previewOnly:false,topics:[]},
  {status:'preview',source:'rnib',title:'NHS accessibility',originalUrl:'https://www.rnib.org.uk/news/latest',
   publishedAt:'2026-11-02T12:00:00Z',previewOnly:true,topics:['deficiência visual']},
 ]};
 const report=buildMonitoringReport({scan,events:[],reason:'scheduled'});
 assert.deepEqual(report.articles.map(x=>x.title),['NHS accessibility','Old news']);
 assert.equal(report.articles[0].previewOnly,true);
 assert.ok(!('summary' in report.articles[0]));
});

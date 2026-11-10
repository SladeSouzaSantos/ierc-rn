import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOnce} from '../src/pipeline.mjs';
const source={id:'w3c-wai',name:'W3C WAI',feed:'https://www.w3.org/WAI/feed.xml',hostname:'www.w3.org',language:'en',country:'Internacional'};
const atom='<feed><entry><title>Accessibility for blind students</title><link href="https://www.w3.org/WAI/news/example"/><updated>2026-11-09T15:00:00Z</updated><summary>Accessible education with screen reader tools and inclusive methodologies</summary></entry></feed>';
test('dry-run collects and filters without any LLM, Redis or Strapi call',async()=>{
 const fetchImpl=async()=>new Response(atom,{status:200});
 const value=await runOnce({sources:[source],fetchImpl,now:Date.parse('2026-11-10T01:00:00Z'),dryRun:true,
   router:null,store:null,cms:null});
 assert.equal(value.preview,true);
 assert.equal(value.count,1);
 assert.equal(value.results[0].status,'preview');
});
test('unavailable feed is logged and never triggers the model',async()=>{
 const events=[];
 const value=await runOnce({sources:[source],fetchImpl:async()=>new Response('',{status:503}),
   now:Date.parse('2026-11-10T01:00:00Z'),dryRun:true,logger:evt=>events.push(evt)});
 assert.equal(value.count,0);
 assert.equal(events[0].event,'feed_unavailable');
});

test('preview can inspect WAI history without changing 45-day live window',async()=>{
 const oldAtom=atom.replace('2026-11-09T15:00:00Z','2026-09-25T15:00:00Z');
 const options={sources:[source],fetchImpl:async()=>new Response(oldAtom,{status:200}),
   now:Date.parse('2026-11-10T01:00:00Z'),dryRun:true};
 const logs=[];
 const recent=await runOnce({...options,logger:e=>logs.push(e)});
 const historical=await runOnce({...options,maxAgeDays:120});
 assert.equal(recent.count,0);
 assert.equal(historical.count,1);
 assert.equal(logs[0].validLastYear,1);
 assert.equal(logs[0].withinWindow,0);
 assert.equal(logs[0].maxAgeDays,45);
});
test('age filter refuses unsafe out-of-range previews',async()=>{
 await assert.rejects(runOnce({maxAgeDays:366}),/Invalid article age window/);
});


test('preview balances WAI, Perkins, RNIB and IBSA without publishing preview-only sources', async () => {
  const { SOURCES } = await import('../src/feeds.mjs');
  const wbu='<rss><channel><title>World Blind Union</title></channel></rss>';
  const perkins='<rss><channel><item><title>Braille literacy for blind students</title>' +
    '<link>https://www.perkins.org/braille-literacy-for-blind-students/</link>' +
    '<pubDate>Thu, 05 Nov 2026 15:00:00 +0000</pubDate>' +
    '<description>New materials help inclusive education in classrooms.</description></item></channel></rss>';
  const rnib='<div class="listing__post small-image-card">' +
    '<h2 class="small-image-card__title"><a href="https://www.rnib.org.uk/news/accessibility-in-britain/">' +
    'Low vision accessibility in Britain</a></h2>' +
    '<p class="small-image-card__description">Rights and support</p>' +
    '<span class="small-image-card__meta-item">Posted Thursday, 5 November 2026</span></div>';
  const ibsa='<div class="tekup-blog-wrap"><div class="tekup-blog-content">' +
    '<div class="tekup-blog-meta"><ul><li>IBSA</li><li>05 November 2026</li></ul></div>' +
    '<a href="https://ibsasport.org/news/new-goalball-program/"><h3>New Goalball Program</h3></a></div></div>';
  const bodyByUrl={
    'https://www.w3.org/WAI/feed.xml':atom,
    'https://www.perkins.org/feed/':perkins,
    'https://www.rnib.org.uk/news/':rnib,
    'https://ibsasport.org/news/':ibsa,
    'https://wbu.ngo/feed/':wbu,
  };
  const reads=[];
  const fetched=async url=>{
    reads.push(url);
    return new Response(bodyByUrl[url],{status:200});
  };
  const out=await runOnce({sources:SOURCES,fetchImpl:fetched,
    now:Date.parse('2026-11-10T12:00:00Z'),maxArticles:6,dryRun:true,
    router:null,store:null,cms:null});
  assert.equal(out.count,4);
  assert.deepEqual(out.results.map(x=>x.source),['w3c-wai','perkins','rnib','ibsa']);
  assert.equal(out.results[2].previewOnly,true);
  assert.ok(out.results.every(x=>x.status==='preview'));
  assert.equal(reads.length,5);
});
test('live ingestion excludes all preview-only HTML sources and empty WBU feed', async()=>{
  const { SOURCES } = await import('../src/feeds.mjs');
  const reads=[];const events=[];
  const store={set:async()=> 'OK', exists:async()=>1, eval:async()=>1};
  const cms={existing:async()=>false,create:async()=>{throw Error('must not write')}};
  const perkins='<rss><channel><item><title>Braille literacy for blind students</title>' +
    '<link>https://www.perkins.org/braille-literacy-for-blind-students/</link>' +
    '<pubDate>Thu, 05 Nov 2026 15:00:00 +0000</pubDate>' +
    '<description>New materials help inclusive education.</description></item></channel></rss>';
  const result=await runOnce({sources:SOURCES,
    fetchImpl:async url=>{
      reads.push(url);
      return new Response(url.includes('perkins.org')?perkins:atom,{status:200});
    },
    now:Date.parse('2026-11-10T12:00:00Z'),dryRun:false,store,cms,router:null,
    logger:event=>events.push(event)});
  assert.deepEqual(reads,['https://www.w3.org/WAI/feed.xml','https://www.perkins.org/feed/']);
  assert.equal(result.results.length,2);
  assert.ok(result.results.every(x=>x.status==='seen'));
  assert.equal(events.filter(x=>x.event==='source_skipped_by_policy').length,3);
});

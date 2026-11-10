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

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoverOnePendingInSchedule,MAX_SCHEDULED_RECOVERY_ATTEMPTS} from '../src/auto-recovery.mjs';

const id='nxh3gri9njyrag8uvbtgux4i';
const listPending=async()=>({documents:[{documentId:id,title:'Synthetic news'}]});
function setup({answers=[1],retryStatus='draft_review_pending',lookup=listPending}={}){
  const calls=[],events=[];
  let n=0;
  return {calls,events,config:{
    listPending:lookup,redis:{eval:async(...args)=>{calls.push(args);return answers[n++]??0;}},
    publisher:{},router:{},allowedSources:['agencia-brasil-educacao'],
    logger:e=>events.push(e),
    recover:async args=>{
      calls.push({recovery:args.documentId});
      return {status:retryStatus,reusedDraft:true};
    },
  }};
}

test('DEV scheduler recovers exactly one held draft, without new CMS insert',async()=>{
  const s=setup();
  const result=await recoverOnePendingInSchedule(s.config);
  assert.deepEqual(result,{
    results:[{status:'draft_review_pending',reusedDraft:true}],
    preview:false,count:1,aiGenerated:false,
  });
  assert.equal(s.calls.length,2);
  assert.equal(s.calls[0][1],1);
  assert.equal(s.calls[0][3],MAX_SCHEDULED_RECOVERY_ATTEMPTS);
  assert.equal(s.calls[1].recovery,id);
  assert.deepEqual(s.events.map(e=>e.event),[
    'pending_auto_started','pending_auto_completed',
  ]);
  assert.equal(s.events[0].attempt,1);
  assert.ok(!JSON.stringify(s.events).includes('Synthetic news'));
  assert.ok(!JSON.stringify(s.events).includes(id));
});

test('a successfully recovered article is published once, not a new draft',async()=>{
  const s=setup({retryStatus:'draft_published'});
  const result=await recoverOnePendingInSchedule(s.config);
  assert.equal(result.results[0].status,'draft_published');
  assert.equal(result.results[0].reusedDraft,true);
  assert.equal(s.events.at(-1).status,'draft_published');
});

test('global discovery continues when no held candidates or recovery budget is exhausted',async()=>{
  const none=setup({lookup:async()=>({documents:[]})});
  assert.equal(await recoverOnePendingInSchedule(none.config),null);
  assert.equal(none.calls.length,0);
  const exhausted=setup({answers:[0]});
  assert.equal(await recoverOnePendingInSchedule(exhausted.config),null);
  assert.equal(exhausted.calls.length,1);
  assert.equal(exhausted.events[0].event,'pending_auto_exhausted');
});

test('unavailable reader does not authorize any retry and normal discovery can continue',async()=>{
  const s=setup({lookup:async()=>{throw Error('secret connection info');}});
  assert.equal(await recoverOnePendingInSchedule(s.config),null);
  assert.deepEqual(s.events,[{event:'pending_auto_scan_unavailable'}]);
  assert.equal(s.calls.length,0);
});

test('Redis failure blocks recovery and never authorizes unmetered model calls',async()=>{
  const s=setup();
  s.config.redis.eval=async()=>{throw Error('Redis unavailable');};
  const result=await recoverOnePendingInSchedule(s.config);
  assert.equal(result.results[0].status,'pending_recovery_unavailable');
  assert.equal(s.calls.length,0);
  assert.equal(s.events[0].event,'pending_auto_quota_unavailable');
});

test('invalid pending CMS record never invokes a recovery',async()=>{
  const s=setup({lookup:async()=>({documents:[{documentId:'../bad'}]})});
  assert.equal(await recoverOnePendingInSchedule(s.config),null);
  assert.deepEqual(s.events,[{event:'pending_auto_scan_unavailable'}]);
  assert.equal(s.calls.length,0);
});

test('invalid and failed recovered drafts fail closed and do not repeat in one slot',async()=>{
  const s=setup();
  s.config.recover=async()=>{throw Error('confidential CMS issue');};
  const result=await recoverOnePendingInSchedule(s.config);
  assert.equal(result.results[0].status,'pending_recovery_failed');
  assert.deepEqual(s.events.map(e=>e.event),[
    'pending_auto_started','pending_auto_failed','pending_auto_completed',
  ]);
  assert.ok(!JSON.stringify(s.events).includes('confidential CMS issue'));
});

test('reader cannot exceed 20 entries per bounded scan',async()=>{
  const s=setup({lookup:async()=>({
    documents:Array(21).fill({documentId:id,title:'Synthetic news'}),
  })});
  assert.equal(await recoverOnePendingInSchedule(s.config),null);
  assert.equal(s.calls.length,0);
});

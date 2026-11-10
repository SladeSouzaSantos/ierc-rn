import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RedisQuotaState} from '../src/quota.mjs';
test('quota reservation uses a single Redis transaction for provider and global',async()=>{
 const params=[];
 const redis={async eval(...args){params.push(args);return 1;},async pttl(){return -2;},
 async set(){return 'OK';}};
 const state=new RedisQuotaState(redis,{globalMax:30,windowMs:86400000});
 const reserved=await state.reserve({id:'gemini',maxCalls:10});
 assert.equal(reserved,'allowed');
 assert.equal(params[0][1],2);
 assert.deepEqual(params[0].slice(2,4),['ierc:curator:llm:global','ierc:curator:llm:gemini']);
 assert.deepEqual(params[0].slice(4),[30,10,86400000]);
});
test('missing quota store errors are not silently converted to new allowance',async()=>{
 const state=new RedisQuotaState({eval:async()=>{throw new Error('redis unavailable');}},
  {globalMax:30,windowMs:86400000});
 await assert.rejects(state.reserve({id:'openrouter',maxCalls:10}),/redis unavailable/);
});
test('provider limitation does not consume other requests and global quota stops',async()=>{
 const fake={answer:0,async eval(){return this.answer;}};
 const state=new RedisQuotaState(fake,{globalMax:30,windowMs:86400000});
 assert.equal(await state.reserve({id:'openrouter',maxCalls:10}),'provider_limited');
 fake.answer=-1;
 assert.equal(await state.reserve({id:'openrouter',maxCalls:10}),'global_limited');
});
test('cooldown respects Redis TTL and fails closed on corrupt state',async()=>{
 const fake={ttl:1600,async pttl(){return this.ttl;},async set(){return 'OK';}};
 const state=new RedisQuotaState(fake,{globalMax:30,windowMs:86400000});
 assert.equal(await state.remainingCooldown('groq'),1600);
 fake.ttl=-1;
 await assert.rejects(state.remainingCooldown('groq'),/Invalid cooldown/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providersFromEnv,settingsFromEnv} from '../src/providers.mjs';
import {FreeLlmRouter,LlmExhaustedError} from '../src/router.mjs';
const config={globalMax:20,windowMs:86400000,maxAttempts:4,timeoutMs:500,cooldownMs:1000,maxCooldownMs:86400000};
class MemoryMeter {
  constructor({global=20,perProvider=20}={}) {
    this.global=global;this.perProvider=perProvider;this.n=0;this.p={};this.blocked={};
  }
  async reserve(candidate) {
    if((this.p[candidate.id]||0)>=Math.min(this.perProvider,candidate.maxCalls))return 'provider_limited';
    if(this.n>=this.global)return 'global_limited';
    this.n++;this.p[candidate.id]=(this.p[candidate.id]||0)+1;return 'allowed';
  }
  async remainingCooldown(id){return this.blocked[id]||0;}
  async block(id,ms){this.blocked[id]=ms;}
}
const candidates=[
  {id:'openrouter',kind:'openai',url:'https://openrouter.ai/api/v1/chat/completions',key:'dummy',model:'openrouter/free',maxCalls:10},
  {id:'gemini',kind:'openai',url:'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',key:'dummy',model:'free-confirmed',maxCalls:10},
  {id:'groq',kind:'openai',url:'https://api.groq.com/openai/v1/chat/completions',key:'dummy',model:'free-confirmed',maxCalls:10},
];
const ok=()=>new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]}),{status:200,headers:{'Content-Type':'application/json'}});
const make=(meter,fetchImpl,providers=candidates)=>new FreeLlmRouter({providers,state:meter,settings:config,fetchImpl});
test('free-only OpenRouter model is mandatory',()=>{
 assert.throws(()=>providersFromEnv({CURATOR_OPENROUTER_API_KEY:'x',CURATOR_OPENROUTER_MODEL:'anthropic/paid-model'}),/paid models/);
 assert.equal(providersFromEnv({CURATOR_OPENROUTER_API_KEY:'x',CURATOR_OPENROUTER_MODEL:'openrouter/free'})[0].model,'openrouter/free');
});
test('Gemini/Groq keys require confirmed free-tier access',()=>{
 assert.throws(()=>providersFromEnv({CURATOR_GEMINI_API_KEY:'x',CURATOR_GEMINI_MODEL:'gemini-model'}),/free-tier-only/);
 assert.throws(()=>providersFromEnv({CURATOR_GROQ_API_KEY:'x',CURATOR_GROQ_MODEL:'groq-model'}),/free-tier-only/);
 assert.deepEqual(providersFromEnv({}),[]);
});
test('ordered fallback on rate-limit, counts failed calls and cooldown',async()=>{
 const meter=new MemoryMeter();const urls=[];
 const router=make(meter,async url=>{
   urls.push(url);return urls.length===1?new Response('',{status:429,headers:{'Retry-After':'15'}}):ok();
 });
 const result=await router.complete({system:'system',prompt:'prompt'});
 assert.equal(result.provider,'gemini');
 assert.equal(result.attempts,2);
 assert.equal(result.fallbackUsed,true);
 assert.equal(meter.n,2);assert.equal(meter.p.openrouter,1);
 assert.ok(meter.blocked.openrouter>=15000);
 assert.deepEqual(urls.slice(0,2),candidates.slice(0,2).map(x=>x.url));
});
test('402 credits exhausted moves to next provider',async()=>{
 const meter=new MemoryMeter();let count=0;
 const result=await make(meter,async()=>++count===1?new Response('',{status:402}):ok())
   .complete({system:'s',prompt:'p'});
 assert.equal(result.provider,'gemini');assert.equal(meter.blocked.openrouter,86400000);
});
test('provider local allowance skips to next without spending global quota',async()=>{
 const meter=new MemoryMeter({perProvider:20});
 meter.p.openrouter=10;
 const result=await make(meter,async()=>ok()).complete({system:'s',prompt:'p'});
 assert.equal(result.provider,'gemini');
 assert.equal(meter.n,1);
});
test('global budget stops the entire chain, no outbound HTTP calls',async()=>{
 const meter=new MemoryMeter({global:0});let calls=0;
 await assert.rejects(make(meter,async()=>{calls++;return ok();}).complete({system:'s',prompt:'p'}),
   e=>e instanceof LlmExhaustedError&&e.message==='global_quota_reached');
 assert.equal(calls,0);
});
test('all cooldowns block all attempts and avoid HTTP',async()=>{
 const meter=new MemoryMeter();meter.blocked={openrouter:2000,gemini:2000,groq:2000};
 let calls=0;
 await assert.rejects(make(meter,async()=>{calls++;return ok();}).complete({system:'s',prompt:'p'}),LlmExhaustedError);
 assert.equal(calls,0);
});
test('non-retryable 400 stops and does not call backup',async()=>{
 const meter=new MemoryMeter();let calls=0;
 await assert.rejects(make(meter,async()=>{calls++;return new Response('',{status:400});})
   .complete({system:'s',prompt:'p'}),/non_retryable_model_error/);
 assert.equal(calls,1);
});
test('5xx failover, invalid response failover and no secrets in diagnostics',async()=>{
 const meter=new MemoryMeter();const diagnostics=[];let count=0;
 const result=await new FreeLlmRouter({providers:candidates,state:meter,settings:config,
   fetchImpl:async()=>++count===1?new Response('',{status:503}):
     count===2?new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}):ok(),
   logger:d=>diagnostics.push(d)}).complete({system:'s',prompt:'p'});
 assert.equal(result.provider,'groq');assert.equal(count,3);
 assert.deepEqual(diagnostics.map(x=>x.result),['unavailable','invalid_output','success']);
 assert.ok(!JSON.stringify(diagnostics).includes('dummy'));
});
test('provider response is plain string, never logs prompt, model or token',async()=>{
 const meter=new MemoryMeter();const logs=[];
 const result=await new FreeLlmRouter({providers:[candidates[0]],state:meter,settings:config,
  fetchImpl:async()=>ok(),logger:x=>logs.push(x)}).complete({system:'secret_prompt',prompt:'secret_prompt'});
 assert.equal(result.provider,'openrouter');assert.ok(!JSON.stringify(logs).includes('secret_prompt'));
});
test('invalid settings fail closed',()=>{
 assert.throws(()=>settingsFromEnv({CURATOR_MAX_ATTEMPTS:'999'}));
 assert.throws(()=>settingsFromEnv({CURATOR_GLOBAL_MAX_CALLS:'0'}));
});

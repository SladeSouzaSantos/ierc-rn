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


test('editorial schema mismatch falls back to another free provider',async()=>{
  const meter=new MemoryMeter();const observed=[];
  let calls=0;
  const result=await new FreeLlmRouter({providers:candidates.slice(0,2),state:meter,
    settings:config,fetchImpl:async()=>{
      calls++;
      const content=calls===1?'{"title":"incomplete"}':
        '{"title":"not enough by itself","summary":"full draft"}';
      return new Response(JSON.stringify({choices:[{message:{content}}]}),{status:200});
    },logger:e=>observed.push(e)}).complete({
      system:'original editorial guidance',prompt:'public feed data',
      validateOutput:raw=>{
        const obj=JSON.parse(raw);
        if(!obj.title||!obj.summary)throw Error('not enough evidence');
      },
    });
  assert.equal(result.provider,'gemini');
  assert.equal(result.attempts,2);
  assert.equal(result.fallbackUsed,true);
  assert.equal(meter.n,2);
  assert.ok(meter.blocked.openrouter>=config.cooldownMs);
  assert.deepEqual(observed.map(x=>x.result),['invalid_output','success']);
});
test('editorial skip:true is accepted rather than causing endless fallback',async()=>{
  const meter=new MemoryMeter();let calls=0;
  const result=await make(meter,async()=>{
    calls++;return new Response(JSON.stringify({choices:[{message:{content:'{"skip":true}'}}]}),{status:200});
  }).complete({system:'s',prompt:'p',validateOutput:raw=>JSON.parse(raw)});
  assert.equal(result.provider,'openrouter');
  assert.equal(calls,1);
});


test('diagnostics distinguish reasoning-only responses, token truncation and schema errors',async()=>{
  const cases=[
    {reason:'token_limit',payload:{choices:[{finish_reason:'length',message:{content:'{"title":"partial"}'}}]}},
    {reason:'reasoning_without_text',payload:{choices:[{finish_reason:'stop',message:{content:'',reasoning:'private internal text'}}]}},
    {reason:'empty_content',payload:{choices:[{finish_reason:'stop',message:{content:''}}]}},
    {reason:'json_syntax',payload:{choices:[{finish_reason:'stop',message:{content:'not a json draft'}}]},
      validator:raw=>{if(!raw.startsWith('{'))throw Error('Model output is not JSON');}},
    {reason:'incomplete_draft',payload:{choices:[{finish_reason:'stop',message:{content:'{"title":"only"}'}}]},
      validator:()=>{throw Error('Incomplete model draft');}},
  ];
  for(const entry of cases){
    const logs=[];const meter=new MemoryMeter();
    const router=new FreeLlmRouter({providers:[candidates[0]],state:meter,settings:config,
      logger:event=>logs.push(event),
      fetchImpl:async()=>new Response(JSON.stringify(entry.payload),{status:200})});
    await assert.rejects(router.complete({
      system:'private-secret-instruction',prompt:'private-source-text',
      validateOutput:entry.validator,
    }),e=>e instanceof LlmExhaustedError&&e.message==='all_free_providers_unavailable');
    assert.equal(meter.n,1);
    assert.equal(logs[0].result,'invalid_output');
    assert.equal(logs[0].reason,entry.reason);
    assert.ok(!JSON.stringify(logs).includes('private'));
    assert.ok(!JSON.stringify(logs).includes('partial'));
  }
});
test('free OpenRouter Nemotron receives reasoning off and bounded 1600 token JSON budget',async()=>{
  const providers=providersFromEnv({
    CURATOR_OPENROUTER_API_KEY:'fake-secret-test-only',
    CURATOR_OPENROUTER_MODEL:'nvidia/nemotron-3.5-super-vl:free',
  });
  assert.equal(providers.length,1);
  assert.equal(providers[0].reasoningEnabled,false);
  const settings=settingsFromEnv({});
  assert.equal(settings.outputMaxTokens,1600);
  let sent;
  const router=new FreeLlmRouter({providers,state:new MemoryMeter(),settings,
    fetchImpl:async(url,options)=>{
      assert.equal(url,'https://openrouter.ai/api/v1/chat/completions');
      sent=JSON.parse(options.body);
      return ok();
    }});
  await router.complete({system:'s',prompt:'p'});
  assert.equal(sent.max_tokens,1600);
  assert.deepEqual(sent.reasoning,{enabled:false});
  assert.equal(sent.model,'nvidia/nemotron-3.5-super-vl:free');
  assert.equal(sent.stream,false);
  assert.throws(()=>settingsFromEnv({CURATOR_MAX_OUTPUT_TOKENS:'10000'}));
  assert.throws(()=>providersFromEnv({
    CURATOR_OPENROUTER_API_KEY:'fake',
    CURATOR_OPENROUTER_MODEL:'nvidia/nemotron-3.5-super-vl:free',
    CURATOR_OPENROUTER_REASONING_ENABLED:'maybe',
  }),/must be true or false/);
  assert.equal(providersFromEnv({
    CURATOR_OPENROUTER_API_KEY:'fake',
    CURATOR_OPENROUTER_MODEL:'nvidia/nemotron-3.5-super-vl:free',
    CURATOR_OPENROUTER_REASONING_ENABLED:'true',
  })[0].reasoningEnabled,true);
});


test('Gemini 2.5 Flash uses official none reasoning effort without changing Pro or Gemini 3',async()=>{
  const base={
    CURATOR_GEMINI_API_KEY:'test-only-not-a-real-token',
    CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',
  };
  const flash=providersFromEnv({...base,CURATOR_GEMINI_MODEL:'gemini-2.5-flash'});
  assert.equal(flash[0].reasoningEffort,'none');
  const flashLite=providersFromEnv({...base,CURATOR_GEMINI_MODEL:'gemini-2.5-flash-lite'});
  assert.equal(flashLite[0].reasoningEffort,'none');
  for(const model of ['gemini-2.5-pro','gemini-3-flash']){
    const candidate=providersFromEnv({...base,CURATOR_GEMINI_MODEL:model});
    assert.equal(candidate[0].reasoningEffort,undefined,model);
  }
  let sent;
  const router=new FreeLlmRouter({
    providers:flash,state:new MemoryMeter(),settings:settingsFromEnv({}),
    fetchImpl:async(_url,options)=>{
      sent=JSON.parse(options.body);
      return ok();
    },
  });
  const result=await router.complete({system:'brief',prompt:'JSON only'});
  assert.equal(result.provider,'gemini');
  assert.equal(sent.model,'gemini-2.5-flash');
  assert.equal(sent.reasoning_effort,'none');
  assert.equal(sent.max_tokens,1600);
  assert.equal(sent.reasoning,undefined);
});

test('Groq exhausted JSON budget falls back to Gemini without persisting incomplete output',async()=>{
  const p=providersFromEnv({
    CURATOR_GEMINI_API_KEY:'fake',CURATOR_GEMINI_MODEL:'gemini-2.5-flash',
    CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',
    CURATOR_GROQ_API_KEY:'fake',CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
    CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',
  });
  const meter=new MemoryMeter();
  const events=[];let calls=0;
  const router=new FreeLlmRouter({
    providers:p,state:meter,settings:config,logger:x=>events.push(x),
    fetchImpl:async()=> {
      calls++;
      if(calls===1)return new Response(JSON.stringify({
        choices:[{finish_reason:'length',message:{content:'{"title":"partial"}'}}],
      }),{status:200});
      return ok();
    },
  });
  const answer=await router.complete({system:'s',prompt:'p',validateOutput:JSON.parse});
  assert.equal(answer.provider,'gemini');
  assert.equal(answer.fallbackUsed,true);
  assert.equal(meter.n,2);
  assert.deepEqual(events.map(x=>x.result),['invalid_output','success']);
  assert.equal(events[0].reason,'token_limit');
});


test('configured free provider priority is Groq then Gemini then OpenRouter regardless of key insertion order',()=>{
  const env={
    CURATOR_OPENROUTER_API_KEY:'fake',CURATOR_OPENROUTER_MODEL:'openrouter/free',
    CURATOR_GEMINI_API_KEY:'fake',CURATOR_GEMINI_MODEL:'gemini-2.5-flash',
    CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',
    CURATOR_GROQ_API_KEY:'fake',CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
    CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',
  };
  assert.deepEqual(providersFromEnv(env).map(p=>p.id),['groq','gemini','openrouter']);
  assert.deepEqual(providersFromEnv({...env,CURATOR_GROQ_API_KEY:''}).map(p=>p.id),
    ['gemini','openrouter']);
  assert.deepEqual(providersFromEnv({...env,CURATOR_GEMINI_API_KEY:''}).map(p=>p.id),
    ['groq','openrouter']);
  assert.deepEqual(providersFromEnv({...env,CURATOR_OPENROUTER_API_KEY:''}).map(p=>p.id),
    ['groq','gemini']);
  assert.equal(providersFromEnv(env)[1].reasoningEffort,'none');
});

test('production-order failover Groq → Gemini → OpenRouter uses same metering and skips invalid prose',async()=>{
  const providers=providersFromEnv({
    CURATOR_OPENROUTER_API_KEY:'fake',CURATOR_OPENROUTER_MODEL:'openrouter/free',
    CURATOR_GEMINI_API_KEY:'fake',CURATOR_GEMINI_MODEL:'gemini-2.5-flash',
    CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',
    CURATOR_GROQ_API_KEY:'fake',CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
    CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',
  });
  const meter=new MemoryMeter(), events=[];
  let calls=0;
  const router=new FreeLlmRouter({providers,state:meter,settings:config,logger:e=>events.push(e),
    fetchImpl:async()=>{
      calls++;
      if(calls===1)return new Response('',{status:429});
      if(calls===2)return new Response(JSON.stringify({
        choices:[{finish_reason:'length',message:{content:'{"title":"partial"}'}}],
      }),{status:200});
      return ok();
    },
  });
  const result=await router.complete({system:'s',prompt:'p',validateOutput:JSON.parse});
  assert.equal(result.provider,'openrouter');
  assert.equal(result.fallbackUsed,true);
  assert.equal(result.attempts,3);
  assert.equal(meter.n,3);
  assert.deepEqual(events.map(e=>[e.provider,e.result]),[
    ['groq','rate_limit'],['gemini','invalid_output'],['openrouter','success'],
  ]);
});

test('draft-invalid free providers remain eligible for independent review without bypassing quotas',async()=>{
  const env={
    CURATOR_GROQ_API_KEY:'fake',CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
    CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',
    CURATOR_GEMINI_API_KEY:'fake',CURATOR_GEMINI_MODEL:'gemini-2.5-flash',
    CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',
    CURATOR_OPENROUTER_API_KEY:'fake',CURATOR_OPENROUTER_MODEL:'openrouter/free',
  };
  const p=providersFromEnv(env),meter=new MemoryMeter(),calls=[],logs=[];
  const router=new FreeLlmRouter({providers:p,state:meter,settings:config,
    logger:x=>logs.push(x),
    fetchImpl:async(url)=>{
      const id=p.find(provider=>provider.url===url).id;
      calls.push(id);
      if(calls.length<3)return new Response(JSON.stringify({choices:[{
        message:{content:'invalid article JSON'},finish_reason:'stop',
      }]}),{status:200});
      return ok();
    },
  });
  const validate=content=>{if(!content.startsWith('{'))throw Error('Model output is not JSON');};
  const first=await router.complete({system:'draft',prompt:'p',phase:'draft',validateOutput:validate});
  assert.equal(first.provider,'openrouter');
  assert.ok(meter.blocked.groq_draft>0);
  assert.ok(meter.blocked.gemini_draft>0);
  assert.equal(meter.blocked.groq||0,0);
  const review=await router.complete({system:'review',prompt:'p',phase:'review',validateOutput:validate});
  assert.equal(review.provider,'groq');
  assert.deepEqual(calls,['groq','gemini','openrouter','groq']);
  assert.equal(meter.n,4); // Same global budget across both phases.
  assert.equal(logs.at(-1).result,'success');
});
test('provider HTTP quota/rate-limit cooldown remains shared between drafting and review',async()=>{
  const p=[candidates[0],candidates[1]],meter=new MemoryMeter();
  let n=0;
  const router=make(meter,async()=>{
    n++;
    return n===1?new Response('',{status:429}):ok();
  },p);
  const draft=await router.complete({system:'s',prompt:'p',phase:'draft'});
  assert.equal(draft.provider,'gemini');
  assert.ok(meter.blocked.openrouter>0);
  const review=await router.complete({system:'s',prompt:'p',phase:'review'});
  assert.equal(review.provider,'gemini');
  assert.equal(n,3);
  await assert.rejects(router.complete({system:'s',prompt:'p',phase:'unknown'}),/Unsupported LLM editorial phase/);
});

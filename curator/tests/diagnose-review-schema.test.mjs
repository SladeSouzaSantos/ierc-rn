import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runSyntheticReviewDiagnostic} from '../src/diagnose-review-schema.mjs';

const state=()=>({
  remainingCooldown:async()=>0,
  reserve:async()=> 'allowed',
  block:async()=>{},
});
const settings={maxAttempts:1,outputMaxTokens:1600,
  timeoutMs:2000,cooldownMs:1000,maxCooldownMs:1000};
const provider=(id='groq')=>({
  id,kind:'openai',url:'https://example.invalid/test',
  key:'TEST_ONLY_SECRET_NEVER_LOG',model:'test-model',maxCalls:10,
});
const response=content=>({
  ok:true,json:async()=>({
    choices:[{finish_reason:'stop',message:{content}}],
  }),
});
const validReview=JSON.stringify({
  decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:[
    'a biblioteca instalou placas táteis nas estantes',
    'incluiu mapas em relevo junto à entrada principal',
  ],
  unsupportedClaims:[],issues:[],
});

test('diagnostic isolates provider outcomes without CMS, source feed, or auth calls',async()=>{
  const calls=[];
  const logs=[];
  const output=await runSyntheticReviewDiagnostic({
    providers:[provider('groq'),provider('gemini'),provider('openrouter')],
    state:state(),settings,
    fetchImpl:async(url,options)=>{
      const parsed=JSON.parse(options.body);
      calls.push({url,method:options.method,headers:options.headers,parsed});
      return response(validReview);
    },
    logger:x=>logs.push(x),
  });
  assert.equal(output.length,3);
  assert.ok(output.every(x=>x.status==='schema_valid'));
  assert.ok(output.every(x=>x.evidenceGate==='full_article_review_passed'));
  assert.deepEqual(output.map(x=>x.provider),['groq','gemini','openrouter']);
  assert.ok(calls.every(x=>x.method==='POST' && x.url==='https://example.invalid/test'));
  assert.ok(calls.every(x=>x.parsed.messages[1].content.includes('fictício')));
  assert.ok(calls.every(x=>x.parsed.messages[0].content.includes('revisor')));
  assert.ok(calls.every(x=>x.parsed.max_tokens===1600));
  assert.deepEqual(logs.map(x=>x.event),Array(3).fill('review_schema_diagnostic'));
  assert.ok(logs.every(x=>x.synthetic===true));
  assert.ok(!JSON.stringify(logs).includes('TEST_ONLY_SECRET_NEVER_LOG'));
  assert.ok(!JSON.stringify(logs).includes('placas táteis'));
});

test('schema failure is categorized, outputs and credentials are never logged',async()=>{
  const logs=[];
  const output=await runSyntheticReviewDiagnostic({
    providers:[provider()],
    state:state(),settings,
    fetchImpl:async()=>response('{"decision":"approve"}'),
    logger:x=>logs.push(x),
  });
  assert.equal(output.length,1);
  assert.deepEqual(output[0],{
    provider:'groq',status:'schema_unavailable',category:'invalid_output',
    reason:'review_missing_fields',gate:'all_free_providers_unavailable',
  });
  assert.deepEqual(logs[0],{
    event:'review_schema_diagnostic',synthetic:true,...output[0],
  });
  assert.ok(!JSON.stringify(logs).includes('{"decision"'));
});

test('valid hold remains a hold, never reported as approved',async()=>{
  const output=await runSyntheticReviewDiagnostic({
    providers:[provider()],state:state(),settings,
    fetchImpl:async()=>response(JSON.stringify({
      decision:'hold',factualSupport:'insufficient',
      evidenceQuotes:[],unsupportedClaims:[],issues:['simulated objection'],
    })),
  });
  assert.equal(output[0].status,'schema_valid');
  assert.equal(output[0].decision,'hold');
  assert.equal(output[0].evidenceGate,'ai_review_hold');
});

test('diagnostic remains DEV-only, does not import CMS or editor write clients',()=>{
  const code=readFileSync(new URL('../src/diagnose-review-schema.mjs',import.meta.url),'utf8');
  assert.match(code,/CURATOR_INSTANCE_KIND!=='dev'/);
  assert.doesNotMatch(code,/from ['"]\.\/cms-publish|from ['"]\.\/editorial\.mjs|\bfetchArticleEvidence\b|\bCURATOR_STRAPI_PUBLISH_TOKEN\b|\bCURATOR_STRAPI_DRAFT_TOKEN\b/);
  assert.match(code,/maxAttempts:1/);
  assert.match(code,/cmsWrites:0/);
});

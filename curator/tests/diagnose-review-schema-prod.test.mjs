import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prodSyntheticDiagnosticPolicy} from '../src/diagnose-review-schema-prod.mjs';
import {runSyntheticReviewDiagnostic} from '../src/diagnose-review-schema.mjs';

const validEnv={
  CURATOR_INSTANCE_KIND:'prod',CURATOR_ENABLED:'true',
  CURATOR_WRITE_DRAFTS:'true',CURATOR_PROD_WRITE_ACK:'PROD_WRITES_APPROVED',
  CURATOR_PROD_AUTO_PUBLISH_ACK:'PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED',
  CURATOR_CMS_URL:'http://cms:1337',CURATOR_REDIS_URL:'redis://redis:6379',
  CURATOR_AUTO_PUBLISH_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-educacao',
  CURATOR_ONCE_LIMIT:'1',
  CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',
  CURATOR_GROQ_API_KEY:'synthetic-key',
  CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
};
test('PROD synthetic reviewer checks instance, licensed policy and one provider',()=>{
  const providers=prodSyntheticDiagnosticPolicy(validEnv,'groq');
  assert.equal(providers.length,1);
  assert.equal(providers[0].id,'groq');
  assert.equal(providers[0].model,'openai/gpt-oss-120b');
  for(const bad of ['random','',null,'all']){
    assert.throws(()=>prodSyntheticDiagnosticPolicy(validEnv,bad));
  }
  assert.throws(()=>prodSyntheticDiagnosticPolicy({
    ...validEnv,CURATOR_INSTANCE_KIND:'dev'},'groq'));
  assert.throws(()=>prodSyntheticDiagnosticPolicy({
    ...validEnv,CURATOR_PROD_AUTO_PUBLISH_ACK:'false'},'groq'));
  assert.throws(()=>prodSyntheticDiagnosticPolicy({
    ...validEnv,CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'perkins'},'groq'));
});
test('synthetic terminal 400 returns only static diagnostic, no CMS I/O or source data',async()=>{
  let calls=0,quota=0;const events=[];
  const state={
    async remainingCooldown(){return 0;},
    async reserve(){quota++;return 'allowed';},
    async block(){throw new Error('terminal status must never enter cooldown');},
  };
  const p=prodSyntheticDiagnosticPolicy(validEnv,'groq');
  const data=await runSyntheticReviewDiagnostic({
    providers:p,state,settings:{
      globalMax:5,windowMs:86400000,maxAttempts:1,timeoutMs:2000,
      cooldownMs:1000,maxCooldownMs:5000,outputMaxTokens:1600,
    },
    fetchImpl:async(_url,request)=>{
      calls++;
      const outbound=JSON.parse(request.body);
      assert.ok(outbound.messages.some(m=>m.content.includes('fictício')));
      assert.doesNotMatch(request.body,/s5fc7fiy2wtub65mwbndg7j2|Enem 2026/);
      return new Response('PRIVATE HTTP BODY FROM GROQ',{status:400});
    },
    logger:x=>events.push(x),
  });
  assert.equal(calls,1);
  assert.equal(quota,1);
  assert.deepEqual(data,[{provider:'groq',status:'schema_unavailable',
    category:'terminal',reason:'http_400',gate:'non_retryable_model_error'}]);
  assert.equal(events[0].reason,'http_400');
  assert.doesNotMatch(JSON.stringify(events),/PRIVATE HTTP BODY|synthetic-key/);
});

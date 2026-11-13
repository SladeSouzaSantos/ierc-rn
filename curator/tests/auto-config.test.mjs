import {test} from 'node:test';
import assert from 'node:assert/strict';
import {autoPublishSettingsFromEnv,publishingPolicyForCommand} from '../src/auto-config.mjs';

// Pure policy tests are independent of the host OS, Node process startup,
// anti-virus scanners and available Docker/Redis connections.
const approved={
  CURATOR_INSTANCE_KIND:'dev',
  CURATOR_AUTO_PUBLISH_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-esportes',
};
const configure=(overrides={},cmd='once',dryRun=false)=>
  autoPublishSettingsFromEnv({...approved,...overrides},cmd,{dryRun});

test('auto publication remains disabled by default without external effects',()=>{
  assert.deepEqual(autoPublishSettingsFromEnv({},'once',{dryRun:true}),{
    autoPublish:false,allowedSources:[],
  });
  assert.deepEqual(configure({CURATOR_AUTO_PUBLISH_ENABLED:'false'}),{
    autoPublish:false,allowedSources:[],
  });
});

test('auto publication refuses missing approval or draft-only execution before any I/O',()=>{
  for(const missing of [
    {CURATOR_AUTO_PUBLISH_ACK:''},
    {CURATOR_AUTO_PUBLISH_ACK:'not-approved'},
  ]){
    assert.throws(()=>configure(missing),/requires explicit licensed full-article review, environment-specific acknowledgment/);
  }
  assert.throws(()=>configure({},'once',true),
    /requires explicit licensed full-article review, environment-specific acknowledgment/);
  assert.throws(()=>configure({},'review-preview',true),
    /requires explicit licensed full-article review, environment-specific acknowledgment/);
});

test('PROD requires its own write and auto-publish acknowledgments before any IO',()=>{
  assert.throws(()=>configure({CURATOR_INSTANCE_KIND:'prod'}),
    /environment-specific acknowledgment/);
  assert.throws(()=>configure({CURATOR_INSTANCE_KIND:'prod',
    CURATOR_PROD_WRITE_ACK:'PROD_WRITES_APPROVED'}),
    /environment-specific acknowledgment/);
  const prod={CURATOR_INSTANCE_KIND:'prod',
    CURATOR_PROD_WRITE_ACK:'PROD_WRITES_APPROVED',
    CURATOR_PROD_AUTO_PUBLISH_ACK:'PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED'};
  assert.deepEqual(configure(prod,'schedule'),{
    autoPublish:true,allowedSources:['agencia-brasil-esportes'],
  });
  for (const mode of ['preview','review-preview']){
    assert.throws(()=>configure(prod,mode,true),/environment-specific acknowledgment/);
  }
  assert.throws(()=>configure({...prod,CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'rnib'}),
    /Explicit verified source allowlist/);
});
test('unsupported commands cannot activate automatic publication',()=>{
  assert.throws(()=>configure({},'preview'),
    /environment-specific acknowledgment/);
});

test('source allowlist must be explicit, trusted and duplicate-free',()=>{
  for(const list of ['', 'rnib','ibsa','wbu','perkins','w3c-wai',
    'agencia-brasil-justica','agencia-brasil-politica',
    'agencia-brasil-saude','agencia-brasil-geral',
    'agencia-brasil-esportes,rnib','agencia-brasil-esportes,agencia-brasil-esportes']){
    assert.throws(()=>configure({CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:list}),
      /Explicit verified source allowlist/);
  }
});

test('explicitly authorized DEV allows only known RSS sources and bounded schedule',()=>{
  assert.deepEqual(configure(),{autoPublish:true,allowedSources:['agencia-brasil-esportes']});
  assert.deepEqual(configure({CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-esportes,eu-commission-news'},'schedule'),{
    autoPublish:true,allowedSources:['agencia-brasil-esportes','eu-commission-news'],
  });
});

test('RSS-only acknowledgments and disabled full-article gate cannot publish',()=>{
 assert.throws(()=>configure({CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'false'}),
   /licensed full-article review/);
 assert.throws(()=>configure({CURATOR_AUTO_PUBLISH_ACK:'RSS_ONLY_REVIEW_ACCEPTED'}),
   /licensed full-article review/);
});


test('read-only previews work even when DEV autonomous publisher is enabled',()=>{
  const env={
    ...approved,
    CURATOR_ENABLED:'true',
    CURATOR_WRITE_DRAFTS:'true',
    CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'true',
  };
  for(const cmd of ['preview','generate-preview','review-preview','review-full-preview']){
    assert.deepEqual(publishingPolicyForCommand(env,cmd,{dryRun:true}),{
      autoPublish:false,allowedSources:[],archiveDiscovery:false,
    });
  }
  // Model previews must never acquire write privileges even if caller passes
  // an inconsistent dryRun flag; CLI separately sets dryRun=true.
  assert.deepEqual(publishingPolicyForCommand(env,'review-full-preview',{dryRun:false}),{
    autoPublish:false,allowedSources:[],archiveDiscovery:false,
  });
});

test('PROD preview never needs publishing acknowledgments or CMS write privileges',()=>{
  const env={
    ...approved,
    CURATOR_INSTANCE_KIND:'prod',
    CURATOR_WRITE_DRAFTS:'true',
    CURATOR_AUTO_PUBLISH_ACK:'',
    CURATOR_PROD_WRITE_ACK:'',
    CURATOR_PROD_AUTO_PUBLISH_ACK:'',
    CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'true',
  };
  assert.deepEqual(publishingPolicyForCommand(env,'review-full-preview',{dryRun:true}),{
    autoPublish:false,allowedSources:[],archiveDiscovery:false,
  });
  assert.throws(()=>publishingPolicyForCommand(env,'once',{dryRun:false}),
    /environment-specific acknowledgment/);
});

test('live once/schedule and pending retry retain licensed write authorization',()=>{
  const env={...approved};
  assert.deepEqual(publishingPolicyForCommand(env,'once',{dryRun:false}),{
    autoPublish:true,allowedSources:['agencia-brasil-esportes'],archiveDiscovery:false,
  });
  assert.deepEqual(publishingPolicyForCommand(env,'schedule',{dryRun:false}),{
    autoPublish:true,allowedSources:['agencia-brasil-esportes'],archiveDiscovery:false,
  });
  assert.throws(()=>publishingPolicyForCommand(env,'once',{dryRun:true}),
    /environment-specific acknowledgment/);
  assert.throws(()=>publishingPolicyForCommand({
    ...env,CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'rnib',
  },'once',{dryRun:false}),/allowlist/);
  assert.throws(()=>publishingPolicyForCommand(env,'retry-pending',{dryRun:false}),
    /environment-specific acknowledgment/);
});

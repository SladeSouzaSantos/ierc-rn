import {test} from 'node:test';
import assert from 'node:assert/strict';
import {autoPublishSettingsFromEnv} from '../src/auto-config.mjs';

// Pure policy tests are independent of the host OS, Node process startup,
// anti-virus scanners and available Docker/Redis connections.
const approved={
  CURATOR_INSTANCE_KIND:'dev',
  CURATOR_AUTO_PUBLISH_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'perkins',
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
    assert.throws(()=>configure(missing),/requires explicit DEV licensed full-article review acknowledgment/);
  }
  assert.throws(()=>configure({},'once',true),
    /requires explicit DEV licensed full-article review acknowledgment/);
  assert.throws(()=>configure({},'review-preview',true),
    /requires explicit DEV licensed full-article review acknowledgment/);
});

test('PROD and unsupported commands cannot activate automatic publication',()=>{
  assert.throws(()=>configure({CURATOR_INSTANCE_KIND:'prod'}),
    /requires explicit DEV licensed full-article review acknowledgment/);
  assert.throws(()=>configure({},'preview'),
    /requires explicit DEV licensed full-article review acknowledgment/);
});

test('source allowlist must be explicit, trusted and duplicate-free',()=>{
  for(const list of ['', 'rnib', 'ibsa', 'wbu','perkins,rnib','perkins,perkins']){
    assert.throws(()=>configure({CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:list}),
      /Explicit verified source allowlist/);
  }
});

test('explicitly authorized DEV allows only known RSS sources and bounded schedule',()=>{
  assert.deepEqual(configure(),{autoPublish:true,allowedSources:['perkins']});
  assert.deepEqual(configure({CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'perkins,w3c-wai'},'schedule'),{
    autoPublish:true,allowedSources:['perkins','w3c-wai'],
  });
});

test('RSS-only acknowledgments and disabled full-article gate cannot publish',()=>{
 assert.throws(()=>configure({CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'false'}),
   /licensed full-article review/);
 assert.throws(()=>configure({CURATOR_AUTO_PUBLISH_ACK:'RSS_ONLY_REVIEW_ACCEPTED'}),
   /licensed full-article review/);
});

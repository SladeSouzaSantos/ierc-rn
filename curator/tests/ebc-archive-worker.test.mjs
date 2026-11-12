import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPacedEbcFetch} from '../src/ebc-archive-worker.mjs';
import {ebcArchivePublishingFromEnv} from '../src/auto-config.mjs';
import {SOURCES} from '../src/feeds.mjs';

const source=SOURCES.find(s=>s.id==='agencia-brasil-educacao');
const settings={
  CURATOR_INSTANCE_KIND:'dev',
  CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'true',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
};
const check=(env,cmd='schedule',allowedSources=[source.id])=>
  ebcArchivePublishingFromEnv(env,cmd,
    {autoPublish:true,dryRun:false,allowedSources});

test('independent EBC archive publishing flag is off by default',()=>{
  assert.equal(check({...settings,CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'false'}),false);
  assert.equal(check({...settings,CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:undefined}),false);
  assert.equal(check(settings),true);
});
test('EBC archive publishing refuses PROD, preview, malformed flags, and non-licensed sources',()=>{
  assert.throws(()=>check({...settings,CURATOR_INSTANCE_KIND:'prod'}),/requires explicit/);
  assert.throws(()=>check({...settings,CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'yes'}),/requires explicit/);
  assert.throws(()=>check(settings,'preview'),/requires explicit/);
  assert.throws(()=>check(settings,'schedule',['agencia-brasil-esportes']),/requires explicit/);
  assert.throws(()=>check({...settings,CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'false'}),/requires explicit/);
});
test('EBC fetch pacing applies to official host requests but not unrelated hosts',async()=>{
  const calls=[],delays=[];
  const fetchImpl=createPacedEbcFetch(async url=>{
    calls.push(url);return new Response('ok');
  },{now:()=>1000,sleep:async ms=>delays.push(ms)});
  await fetchImpl(source.feed,{method:'GET'});
  await fetchImpl('https://www.w3.org/WAI/feed.xml',{method:'GET'});
  await fetchImpl('https://agenciabrasil.ebc.com.br/educacao',{method:'GET'});
  await fetchImpl('https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-acessibilidade',{method:'GET'});
  assert.equal(calls.length,4);
  assert.deepEqual(delays,[10000,10000]);
  await assert.rejects(fetchImpl('not_a_url'),/Invalid worker request URL/);
});

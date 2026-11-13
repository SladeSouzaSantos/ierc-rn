import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const doc='abc123def456ghi789jklm0';
const base={
  CURATOR_INSTANCE_KIND:'dev',
  CURATOR_ENABLED:'true',
  CURATOR_WRITE_DRAFTS:'true',
  CURATOR_AUTO_PUBLISH_ENABLED:'true',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-educacao',
  CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'false',
  CURATOR_REDIS_URL:'redis://127.0.0.1:1',
};
function invoke(overrides={},ids=[doc]){
  return spawnSync(process.execPath,['src/cli.mjs','retry-pending',...ids],{
    cwd,env:{...process.env,...base,...overrides},
    encoding:'utf8',timeout:6000,
  });
}
test('DEV retry refuses malformed or multiple IDs before any network I/O',()=>{
  for(const ids of [[],['5'],['../etc'],['https://x.test/id'],[doc,doc]]){
    const result=invoke({},ids);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Pending recovery requires exactly one documentId/);
    assert.doesNotMatch(result.stderr,/ECONNREFUSED|Redis is unavailable/);
  }
});
test('DEV retry never bypasses explicit auto-publish and full article ACKs',()=>{
  for(const overrides of [
    {CURATOR_AUTO_PUBLISH_ENABLED:'false'},
    {CURATOR_AUTO_PUBLISH_ACK:''},
    {CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'false'},
    {CURATOR_WRITE_DRAFTS:'false'},
    {CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'perkins'},
  ]){
    const result=invoke(overrides);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/Pending recovery requires approved|Auto publication requires explicit|allowlist/);
    assert.doesNotMatch(result.stderr,/ECONNREFUSED|Redis is unavailable/);
  }
});
test('approved DEV retry reaches Redis gate, not the old PROD-only rejection',()=>{
  const result=invoke();
  assert.equal(result.error,undefined);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Redis is unavailable or not ready/);
  assert.doesNotMatch(result.stderr,/Pending recovery requires PROD/);
});
test('PROD retry keeps its distinct explicit production write permission',()=>{
  const result=invoke({CURATOR_INSTANCE_KIND:'prod',
    CURATOR_PROD_WRITE_ACK:'',
    CURATOR_PROD_AUTO_PUBLISH_ACK:''});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/PROD draft writes require explicit/);
  assert.doesNotMatch(result.stderr,/Redis is unavailable/);
});

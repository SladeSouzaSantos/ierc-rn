import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../src/cli.mjs',import.meta.url));
function run(envOverrides={}){
 const env={
   ...process.env,
   CURATOR_ENABLED:'true',
   CURATOR_INSTANCE_KIND:'dev',
   CURATOR_WRITE_DRAFTS:'false',
   CURATOR_AUTO_PUBLISH_ENABLED:'true',
   CURATOR_AUTO_PUBLISH_ACK:'',
   CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'',
   CURATOR_OPENROUTER_API_KEY:'',
   CURATOR_STRAPI_DRAFT_TOKEN:'',
   CURATOR_STRAPI_PUBLISH_TOKEN:'',
   ...envOverrides,
 };
 return spawnSync(process.execPath,[cli,'once'],{encoding:'utf8',env,timeout:4000});
}
test('auto publishing fails before Redis/LLM when disabled or acknowledgment absent',()=>{
 const out=run();
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/requires explicit DEV RSS-only review acknowledgment/);
 assert.ok(!out.stderr.includes('ECONNREFUSED'));
});
test('PROD cannot activate automatic review and publication',()=>{
 const out=run({CURATOR_INSTANCE_KIND:'prod',CURATOR_WRITE_DRAFTS:'true',
   CURATOR_AUTO_PUBLISH_ACK:'RSS_ONLY_REVIEW_ACCEPTED'});
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/Automatic PROD ingestion is not approved|requires explicit DEV/);
});
test('source allowlist must be explicitly configured before network access',()=>{
 const out=run({CURATOR_WRITE_DRAFTS:'true',
   CURATOR_AUTO_PUBLISH_ACK:'RSS_ONLY_REVIEW_ACCEPTED'});
 assert.notEqual(out.status,0);
 assert.match(out.stderr,/Explicit verified source allowlist/);
 const invalid=run({CURATOR_WRITE_DRAFTS:'true',
   CURATOR_AUTO_PUBLISH_ACK:'RSS_ONLY_REVIEW_ACCEPTED',
   CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'rnib'});
 assert.match(invalid.stderr,/Explicit verified source allowlist/);
});

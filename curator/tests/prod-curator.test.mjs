import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {autoPublishSettingsFromEnv,ebcArchivePublishingFromEnv} from '../src/auto-config.mjs';
import {providersFromEnv} from '../src/providers.mjs';

const curator=resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=resolve(curator,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const prod={
  CURATOR_INSTANCE_KIND:'prod',CURATOR_ENABLED:'true',CURATOR_WRITE_DRAFTS:'true',
  CURATOR_PROD_WRITE_ACK:'PROD_WRITES_APPROVED',
  CURATOR_AUTO_PUBLISH_ENABLED:'true',
  CURATOR_PROD_AUTO_PUBLISH_ACK:'PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED',
  CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-direitos,agencia-brasil-esportes',
  CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'false',
};
test('PROD CLI refuses write without dedicated acknowledgment before Redis or LLM I/O',()=>{
  const env={...process.env,
    CURATOR_INSTANCE_KIND:'prod',CURATOR_ENABLED:'true',
    CURATOR_WRITE_DRAFTS:'true',CURATOR_AUTO_PUBLISH_ENABLED:'false',
    CURATOR_PROD_WRITE_ACK:''};
  const result=spawnSync(process.execPath,['src/cli.mjs','once'],
    {cwd:curator,env,encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/PROD draft writes require explicit local acknowledgment/);
  assert.doesNotMatch(result.stderr,/ECONNREFUSED|redis:\/\//);
});
test('PROD automatic publishing rejects missing separate approval before calling Redis',()=>{
  const env={...process.env,...prod,CURATOR_PROD_AUTO_PUBLISH_ACK:''};
  const result=spawnSync(process.execPath,['src/cli.mjs','schedule'],
    {cwd:curator,env,encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/environment-specific acknowledgment/);
  assert.doesNotMatch(result.stderr,/ECONNREFUSED|redis:\/\//);
});
test('PROD explicitly licensed policy allows a single source-bounded auto-publisher',()=>{
  const gate=autoPublishSettingsFromEnv(prod,'schedule',{dryRun:false});
  assert.deepEqual(gate,{autoPublish:true,
    allowedSources:['agencia-brasil-direitos','agencia-brasil-esportes']});
  assert.equal(ebcArchivePublishingFromEnv(prod,'schedule',
    {...gate,dryRun:false}),false);
});
test('PROD EBC archive discovery needs a separate source-specific acknowledgment',()=>{
  const gate=autoPublishSettingsFromEnv(prod,'schedule',{dryRun:false});
  assert.throws(()=>ebcArchivePublishingFromEnv({...prod,
    CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'true',
    CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-educacao'},'schedule',
    {autoPublish:true,allowedSources:['agencia-brasil-educacao'],dryRun:false}),
    /environment authorization/);
  assert.equal(ebcArchivePublishingFromEnv({...prod,
    CURATOR_EBC_ARCHIVE_PUBLISH_ENABLED:'true',
    CURATOR_PROD_EBC_ARCHIVE_ACK:'PROD_EBC_ARCHIVE_APPROVED'},'schedule',
    {autoPublish:true,allowedSources:['agencia-brasil-educacao'],dryRun:false}),true);
});
test('PROD provider gate never chooses a paid OpenRouter route',()=>{
  assert.throws(()=>providersFromEnv({
    CURATOR_OPENROUTER_API_KEY:'not-real',
    CURATOR_OPENROUTER_MODEL:'openai/gpt-4o',
  }),/paid models/);
  assert.deepEqual(providersFromEnv({
    CURATOR_OPENROUTER_API_KEY:'test-only',
    CURATOR_OPENROUTER_MODEL:'openrouter/free',
  }).map(p=>p.model),['openrouter/free']);
});
test('PROD Compose segregates Redis, CMS network, and does not expose public ports',()=>{
  const prodCompose=read('compose.curator.prod.yml');
  const devCompose=read('compose.curator.dev.yml');
  assert.match(prodCompose,/^name: ierc-rn-curator-prod$/m);
  assert.match(prodCompose,/name: ierc-rn-cms-prod_cms_prod_private/);
  assert.match(prodCompose,/env_file: \.\/curator\/\.env\.prod/);
  assert.match(prodCompose,/CURATOR_INSTANCE_KIND: prod/);
  assert.match(prodCompose,/CURATOR_CMS_URL: http:\/\/cms:1337/);
  assert.match(prodCompose,/CURATOR_REDIS_URL: redis:\/\/redis:6379/);
  assert.match(prodCompose,/curator_redis_prod:/);
  // Redis official entrypoint needs CHOWN and SETUID/SETGID to drop root
  // privileges via setpriv; cap_drop ALL alone causes exit 127/restart loop.
  const redisService=prodCompose.split(/^  worker:/m)[0];
  const workerService=prodCompose.split(/^  worker:/m)[1];
  assert.match(redisService,/cap_drop: \[ALL\]/);
  assert.match(redisService,/cap_add: \[CHOWN, SETGID, SETUID\]/);
  assert.match(redisService,/security_opt: \[no-new-privileges:true\]/);
  assert.match(workerService,/cap_drop: \[ALL\]/);
  assert.doesNotMatch(workerService,/cap_add:/);
  assert.doesNotMatch(prodCompose,/ports:|ierc-rn-cms_cms_private|\.\/curator\/\.env\s*$/m);
  assert.notEqual(prodCompose.match(/name: ierc-rn-curator-prod/)[0],devCompose.match(/name: ierc-rn-curator-dev/)[0]);
  const prodPreflight=read('scripts/preflight-curator-autopublish-prod.sh');
  assert.match(prodPreflight,/RESTORE_VERIFIED\.txt/);
  assert.match(prodPreflight,/--no-deps/);
  assert.doesNotMatch(prodPreflight,/docker (?:volume|system) prune|down -v/);
});

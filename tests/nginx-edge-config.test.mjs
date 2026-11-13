import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('infra/nginx/shared-main.conf');
const dev=read('infra/nginx/shared-dev.conf');
const prod=read('compose.portal.prod.yml');
const preview=read('compose.portal.dev.yml');
const ignore=read('.gitignore');

test('only existing nginx-proxy is used; no dedicated Nginx compose remains',()=>{
  assert.equal(existsSync(new URL('../compose.nginx.yml',import.meta.url)),false);
  assert.match(prod,/name: \$\{IERC_PROXY_NETWORK:-nginx_default\}/);
  assert.match(preview,/name: \$\{IERC_PROXY_NETWORK:-nginx_default\}/);
  assert.match(ignore,/^\/nginx\.conf$/m);
});

test('each checkout gets a unique Host and Docker proxy alias, never CMS',()=>{
  for(const [site,hostname,alias,opposite] of [
    [main,'iercrn.org.br','ierc-rn-main-portal','dev.iercrn.org.br'],
    [dev,'dev.iercrn.org.br','ierc-rn-dev-portal','strapi-dev.iercrn.org.br']
  ]){
    assert.ok(site.includes('server_name '+hostname+';'));
    assert.ok(site.includes('set $ierc_upstream '+alias+':3000;'));
    assert.match(site,/listen 80;/);
    assert.match(site,/resolver 127\.0\.0\.11 valid=10s ipv6=off;/);
    assert.match(site,/proxy_pass http:\/\/\$ierc_upstream;/);
    assert.match(site,/proxy_set_header X-Forwarded-Proto https;/);
    assert.doesNotMatch(site,/strapi\.|1337|1338|postgres|redis|listen 443;/i);
    // These templates must never be configured for the wrong hostname.
    assert.equal(site.includes('server_name '+opposite+';'),false);
  }
});

test('portal network maps keep private CMS and join same external shared nginx',()=>{
  for(const [cfg,alias,port,cmsNet] of [
    [prod,'ierc-rn-main-portal','3102','ierc-rn-prod-cms-read'],
    [preview,'ierc-rn-dev-portal','3101','ierc-rn-dev-cms-read']
  ]){
    assert.match(cfg,/cms_read:\s*\{\}/);
    assert.ok(cfg.includes('aliases: ['+alias+']'));
    assert.match(cfg,/proxy:\s*\n\s*external: true/);
    assert.ok(cfg.includes('name: '+cmsNet));
    assert.ok(cfg.includes('127.0.0.1:'+port+':3000'));
    assert.doesNotMatch(cfg,/ierc-rn-main-edge|ierc-rn-dev-edge/);
  }
});

test('local deployment never rewrites previous Nginx configuration',()=>{
  const script=read('scripts/prepare-shared-nginx.sh');
  assert.match(script,/Refusing to overwrite an existing nginx\.conf/);
  assert.match(script,/source_file=infra\/nginx\/shared-main\.conf/);
  assert.match(script,/source_file=infra\/nginx\/shared-dev\.conf/);
  assert.doesNotMatch(script,/nginx -s reload|docker compose.*up|docker restart/);
});

test('Git excludes machine-local Nginx config and generated/secret state',()=>{
  for(const pattern of [
    '/nginx.conf','.env*','!.env.example','cms-backups/','/backups/',
    '*.log','logs/','tmp/','dist/','curator/.cache/','cms/public/uploads/'
  ]){
    assert.ok(ignore.split('\\n').includes(pattern),
      'Expected gitignore entry: '+pattern);
  }
  assert.ok(existsSync(new URL('../infra/nginx/shared-main.conf',import.meta.url)));
  assert.ok(existsSync(new URL('../infra/nginx/shared-dev.conf',import.meta.url)));
});

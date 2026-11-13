import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const base=read('infra/nginx/nginx.conf');
const main=read('infra/nginx/conf.d/ierc-rn-main.conf');
const dev=read('infra/nginx/conf.d/ierc-rn-dev.conf');
const deny=read('infra/nginx/conf.d/00-default-deny.conf');
const edge=read('compose.nginx.yml');
const prod=read('compose.portal.prod.yml');
const preview=read('compose.portal.dev.yml');
test('MAIN and DEV use distinct Host-based vhosts and isolated Docker DNS',()=>{
  assert.match(main,/server_name iercrn\.org\.br;/);
  assert.match(main,/ierc-rn-main-portal:3000/);
  assert.doesNotMatch(main,/dev\.iercrn\.org\.br|strapi\./);
  assert.match(dev,/server_name dev\.iercrn\.org\.br;/);
  assert.match(dev,/ierc-rn-dev-portal:3000/);
  assert.doesNotMatch(dev,/strapi\.|127\.0\.0\.1:3102/);
  for(const site of [main,dev]){
    assert.match(site,/listen 8080;/);
    assert.match(site,/proxy_set_header Host \$host;/);
    assert.match(site,/proxy_set_header X-Forwarded-Proto https;/);
    assert.match(site,/proxy_pass http:\/\/\$ierc_(?:main|dev)_upstream;/);
    assert.doesNotMatch(site,/listen 443;|return 301|redis|postgres/i);
  }
});
test('unknown Host denied and Docker resolver is used for redeploys',()=>{
  assert.match(deny,/default_server/);
  assert.match(deny,/return 444;/);
  assert.match(base,/resolver 127\.0\.0\.11 valid=10s ipv6=off;/);
  assert.match(base,/pid \/tmp\/nginx\.pid;/);
  assert.doesNotMatch(base,/^user root/m);
});
test('dedicated edge Nginx is private, non-root and never attaches CMS network',()=>{
  assert.match(edge,/127\.0\.0\.1:18081:8080/);
  assert.match(edge,/user: "101:101"/);
  assert.match(edge,/read_only: true/);
  assert.match(edge,/cap_drop: \[ALL\]/);
  assert.match(edge,/no-new-privileges:true/);
  assert.match(edge,/ierc-rn-main-edge/);
  assert.match(edge,/ierc-rn-dev-edge/);
  assert.doesNotMatch(edge,/cms_read|1337|1338/);
  // Match published ports only, not the harmless 80/443 explanatory comment.
  assert.doesNotMatch(edge,/^\s*- ["']?(?:0\.0\.0\.0:)?(?:80|443):/m);
});
test('portal private CMS networks remain intact, and only edge networks are added',()=>{
  for(const [config,alias,edgeNetwork] of [
    [prod,'ierc-rn-main-portal','ierc-rn-main-edge'],
    [preview,'ierc-rn-dev-portal','ierc-rn-dev-edge']
  ]){
    assert.match(config,/cms_read:\s*\{\}/);
    assert.ok(config.includes('aliases: ['+alias+']'));
    assert.ok(config.includes('name: '+edgeNetwork));
    assert.match(config,/external: true/);
  }
  assert.match(prod,/127\.0\.0\.1:3102:3000/);
  assert.match(preview,/127\.0\.0\.1:3101:3000/);
  assert.match(prod,/name: ierc-rn-prod-cms-read/);
  assert.match(preview,/name: ierc-rn-dev-cms-read/);
});

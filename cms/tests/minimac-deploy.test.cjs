const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = file => readFileSync(join(__dirname, '../..', file), 'utf8');

test('portal DEV/PROD have separate names, localhost ports and CMS networks', () => {
  const dev = read('compose.portal.dev.yml');
  const prod = read('compose.portal.prod.yml');
  assert.match(dev, /^name: ierc-rn-portal-dev$/m);
  assert.match(prod, /^name: ierc-rn-portal-prod$/m);
  assert.match(dev, /127\.0\.0\.1:3101:3000/);
  assert.match(prod, /127\.0\.0\.1:3102:3000/);
  assert.match(dev, /name: ierc-rn-dev-cms-read/);
  assert.match(prod, /name: ierc-rn-prod-cms-read/);
  assert.match(dev, /CMS_API_URL: http:\/\/cms:1337/);
  assert.match(prod, /CMS_API_URL: http:\/\/cms:1337/);
  assert.doesNotMatch(dev + prod, /CURATOR_AUTO_PUBLISH_ENABLED:\s*["']?true/);
});

test('CMS DB private networks stay inaccessible from Next.js portal networks', () => {
  const dev = read('compose.cms.yml');
  const prod = read('compose.cms.prod.yml');
  assert.match(dev, /name: ierc-rn-dev-cms-read/);
  assert.match(prod, /name: ierc-rn-prod-cms-read/);
  assert.match(dev, /networks: \[cms_private, portal_read\]/);
  assert.match(prod, /networks: \[cms_prod_private, portal_read\]/);
  assert.match(dev, /db:[\s\S]*?networks: \[cms_private\]/);
  assert.match(prod, /db:[\s\S]*?networks: \[cms_prod_private\]/);
});

test('Strapi reverse-proxy settings default closed and Next.js builds standalone', () => {
  const gen = read('cms/scripts/generate.mjs');
  assert.match(gen, /url: env\('PUBLIC_URL', ''\)/);
  assert.match(gen, /proxy: \{ koa: env\.bool\('TRUST_PROXY', false\) \}/);
  assert.match(read('next.config.ts'), /output: "standalone"/);
  assert.match(read('app/layout.tsx'), /process\.env\.SITE_URL/);
});

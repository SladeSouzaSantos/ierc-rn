const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const root = join(__dirname, '..');
execFileSync(process.execPath, [join(root, 'scripts/generate.mjs')], { cwd: root });
const configPath = join(root, 'config/middlewares.js');
const originalKind = process.env.CMS_INSTANCE_KIND;
const originalEval = process.env.CMS_DIAGNOSTIC_UNSAFE_EVAL;
function config(kind, allow) {
  if (kind === undefined) delete process.env.CMS_INSTANCE_KIND;
  else process.env.CMS_INSTANCE_KIND = kind;
  if (allow === undefined) delete process.env.CMS_DIAGNOSTIC_UNSAFE_EVAL;
  else process.env.CMS_DIAGNOSTIC_UNSAFE_EVAL = allow;
  delete require.cache[require.resolve(configPath)];
  return require(configPath);
}
function security(list) { return list.find(item => item === 'strapi::security' || item.name === 'strapi::security'); }
test('CSP default stays strict even for a DEV instance', () => {
  assert.equal(security(config('dev', undefined)), 'strapi::security');
  assert.equal(security(config('dev', 'false')), 'strapi::security');
  assert.equal(security(config(undefined, 'true')), 'strapi::security');
});
test('CSP diagnostic requires dev and an explicit true flag', () => {
  const sec = security(config('dev', 'true'));
  assert.equal(sec.name, 'strapi::security');
  assert.deepEqual(sec.config.contentSecurityPolicy.directives['script-src'], ["'self'", "'unsafe-eval'"]);
  assert.equal(sec.config.contentSecurityPolicy.useDefaults, true);
  assert.deepEqual(Object.keys(sec.config.contentSecurityPolicy.directives), ['script-src']);
});
test('PROD cannot enable unsafe eval by a stray flag', () => {
  assert.equal(security(config('prod', 'true')), 'strapi::security');
  assert.equal(security(config('production', 'true')), 'strapi::security');
});
test('security override never removes the private API authorization guard', () => {
  assert.ok(config('dev', 'true').includes('global::private-api-gate'));
});
process.env.CMS_INSTANCE_KIND = originalKind;
process.env.CMS_DIAGNOSTIC_UNSAFE_EVAL = originalEval;

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

test('Strapi CMS components and admin override use the exact same release', () => {
  const release = pkg.dependencies['@strapi/strapi'];
  assert.match(release, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.dependencies['@strapi/plugin-users-permissions'], release);
  assert.equal(pkg.dependencies['@strapi/typescript-utils'], release);
  assert.equal(pkg.overrides['@strapi/admin'], release);
});

test('Isolated Strapi admin stays on supported React Router and React majors', () => {
  assert.match(pkg.dependencies.react, /^18\./);
  assert.match(pkg.dependencies['react-dom'], /^18\./);
  assert.match(pkg.dependencies['react-router-dom'], /^6\./);
});

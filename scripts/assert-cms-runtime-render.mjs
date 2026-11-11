// Verify the actual Next.js production build, not only route source declarations.
// Building without CMS_ENABLED must not permanently freeze public editorial pages.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(readFileSync('.next/prerender-manifest.json', 'utf8'));
assert.ok(manifest?.routes && typeof manifest.routes === 'object', 'Missing Next.js prerender manifest');

const mustRenderAtRuntime = [
  '/',
  '/radar-da-inclusao',
  '/noticias',
  '/atividades',
  '/eventos',
  '/historias',
];
const frozen = mustRenderAtRuntime.filter(path => Object.hasOwn(manifest.routes, path));
assert.deepEqual(frozen, [], 'CMS-dependent pages are unexpectedly pre-rendered at build time');
console.log('CMS_RUNTIME_RENDER_OK: editorial pages are not frozen in the production build');

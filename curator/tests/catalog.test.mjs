import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/feeds.mjs';
test('source catalog declares publication policy and exact official HTTPS origin', () => {
  assert.deepEqual(SOURCES.map(x=>x.id),['w3c-wai','rnib','ibsa','wbu']);
  assert.equal(new Set(SOURCES.map(x=>x.id)).size, SOURCES.length);
  for(const source of SOURCES) {
    assert.equal(new URL(source.feed).protocol,'https:');
    assert.equal(new URL(source.feed).hostname,source.hostname);
    assert.equal(typeof source.previewOnly,'boolean');
    assert.ok(source.readiness);
  }
  assert.equal(SOURCES.filter(x=>!x.previewOnly).length,1);
  assert.equal(SOURCES.find(x=>x.id==='wbu').readiness,'feed_verified_empty');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/feeds.mjs';
test('source catalog declares publication policy and exact official HTTPS origin', () => {
  assert.deepEqual(SOURCES.map(x=>x.id),[
    'eu-commission-news','agencia-brasil-direitos','agencia-brasil-educacao',
    'agencia-brasil-esportes','agencia-brasil-internacional',
    'w3c-wai','perkins','rnib','ibsa','wbu']);
  assert.equal(new Set(SOURCES.map(x=>x.id)).size, SOURCES.length);
  for(const source of SOURCES) {
    assert.equal(new URL(source.feed).protocol,'https:');
    assert.equal(new URL(source.feed).hostname,source.hostname);
    assert.equal(typeof source.previewOnly,'boolean');
    assert.ok(source.readiness);
  }
  assert.equal(SOURCES.filter(x=>!x.previewOnly).length,7);
  assert.equal(SOURCES.filter(x=>x.fullTextAccess?.status==='approved').length,5);
  assert.equal(SOURCES.filter(x=>['perkins','w3c-wai'].includes(x.id))
    .every(x=>x.fullTextAccess===undefined),true);
  const eu=SOURCES.find(x=>x.id==='eu-commission-news');
  assert.equal(eu.feed,'https://commission.europa.eu/node/29665/rss_en');
  assert.equal(eu.readiness,'official_rss_link_verified_runtime_check_pending');
  assert.equal(SOURCES.find(x=>x.id==='wbu').readiness,'feed_verified_empty');
});

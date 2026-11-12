import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/feeds.mjs';
test('source catalog declares publication policy and exact official HTTPS origin', () => {
  assert.deepEqual(SOURCES.map(x=>x.id),[
    'eu-commission-news','agencia-brasil-direitos','agencia-brasil-educacao',
    'agencia-brasil-esportes','agencia-brasil-internacional',
    'agencia-brasil-justica','agencia-brasil-politica',
    'agencia-brasil-saude','agencia-brasil-geral',
    'w3c-wai','perkins','diario-pcd','jornalista-inclusivo',
    'fundacao-dorina','ebu','iapb','rnib','ibsa','wbu']);
  assert.equal(new Set(SOURCES.map(x=>x.id)).size, SOURCES.length);
  for(const source of SOURCES) {
    assert.equal(new URL(source.feed).protocol,'https:');
    assert.equal(new URL(source.feed).hostname,source.hostname);
    assert.equal(typeof source.previewOnly,'boolean');
    assert.ok(source.readiness);
  }
  assert.equal(SOURCES.filter(x=>!x.previewOnly).length,7);
  const additions={
    'diario-pcd':'https://diariopcd.com.br/feed/',
    'jornalista-inclusivo':'https://jornalistainclusivo.com/feed/',
    'fundacao-dorina':'https://fundacaodorina.org.br/feed/',
    'ebu':'https://www.euroblind.org/rss.xml',
    'iapb':'https://www.iapb.org/feed/',
  };
  for(const [id,feed] of Object.entries(additions)){
    const found=SOURCES.find(x=>x.id===id);
    assert.ok(found, id);
    assert.equal(found.feed,feed);
    assert.equal(found.mode,'rss');
    assert.equal(found.previewOnly,true);
    assert.equal(found.paused,undefined);
    assert.equal(found.fullTextAccess,undefined);
    assert.match(found.readiness,/reuse_permission_pending/);
  }

  assert.equal(SOURCES.filter(x=>x.fullTextAccess?.status==='approved').length,5);
  const discovery=['justica','politica','saude','geral'].map(x=>
    SOURCES.find(s=>s.id==='agencia-brasil-'+x));
  for(const entry of discovery){
    assert.ok(entry);
    assert.equal(entry.previewOnly,true);
    assert.equal(entry.fullTextAccess,undefined);
    assert.equal(entry.readiness,'official_rss_discovery_live_validation_pending');
    assert.equal(new URL(entry.feed).pathname,'/rss/'+entry.section+'/feed.xml');
  }
  assert.equal(SOURCES.filter(x=>['perkins','w3c-wai'].includes(x.id))
    .every(x=>x.fullTextAccess===undefined),true);
  const eu=SOURCES.find(x=>x.id==='eu-commission-news');
  assert.equal(eu.feed,'https://commission.europa.eu/node/29665/rss_en');
  assert.equal(eu.paused,true);
  assert.equal(eu.readiness,'temporarily_paused_timeout_windows_docker_2026-11-10');
  assert.equal(SOURCES.find(x=>x.id==='wbu').readiness,'feed_verified_empty');
});

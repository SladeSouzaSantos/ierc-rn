const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { existsSync, readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
test('generator cria rotas e schemas reproduziveis do Strapi', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/generate.mjs')], { stdio: 'pipe' });
  for (const singular of ['news-article','event','activity','athlete','gallery','media-record','site-setting']) {
    const schemaPath = path.join(root, 'src/api', singular, 'content-types', singular, 'schema.json');
    const model = JSON.parse(readFileSync(schemaPath, 'utf8'));
    assert.equal(model.info.singularName, singular);
    assert.equal(model.options.draftAndPublish, true);
    assert.deepEqual(model.attributes.editorialStatus.enum, ['em_preparacao','em_revisao','aprovado']);
    assert.equal(model.attributes.editorialStatus.default, 'em_preparacao');
    for (const kind of ['routes','controllers','services']) {
      assert.ok(existsSync(path.join(root, 'src/api', singular, kind, singular + '.js')));
    }
  }
});
test('todos os modelos com retrato exigem aprovacao de imagem', () => {
  for (const singular of ['news-article','event','activity','athlete']) {
    const schema = JSON.parse(readFileSync(path.join(root, 'src/api', singular, 'content-types', singular, 'schema.json')));
    assert.ok(schema.attributes.image);
    assert.equal(schema.attributes.imageRightsStatus.default, 'pendente');
    assert.ok(schema.attributes.imageAlt);
    assert.ok(schema.attributes.imageCredit);
  }
});
test('cada registro de midia exige texto alternativo, credito e comprovacao de licenca', () => {
  const m = JSON.parse(readFileSync(path.join(root, 'src/api/media-record/content-types/media-record/schema.json')));
  for (const field of ['altText', 'credit', 'licenseType', 'licenseEvidence']) {
    assert.equal(m.attributes[field].required, true, field);
  }
  assert.equal(m.attributes.imageRightsStatus.default, 'pendente');
  assert.equal(m.attributes.consentConfirmed.default, false);
});
test('nada publica dados de visitas ou usuarios automaticamente', () => {
  const src = readFileSync(path.join(root, 'scripts/generate.mjs'), 'utf8');
  assert.ok(!src.includes('strapi.admin.services.user.create'));
  assert.ok(!src.includes('apiToken: { token:'));
  const settings = JSON.parse(readFileSync(path.join(root, 'src/api/site-setting/content-types/site-setting/schema.json')));
  assert.equal(settings.kind,'singleType');
  assert.ok(settings.attributes.visitBookingUrl);
  assert.ok(!settings.attributes.visitBookingUrl.default);
});

test('favicon provisório existe e é um PNG válido antes do boot', () => {
  const favicon = path.join(root, 'favicon.png');
  assert.ok(existsSync(favicon));
  const buffer = readFileSync(favicon);
  assert.deepEqual(Array.from(buffer.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('Radar da Inclusão exige origem externa e não afeta as noticias institucionais', () => {
  const schema=JSON.parse(readFileSync(path.join(root,'src/api/news-article/content-types/news-article/schema.json'),'utf8'));
  assert.equal(schema.attributes.originType.default,'institucional');
  assert.deepEqual(schema.attributes.originType.enum,['institucional','externa']);
  assert.deepEqual(schema.attributes.scope.enum,['local','brasil','internacional']);
  assert.equal(schema.attributes.aiAssisted.default,false);
  assert.equal(schema.attributes.dedupeKey.unique,true);
  assert.ok(schema.attributes.whyItMatters);
});

test('competicoes esportivas manuais exigem revisao editorial e nunca confirmam participacao por padrao', () => {
  const schema = JSON.parse(readFileSync(
    path.join(root, 'src/api/event/content-types/event/schema.json'), 'utf8'
  ));
  assert.equal(schema.options.draftAndPublish, true);
  assert.deepEqual(schema.attributes.eventType.enum, ['institucional','competicao_esportiva']);
  assert.equal(schema.attributes.eventType.default, 'institucional');
  assert.equal(schema.attributes.eventType.required, undefined);
  assert.deepEqual(schema.attributes.participationStatus.enum, ['nao_confirmada','confirmada']);
  assert.equal(schema.attributes.participationStatus.default, 'nao_confirmada');
  assert.equal(schema.attributes.participationStatus.required, undefined);
  assert.equal(schema.attributes.sportModality.type, 'string');
  assert.equal(schema.attributes.editorialStatus.default, 'em_preparacao');
  assert.ok(schema.attributes.sourceName);
  assert.ok(schema.attributes.sourceUrl);
});

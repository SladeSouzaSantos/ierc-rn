const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

const script = resolve(__dirname, '../scripts/verify-editorial-read.mjs');

async function exercise(expected, items, { responseStatus = 200, token = 'private-test-token' } = {}) {
  let calls = 0;
  const server = createServer((req, res) => {
    calls++;
    assert.equal(req.method, 'GET');
    assert.equal(req.headers.authorization, 'Bearer private-test-token');
    const url = new URL(req.url, 'http://127.0.0.1');
    assert.equal(url.pathname, '/api/news-articles');
    assert.equal(url.searchParams.get('status'), 'published');
    assert.equal(url.searchParams.get('filters[editorialStatus][$eq]'), 'aprovado');
    assert.equal(url.searchParams.get('filters[slug][$eq]'), 'homologacao-cms-dev');
    res.writeHead(responseStatus, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ data: items }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const completed = new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [script, 'homologacao-cms-dev', expected], {
      env: { ...process.env, CMS_API_URL: `http://127.0.0.1:${port}`, CMS_READ_TOKEN: token },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    p.stdout.on('data', chunk => stdout += chunk);
    p.stderr.on('data', chunk => stderr += chunk);
    p.on('error', reject);
    p.on('close', code => resolve({ code, stdout, stderr }));
  });
  try {
    const result = await completed;
    if (token) assert.ok(!`${result.stdout}${result.stderr}`.includes(token));
    return { ...result, calls };
  } finally { await new Promise(resolve => server.close(resolve)); }
}

test('Draft ou revisao nao deve aparecer no gate de leitura aprovado+publicado', async () => {
  const result = await exercise('absent', []);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.calls, 1);
});

test('Documento aprovado e publicado aparece no gate de leitura', async () => {
  const result = await exercise('visible', [
    { slug: 'homologacao-cms-dev', editorialStatus: 'aprovado', publishedAt: '2026-11-10T12:00:00.000Z' },
  ]);
  assert.equal(result.code, 0, result.stderr);
});

test('API rejeita registro de revisao mesmo se filtro estiver errado', async () => {
  const result = await exercise('visible', [
    { slug: 'homologacao-cms-dev', editorialStatus: 'em_revisao', publishedAt: '2026-11-10T12:00:00.000Z' },
  ]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /gate/);
});

test('Sem token de leitura a auditoria falha fechada', async () => {
  const result = await exercise('absent', [], { token: '' });
  assert.equal(result.code, 2);
  assert.equal(result.calls, 0);
});

test('HTTP 401 ou 403 nao gera falso sucesso de rascunho ausente', async () => {
  const result = await exercise('absent', [], { responseStatus: 401 });
  assert.equal(result.code, 1);
  assert.equal(result.calls, 1);
});

test('Conteudo indevido nunca passa como visivel e falha sem aborto do runtime', async () => {
  const result = await exercise('visible', []);
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stderr, /esperado=visible, publicados_aprovados=0/);
  assert.doesNotMatch(result.stderr, /Assertion failed|UV_HANDLE_CLOSING|node::Abort/);
});

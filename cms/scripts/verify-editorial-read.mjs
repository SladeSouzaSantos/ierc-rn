/**
 * Read-only acceptance gate for a single DEV news-article slug.
 *
 * Usage (from repository root):
 *   node --env-file=.env.local cms/scripts/verify-editorial-read.mjs homologacao-cms-dev absent
 *   node --env-file=.env.local cms/scripts/verify-editorial-read.mjs homologacao-cms-dev visible
 *
 * No write methods, no drafts requested, no credentials logged. Only loopback CMS.
 */
async function main() {
const [slug, expected, ...extra] = process.argv.slice(2);
if (extra.length || !/^[a-z0-9-]{1,90}$/.test(slug || '') || !['absent', 'visible'].includes(expected)) {
  console.error('Uso: node --env-file=.env.local cms/scripts/verify-editorial-read.mjs <slug> <absent|visible>');
  return 2;
}

let cms;
try { cms = new URL(process.env.CMS_API_URL || ''); }
catch { console.error('CMS_API_URL ausente ou invalida.'); return 2; }
if (!['localhost', '127.0.0.1', '[::1]'].includes(cms.hostname) ||
    !['http:', 'https:'].includes(cms.protocol) ||
    cms.username || cms.password || cms.search || cms.hash || cms.pathname !== '/') {
  console.error('Bloqueado: a auditoria so consulta o CMS local, sem credenciais na URL.');
  return 2;
}
const token = process.env.CMS_READ_TOKEN?.trim();
if (!token || /[\r\n]/.test(token)) {
  console.error('CMS_READ_TOKEN somente leitura nao configurado. Nenhuma consulta realizada.');
  return 2;
}

const address = new URL('/api/news-articles', cms);
address.searchParams.set('status', 'published');
address.searchParams.set('filters[editorialStatus][$eq]', 'aprovado');
address.searchParams.set('filters[slug][$eq]', slug);
address.searchParams.set('pagination[pageSize]', '5');
let response;
try {
  response = await fetch(address, {
    method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error',
  });
} catch {
  console.error('Falha de rede ou timeout ao consultar a API local (sem alterar dados).');
  return 1;
}
if (!response.ok) {
  console.error(`API nao confirmou o acesso de leitura: HTTP ${response.status}.`);
  return 1;
}
let payload;
try { payload = await response.json(); }
catch { console.error('API retornou JSON invalido.'); return 1; }
if (!payload || !Array.isArray(payload.data)) {
  console.error('Contrato da API inesperado; auditoria inconclusiva.');
  return 1;
}
const records = payload.data;
const safe = records.every(item =>
  item && item.slug === slug && item.editorialStatus === 'aprovado' &&
  typeof item.publishedAt === 'string' && item.publishedAt.length > 0);
if (!safe) {
  console.error('Falha no gate: API retornou registro fora do filtro aprovado+publicado.');
  return 1;
}
const count = records.length;
const passed = expected === 'absent' ? count === 0 : count === 1;
if (!passed) {
  console.error(`FALHA: esperado=${expected}, publicados_aprovados=${count}.`);
  return 1;
}
console.log(`OK: esperado=${expected}, publicados_aprovados=${count}; GET somente leitura em CMS local.`);
return 0;
}

// Nao interromper o runtime com handles HTTP/undici ativos no Windows.
// O Node encerra naturalmente depois que suas conexoes pendentes forem liberadas.
process.exitCode = await main();

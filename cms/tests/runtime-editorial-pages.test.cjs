const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '../..');
const read = path => readFileSync(join(root, path), 'utf8');

// Docker builds Next.js before private CMS runtime environment variables are injected.
// The pages must not bake an empty CMS response into a static HTML snapshot.
test('CMS-dependent pages render dynamically with runtime-only credentials', () => {
  for (const route of [
    'app/page.tsx',
    'app/[slug]/page.tsx',
    'app/radar-da-inclusao/page.tsx',
  ]) {
    assert.match(read(route), /export const dynamic = ["']force-dynamic["'];/, route);
  }
});

test('CMS still filters Published + editorially approved content on the server', () => {
  const src = read('lib/cms.ts');
  assert.match(src, /import ["']server-only["']/);
  assert.match(src, /status: ["']published["']/);
  assert.match(src, /"filters\[editorialStatus\]\[\$eq\]": ["']aprovado["']/);
  assert.match(src, /item\.editorialStatus === ["']aprovado["']/);
  assert.match(src, /typeof item\.publishedAt === ["']string["']/);
  assert.match(src, /CMS_READ_TOKEN/);
});

test('the Radar filters attributable external news and uses a server-only CMS fetch', () => {
  assert.match(read('app/radar-da-inclusao/page.tsx'), /getCmsRadarNews\(\)/);
  const cms = read('lib/cms.ts');
  assert.match(cms, /"filters\[originType\]\[\$eq\]": ["']externa["']/);
  assert.match(cms, /item\.scope !== ["']local["']/);
  assert.match(cms, /attributableExternalArticle\(item\)/);
});

test('sport competitions use a dedicated read-only CMS collection, distinct from institutional events', () => {
  const cms=read('lib/cms.ts');
  const page=read('app/[slug]/page.tsx');
  const render=read('components/sport-competitions.tsx');
  assert.match(cms,/["']sport-competitions["']/);
  assert.match(cms,/getCmsSportCompetitions\(\)/);
  assert.match(cms,/find\(["']sport-competitions["']\)/);
  assert.match(page,/slug === ["']esportes["'] \? await getCmsSportCompetitions\(\)/);
  assert.match(page,/slug === ["']eventos["'] \? await getCmsEvents\(\)/);
  assert.match(render,/organizeSportCompetitions\(cbdv,competitions\)/);
  assert.match(cms,/v\.participationStatus === ["']confirmada["'] &&/);
  assert.match(cms,/v\.approvalReference/);
});

test('article impact heading and CBDV calendar have scoped responsive vertical spacing', () => {
  const news = read('app/noticias/[slug]/page.tsx');
  const sports = read('components/sport-competitions.tsx');
  const css = read('app/globals.css');
  assert.match(news, /<section className="cms-article-impact" aria-labelledby="cms-impact-title">/);
  assert.match(sports, /<section className="sport-cbdv-calendar" aria-labelledby="cbdv-sport-competitions">/);
  assert.match(css, /\.cms-article-impact\s*\{\s*margin-top:\s*clamp\(48px,\s*5vw,\s*80px\);\s*\}/);
  assert.match(css, /\.sport-cbdv-calendar\s*\{\s*margin-top:\s*clamp\(48px,\s*6vw,\s*88px\);\s*\}/);
});

test('event cards populate and serve only editorially approved Strapi images', () => {
  const cms = read('lib/cms.ts');
  const media = read('lib/event-media.ts');
  const endpoint = read('app/api/event-image/[slug]/route.ts');
  const cards = read('components/cms-public.tsx');
  const css = read('app/globals.css');
  assert.match(cms, /find\("events", \{ populate: "image" \}\)/);
  assert.match(cms, /getCmsEventImageBySlug/);
  assert.match(cms, /approvedEventImage\(v\)/);
  assert.match(media, /imageRightsStatus !== "autorizado"/);
  assert.match(media, /imageAlt/);
  assert.match(endpoint, /getCmsEventImageBySlug\(slug\)/);
  assert.match(endpoint, /"Cache-Control": "no-store"/);
  assert.match(cards, /className="editorial-event-media"/);
  assert.match(cards, /unoptimized loading="lazy"/);
  assert.match(cards, /alt=\{item\.image\.alt\}/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /\.cms-events-list \.event-group \+ \.event-group/);
});

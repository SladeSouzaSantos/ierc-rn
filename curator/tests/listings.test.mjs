import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/feeds.mjs';
import { listingDate, parseListing } from '../src/listings.mjs';

const rnib = SOURCES.find(x => x.id === 'rnib');
const ibsa = SOURCES.find(x => x.id === 'ibsa');
const now = Date.parse('2026-11-10T12:00:00Z');
const rnibHtml = '<html><div class="small-image-card listing__post">' +
  '<h2 class="small-image-card__title"><a href="https://www.rnib.org.uk/news/report-finds-nhs-app-falls-short-on-accessibility/">' +
  'Report finds NHS app falls short on accessibility</a></h2>' +
  '<p class="small-image-card__description">Original RNIB copyrighted excerpt must not be reused.</p>' +
  '<div class="small-image-card__meta-details"><span class="small-image-card__meta-item">Posted Monday, 2 November 2026</span></div>' +
  '</div></html>';
const ibsaHtml = '<div class="tekup-blog-wrap"><div class="tekup-blog-content">' +
  '<div class="tekup-blog-meta"><ul><li><a href="/categories/16/">IBSA</a></li>' +
  '<li>05 November 2026</li></ul></div>' +
  '<a href="https://ibsasport.org/news/from-guatemala-to-new-opportunities-ibsa-expands-goalball-development-across-latin-america/">' +
  '<h3>From Guatemala to New Opportunities: IBSA Expands Goalball Development Across Latin America</h3></a>' +
  '</div></div>';

test('RNIB allowlisted listing gets title/date/link, never copyrighted excerpt', () => {
  const items = parseListing(rnibHtml, rnib, now, 45);
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, '');
  assert.equal(items[0].country, 'Reino Unido');
  assert.match(items[0].url, /^https:\/\/www\.rnib\.org\.uk\/news\//);
  assert.equal(items[0].publishedAt, '2026-11-02T12:00:00.000Z');
});
test('IBSA listing extracts a goalball title without image or invented article body', () => {
  const items = parseListing(ibsaHtml, ibsa, now, 45);
  assert.equal(items.length, 1);
  assert.equal(items[0].summary, '');
  assert.ok(!('image' in items[0]));
  assert.match(items[0].title, /Goalball Development/);
});
test('HTML outside verified article path is rejected, even on the source host', () => {
  const altered = rnibHtml.replace('/news/report-finds-nhs-app', '/admin/report-finds-nhs-app');
  assert.equal(parseListing(altered, rnib, now).length, 0);
  const evil = ibsaHtml.replace('https://ibsasport.org/news/', 'https://evil.example/news/');
  assert.equal(parseListing(evil, ibsa, now).length, 0);
});
test('no future or invalid date; stale listings excluded', () => {
  assert.equal(listingDate('32 November 2026'), null);
  assert.equal(listingDate('30 February 2026'), null);
  assert.equal(parseListing(rnibHtml, rnib, Date.parse('2027-06-01T12:00:00Z')).length, 0);
  assert.equal(parseListing(rnibHtml.replace('2 November 2026', '2 November 2027'), rnib, now).length, 0);
});
test('unapproved HTML source cannot be parsed as a publishable feed', () => {
  assert.throws(() => parseListing(rnibHtml, {...rnib, previewOnly:false}, now), /preview-only/);
  assert.throws(() => parseListing(rnibHtml, {...rnib, id:'unknown'}, now), /Unsupported HTML source/);
});

test('counter diagnostics distinguish empty listing, invalid dates and foreign links',()=>{
 const none={};const date={};const link={};
 assert.equal(parseListing('<html><div>no card</div></html>',rnib,now,45,none).length,0);
 assert.equal(none.detectedCards,0);
 assert.equal(parseListing(rnibHtml.replace('2 November 2026','unknown'),rnib,now,45,date).length,0);
 assert.equal(date.invalidDate,1);
 assert.equal(parseListing(rnibHtml.replace('https://www.rnib.org.uk/news/','https://evil.example/news/'),rnib,now,45,link).length,0);
 assert.equal(link.invalidLink,1);
});

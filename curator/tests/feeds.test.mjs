import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES,parseFeed,relevant,canonicalLink} from '../src/feeds.mjs';
const source=SOURCES[0];
const atom='<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">'+
  '<entry><title>Accessibility for low vision learners</title>'+
  '<link href="https://www.w3.org/WAI/news/example?utm_source=campaign"/>'+
  '<updated>2026-11-09T12:00:00Z</updated>'+
  '<summary>New materials for screen reader testing and inclusive education</summary></entry></feed>';
test('canonical URLs eliminate tracking parameters but reject foreign hosts',()=>{
 assert.equal(canonicalLink('https://www.w3.org/WAI/news/example?utm_source=x',source),
   'https://www.w3.org/WAI/news/example');
 assert.equal(canonicalLink('http://www.w3.org/WAI/news/example',source),null);
 assert.equal(canonicalLink('https://evil.example/article',source),null);
});
test('only recent items from a verified host are parsed with date and URL',()=>{
 const items=parseFeed(atom,source,Date.parse('2026-11-09T15:00:00Z'));
 assert.equal(items.length,1);assert.ok(relevant(items[0]));
 assert.match(items[0].dedupeKey,/^[0-9a-f]{64}$/);
 assert.equal(items[0].url,'https://www.w3.org/WAI/news/example');
});
test('discard stale records and malicious cross-site links',()=>{
 const stale=parseFeed(atom,source,Date.parse('2027-03-01T12:00:00Z'));
 assert.equal(stale.length,0);
 const evil=parseFeed(atom.replace('www.w3.org','evil.example'),source,Date.parse('2026-11-09T15:00:00Z'));
 assert.equal(evil.length,0);
});
test('RSS format and lack of relevance are handled',()=>{
 const rss='<rss><channel><item><title>Goalball inclusion</title><link>https://www.w3.org/WAI/news/test</link>'+
  '<pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><description>Goalball athletes</description></item></channel></rss>';
 assert.equal(parseFeed(rss,source,Date.parse('2026-11-09T15:00:00Z')).length,1);
 assert.equal(relevant({title:'Weather',summary:'rain today'}),false);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES,parseFeed,relevant,canonicalLink} from '../src/feeds.mjs';
const source=SOURCES.find(s=>s.id==='w3c-wai');
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
 const evil=parseFeed(atom.replace('https://www.w3.org/WAI/news','https://evil.example/WAI/news'),source,Date.parse('2026-11-09T15:00:00Z'));
 assert.equal(evil.length,0);
});
test('RSS format and lack of relevance are handled',()=>{
 const rss='<rss><channel><item><title>Goalball inclusion</title><link>https://www.w3.org/WAI/news/test</link>'+
  '<pubDate>Mon, 09 Nov 2026 12:00:00 GMT</pubDate><description>Goalball athletes</description></item></channel></rss>';
 assert.equal(parseFeed(rss,source,Date.parse('2026-11-09T15:00:00Z')).length,1);
 assert.equal(relevant({title:'Weather',summary:'rain today'}),false);
});

test('Perkins RSS parses current educational news and preserves official source URL',()=>{
 const perkins=SOURCES.find(s=>s.id==='perkins');
 const rss='<rss><channel><item><title>More than a game: How adapted sport supports inclusion</title>'+
 '<link>https://www.perkins.org/more-than-a-game-how-sport-opens-doors-to-learning-and-belonging-for-children-with-disabilities/</link>'+
 '<pubDate>Thu, 05 Nov 2026 15:49:45 +0000</pubDate>'+
 '<description><![CDATA[<p>Accessible and adapted sports offer a sense of belonging.</p>]]></description>'+
 '</item></channel></rss>';
 const entries=parseFeed(rss,perkins,Date.parse('2026-11-10T12:00:00Z'));
 assert.equal(entries.length,1);
 assert.match(entries[0].url,/^https:\/\/www\.perkins\.org\//);
 assert.ok(entries[0].summary.includes('Accessible'));
 assert.equal(relevant(entries[0]),true);
});

test('empty RSS channel is valid but HTML pretending to be a feed is not',()=>{
 const wbu=SOURCES.find(x=>x.id==='wbu');
 assert.deepEqual(parseFeed('<rss><channel><title>WBU</title></channel></rss>',wbu),[]);
 assert.throws(()=>parseFeed('<html><body>blocked</body></html>',wbu),/Invalid RSS\/Atom/);
});
test('safe one-hop slash redirect works, external and extra redirects are blocked',async()=>{
 const {fetchSource}=await import('../src/feeds.mjs');
 const wbu=SOURCES.find(x=>x.id==='wbu');
 const urls=[];
 const payload=await fetchSource(wbu,async url=>{
  urls.push(url);
  return urls.length===1?new Response(null,{status:301,headers:{Location:'https://wbu.ngo/feed'}}):
   new Response('<rss><channel/></rss>',{status:200});
 });
 assert.equal(urls.length,2);assert.ok(payload.includes('rss'));
 await assert.rejects(fetchSource(wbu,async()=>new Response(null,{status:302,headers:{Location:'https://evil.example/feed'}})),/Unsafe source redirect/);
 let attempts=0;
 await assert.rejects(fetchSource(wbu,async()=>{
  attempts++;
  return new Response(null,{status:302,headers:{Location:'https://wbu.ngo/feed'}});
 }),/Unsafe source redirect/);
 assert.equal(attempts,2);
});


test('official Agency Brasil editorial RSS feeds parse as Portuguese source candidates',()=>{
 const ebc=SOURCES.find(s=>s.id==='agencia-brasil-esportes');
 assert.equal(ebc.fullTextAccess.reference,'https://agenciabrasil.ebc.com.br/sobre');
 const xml='<rss><channel><item>'+
 '<title>Brasil lança projetos de educação inclusiva e braille para estudantes com deficiência visual</title>'+
 '<link>https://agenciabrasil.ebc.com.br/esportes/noticia/2026-11/educacao-inclusiva-de-estudantes-cegos</link>'+
 '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
 '<description>Uma iniciativa de acessibilidade promove esporte adaptado e educação inclusiva entre jovens cegos.</description>'+
 '</item></channel></rss>';
 const items=parseFeed(xml,ebc,Date.parse('2026-11-10T15:00:00Z'));
 assert.equal(items.length,1);assert.equal(items[0].source,'Agência Brasil (EBC)');
 assert.equal(items[0].language,'pt-BR');
 assert.equal(relevant(items[0]),true);
 assert.match(items[0].dedupeKey,/^[a-f0-9]{64}$/);
 assert.equal(canonicalLink('https://other.example.com/story',ebc),null);
});
test('EU Commission RSS can supply international accessibility policy coverage',()=>{
 const eu=SOURCES.find(s=>s.id==='eu-commission-news');
 assert.equal(eu.fullTextAccess.basis,'cc-by-4.0-public-notice');
 const feed='<rss><channel><item>'+
 '<title>EU programme improves accessibility and independent living for persons with disabilities</title>'+
 '<link>https://commission.europa.eu/news-and-media/news/eu-improves-accessibility-and-independent-living-2026-11-10_en</link>'+
 '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
 '<description>New EU plans focus on accessible transport, assistive technology and equal opportunities for people with disabilities.</description>'+
 '</item></channel></rss>';
 const items=parseFeed(feed,eu,Date.parse('2026-11-10T15:00:00Z'));
 assert.equal(items.length,1);
 assert.equal(relevant(items[0]),true);
});

test('bounded RSS retry recovers transient network and 503 failures',async()=>{
  const {fetchSource}=await import('../src/feeds.mjs');
  const perkins=SOURCES.find(x=>x.id==='perkins');
  const xml='<rss><channel><title>Sample</title></channel></rss>';
  for(const first of [
    ()=>{throw new TypeError('temporary transport reset');},
    ()=>new Response('',{status:503}),
    ()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});},
  ]){
    let calls=0;
    const body=await fetchSource(perkins,async()=>{
      calls++;
      return calls===1?first():new Response(xml,{status:200});
    });
    assert.equal(calls,2);assert.equal(body,xml);
  }
});

test('RSS retry fails closed on 403 and unsafe redirects; recurrent outages stop at two attempts',async()=>{
  const {fetchSource}=await import('../src/feeds.mjs');
  const perkins=SOURCES.find(x=>x.id==='perkins');
  for(const response of [
    ()=>new Response('',{status:403}),
    ()=>new Response(null,{status:302,headers:{location:'https://evil.example/feed/'}}),
  ]){
    let calls=0;
    await assert.rejects(fetchSource(perkins,async()=>{
      calls++;return response();
    }));
    assert.equal(calls,1);
  }
  let attempts=0;
  await assert.rejects(fetchSource(perkins,async()=>{
    attempts++;throw new TypeError('repeated failure');
  }));
  assert.equal(attempts,2);
});

test('New publisher RSS sources are parsed only for safe preview metadata',()=>{
 const recent=Date.parse('2026-11-11T11:00:00Z');
 for(const id of ['diario-pcd','jornalista-inclusivo','fundacao-dorina','ebu','iapb']){
   const src=SOURCES.find(x=>x.id===id);
   assert.equal(src.previewOnly,true);
   assert.equal(src.fullTextAccess,undefined);
   const articleUrl='https://'+src.hostname+'/noticia-sobre-braille/';
   const xml='<?xml version="1.0"?><rss version="2.0"><channel><item>'+
     '<title><![CDATA[Educação em Braille para estudantes cegos]]></title>'+
     '<link>'+articleUrl+'</link>'+
     '<pubDate>Tue, 10 Nov 2026 11:00:00 GMT</pubDate>'+
     '<description><![CDATA[Novas iniciativas de leitura tátil e inclusão escolar.]]></description>'+
     '</item></channel></rss>';
   const found=parseFeed(xml,src,recent,45);
   assert.equal(found.length,1,id);
   assert.equal(found[0].url,articleUrl.slice(0,-1));
   assert.match(found[0].dedupeKey,/^[a-f0-9]{64}$/);
   assert.equal(parseFeed(xml.replace(articleUrl,'https://untrusted.example/news'),src,recent,45).length,0);
   assert.equal(parseFeed(xml,src,Date.parse('2027-02-01T11:00:00Z'),45).length,0);
 }
});

test('Discovery-only publisher feeds cannot be selected by automatic publication',async()=>{
 const {runOnce}=await import('../src/pipeline.mjs');
 const src=SOURCES.find(x=>x.id==='diario-pcd');
 let fetches=0,modelCalls=0,writes=0;
 const report=await runOnce({sources:[src],maxArticles:1,dryRun:false,autoPublish:true,
   autoPublishSources:['agencia-brasil-esportes'],
   publisher:{async publishApprovedDraft(){writes++;}},
   articleReader:async()=>{writes++;throw Error('not permitted');},
   cms:{async create(){writes++;}},
   store:{async set(){writes++;}},
   router:{async complete(){modelCalls++;}},
   fetchImpl:async()=>{fetches++;throw Error('must not fetch in publish mode');},
 });
 assert.equal(report.count,0);
 assert.equal(fetches,0);
 assert.equal(modelCalls,0);
 assert.equal(writes,0);
});

test('RSS malicious DTD and custom entities are rejected before parsing', () => {
 const now=Date.parse('2026-11-09T15:00:00Z');
 const xml='<?xml version="1.0"?><!DOCTYPE feed [<!ENTITY x "recursive">]>'+
   '<feed><entry><title>&x;</title></entry></feed>';
 assert.throws(()=>parseFeed(xml,source,now),/DTD is not allowed/);
 assert.equal(parseFeed(atom,source,now).length,1);
});

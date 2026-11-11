import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES} from '../src/feeds.mjs';
import {scanEbcReadiness,EBC_DISCOVERY_SECTIONS} from '../src/check-ebc-readiness.mjs';

const NOW=Date.parse('2026-11-11T17:00:00Z');
const rssFor=section=>'<rss><channel><item>'+
  '<title>Educação inclusiva e braille para estudantes cegos</title>'+
  '<link>https://agenciabrasil.ebc.com.br/'+section+'/noticia/2026-11/educacao-braille</link>'+
  '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
  '<description>Iniciativa de acessibilidade promove leitura tátil e educação inclusiva de estudantes com deficiência visual.</description>'+
  '</item></channel></rss>';

test('all eight official EBC feeds receive safe, read-only eligibility diagnostics',async()=>{
  const requested=[],logs=[];
  const result=await scanEbcReadiness({now:NOW,log:x=>logs.push(x),
    fetchImpl:async(url,options)=>{
      requested.push({url,options});
      const section=new URL(url).pathname.split('/')[2];
      return new Response(rssFor(section),{status:200});
    }});
  assert.equal(requested.length,8);
  assert.equal(result.completed.checked,8);
  assert.equal(result.completed.unavailable,0);
  assert.equal(result.completed.relevant,8);
  assert.equal(result.completed.potentialRightsChecks,4);
  assert.deepEqual(Object.keys(EBC_DISCOVERY_SECTIONS),[
    'agencia-brasil-direitos','agencia-brasil-educacao',
    'agencia-brasil-esportes','agencia-brasil-internacional',
    'agencia-brasil-justica','agencia-brasil-politica',
    'agencia-brasil-saude','agencia-brasil-geral']);
  assert.ok(requested.every(x=>x.options.method==='GET'&&
    x.options.redirect==='manual'&&x.url.startsWith('https://agenciabrasil.ebc.com.br/rss/')));
  assert.ok(result.events.filter(x=>x.event==='ebc_source_checked'&&
    x.policy==='discovery_only').length===4);
  assert.ok(result.events.every(x=>x.candidateLinks?.every(link=>
    !('body' in link)&&!('summary' in link)&&link.url.startsWith('https://agenciabrasil.ebc.com.br/'))));
  assert.deepEqual(logs.at(-1),result.completed);
  assert.equal(result.completed.cmsWrites,false);
  assert.equal(result.completed.aiUsed,false);
  assert.equal(result.completed.published,false);
});

test('only the exact trusted EBC catalog is accepted before HTTP requests',async()=>{
  let calls=0;
  const forged=SOURCES.map(s=>s.id==='agencia-brasil-direitos'?
    {...s,feed:'https://other.example.com/rss/direitos-humanos/feed.xml'}:s);
  await assert.rejects(scanEbcReadiness({catalog:forged,now:NOW,
    fetchImpl:async()=>{calls++;throw Error('Should not fetch');},
    log:()=>{},
  }),/approved RSS catalog/);
  assert.equal(calls,0);
});

test('transient EBC errors are counted without leaking raw errors or checking article bodies',async()=>{
  const result=await scanEbcReadiness({now:NOW,log:()=>{},
    fetchImpl:async(url)=>{
      if(url.includes('/rss/educacao/'))return new Response('',{status:403});
      const section=new URL(url).pathname.split('/')[2];
      return new Response(rssFor(section),{status:200});
    }});
  assert.equal(result.completed.unavailable,1);
  const failure=result.events.find(x=>x.source==='agencia-brasil-educacao');
  assert.equal(failure.reason,'http_error');
  assert.equal(failure.event,'ebc_source_unavailable');
  assert.equal(result.completed.potentialRightsChecks,3);
});

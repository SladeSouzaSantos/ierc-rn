import {test} from 'node:test';
import assert from 'node:assert/strict';
import {archivePageUrl,archiveSource,parseEbcArchive,
  inspectEbcArchive} from '../src/ebc-archive.mjs';

const at=Date.parse('2026-11-11T18:00:00Z');
const news='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-acessibilidade';
const irrelevant='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/assunto-irrelevante';
const card=(title,url,date='dom, 08/11/2026 - 11:40')=>
  '<div class="ultima-noticia"><div class="box-texto">'+
  '<a class="titulo-noticia" href="'+url+'">'+title+'</a>'+
  '<div class="data-publicacao"><span class="data">'+date+'</span></div>'+
  '</div></div>';
const page0='<html><main>'+
  card('Enem 2026 tem novas regras de acessibilidade',news)+
  card('Notícia sem relação editorial direta',irrelevant)+
  '</main></html>';
const page1='<html><main>'+
  card('Enem 2026 tem novas regras de acessibilidade',news)+
  card('História antiga de inclusão',irrelevant,'sab, 11/07/2026 - 11:40')+
  '</main></html>';
const paragraphs=[
 'Uma reportagem apresenta medidas de acessibilidade em um exame nacional, com orientações para candidatos que precisam de atendimento especializado e adaptações durante a aplicação da avaliação.',
 'A organização do exame detalha que estudantes com baixa visão podem solicitar auxílio de leitura e provas em braile. As opções de apoio devem ser solicitadas dentro do prazo previsto pela organização.',
 'A reportagem também explica como as escolas podem orientar estudantes e famílias sobre regras de acessibilidade e sobre os procedimentos formais para requerer o atendimento especializado.',
];
const full=byline=>'<html><div class="autor-noticia">'+byline+'</div>'+
  '<div class="conteudo-noticia">'+paragraphs.map(x=>'<p>'+x+'</p>').join('')+
  '</div></html>';

test('EBC listing parser requires official source, dated card and safe same-category URL',()=>{
  assert.equal(archiveSource('educacao').id,'agencia-brasil-educacao');
  assert.equal(archivePageUrl('educacao',0),'https://agenciabrasil.ebc.com.br/educacao');
  assert.equal(archivePageUrl('educacao',1),'https://agenciabrasil.ebc.com.br/educacao?page=1');
  assert.throws(()=>archivePageUrl('educacao',2),/first two/);
  assert.throws(()=>archiveSource('partners'),/Unsupported/);
  const html='<main>'+card('Enem 2026 tem novas regras de acessibilidade',news)+
    card('Enem 2026 tem novas regras de acessibilidade','https://evil.example/educacao/noticia/2026-11/falso')+
    card('Enem 2026 tem novas regras de acessibilidade','http://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/inseguro')+
    card('Enem 2026 tem novas regras de acessibilidade','https://agenciabrasil.ebc.com.br/politica/noticia/2026-11/outra-editoria')+
    card('Enem 2026 tem novas regras de acessibilidade','https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/antigo','ter, 11/07/2026 - 11:40')+
    card('Enem 2026 tem novas regras de acessibilidade',news)+
    '</main>';
  const results=parseEbcArchive(html,{section:'educacao',now:at});
  assert.equal(results.length,1);
  assert.equal(results[0].url,news);
  assert.equal(results[0].discoveryHint,true);
  assert.equal(results[0].publishedAt,'2026-11-08T14:40:00.000Z');
  assert.match(results[0].dedupeKey,/^[a-f0-9]{64}$/);
  assert.equal('summary' in results[0],false);
  assert.throws(()=>parseEbcArchive('<main>none</main>',{section:'educacao',now:at}),/archive_invalid_html/);
  assert.throws(()=>parseEbcArchive('x'.repeat(300001),{section:'educacao',now:at}),/archive_too_large/);
});

test('two paginated first-party pages and one full article only: 10s request pacing, no CMS/AI',async()=>{
  const requests=[],delays=[],events=[];
  const out=await inspectEbcArchive({section:'educacao',pages:2,
    maxEvidence:1,now:at,sleepImpl:async ms=>delays.push(ms),
    log:e=>events.push(e),
    fetchImpl:async(url,options)=>{
      requests.push({url,options});
      if(url===archivePageUrl('educacao',0))
        return new Response(page0,{headers:{'content-type':'text/html'}});
      if(url===archivePageUrl('educacao',1))
        return new Response(page1,{headers:{'content-type':'text/html'}});
      if(url===news)
        return new Response(full('Repórter da Agência Brasil'),{headers:{'content-type':'text/html'}});
      throw Error('Unknown network destination');
    }});
  assert.equal(out.completed.pagesChecked,2);
  assert.equal(out.completed.uniqueDatedItems,2);
  assert.equal(out.completed.titleHints,1);
  assert.equal(out.completed.evidenceChecked,1);
  assert.equal(out.completed.visualVerified,1);
  assert.deepEqual(requests.map(x=>x.url),[
    archivePageUrl('educacao',0),archivePageUrl('educacao',1),news]);
  assert.deepEqual(delays,[10000,10000]);
  assert.ok(requests.every(x=>x.options.method==='GET'&&x.options.redirect==='manual'));
  assert.equal(events.find(x=>x.event==='ebc_archive_candidate_checked')?.status,
    'visual_evidence_verified_for_review');
  assert.equal(out.completed.aiUsed,false);
  assert.equal(out.completed.cmsWrites,false);
  assert.equal(out.completed.published,false);
  assert.equal(JSON.stringify(out).includes('baixa visão'),false);
});

test('partner byline or denied article rights never becomes visual evidence approved',async()=>{
  const out=await inspectEbcArchive({section:'educacao',pages:1,
    maxEvidence:1,now:at,log:()=>{},sleepImpl:async()=>{},
    fetchImpl:async(url)=>{
      if(url===archivePageUrl('educacao',0))
        return new Response(page0,{headers:{'content-type':'text/html'}});
      if(url===news)
        return new Response(full('Reuters'),{headers:{'content-type':'text/html'}});
      throw Error('Unexpected URL');
    }});
  assert.equal(out.completed.visualVerified,0);
  const candidate=out.events.find(x=>x.event==='ebc_archive_candidate_checked');
  assert.equal(candidate.status,'article_evidence_unavailable');
  assert.equal(candidate.reason,'article_rights_unverified');
});

test('redirect and invalid listing do not follow external URLs or expose network error details',async()=>{
  let n=0;
  const out=await inspectEbcArchive({section:'educacao',pages:1,
    maxEvidence:0,now:at,log:()=>{},
    fetchImpl:async()=>{n++;return new Response(null,{status:302,headers:{Location:'https://other.example/'}});}});
  assert.equal(n,1);
  assert.equal(out.completed.pagesChecked,0);
  assert.equal(out.events[0].reason,'redirect_blocked');
  assert.equal(out.completed.evidenceChecked,0);
});


test('Braille in headline alone is insufficient without direct visual evidence in article body',async()=>{
  const titleOnly='<main>'+card('Braille estará em uma nova ação educacional',news)+'</main>';
  const nonVisual=[
    'A reportagem apresenta novos horários e regras de organização de um exame aplicado para estudantes de diferentes áreas, explicando como consultar as informações disponibilizadas pelos organizadores para as instituições de ensino.',
    'As equipes de apoio revisam documentos e orientações referentes ao acesso aos prédios e às salas onde ocorrerão as provas, com informações sobre transporte e horários de início e encerramento das atividades.',
    'Os participantes podem consultar orientações sobre os locais de prova e sobre os procedimentos administrativos associados aos eventos escolares e à comunicação com os organizadores durante o período da avaliação.',
  ];
  const html='<html><div class="autor-noticia">Repórter da Agência Brasil</div>'+
    '<div class="conteudo-noticia">'+nonVisual.map(x=>'<p>'+x+'</p>').join('')+
    '</div></html>';
  const out=await inspectEbcArchive({section:'educacao',pages:1,
    maxEvidence:1,now:at,log:()=>{},
    fetchImpl:async url=>url===archivePageUrl('educacao',0)?
      new Response(titleOnly,{headers:{'content-type':'text/html'}}):
      new Response(html,{headers:{'content-type':'text/html'}}),
    sleepImpl:async()=>{}});
  assert.equal(out.completed.visualVerified,0);
  assert.equal(out.completed.evidenceChecked,1);
  assert.equal(out.events.find(x=>x.event==='ebc_archive_candidate_checked')?.status,
    'visual_evidence_not_found');
});


test('diagnostic counters distinguish all-rejected layouts from no relevant headline',()=>{
  const counters={};
  const results=parseEbcArchive(page0,{section:'educacao',now:at,diagnostics:counters});
  assert.equal(results.length,2);
  assert.equal(counters.cardsFound,2);
  assert.equal(counters.accepted,2);
  assert.equal(counters.urlsRejected,0);
  assert.equal(counters.datesUnrecognized,0);
  const foreign='<main>'+card('Acessibilidade e Braille serão discutidos',
    'https://outro.example/educacao/noticia/2026-11/externa')+'</main>';
  const rejected={};
  assert.deepEqual(parseEbcArchive(foreign,{section:'educacao',now:at,diagnostics:rejected}),[]);
  assert.equal(rejected.cardsFound,1);
  assert.equal(rejected.urlsRejected,1);
  assert.equal(rejected.accepted,0);
});
test('official EBC alternative title class remains within dated public cards',()=>{
  const alt=card('Iniciativa amplia acesso ao Braille nas escolas',news)
    .replace('class="titulo-noticia"','class="titulo-noticia-interna"');
  const diagnostics={};
  const found=parseEbcArchive('<main>'+alt+'</main>',{
    section:'educacao',now:at,diagnostics});
  assert.equal(found.length,1);
  assert.equal(found[0].discoveryHint,true);
  assert.equal(diagnostics.accepted,1);
});

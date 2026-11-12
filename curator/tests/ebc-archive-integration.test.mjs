import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOnce} from '../src/pipeline.mjs';
import {collectEbcArchiveCandidates} from '../src/ebc-archive-worker.mjs';
import {fetchArticleEvidence} from '../src/article-evidence.mjs';
import {SOURCES} from '../src/feeds.mjs';

const source=SOURCES.find(s=>s.id==='agencia-brasil-educacao');
const url='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-acessibilidade';
const other='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/alunos-aprendizagem';
const card=(title,href,date)=>'<div class="ultima-noticia"><div class="box-texto">'+
  '<a class="titulo-noticia" href="'+href+'">'+title+'</a>'+
  '<div class="data-publicacao"><span class="data">'+date+'</span></div></div></div>';
const page0='<main>'+card('Enem estreia novas regras de acessibilidade',
  '/educacao/noticia/2026-11/enem-acessibilidade','dom, 08/11/2026 - 11:40')+'</main>';
const page1='<main>'+card('Aprendizagem de alunos com deficiência avança',
  '/educacao/noticia/2026-11/alunos-aprendizagem','sex, 06/11/2026 - 12:10')+'</main>';
const paragraphs=[
  'O exame nacional divulgou novas regras para atendimento especializado de estudantes e candidatos que precisam de orientações específicas durante as provas, incluindo solicitações de recursos adaptados e acompanhamento no local da avaliação.',
  'Candidatos com baixa visão podem solicitar auxílio de leitura e provas em Braille durante a aplicação, com procedimentos específicos para efetuar pedidos e consultar as regras de atendimento da organização.',
  'A reportagem descreve orientações para estudantes e familiares conhecerem os recursos de acessibilidade que são oferecidos durante o exame, esclarecendo os requisitos para atendimento especializado.',
];
const generic=[
  'A reportagem descreve dados gerais de aprendizado de estudantes durante avaliações realizadas por instituições de ensino, explicando características das provas e critérios de acompanhamento pedagógico.',
  'As instituições receberam novas orientações sobre indicadores e processos de avaliação utilizados para acompanhamento de trajetórias escolares, com informações sobre desempenho e recursos de ensino.',
  'A análise busca oferecer aos gestores um panorama dos indicadores nacionais de aprendizagem e educação para planejamento de medidas administrativas em instituições públicas.',
];
const html=(author,parts)=>'<html><div class="autor-noticia">'+author+
  '</div><div class="conteudo-noticia">'+parts.map(p=>'<p>'+p+'</p>').join('')+
  '</div></html>';
const rss='<rss><channel><item><title>Calendário administrativo de aulas</title>'+
  '<link>https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/horarios</link>'+
  '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
  '<description>Calendário geral de reuniões e planejamento de atividades administrativas das escolas.</description>'+
  '</item></channel></rss>';
function http(author='Repórter da Agência Brasil'){
  const requests=[];
  const fetchImpl=async(input,options={})=>{
    requests.push({url:input,method:options.method||'GET'});
    if(input===source.feed)return new Response(rss);
    if(input==='https://agenciabrasil.ebc.com.br/educacao')
      return new Response(page0,{headers:{'content-type':'text/html'}});
    if(input==='https://agenciabrasil.ebc.com.br/educacao?page=1')
      return new Response(page1,{headers:{'content-type':'text/html'}});
    if(input===url)return new Response(html(author,paragraphs),
      {headers:{'content-type':'text/html'}});
    if(input===other)return new Response(html('Repórter da Agência Brasil',generic),
      {headers:{'content-type':'text/html'}});
    throw Error('Unlisted URL');
  };
  return {requests,fetchImpl};
}
const drafted={
  title:'Exame apresenta adaptações de acessibilidade para candidatos',
  summary:'A Agência Brasil informa que o exame disponibiliza atendimento especializado para candidatos com baixa visão, incluindo auxílio de leitura e provas em Braille.',
  body:'As novas regras do exame descrevem orientações sobre solicitações de atendimento especializado. Os candidatos com baixa visão podem pedir auxílio de leitura e provas em Braille, seguindo os procedimentos divulgados pela organização.',
  whyItMatters:'A informação ajuda estudantes com deficiência visual a identificar modalidades de atendimento adaptado durante a avaliação.',
  category:'Educação inclusiva',
};
const reviewer={
  decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:[
    'Candidatos com baixa visão podem solicitar auxílio de leitura e provas em Braille',
    'A reportagem descreve orientações para estudantes e familiares conhecerem os recursos de acessibilidade',
  ],issues:[],unsupportedClaims:[],
};
function model(verdict=reviewer){
  let count=0;
  return {get count(){return count},async complete(){
    return {provider:'groq',content:JSON.stringify(++count===1?drafted:verdict)};
  }};
}
function mocks(){
  let draftCount=0,publishCount=0;
  return {get draftCount(){return draftCount;},get publishCount(){return publishCount;},
    store:{async set(){return 'OK'},async exists(){return 0},async eval(){return 1}},
    cms:{async existing(){return false},async create(){draftCount++;return 'doc-safe-id'}},
    publisher:{async publishApprovedDraft(){publishCount++;}},
  };
}
const now=Date.parse('2026-11-11T18:00:00Z');
const run=async({author,verdict,archiveDiscovery=true}={})=>{
  const net=http(author),services=mocks(),llm=model(verdict),events=[],delays=[];
  const result=await runOnce({sources:[source],fetchImpl:net.fetchImpl,
    articleReader:fetchArticleEvidence,now,maxArticles:1,dryRun:false,
    autoPublish:true,autoPublishSources:[source.id],archiveDiscovery,
    archivePaceSleep:async ms=>delays.push(ms),router:llm,
    store:services.store,cms:services.cms,publisher:services.publisher,
    logger:e=>events.push(e)});
  return {net,services,llm,events,delays,result};
};
test('full EBC archive collector returns only rights-verified directly visual candidates',async()=>{
  const net=http();
  const out=await collectEbcArchiveCandidates({source,now,
    fetchImpl:net.fetchImpl,articleReader:fetchArticleEvidence});
  assert.equal(out.candidates.length,1);
  assert.equal(out.candidates[0].url,url);
  assert.equal(out.candidates[0].relevance.editorialFocus,'visual_direta');
  assert.equal(out.evidenceByUrl.get(url).verified,true);
  assert.equal(out.evidenceByUrl.has(other),false);
  assert.equal(net.requests.every(r=>r.method==='GET'),true);
});
test('archive opt-in produces one draft, two AI passes and one approved publication',async()=>{
  const a=await run();
  assert.equal(a.result.results[0].status,'draft_published');
  assert.equal(a.services.draftCount,1);
  assert.equal(a.services.publishCount,1);
  assert.equal(a.llm.count,2);
  assert.equal(a.net.requests.filter(r=>r.url===url).length,1);
  assert.equal(a.delays.length>=4,true);
  assert.equal(a.delays.every(ms=>ms>9000),true);
  assert.equal(a.events.some(e=>e.event==='archive_candidate_verified'),true);
});
test('partner byline holds archive candidates before any AI calls or CMS operations',async()=>{
  const a=await run({author:'Reuters'});
  assert.equal(a.result.count,0);
  assert.equal(a.services.draftCount,0);
  assert.equal(a.services.publishCount,0);
  assert.equal(a.llm.count,0);
});
test('independent reviewer HOLD leaves an unpublished draft',async()=>{
  const a=await run({verdict:{decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['unsupported'],issues:['attribution']}});
  assert.equal(a.result.results[0].status,'draft_created_review_pending');
  assert.equal(a.services.draftCount,1);
  assert.equal(a.services.publishCount,0);
  assert.equal(a.llm.count,2);
});
test('feature absent preserves existing RSS worker with no archive requests',async()=>{
  const a=await run({archiveDiscovery:false});
  assert.equal(a.result.count,0);
  assert.equal(a.llm.count,0);
  assert.equal(a.services.draftCount,0);
  assert.equal(a.net.requests.length,1);
});

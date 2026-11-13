import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOnce} from '../src/pipeline.mjs';
import {SOURCES} from '../src/feeds.mjs';
import {fetchArticleEvidence} from '../src/article-evidence.mjs';
import {cmsClient} from '../src/editorial.mjs';
import {cmsPublisher} from '../src/cms-publish.mjs';

const source=SOURCES.find(s=>s.id==='agencia-brasil-educacao');
const URL_NEWS='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/educacao-braille';
const DOC_ID='abcdefghijklmnopqrstuvwx';
const title='Iniciativa de leitura em Braille apoia estudantes com deficiência visual';
const rss='<rss><channel><item><title>'+title+'</title>'+
  '<link>'+URL_NEWS+'</link><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
  '<description>Projeto de educação inclusiva apresenta leitura tátil em Braille, tecnologia assistiva e ações com estudantes cegos em sala de aula.</description>'+
  '</item></channel></rss>';
const paragraph1='Uma iniciativa de leitura tátil em Braille reuniu estudantes com deficiência visual em atividades educacionais inclusivas. As atividades contemplaram materiais acessíveis, acompanhamento de aprendizagem e experiências coletivas na escola.';
const paragraph2='Professores apresentaram recursos de tecnologia assistiva e material acessível para atividades de alfabetização. O projeto também reuniu educadores e estudantes para discutir o uso dos materiais e estratégias de leitura tátil.';
const paragraph3='A reportagem descreve ações de educação inclusiva para estudantes cegos, com foco em participação nas atividades de sala de aula. A equipe pedagógica relatou experiências realizadas com a comunidade escolar durante o desenvolvimento das atividades.';
const ebcHtml=author=>'<html><body><div class="autor-noticia">'+author+'</div>'+
  '<div class="conteudo-noticia"><p>'+paragraph1+'</p><p>'+paragraph2+
  '</p><p>'+paragraph3+'</p></div></body></html>';
const generated={
  title:'Escola apresenta atividades de leitura tátil em Braille',
  summary:'Uma iniciativa educacional apresenta leitura tátil em Braille e recursos de tecnologia assistiva para estudantes com deficiência visual em atividades escolares.',
  body:'Uma escola apresentou atividades inclusivas de alfabetização e leitura tátil em Braille. A reportagem descreve materiais acessíveis e recursos de tecnologia assistiva utilizados no contexto escolar, com participação de docentes e estudantes.',
  whyItMatters:'A experiência permite refletir sobre o acesso a materiais educacionais adaptados na educação brasileira.',
  category:'Educação inclusiva',
};
const approved={
  decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:[
    'Uma iniciativa de leitura tátil em Braille reuniu estudantes com deficiência visual',
    'Professores apresentaram recursos de tecnologia assistiva e material acessível',
  ],
  unsupportedClaims:[],issues:[],
};
function model(review=approved){
  let calls=0;
  return {get calls(){return calls;},async complete(){
    calls++;
    return {provider:'groq',content:JSON.stringify(calls===1?generated:review)};
  }};
}
function store(){
  let seen=0;
  return {get seen(){return seen;},
    async set(key){if(key.startsWith('ierc:curator:seen:'))seen++;return 'OK';},
    async exists(){return 0;},async eval(){return 1;}};
}
function fakeCmsFetch({byline='Agência Brasil'}={}){
  const calls=[];
  let draft=null,publication=null;
  const json=(data,status=200)=>Response.json({data},{status});
  return {calls,get draft(){return draft;},get publication(){return publication;},
    async fetch(url,options={}){
      const method=options.method||'GET';
      calls.push({url,method,authorization:options.headers?.Authorization||null});
      if(url===source.feed&&method==='GET')
        return new Response(rss,{status:200});
      if(url===URL_NEWS&&method==='GET')
        return new Response(ebcHtml(byline),{status:200,headers:{'content-type':'text/html'}});
      const parsed=new URL(url);
      if(parsed.origin!=='http://cms:1337')throw new Error('Unexpected network destination');
      if(parsed.pathname==='/api/news-articles'&&method==='GET')
        return json([]);
      if(parsed.pathname==='/api/news-articles'&&method==='POST'&&parsed.searchParams.get('status')==='draft'){
        draft=JSON.parse(options.body).data;
        assert.equal(draft.editorialStatus,'em_revisao');
        return json({...draft,documentId:DOC_ID,publishedAt:null},201);
      }
      if(parsed.pathname==='/api/news-articles/'+DOC_ID&&method==='GET'&&
         parsed.searchParams.get('status')==='draft')
        return json({...draft,documentId:DOC_ID,publishedAt:null});
      if(parsed.pathname==='/api/news-articles/'+DOC_ID&&method==='PUT'&&
         parsed.searchParams.get('status')==='published'){
        publication=JSON.parse(options.body).data;
        return json({...draft,...publication,documentId:DOC_ID,
          publishedAt:'2026-11-11T17:00:00.000Z'});
      }
      throw new Error('Unexpected CMS operation '+method+' '+parsed.pathname);
    }};
}
function setupClients(network){
  return {
    cms:cmsClient({baseUrl:'http://cms:1337',token:'draft-test-token-123',
      fetchImpl:network.fetch}),
    publisher:cmsPublisher({baseUrl:'http://cms:1337',token:'publish-test-token-456',
      draftToken:'draft-test-token-123',fetchImpl:network.fetch}),
  };
}

test('deterministic EBC RSS -> licensed full article -> two AI passes -> Draft -> Strapi published',async()=>{
  const network=fakeCmsFetch(),router=model(),redis=store(),events=[];
  const output=await runOnce({sources:[source],fetchImpl:network.fetch,
    now:Date.parse('2026-11-11T17:00:00Z'),maxArticles:1,dryRun:false,
    autoPublish:true,autoPublishSources:[source.id],
    articleReader:fetchArticleEvidence,router,store:redis,
    ...setupClients(network),logger:e=>events.push(e)});
  assert.equal(output.count,1);
  assert.equal(output.results[0].status,'draft_published');
  assert.equal(router.calls,2);
  assert.equal(redis.seen,1);
  assert.equal(network.draft.sourceUrl,URL_NEWS);
  assert.equal(network.draft.imageRightsStatus,'pendente');
  assert.equal(network.publication.editorialStatus,'aprovado');
  assert.match(network.publication.approvalReference,/^ai-source-v2-/);
  assert.match(network.publication.approvalNote,/texto integral autorizado/);
  assert.equal(network.calls.filter(x=>x.method==='POST').length,1);
  assert.equal(network.calls.filter(x=>x.method==='PUT').length,1);
  assert.equal(events.filter(x=>x.event==='auto_published').length,1);
  assert.equal(events.find(x=>x.event==='auto_published').review,'full_article');
  assert.equal(network.calls.find(x=>x.method==='POST').authorization,'Bearer draft-test-token-123');
  assert.equal(network.calls.find(x=>x.method==='PUT').authorization,'Bearer publish-test-token-456');
});

test('partner agency byline prevents all LLM and CMS writes, even in opted-in auto mode',async()=>{
  const network=fakeCmsFetch({byline:'Agência Reuters'}),router=model(),redis=store();
  const output=await runOnce({sources:[source],fetchImpl:network.fetch,
    now:Date.parse('2026-11-11T17:00:00Z'),maxArticles:1,dryRun:false,
    autoPublish:true,autoPublishSources:[source.id],
    articleReader:fetchArticleEvidence,router,store:redis,
    ...setupClients(network)});
  assert.equal(output.results[0].status,'article_evidence_unavailable');
  assert.equal(output.results[0].evidenceReason,'article_rights_unverified');
  assert.equal(router.calls,0);
  assert.equal(redis.seen,0);
  assert.equal(network.calls.some(x=>x.url.startsWith('http://cms:1337')),false);
});

test('independent AI reviewer HOLD leaves an unpublished Draft',async()=>{
  const network=fakeCmsFetch(),router=model({
    decision:'hold',factualSupport:'insufficient',evidenceQuotes:[],
    unsupportedClaims:['Não comprovado'],issues:['Verificar atribuição'],
  });
  const output=await runOnce({sources:[source],fetchImpl:network.fetch,
    now:Date.parse('2026-11-11T17:00:00Z'),maxArticles:1,dryRun:false,
    autoPublish:true,autoPublishSources:[source.id],
    articleReader:fetchArticleEvidence,router,store:store(),
    ...setupClients(network)});
  assert.equal(output.results[0].status,'draft_created_review_pending');
  assert.ok(network.draft);
  assert.equal(network.publication,null);
  assert.equal(network.calls.filter(x=>x.method==='PUT').length,0);
  assert.equal(router.calls,3); // bounded repair attempt
});

test('EBC HOLD triggers grounded rewrite, new independent approval, and single corrected publication',async()=>{
  const revised={...generated,
    title:'Escola relata atividades inclusivas de leitura tátil em Braille'};
  const hold={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['Broad original headline'],
    issues:['Specify the source of the claim']};
  const phases=[],events=[];
  const router={async complete(req){
    phases.push(req.phase);
    const answer=[generated,hold,revised,approved][phases.length-1];
    if(!answer)throw Error('Unexpected model request');
    return {provider:'groq',content:JSON.stringify(answer)};
  }};
  const network=fakeCmsFetch();
  const out=await runOnce({sources:[source],fetchImpl:network.fetch,
    now:Date.parse('2026-11-11T17:00:00Z'),maxArticles:1,
    dryRun:false,autoPublish:true,autoPublishSources:[source.id],
    articleReader:fetchArticleEvidence,router,store:store(),
    ...setupClients(network),logger:e=>events.push(e)});
  assert.equal(out.results[0].status,'draft_published');
  assert.deepEqual(phases,['draft','review','draft','review']);
  assert.equal(network.draft.title,generated.title);
  assert.equal(network.publication.title,revised.title);
  assert.equal(network.calls.filter(x=>x.method==='POST').length,1);
  assert.equal(network.calls.filter(x=>x.method==='PUT').length,1);
  assert.ok(events.some(x=>x.event==='editorial_repair_approved'));
  assert.equal(events.find(x=>x.event==='auto_published').corrected,true);
});

test('corrected Draft remains unpublished if independent re-review still decides HOLD',async()=>{
  const revised={...generated,title:'Escola relata atividades inclusivas de leitura tátil em Braille'};
  const hold={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:[],issues:['Uncertain relationship']};
  let n=0;
  const router={async complete(){
    const answer=[generated,hold,revised,hold][n++];
    if(!answer)throw Error('Too many model requests');
    return {provider:'groq',content:JSON.stringify(answer)};
  }};
  const network=fakeCmsFetch();
  const out=await runOnce({sources:[source],fetchImpl:network.fetch,
    now:Date.parse('2026-11-11T17:00:00Z'),maxArticles:1,
    dryRun:false,autoPublish:true,autoPublishSources:[source.id],
    articleReader:fetchArticleEvidence,router,store:store(),
    ...setupClients(network)});
  assert.equal(n,4);
  assert.equal(out.results[0].status,'draft_created_review_pending');
  assert.equal(network.publication,null);
});

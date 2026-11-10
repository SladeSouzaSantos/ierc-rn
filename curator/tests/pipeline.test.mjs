import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runOnce} from '../src/pipeline.mjs';
const source={id:'w3c-wai',name:'W3C WAI',feed:'https://www.w3.org/WAI/feed.xml',hostname:'www.w3.org',language:'en',country:'Internacional'};
const atom='<feed><entry><title>Accessibility for blind students</title><link href="https://www.w3.org/WAI/news/example"/><updated>2026-11-09T15:00:00Z</updated><summary>Accessible education with screen reader tools and inclusive methodologies</summary></entry></feed>';
test('dry-run collects and filters without any LLM, Redis or Strapi call',async()=>{
 const fetchImpl=async()=>new Response(atom,{status:200});
 const value=await runOnce({sources:[source],fetchImpl,now:Date.parse('2026-11-10T01:00:00Z'),dryRun:true,
   router:null,store:null,cms:null});
 assert.equal(value.preview,true);
 assert.equal(value.count,1);
 assert.equal(value.results[0].status,'preview');
 assert.equal(value.aiGenerated,false);
});
test('valid feeds with no matching inclusion topic report editorial filtering, not an outage',async()=>{
 const general='<rss><channel><item>'+
   '<title>Economia registra nova rodada de dados comerciais</title>'+
   '<link>https://agenciabrasil.ebc.com.br/economia/noticia/2026-11/economia-dados</link>'+
   '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
   '<description>Estudo mostra resultados de exportação e comércio.</description>'+
   '</item></channel></rss>';
 const ebc={id:'agencia-brasil-educacao',name:'Agência Brasil',country:'Brasil',
   mode:'rss',feed:'https://agenciabrasil.ebc.com.br/rss/educacao/feed.xml',
   hostname:'agenciabrasil.ebc.com.br'};
 const events=[];
 const result=await runOnce({sources:[ebc],fetchImpl:async()=>new Response(general,{status:200}),
   now:Date.parse('2026-11-10T15:00:00Z'),maxArticles:1,dryRun:true,logger:x=>events.push(x)});
 assert.equal(result.count,0);
 assert.equal(events[0].event,'feed_checked');
 assert.equal(events[0].validLastYear,1);
 assert.equal(events[0].withinWindow,1);
 assert.equal(events[0].candidates,0);
 assert.equal(events[0].filteredByTopic,1);
 assert.equal(events[0].noCandidatesReason,'no_matching_topics');
 assert.equal(events.some(x=>x.event==='feed_unavailable'),false);
});

test('repeated syndicated articles are evaluated once across multiple official feeds',async()=>{
  const same='<rss><channel><item>'+
    '<title>Educação inclusiva e braille beneficiam estudantes cegos</title>'+
    '<link>https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/educacao-inclusiva</link>'+
    '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
    '<description>Projeto de acessibilidade para estudantes com deficiência visual.</description>'+
    '</item></channel></rss>';
  const feeds=['educacao','geral'].map(sec=>({
    id:'agencia-brasil-'+sec,mode:'rss',name:'Agência Brasil',
    country:'Brasil',language:'pt-BR',hostname:'agenciabrasil.ebc.com.br',
    feed:'https://agenciabrasil.ebc.com.br/rss/'+sec+'/feed.xml',
    previewOnly:true,
  }));
  const events=[];
  const value=await runOnce({sources:feeds,dryRun:true,
    fetchImpl:async()=>new Response(same,{status:200}),
    maxArticles:6,now:Date.parse('2026-11-10T15:00:00Z'),
    logger:e=>events.push(e)});
  assert.equal(value.count,1);
  assert.equal(value.results[0].coverageTrack,'brasil');
  assert.equal(events.filter(e=>e.event==='feed_checked').length,2);
  assert.equal(events.filter(e=>e.event==='cross_feed_duplicate_skipped').length,1);
});

test('new EBC topical discovery sections are read-only previews and never enter AI/live ingestion',async()=>{
  const {SOURCES}=await import('../src/feeds.mjs');
  const types=['justica','politica','saude','geral'];
  const discovery=types.map(type=>SOURCES.find(x=>x.id==='agencia-brasil-'+type));
  const feed='<rss><channel><item>'+
    '<title>Nova iniciativa de acessibilidade e braille para estudantes cegos</title>'+
    '<link>https://agenciabrasil.ebc.com.br/justica/noticia/2026-11/iniciativa-acessibilidade</link>'+
    '<pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate>'+
    '<description>Educação inclusiva fortalece o acesso de estudantes com deficiência visual.</description>'+
    '</item></channel></rss>';
  let reads=0;
  const fetchImpl=async()=>{reads++;return new Response(feed,{status:200});};
  const logs=[];
  const p=await runOnce({sources:discovery,fetchImpl,
    now:Date.parse('2026-11-10T15:00:00Z'),maxArticles:4,
    dryRun:true,logger:x=>logs.push(x)});
  assert.equal(reads,4);
  assert.equal(p.aiGenerated,false);
  assert.ok(p.results.every(x=>x.status==='preview'&&x.previewOnly===true));
  assert.equal(logs.filter(x=>x.event==='feed_checked').length,4);
  const attempts=reads;
  const live=await runOnce({sources:discovery,fetchImpl,
    now:Date.parse('2026-11-10T15:00:00Z'),maxArticles:4,dryRun:false,
    store:null,cms:null,router:{async complete(){throw Error('No LLM allowed');}},
    logger:x=>logs.push(x)});
  assert.equal(live.count,0);
  assert.equal(reads,attempts);
  assert.equal(logs.filter(x=>x.event==='source_skipped_by_policy').length,4);
});
test('paused feed does not issue HTTP requests or block healthy feeds',async()=>{
  const {SOURCES}=await import('../src/feeds.mjs');
  const eu=SOURCES.find(x=>x.id==='eu-commission-news');
  let fetchedEu=0;
  const seen=[];
  const result=await runOnce({
    sources:[eu,source],now:Date.parse('2026-11-10T20:00:00Z'),
    fetchImpl:async url=>{
      if(url.includes('commission.europa.eu')){fetchedEu++;throw Error('paused feed fetched');}
      return new Response(atom,{status:200});
    },
    dryRun:true,logger:event=>seen.push(event),
  });
  assert.equal(fetchedEu,0);
  assert.equal(result.count,1);
  assert.equal(result.results[0].source,'w3c-wai');
  assert.deepEqual(seen[0],{
    event:'source_paused',source:'eu-commission-news',
    reason:'temporarily_paused_timeout_windows_docker_2026-11-10',
  });
  assert.equal(seen[1].event,'feed_checked');
});

test('unavailable feed is logged and never triggers the model',async()=>{
 const events=[];
 const value=await runOnce({sources:[source],fetchImpl:async()=>new Response('',{status:503}),
   now:Date.parse('2026-11-10T01:00:00Z'),dryRun:true,logger:evt=>events.push(evt)});
 assert.equal(value.count,0);
 assert.equal(events[0].event,'feed_unavailable');
});

test('preview can inspect WAI history without changing 45-day live window',async()=>{
 const oldAtom=atom.replace('2026-11-09T15:00:00Z','2026-09-25T15:00:00Z');
 const options={sources:[source],fetchImpl:async()=>new Response(oldAtom,{status:200}),
   now:Date.parse('2026-11-10T01:00:00Z'),dryRun:true};
 const logs=[];
 const recent=await runOnce({...options,logger:e=>logs.push(e)});
 const historical=await runOnce({...options,maxAgeDays:120});
 assert.equal(recent.count,0);
 assert.equal(historical.count,1);
 assert.equal(logs[0].validLastYear,1);
 assert.equal(logs[0].withinWindow,0);
 assert.equal(logs[0].maxAgeDays,45);
});
test('age filter refuses unsafe out-of-range previews',async()=>{
 await assert.rejects(runOnce({maxAgeDays:366}),/Invalid article age window/);
});


test('preview balances WAI, Perkins, RNIB and IBSA without publishing preview-only sources', async () => {
  const { SOURCES } = await import('../src/feeds.mjs');
  const wbu='<rss><channel><title>World Blind Union</title></channel></rss>';
  const perkins='<rss><channel><item><title>Braille literacy for blind students</title>' +
    '<link>https://www.perkins.org/braille-literacy-for-blind-students/</link>' +
    '<pubDate>Thu, 05 Nov 2026 15:00:00 +0000</pubDate>' +
    '<description>New materials help inclusive education in classrooms.</description></item></channel></rss>';
  const rnib='<div class="listing__post small-image-card">' +
    '<h2 class="small-image-card__title"><a href="https://www.rnib.org.uk/news/accessibility-in-britain/">' +
    'Low vision accessibility in Britain</a></h2>' +
    '<p class="small-image-card__description">Rights and support</p>' +
    '<span class="small-image-card__meta-item">Posted Thursday, 5 November 2026</span></div>';
  const ibsa='<div class="tekup-blog-wrap"><div class="tekup-blog-content">' +
    '<div class="tekup-blog-meta"><ul><li>IBSA</li><li>05 November 2026</li></ul></div>' +
    '<a href="https://ibsasport.org/news/new-goalball-program/"><h3>New Goalball Program</h3></a></div></div>';
  const bodyByUrl={
    'https://www.w3.org/WAI/feed.xml':atom,
    'https://www.perkins.org/feed/':perkins,
    'https://www.rnib.org.uk/news/':rnib,
    'https://ibsasport.org/news/':ibsa,
    'https://wbu.ngo/feed/':wbu,
  };
  const reads=[];
  const fetched=async url=>{
    reads.push(url);
    return new Response(bodyByUrl[url],{status:200});
  };
  const historic=SOURCES.filter(x=>['w3c-wai','perkins','rnib','ibsa','wbu'].includes(x.id));
  const out=await runOnce({sources:historic,fetchImpl:fetched,
    now:Date.parse('2026-11-10T12:00:00Z'),maxArticles:6,dryRun:true,
    router:null,store:null,cms:null});
  assert.equal(out.count,4);
  assert.deepEqual(out.results.map(x=>x.source),['w3c-wai','perkins','rnib','ibsa']);
  assert.equal(out.results[2].previewOnly,true);
  assert.ok(out.results.every(x=>x.status==='preview'));
  assert.equal(reads.length,5);
});
test('live ingestion excludes all preview-only HTML sources and empty WBU feed', async()=>{
  const { SOURCES } = await import('../src/feeds.mjs');
  const reads=[];const events=[];
  const store={set:async()=> 'OK', exists:async()=>1, eval:async()=>1};
  const cms={existing:async()=>false,create:async()=>{throw Error('must not write')}};
  const perkins='<rss><channel><item><title>Braille literacy for blind students</title>' +
    '<link>https://www.perkins.org/braille-literacy-for-blind-students/</link>' +
    '<pubDate>Thu, 05 Nov 2026 15:00:00 +0000</pubDate>' +
    '<description>New materials help inclusive education.</description></item></channel></rss>';
  const historic=SOURCES.filter(x=>['w3c-wai','perkins','rnib','ibsa','wbu'].includes(x.id));
  const result=await runOnce({sources:historic,
    fetchImpl:async url=>{
      reads.push(url);
      return new Response(url.includes('perkins.org')?perkins:atom,{status:200});
    },
    now:Date.parse('2026-11-10T12:00:00Z'),dryRun:false,store,cms,router:null,
    logger:event=>events.push(event)});
  assert.deepEqual(reads,['https://www.w3.org/WAI/feed.xml','https://www.perkins.org/feed/']);
  assert.equal(result.results.length,2);
  assert.ok(result.results.every(x=>x.status==='seen'));
  assert.equal(events.filter(x=>x.event==='source_skipped_by_policy').length,3);
});

test('empty HTML shows detectedCards=0 rather than a silent source failure',async()=>{
 const {SOURCES}=await import('../src/feeds.mjs');
 const events=[];
 await runOnce({sources:[SOURCES.find(x=>x.id==='rnib')],
  fetchImpl:async()=>new Response('<html><main>empty</main></html>'),
  dryRun:true,logger:e=>events.push(e)});
 assert.equal(events[0].event,'feed_checked');
 assert.equal(events[0].listingDiagnostics.detectedCards,0);
});
test('external redirects log only a fixed reason without private URLs',async()=>{
 const {SOURCES}=await import('../src/feeds.mjs');
 const events=[];
 await runOnce({sources:[SOURCES.find(x=>x.id==='wbu')],
  fetchImpl:async()=>new Response(null,{status:302,headers:{Location:'https://evil.example'}}),
  dryRun:true,logger:e=>events.push(e)});
 assert.equal(events[0].reason,'redirect_blocked');
 assert.ok(!JSON.stringify(events).includes('evil.example'));
});


test('one-shot AI preview generates original draft without CMS/Redis writes, even with preview-only sources',async()=>{
  const {SOURCES}=await import('../src/feeds.mjs');
  const approved=SOURCES.find(s=>s.id==='w3c-wai');
  const restricted=SOURCES.find(s=>s.id==='rnib');
  const events=[];const calls=[];
  const draft={
    title:'Uma nova oportunidade para a inclusao digital e acessibilidade',
    summary:'Uma iniciativa sobre educacao inclusiva e leitores de tela foi comunicada em canal oficial, com potencial para discussao educativa.',
    body:'O canal oficial descreve iniciativas de acessibilidade e tecnologias de leitura de tela para estudantes cegos. Este texto e uma sintese preliminar baseada no titulo e no resumo, sujeita a verificacao editorial.',
    whyItMatters:'O tema pode contribuir com o debate sobre acessibilidade na educacao brasileira.',
    category:'Tecnologia assistiva',
  };
  const router={async complete({system,prompt}){
    calls.push(JSON.parse(prompt));
    assert.match(system,/DADOS NÃO CONFIÁVEIS/);
    return {content:JSON.stringify(draft),provider:'openrouter'};
  }};
  const result=await runOnce({
    sources:[approved,restricted],now:Date.parse('2026-11-10T01:00:00Z'),
    fetchImpl:async url=>{assert.equal(url,approved.feed);return new Response(atom,{status:200});},
    router,store:null,cms:null,dryRun:true,aiPreview:true,maxArticles:1,
    logger:x=>events.push(x),
  });
  assert.equal(result.preview,true);
  assert.equal(result.aiGenerated,true);
  assert.equal(result.count,1);
  assert.equal(result.results[0].status,'draft_ready');
  assert.equal(result.results[0].provider,'openrouter');
  assert.deepEqual(result.results[0].draft,draft);
  assert.equal(result.results[0].originalUrl,'https://www.w3.org/WAI/news/example');
  assert.equal(result.results[0].previewOnly,false);
  assert.equal(calls.length,1);
  assert.ok(events.some(x=>x.event==='source_skipped_by_policy'&&x.source==='rnib'));
});
test('AI preview refuses a configured CMS writer and live mode',async()=>{
  await assert.rejects(runOnce({aiPreview:true,dryRun:true,cms:{create(){}}}),/cannot write/);
  await assert.rejects(runOnce({aiPreview:true,dryRun:false,cms:null}),/cannot write/);
});
test('AI preview returns explicit lack of evidence, never a fabricated published item',async()=>{
  const result=await runOnce({sources:[source],fetchImpl:async()=>new Response(atom,{status:200}),
    now:Date.parse('2026-11-10T01:00:00Z'),maxArticles:1,
    dryRun:true,aiPreview:true,router:{async complete(){return {content:'{"skip":true}',provider:'openrouter'};}}});
  assert.equal(result.count,1);
  assert.equal(result.results[0].status,'insufficient_evidence');
  assert.equal(result.results[0].draft,undefined);
  assert.equal(result.aiGenerated,false);
});


test('one-shot acceptance never creates more than one CMS draft in DEV',async()=>{
  const draft={
    title:'Esporte adaptado e inclusao escolar como tema de debate',
    summary:'Uma fonte oficial discute oportunidades esportivas para criancas com deficiencia e abordagens de aprendizagem e participacao inclusiva.',
    body:'O resumo publicado pela fonte trata das atividades esportivas acessiveis para criancas e de sua relacao com aprendizagem, convivencia e inclusao. O material requer revisao humana antes de qualquer divulgacao.',
    whyItMatters:'O debate pode apoiar reflexoes sobre esporte adaptado e acesso a atividades escolares no Brasil.',
    category:'Esporte adaptado'
  };
  let created=0;
  const cms={
    async existing(){return false;},
    async create(payload){
      created++;
      assert.equal(payload.editorialStatus,'em_revisao');
      assert.equal(payload.aiAssisted,true);
      assert.equal(payload.imageRightsStatus,'pendente');
      assert.equal(payload.publishedAt,undefined);
      return 'document-mock-'+created;
    },
  };
  const store={
    async set(){return 'OK';},
    async exists(){return 0;},
    async eval(){return 1;},
  };
  let modelCalls=0;
  const result=await runOnce({
    sources:[source],now:Date.parse('2026-11-10T12:00:00Z'),
    fetchImpl:async()=>new Response(atom.replace('</feed>', '<entry><title>Blind sport and adapted games</title><link href="https://www.w3.org/WAI/news/another"/><updated>2026-11-09T15:00:00Z</updated><summary>Children with disabilities participate in adapted sports and accessible games.</summary></entry></feed>')),
    maxArticles:1,dryRun:false,cms,store,
    router:{async complete(){modelCalls++;return {provider:'openrouter',content:JSON.stringify(draft)}}},
  });
  assert.equal(created,1);
  assert.equal(modelCalls,1);
  assert.equal(result.results.filter(r=>r.status==='draft_created').length,1);
  assert.equal(result.preview,false);
  assert.equal(result.aiGenerated,true);
});

test('live scan with already-seen sources does not claim AI generation',async()=>{
 const out=await runOnce({sources:[source],now:Date.parse('2026-11-10T12:00:00Z'),
   fetchImpl:async()=>new Response(atom,{status:200}),dryRun:false,maxArticles:1,
   store:{async set(){return 'OK';},async exists(){return 1;},async eval(){return 1;}},
   cms:{async existing(){throw Error('should not inspect seen item');}},
   router:{async complete(){throw Error('should not invoke AI');}}});
 assert.equal(out.preview,false);
 assert.equal(out.aiGenerated,false);
 assert.equal(out.results[0].status,'seen');
});


test('auto publication refuses preview, batch >1 and missing allowlisted sources',async()=>{
  await assert.rejects(runOnce({autoPublish:true,articleReader:async()=>{throw Error('not called');},dryRun:true,publisher:{},
    autoPublishSources:['agencia-brasil-esportes'],maxArticles:1}),/live mode/);
  await assert.rejects(runOnce({autoPublish:true,articleReader:async()=>{throw Error('not called');},dryRun:false,publisher:{},
    autoPublishSources:['agencia-brasil-esportes'],maxArticles:3}),/one-item batch/);
  await assert.rejects(runOnce({autoPublish:true,articleReader:async()=>{throw Error('not called');},dryRun:false,publisher:{},
    autoPublishSources:['unknown'],maxArticles:1}),/source allowlist/);
  await assert.rejects(runOnce({autoPublish:true,articleReader:async()=>{throw Error('not called');},dryRun:false,publisher:{},
    autoPublishSources:[],maxArticles:1}),/source allowlist/);
});
test('auto mode cannot publish a source excluded by the explicit allowlist',async()=>{
  const content='<feed><entry><title>Blind sport and adapted games for children</title>'+
    '<link href="https://www.w3.org/WAI/news/example"/>'+
    '<updated>2026-11-09T15:00:00Z</updated>'+
    '<summary>Children with disabilities participate in adapted sports and accessible games. The program offers inclusive activities, group play, opportunities to join peers and to take part in accessible physical education lessons.</summary></entry></feed>';
  let attempts=0;
  const cms={async existing(){return false;},async create(){
    return 'a1b2c3d4e5f6g7h8i9j0klmn';}};
  const store={async set(){return 'OK';},async exists(){return 0;},async eval(){return 1;}};
  const router={async complete(){attempts++;
    return {provider:'openrouter',content:JSON.stringify({
      title:'Atividades de esporte adaptado para crianças com deficiência',
      summary:'Uma instituição apresenta atividades de esporte adaptado para crianças com deficiência e oportunidades de participação em grupos.',
      body:'O programa oferece práticas esportivas acessíveis, atividades em grupo e participação em aulas de educação física com colegas. Essas ações são descritas na comunicação original da instituição.',
      whyItMatters:'O tema permite refletir sobre acesso ao esporte adaptado, educação inclusiva e participação de crianças com deficiência visual no Brasil.',
      category:'esporte',
    })};
  }};
  const out=await runOnce({sources:[source],fetchImpl:async()=>new Response(content),
    now:Date.parse('2026-11-10T12:00:00Z'),maxArticles:1,dryRun:false,store,cms,router,
    autoPublish:true,autoPublishSources:['agencia-brasil-esportes'],
    articleReader:async()=>{throw Error('Reader not called for excluded source');},
    publisher:{async publishApprovedDraft(){throw Error('unlisted source published');}}});
  assert.equal(out.count,1);
  assert.equal(out.results[0].status,'draft_created');
  assert.equal(out.aiGenerated,true);
  assert.equal(attempts,1);
});


test('review:preview performs two free-model passes and zero CMS or persistence calls',async()=>{
 const summary='Blind students participate in accessible sports, group learning, and classroom games. The program provides adapted games and activities that encourage participation alongside peers, supporting inclusion within school lessons.';
 const title='Accessible sports and inclusive learning programs for blind students';
 const rss='<feed><entry><title>'+title+'</title>'+
   '<link href="https://www.w3.org/WAI/news/example"/>'+
   '<updated>2026-11-09T15:00:00Z</updated><summary>'+summary+'</summary></entry></feed>';
 const draft={
   title:'Iniciativas de esporte adaptado e inclusão na aprendizagem',
   summary:'Uma organização relata atividades esportivas acessíveis para estudantes com deficiência visual e oportunidades de participação com colegas.',
   body:'O material apresenta programas de aprendizagem inclusiva para estudantes com deficiência visual e relata jogos acessíveis em grupo, além de atividades que possibilitam a participação dos alunos no contexto escolar.',
   whyItMatters:'A experiência pode orientar uma reflexão sobre esporte adaptado e educação inclusiva sem estabelecer vínculos institucionais brasileiros.',
   category:'esporte',
 };
 let calls=0;
 const router={async complete(){
   calls++;
   return {provider:'openrouter',content:JSON.stringify(calls===1?draft:{
     decision:'approve',factualSupport:'fully_supported',
     evidenceQuotes:['Accessible sports and inclusive learning programs',
       'accessible sports, group learning, and classroom games'],
     unsupportedClaims:[],issues:[],
   })};
 }};
 const result=await runOnce({sources:[source],
   fetchImpl:async()=>new Response(rss),now:Date.parse('2026-11-10T12:00:00Z'),
   router,store:null,cms:null,dryRun:true,aiPreview:true,reviewPreview:true,
   previewLookup:{async check(){return null;}},maxArticles:1});
 assert.equal(result.count,1);assert.equal(calls,2);
 assert.equal(result.results[0].status,'review_approved_preview');
 assert.equal(result.results[0].draft.category,'Esporte adaptado');
 assert.equal(result.results[0].reviewReason,'rss_review_passed');
 assert.equal(result.aiGenerated,true);assert.equal(result.preview,true);
});
test('review preview cannot bypass normal AI-preview safety flags',async()=>{
 await assert.rejects(runOnce({reviewPreview:true,dryRun:true}),/read-only AI preview/);
 await assert.rejects(runOnce({reviewPreview:true,aiPreview:true,dryRun:false}),
   /cannot write to CMS/);
});


test('review preview skips Redis seen and CMS published sources before spending either model call',async()=>{
 const feed='<feed>'+
   '<entry><title>Braille literacy for blind students</title><link href="https://www.w3.org/WAI/news/first"/><updated>2026-11-10T10:00:00Z</updated><summary>Inclusive education for blind students with Braille instruction and accessibility technology for early classroom learning.</summary></entry>'+
   '<entry><title>Accessible sports for blind students</title><link href="https://www.w3.org/WAI/news/second"/><updated>2026-11-09T10:00:00Z</updated><summary>Inclusive accessible sports and adapted activities for students with visual disabilities in group lessons and school programs.</summary></entry>'+
   '<entry><title>New assistive technology for low vision</title><link href="https://www.w3.org/WAI/news/third"/><updated>2026-11-08T10:00:00Z</updated><summary>Assistive technology and accessible devices are presented to support students with low vision in inclusive school settings. The communication also describes learning resources and classroom support practices, offering information about participation during school activities.</summary></entry>'+
   '</feed>';
 const seen=[];let calls=0;
 const draft={title:'Nova tecnologia assistiva auxilia estudantes com baixa visão',
   summary:'Uma nova tecnologia assistiva oferece possibilidades de aprendizagem inclusiva para estudantes com baixa visão em ambientes escolares.',
   body:'Uma organização descreve uma tecnologia assistiva destinada a estudantes com baixa visão, destacando recursos de acessibilidade e oportunidades de aprendizagem em ambientes escolares inclusivos.',
   whyItMatters:'A tecnologia assistiva pode contribuir para debates sobre recursos acessíveis e educação inclusiva.',
   category:'tecnologia'};
 const out=await runOnce({
   sources:[source],fetchImpl:async()=>new Response(feed),
   now:Date.parse('2026-11-10T12:00:00Z'),maxArticles:1,
   dryRun:true,aiPreview:true,reviewPreview:true,store:null,cms:null,
   previewLookup:{async check(article){
     seen.push(article.url);
     if(article.url.endsWith('/first'))return 'redis';
     if(article.url.endsWith('/second'))return 'cms';
     return null;
   }},
   router:{async complete(){
     calls++;return {provider:'openrouter',content:JSON.stringify(calls===1?draft:{
       decision:'hold',factualSupport:'insufficient',evidenceQuotes:[],unsupportedClaims:[],issues:['Fonte insuficiente']
     })};
   }},
 });
 assert.equal(out.count,1);
 assert.equal(out.results.length,1);
 assert.equal(calls,2);
 assert.equal(seen.length,3);
 assert.equal(out.results[0].originalUrl,'https://www.w3.org/WAI/news/third');
 assert.equal(out.results[0].status,'review_pending_preview');
 assert.deepEqual(out.skippedPreviouslyProcessed,{redis:1,cms:1});
});
test('review preview stops before any LLM call if CMS/Redis lookup fails',async()=>{
 const feed='<feed><entry><title>Braille literacy for blind students</title>'+
   '<link href="https://www.w3.org/WAI/news/first"/><updated>2026-11-10T10:00:00Z</updated>'+
   '<summary>Accessible Braille education in inclusive settings and assistive learning for students with visual disabilities.</summary></entry></feed>';
 let calls=0;
 await assert.rejects(runOnce({sources:[source],fetchImpl:async()=>new Response(feed),
   now:Date.parse('2026-11-10T12:00:00Z'),dryRun:true,aiPreview:true,reviewPreview:true,
   maxArticles:1,previewLookup:{async check(){throw Error('CMS read-only duplicate lookup unavailable');}},
   router:{async complete(){calls++;throw Error('should not reach AI');}}}),/CMS read-only duplicate lookup unavailable/);
 assert.equal(calls,0);
});
test('review preview has no fallback to unverified duplicates, and no LLM when all seen',async()=>{
 const out=await runOnce({sources:[source],
   fetchImpl:async()=>new Response(atom),now:Date.parse('2026-11-10T12:00:00Z'),
   maxArticles:1,dryRun:true,aiPreview:true,reviewPreview:true,
   previewLookup:{async check(){return 'cms';}},
   router:{async complete(){throw Error('should never call a model');}}});
 assert.equal(out.count,0);assert.equal(out.aiGenerated,false);
 assert.deepEqual(out.skippedPreviouslyProcessed,{redis:0,cms:1});
 assert.deepEqual(out.results,[]);
});


test('full-article preview refuses unlicensed source before either model call',async()=>{
 const {ArticleEvidenceError}=await import('../src/article-evidence.mjs');
 let modelCalls=0,readerCalls=0;
 const report=await runOnce({sources:[source],
   fetchImpl:async()=>new Response(atom,{status:200}),
   now:Date.parse('2026-11-10T12:00:00Z'),maxArticles:1,
   dryRun:true,aiPreview:true,reviewPreview:true,fullArticlePreview:true,
   previewLookup:{async check(){return null;}},
   articleReader:async()=>{
     readerCalls++;throw new ArticleEvidenceError('source_permission_pending');
   },
   router:{async complete(){modelCalls++;throw Error('Should not call model');}}});
 assert.equal(readerCalls,1);assert.equal(modelCalls,0);
 assert.equal(report.results[0].status,'article_evidence_unavailable');
 assert.equal(report.results[0].evidenceReason,'source_permission_pending');
 assert.equal(report.reviewBasis,'full_article');assert.equal(report.aiGenerated,false);
});
test('full-article preview generates and reviews only when evidence has verified source blocks',async()=>{
 const articleUrl='https://www.w3.org/WAI/news/example';
 const evidence={verified:true,mode:'full_article',sourceUrl:articleUrl,
   digest:'e'.repeat(64),blocks:[
     {id:'E01',text:'A new accessibility activity helps students with visual disabilities participate in classroom learning with accessible materials and guidance.'},
     {id:'E02',text:'Teachers use inclusive learning activities and screen reader tools to make school material accessible for students with low vision.'},
     {id:'E03',text:'Accessible classroom practices and assistive tools help students join educational groups and classroom exercises.'},
   ]};
 const draft={title:'Iniciativas acessíveis auxiliam estudantes com deficiência visual',
   summary:'Uma organização apresenta atividades inclusivas e ferramentas de acessibilidade voltadas para estudantes com deficiência visual na escola.',
   body:'Educadores utilizam materiais acessíveis e ferramentas de leitura de tela em atividades educacionais inclusivas. As orientações abordam práticas escolares e oportunidades de participação dos alunos no ambiente de aprendizagem.',
   whyItMatters:'A experiência ajuda a refletir sobre a presença de recursos acessíveis na educação inclusiva.',
   category:'educacao'};
 let calls=0;
 const out=await runOnce({sources:[source],fetchImpl:async()=>new Response(atom,{status:200}),
   now:Date.parse('2026-11-10T12:00:00Z'),maxArticles:1,
   dryRun:true,aiPreview:true,reviewPreview:true,fullArticlePreview:true,
   previewLookup:{async check(){return null;}},articleReader:async()=>evidence,
   router:{async complete(){
     calls++;return {provider:'openrouter',content:JSON.stringify(calls===1?draft:{
       decision:'approve',factualSupport:'fully_supported',
       evidenceQuotes:['A new accessibility activity helps students',
         'Teachers use inclusive learning activities and screen reader tools'],
       unsupportedClaims:[],issues:[],
     })};
   }}});
 assert.equal(calls,2);assert.equal(out.count,1);
 assert.equal(out.results[0].status,'review_approved_preview');
 assert.equal(out.results[0].reviewBasis,'full_article');
 assert.equal(out.reviewBasis,'full_article');
});
test('full-article mode rejects an unconfigured evidence reader',async()=>{
 await assert.rejects(runOnce({reviewPreview:true,aiPreview:true,fullArticlePreview:true,
   previewLookup:{async check(){return null;}}}),/full article reader/);
});


test('auto publishing cannot write or call LLM when source lacks full-text permission',async()=>{
  const {ArticleEvidenceError}=await import('../src/article-evidence.mjs');
  let llm=0,writes=0,redisWrites=0;
  const response=await runOnce({sources:[{...source,id:'agencia-brasil-esportes'}],
    fetchImpl:async()=>new Response(atom,{status:200}),
    now:Date.parse('2026-11-10T12:00:00Z'),
    maxArticles:1,dryRun:false,autoPublish:true,autoPublishSources:['agencia-brasil-esportes'],
    articleReader:async()=>{throw new ArticleEvidenceError('source_permission_pending');},
    cms:{async existing(){writes++;throw Error('never called');},async create(){writes++;}},
    store:{async set(){redisWrites++;throw Error('never called');}},
    publisher:{async publishApprovedDraft(){writes++;throw Error('never called');}},
    router:{async complete(){llm++;throw Error('never called');}},
  });
  assert.equal(response.results[0].status,'article_evidence_unavailable');
  assert.equal(response.results[0].evidenceReason,'source_permission_pending');
  assert.equal(writes,0);assert.equal(llm,0);assert.equal(redisWrites,0);
});

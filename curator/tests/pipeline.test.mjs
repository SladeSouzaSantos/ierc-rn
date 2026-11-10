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
  const out=await runOnce({sources:SOURCES,fetchImpl:fetched,
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
  const result=await runOnce({sources:SOURCES,
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

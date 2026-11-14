import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM,canonicalCategory,cmsClient,validateDraft,validatePublicationReadyDraft,payloadFor,slugFor,processArticle} from '../src/editorial.mjs';
const source={title:'New accessible device',summary:'A new tool for low vision has been described.',
  url:'https://www.w3.org/WAI/news/test',publishedAt:'2026-11-09T12:00:00Z',
  country:'Internacional',language:'en',source:'W3C WAI',dedupeKey:'a'.repeat(64)};
const draft={title:'Nova iniciativa de acessibilidade inclusiva',summary:'Resumo informativo original de uma iniciativa sobre tecnologia assistiva e inclusão de pessoas com baixa visão.',
  body:'Um projeto internacional apresenta formas de ampliar a acessibilidade e a educação inclusiva. A fonte deve ser revisada por um editor antes da publicação institucional.',
  whyItMatters:'A experiência pode estimular debates sobre acesso a tecnologias assistivas no Brasil.',category:'Tecnologia'};
test('draft from AI always requires human review, with no picture or publication flag',()=>{
 const obj=payloadFor(source,draft,'openrouter');
 assert.equal(obj.editorialStatus,'em_revisao');
 assert.equal(obj.originType,'externa');
 assert.equal(obj.imageRightsStatus,'pendente');
 assert.equal(obj.dedupeKey,source.dedupeKey);
 assert.equal(obj.publishedAt,undefined);
 assert.equal(obj.image,undefined);
});
test('LLM generated article is constrained and unsafe script is rejected',()=>{
 assert.equal(validateDraft('{"skip":true}'),null);
 assert.equal(validateDraft(JSON.stringify(draft)).title,draft.title);
 assert.throws(()=>validateDraft('{"title":"short"}'),/Incomplete/);
 assert.throws(()=>validateDraft(JSON.stringify({...draft,body:'<script>'+draft.body})),/Unsafe/);
});
test('Strapi writer explicitly uses POST status=draft and validates unpublished response',async()=>{
 const urls=[];const api=cmsClient({baseUrl:'http://cms:1337',token:'test-token-123456',
   fetchImpl:async (url,opts)=>{
     urls.push({url,opts});
     if(opts?.method==='POST')return new Response(JSON.stringify({data:{documentId:'doc1',publishedAt:null}}),{status:201});
     return new Response(JSON.stringify({data:[]}),{status:200});
   }});
 assert.equal(await api.existing(source.dedupeKey),false);
 assert.equal(await api.create(payloadFor(source,draft,'groq')),'doc1');
 assert.equal(urls.length,3);
 assert.equal(new URL(urls[0].url).searchParams.get('status'),'draft');
 assert.equal(new URL(urls[1].url).searchParams.get('status'),'published');
 assert.match(urls[2].url,/\?status=draft$/);
 assert.equal(JSON.parse(urls[2].opts.body).data.editorialStatus,'em_revisao');
});
test('accidental Strapi publication fails validation',async()=>{
 const api=cmsClient({baseUrl:'http://cms:1337',token:'test-token-123456',
   fetchImpl:async()=>new Response(JSON.stringify({data:{documentId:'doc1',
     publishedAt:'2026-11-09T12:00:00Z'}}),{status:201})});
 await assert.rejects(api.create(payloadFor(source,draft,'groq')),/DRAFT|draft/);
});
test('dry-run does not call LLM, Redis or CMS',async()=>{
 const value=await processArticle(source,{dryRun:true,router:null,store:null,cms:null});
 assert.equal(value.status,'preview');
});
test('successful content ends only as a draft and seen mark is written',async()=>{
 const seen=[];
 const store={
  async set(k,v){seen.push(k);return 'OK';},
  async exists(){return 0;},
  async eval(){return 1;},
 };
 const cms={async existing(){return false;},async create(obj){
    assert.equal(obj.editorialStatus,'em_revisao');return 'doc-id-1';}};
 const router={async complete(){return {provider:'openrouter',content:JSON.stringify(draft)};}};
 const result=await processArticle(source,{dryRun:false,router,store,cms});
 assert.equal(result.status,'draft_created');assert.ok(seen.some(x=>x.includes(':seen:')));
});


test('Strapi draft lookup reports only safe HTTP status and never exposes remote errors',async()=>{
 const SECRET='secret-should-never-be-logged';
 for(const code of [400,401,403,404,500,503]){
   const urls=[];const token='test-token-123456';
   const api=cmsClient({baseUrl:'http://cms:1337',token,
     fetchImpl:async(url,options)=>{
       urls.push({url,options});
       return new Response(JSON.stringify({error:{message:SECRET,
         details:{authorization:token}}}),{status:code});
     }});
   await assert.rejects(api.existing(source.dedupeKey),error=>{
     assert.equal(error.message,'CMS read-only duplicate lookup failed (HTTP '+code+')');
     assert.ok(!error.message.includes(SECRET));
     assert.ok(!error.message.includes(token));
     return true;
   });
   assert.equal(urls.length,1);
   assert.equal(urls[0].options.method,'GET'); // authenticated GET only
   assert.match(urls[0].url,/status=draft/);
   assert.match(decodeURIComponent(urls[0].url),/filters\[dedupeKey\]\[\$eq\]/);
   assert.equal(urls[0].options.headers.Authorization,'Bearer '+token);
 }
});
test('Strapi lookup transport and malformed body errors are sanitized',async()=>{
 const token='test-token-123456';
 const network=cmsClient({baseUrl:'http://cms:1337',token,fetchImpl:async()=>{
   throw new Error('Connection password private-secret has been included');
 }});
 await assert.rejects(network.existing(source.dedupeKey),e=>
   e.message==='CMS read-only duplicate lookup unavailable');
 const malformed=cmsClient({baseUrl:'http://cms:1337',token,fetchImpl:async()=>
   new Response('no-json',{status:200})});
 await assert.rejects(malformed.existing(source.dedupeKey),e=>
   e.message==='Invalid CMS read-only duplicate lookup response');
});
test('lookup HTTP 403 prevents model invocation or draft write and releases Redis lock',async()=>{
 let calls=0;let unlocks=0;
 const store={async set(){return 'OK';},async exists(){return 0;},
   async eval(){unlocks++;return 1;}};
 const cms={async existing(){throw new Error('Strapi draft lookup failed (HTTP 403)');},
   async create(){calls++;}};
 const router={async complete(){calls++;return {content:JSON.stringify(draft),provider:'openrouter'};}};
 await assert.rejects(processArticle(source,{dryRun:false,store,cms,router}),
   /Strapi draft lookup failed \(HTTP 403\)/);
 assert.equal(calls,0);
 assert.equal(unlocks,1);
});

test('editorial prompt never infers absence of evidence or examples from an RSS summary',()=>{
 assert.match(SYSTEM,/Você NÃO leu a reportagem completa/);
 assert.match(SYSTEM,/ausência de detalhes no resumo RSS não significa ausência no artigo/);
 assert.match(SYSTEM,/Não afirme que a publicação não detalha modalidades/);
 assert.match(SYSTEM,/skip:true em vez de especular/);
 // The LLM receives only source title + RSS summary; this tests prompt policy,
 // not stochastic model compliance. Human editorial approval remains mandatory.
});

test('RSS writer prompt specifies safe completeness bounds without weakening factual gates',()=>{
 assert.match(SYSTEM,/title 15–150 caracteres/);
 assert.match(SYSTEM,/summary 60–250/);
 assert.match(SYSTEM,/body 100–1000/);
 assert.match(SYSTEM,/whyItMatters 40–350/);
 assert.match(SYSTEM,/jamais invente fatos/);
});

test('Radar taxonomy standardizes sport and assistive categories without making factual claims',()=>{
 assert.equal(canonicalCategory('esporte'), 'Esporte adaptado');
 assert.equal(canonicalCategory('Esportes Adaptados'), 'Esporte adaptado');
 assert.equal(canonicalCategory('esporte e lazer'), 'Esporte adaptado');
 assert.equal(canonicalCategory('Braille'), 'Educação inclusiva');
 assert.equal(canonicalCategory('tecnologia'), 'Tecnologia assistiva');
 assert.equal(canonicalCategory('cidadania'), 'Direitos e acessibilidade');
 assert.equal(canonicalCategory('livros e novidades'), 'Inclusão e acessibilidade');
 assert.equal(canonicalCategory(undefined), 'Inclusão e acessibilidade');
 assert.equal(validateDraft(JSON.stringify({...draft,category:'esporte'})).category,'Esporte adaptado');
 assert.equal(payloadFor(source,{...draft,category:'esporte'},'openrouter').category,'Esporte adaptado');
 assert.match(SYSTEM,/Classifique category com um destes rótulos/);
});

test('readable slug uses title words and deterministic source fingerprint',()=>{
 const sample={...source,dedupeKey:'4e44e09a02'+'b'.repeat(54)};
 const slug=slugFor(sample,'Esportes acessíveis ampliam aprendizado e pertencimento');
 assert.match(slug,/^esportes-acessiveis-ampliam-aprendizado-e-pertencimento-4e44e09a02$/);
 assert.ok(slug.length<=90);
 assert.equal(slugFor(sample,'Esportes acessíveis ampliam aprendizado e pertencimento'),slug);
 assert.notEqual(slugFor({...sample,dedupeKey:'a'.repeat(64)},'Esportes acessíveis ampliam aprendizado e pertencimento'),slug);
 assert.equal(slugFor(sample,'!!!'),'radar-da-inclusao-4e44e09a02');
 assert.equal(payloadFor(sample,{...draft,title:'Esportes acessíveis ampliam aprendizado e pertencimento'},'openrouter').slug,slug);
 assert.throws(()=>slugFor({...sample,dedupeKey:'invalid'},'Teste'),/fingerprint/);
});
const reviewSource={...source,title:'Accessible learning and sports help blind students in classrooms',
  summary:'A specialized school describes inclusive sports and accessible classroom practices for blind children. The new activities offer opportunities to join peer groups, participate in games, and learn skills alongside other students. Families describe these events as part of the school program.',
  url:'https://www.w3.org/WAI/news/test'};
const reviewDraft={...draft,
  title:'Esporte acessível promove aprendizado com crianças',
  body:'Uma escola especializada descreve esportes acessíveis e atividades escolares inclusivas para crianças com deficiência visual. O texto apresenta oportunidades de convivência entre colegas e participação em jogos, com base no resumo disponibilizado pela organização.'};
const approvedEvidence={verified:true,mode:'full_article',sourceUrl:reviewSource.url,
  digest:'e'.repeat(64),blocks:[
    {id:'E01',text:'The school describes inclusive sports and accessible classroom practices for children with visual disabilities in a supervised educational environment.'},
    {id:'E02',text:'Students participate in adapted games and learn alongside peers during inclusive group activities in school classrooms.'},
    {id:'E03',text:'Families and educators exchange perspectives on inclusive learning and accessibility while developing opportunities for children.'},
  ]};
const reviewReply={decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:['inclusive sports and accessible classroom practices',
    'Students participate in adapted games and learn alongside peers'],
  unsupportedClaims:[],issues:[]};
test('opted-in second AI review can publish one newly created Draft after independent CMS preflight',async()=>{
 let n=0,created=0,published=0;
 const router={async complete(){n++;
   return {provider:'openrouter',content:JSON.stringify(n===1?reviewDraft:reviewReply)};}};
 const cms={async existing(){return false;},async create(payload){
   created++;assert.equal(payload.editorialStatus,'em_revisao');
   assert.match(payload.slug,/^esporte-acessivel-promove-aprendizado/);
   return 'a1b2c3d4e5f6g7h8i9j0klmn';
 }};
 const publisher={async publishApprovedDraft(id,payload){
   published++;assert.equal(id,'a1b2c3d4e5f6g7h8i9j0klmn');
   assert.equal(payload.aiAssisted,true);return {published:true};
 }};
 const store={async set(){return 'OK';},async exists(){return 0;},async eval(){return 1;}};
 const out=await processArticle(reviewSource,{router,store,cms,dryRun:false,autoPublish:true,publisher,fullArticleEvidence:approvedEvidence});
 assert.equal(out.status,'draft_published');
 assert.equal(created,1);assert.equal(published,1);assert.equal(n,2);
});
test('AI review HOLD or unavailable leaves newly generated item as unpublished Draft',async()=>{
 let publisherCalls=0;let modelCalls=0;let created=0;
 const router={async complete(){modelCalls++;
   return {provider:'openrouter',content:JSON.stringify(modelCalls%2===1?
     reviewDraft:{...reviewReply,decision:'hold',issues:['Claim not verified']})};}};
 const store={async set(){return 'OK';},async exists(){return 0;},async eval(){return 1;}};
 const cms={async existing(){return false;},async create(){created++;return 'a1b2c3d4e5f6g7h8i9j0klmn';}};
 const publisher={async publishApprovedDraft(){publisherCalls++;}};
 const out=await processArticle(reviewSource,{router,store,cms,dryRun:false,autoPublish:true,publisher,fullArticleEvidence:approvedEvidence});
 assert.equal(out.status,'draft_created_review_pending');
 assert.equal(created,1);assert.equal(publisherCalls,0);assert.equal(modelCalls,3); // one bounded repair request
});
test('Strapi publish failure remains Draft and never leaks CMS errors',async()=>{
 let calls=0;const events=[];
 const router={async complete(){calls++;return {provider:'openrouter',
   content:JSON.stringify(calls===1?reviewDraft:reviewReply)};}};
 const store={async set(){return 'OK';},async exists(){return 0;},async eval(){return 1;}};
 const cms={async existing(){return false;},async create(){return 'a1b2c3d4e5f6g7h8i9j0klmn';}};
 const publisher={async publishApprovedDraft(){throw Error('secret CMS error detail');}};
 const out=await processArticle(reviewSource,{router,store,cms,dryRun:false,autoPublish:true,publisher,fullArticleEvidence:approvedEvidence,
   logger:x=>events.push(x)});
 assert.equal(out.status,'draft_created_publish_failed');
 assert.ok(events.some(x=>x.event==='auto_publish_failed'));
 assert.ok(!JSON.stringify(events).includes('secret CMS error'));
});
test('auto publication refuses missing publisher before any CMS access',async()=>{
 let cmsCalled=0;
 const out=processArticle(reviewSource,{dryRun:false,autoPublish:true,publisher:null,
   cms:{async create(){cmsCalled++;}},router:null,store:null});
 await assert.rejects(out,/scoped publisher/);
 assert.equal(cmsCalled,0);
});

test('live writer detects a previously published article even after Redis seen TTL expires',async()=>{
 const sourceKey=source.dedupeKey;let calls=0,modelCalls=0;
 const cms=cmsClient({baseUrl:'http://cms:1337',token:'test-token-123456',
   fetchImpl:async(url,opts)=>{
     calls++;
     if(opts.method!=='GET')throw Error('Unexpected CMS write');
     if(new URL(url).searchParams.get('status')==='draft')
       return new Response(JSON.stringify({data:[]}),{status:200});
     assert.equal(new URL(url).searchParams.get('status'),'published');
     return new Response(JSON.stringify({data:[{documentId:'already-published'}]}),{status:200});
   }});
 const store={async set(){return 'OK';},async exists(){return 0;},async eval(){return 1;}};
 const result=await processArticle(source,{dryRun:false,store,cms,
   router:{async complete(){modelCalls++;throw Error('do not generate duplicate');}}});
 assert.equal(result.status,'already_in_cms');
 assert.equal(calls,2);assert.equal(modelCalls,0);
 assert.equal(sourceKey,source.dedupeKey);
});

test('auto publication rejects RSS-only reviewer evidence before acquiring a Redis lock',async()=>{
  let reads=0;const store={async set(){reads++;}};
  await assert.rejects(processArticle(reviewSource,{
    dryRun:false,autoPublish:true,publisher:{async publishApprovedDraft(){}},
    router:null,store,cms:null,
  }),/authorized full article evidence/);
  assert.equal(reads,0);
});


test('model JSON with clipped editorial prose is rejected even if parsed',()=>{
  const ending='A inclusão deve ser considerada na elaboração de programas e pol';
  assert.throws(()=>validateDraft(JSON.stringify({...draft,whyItMatters:ending})),
    /Incomplete model draft/);
  assert.throws(()=>validateDraft(JSON.stringify({...draft,body: 
    'Uma notícia descreve uma prática importante para o desenvolvimento de crianças com deficiência visual. O artigo segue com informa'})), 
    /Incomplete model draft/);
  assert.equal(validateDraft(JSON.stringify(draft)).whyItMatters,draft.whyItMatters);
  assert.equal(validateDraft(JSON.stringify({...draft,
    whyItMatters:'A inclusão deve ser considerada em projetos de educação acessível!'}))
    .category,'Tecnologia assistiva');
});

test('publication-ready gate rejects clipped summaries without changing historical Draft audit parser',()=>{
  const clipped={...draft,summary:'Uma reportagem descreve recursos de acessibilidade para estudantes e prevê novas condições para participação. A'};
  assert.equal(validateDraft(JSON.stringify(clipped)).summary,clipped.summary);
  assert.throws(()=>validatePublicationReadyDraft(JSON.stringify(clipped)),/Incomplete model draft/);
  assert.equal(validatePublicationReadyDraft(JSON.stringify(draft)).summary,draft.summary);
  assert.equal(validatePublicationReadyDraft('{"skip":true}'),null);
});


test('publication-ready diagnostics identify only a static field and violated rule',()=>{
  const check=(candidate,field,constraint)=>{
    assert.throws(
      ()=>validatePublicationReadyDraft(JSON.stringify(candidate)),
      error=>{
        assert.equal(error.message,'Incomplete model draft');
        assert.equal(error.editorialField,field);
        assert.equal(error.editorialConstraint,constraint);
        assert.equal(Object.keys(error).includes('content'),false);
        return true;
      });
  };
  check({...draft,title:'Curto'},'title','too_short');
  check({...draft,summary:'Resumo curto.'},'summary','too_short');
  check({...draft,body:'Corpo curto.'},'body','too_short');
  check({...draft,whyItMatters:'Curto.'},'whyItMatters','too_short');
  check({...draft,title:'T'.repeat(151)},'title','too_long');
  check({...draft,summary:'S'.repeat(255)+'.'},'summary','too_long');
  check({...draft,body:'B'.repeat(1000)+'.'},'body','too_long');
  check({...draft,whyItMatters:'W'.repeat(355)+'.'},'whyItMatters','too_long');
  check({...draft,summary:'Resumo completo que foi interrompido no meio de uma oração sem concluir'},'summary','unfinished_sentence');
  check({...draft,body:'A'.repeat(125)},'body','unfinished_sentence');
  check({...draft,whyItMatters:'Justificativa extensa mas sem pontuacao ao final'},'whyItMatters','unfinished_sentence');
  // Legacy imported Drafts retain the same permissive parser; only the
  // final publication gate adds tighter limits and punctuation.
  const legacy={...draft,summary:'S'.repeat(255)+'.'};
  assert.equal(validateDraft(JSON.stringify(legacy)).summary,legacy.summary);
  assert.equal(validatePublicationReadyDraft('{"skip":true}'),null);
});


test('live auto publisher rejects unsourced names before writing a CMS Draft',async()=>{
  let cmsWrites=0,publisherCalls=0,requests=0,unlocks=0;
  const invalid={...reviewDraft,
    body:reviewDraft.body+
      ' O ministro Leonardo Barchin anunciou uma nova política.'};
  const router={async complete(){requests++;return {
    provider:'groq',content:JSON.stringify(invalid),
  };}};
  const store={
    async set(){return 'OK';},async exists(){return 0;},
    async eval(){unlocks++;return 1;},
  };
  const cms={
    async existing(){return false;},
    async create(){cmsWrites++;throw Error('no unsourced draft should be written');},
  };
  const publisher={async publishApprovedDraft(){publisherCalls++;}};
  const result=await processArticle(reviewSource,{
    dryRun:false,autoPublish:true,router,store,cms,publisher,
    fullArticleEvidence:approvedEvidence,
  });
  assert.equal(result.status,'invalid_draft');
  assert.equal(requests,1);
  assert.equal(cmsWrites,0);
  assert.equal(publisherCalls,0);
  assert.equal(unlocks,1);
});

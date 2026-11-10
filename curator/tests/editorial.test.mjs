import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM,canonicalCategory,cmsClient,validateDraft,payloadFor,processArticle} from '../src/editorial.mjs';
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
 assert.match(urls[1].url,/\?status=draft$/);
 assert.equal(JSON.parse(urls[1].opts.body).data.editorialStatus,'em_revisao');
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
     assert.equal(error.message,'Strapi draft lookup failed (HTTP '+code+')');
     assert.ok(!error.message.includes(SECRET));
     assert.ok(!error.message.includes(token));
     return true;
   });
   assert.equal(urls.length,1);
   assert.equal(urls[0].options.method,undefined); // GET
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
   e.message==='Strapi draft lookup unreachable');
 const malformed=cmsClient({baseUrl:'http://cms:1337',token,fetchImpl:async()=>
   new Response('no-json',{status:200})});
 await assert.rejects(malformed.existing(source.dedupeKey),e=>
   e.message==='Invalid Strapi lookup response');
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

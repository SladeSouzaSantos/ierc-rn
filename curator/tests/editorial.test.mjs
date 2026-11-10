import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cmsClient,validateDraft,payloadFor,processArticle} from '../src/editorial.mjs';
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

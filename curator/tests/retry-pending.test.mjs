import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {retryPendingDraft} from '../src/retry-pending.mjs';
import {slugFor,payloadFor} from '../src/editorial.mjs';
import {cmsPublisher} from '../src/cms-publish.mjs';

const doc='a1b2c3d4e5f6g7h8i9j0klmn';
const url='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/inclusao-visual';
const dedupeKey=createHash('sha256').update(url).digest('hex');
const article={
  documentId:doc,sourceUrl:url,dedupeKey,
  sourceName:'Agência Brasil (EBC)',sourceLanguage:'pt-BR',
  originalTitle:'Educação inclusiva amplia o acesso a recursos para estudantes cegos',
  originalPublishedAt:'2026-11-12T11:00:00.000Z',
  title:'Recursos acessíveis contribuem para a educação inclusiva',
  summary:'Uma publicação da Agência Brasil apresenta experiências de inclusão escolar e recursos adaptados para estudantes com deficiência visual.',
  body:'A reportagem descreve práticas educacionais inclusivas e recursos adaptados utilizados por escolas. A matéria aponta exemplos de atividades e materiais acessíveis para estudantes com deficiência visual.',
  whyItMatters:'O tema apresenta experiências relevantes para o debate sobre acessibilidade escolar no Brasil.',
  category:'Educação inclusiva',scope:'brasil',
};
article.slug=slugFor({dedupeKey},article.title);
const evidence={verified:true,mode:'full_article',sourceUrl:url,
  sourceId:'agencia-brasil-educacao',digest:'b'.repeat(64),
  licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
  blocks:[
    {id:'E01',text:'A Agência Brasil apresenta experiências de inclusão escolar e recursos adaptados para estudantes com deficiência visual.'},
    {id:'E02',text:'O texto relata que escolas utilizam materiais acessíveis e atividades adaptadas no cotidiano de estudantes.'},
    {id:'E03',text:'Professores discutem formas de ampliar o acesso a recursos pedagógicos acessíveis na educação inclusiva.'},
  ]};
const review={decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:['experiências de inclusão escolar e recursos adaptados',
    'escolas utilizam materiais acessíveis e atividades adaptadas'],
  unsupportedClaims:[],issues:[]};
const allowedSources=['agencia-brasil-educacao'];
function config(overrides={}){
  let published=0,created=0,modelCalls=0,articleReads=0;
  const events=[];
  const publisher={
    async readPendingDraft(id){assert.equal(id,doc);return overrides.pending||article;},
    async publishApprovedDraft(id,expected,verdict){
      assert.equal(id,doc);
      assert.equal(expected.sourceUrl,url);
      assert.equal(expected.dedupeKey,dedupeKey);
      assert.equal(expected.slug,article.slug);
      assert.equal(verdict.evidenceDigest,evidence.digest);
      published++;return {published:true};
    },
  };
  const store={
    async set(){return 'OK';},
    async eval(){return 1;},
  };
  const router={async complete(args){
    modelCalls++;assert.equal(args.phase,'review');
    assert.match(args.system,/revisor independente/);
    return {provider:'groq',content:JSON.stringify(overrides.review||review)};
  }};
  const articleReader=async()=>{articleReads++;return overrides.evidence||evidence;};
  return {
    args:{documentId:doc,publisher,store,router,allowedSources,
      now:Date.parse('2026-11-13T00:49:00Z'),articleReader,
      logger:e=>events.push(e)},
    counts:()=>({published,created,modelCalls,articleReads,events}),
  };
}
test('retry-pending publishes same existing Draft only after new full article second review',async()=>{
  const {args,counts}=config();
  const result=await retryPendingDraft(args);
  assert.deepEqual(result,{status:'draft_published',reusedDraft:true});
  const out=counts();
  assert.equal(out.published,1);
  assert.equal(out.created,0);
  assert.equal(out.modelCalls,1);
  assert.equal(out.articleReads,1);
  assert.ok(out.events.some(e=>e.event==='pending_draft_published'));
});
test('recovery accepts CMS summary with surrounding whitespace but publishes exact stored summary',async()=>{
  const pending={...article,summary:'  '+article.summary+'\n'};
  const {args,counts}=config({pending});
  let persistedSummary;
  const originalPublish=args.publisher.publishApprovedDraft.bind(args.publisher);
  args.publisher.publishApprovedDraft=async(id,expected,verdict)=>{
    persistedSummary=expected.summary;
    return originalPublish(id,expected,verdict);
  };
  const result=await retryPendingDraft(args);
  assert.equal(result.status,'draft_published');
  assert.equal(result.reusedDraft,true);
  assert.equal(persistedSummary,pending.summary);
  assert.equal(counts().published,1);
  assert.equal(counts().modelCalls,1);
});
test('recovery still rejects summary that validator would truncate, before calls and CMS writes',async()=>{
  const pending={...article,summary:article.summary+' '.'repeat(4)+'X'.repeat(300)};
  const {args,counts}=config({pending});
  await assert.rejects(retryPendingDraft(args),/editorial integrity/);
  assert.equal(counts().articleReads,0);
  assert.equal(counts().modelCalls,0);
  assert.equal(counts().published,0);
});
test('unavailable LLM review holds the existing draft; never PUT or create another',async()=>{
  const {args,counts}=config();
  args.router={async complete(){throw Error('free quotas exhausted');}};
  const result=await retryPendingDraft(args);
  assert.deepEqual(result,{status:'draft_review_pending',reason:'review_unavailable'});
  assert.equal(counts().published,0);
  assert.equal(counts().articleReads,1);
});
test('negative evidence review holds existing draft; no publication',async()=>{
  const {args,counts}=config({review:{...review,decision:'hold',issues:['no evidence']}});
  const result=await retryPendingDraft(args);
  assert.equal(result.status,'draft_review_pending');
  assert.equal(counts().published,0);
});
test('forged link, changed content and stale date prevent external reads and all writes',async()=>{
  const altered=[
    {...article,sourceUrl:'https://example.net/noticia/inclusao'},
    {...article,dedupeKey:'0'.repeat(64)},
    {...article,slug:'changed-slug'},
    {...article,originalPublishedAt:'2025-05-01T00:00:00Z'},
    {...article,title:'X'},
    {...article,sourceName:'Perkins'},
  ];
  for(const pending of altered){
    const {args,counts}=config({pending});
    await assert.rejects(retryPendingDraft(args),/Pending Draft|editorial integrity/);
    assert.equal(counts().published,0);
    assert.equal(counts().modelCalls,0);
    assert.equal(counts().articleReads,0);
  }
});
test('source license or article evidence failure prevents any model call or publish',async()=>{
  const {args,counts}=config({evidence:{...evidence,verified:false}});
  await assert.rejects(retryPendingDraft(args),/full article rights unavailable/);
  assert.equal(counts().published,0);
  assert.equal(counts().modelCalls,0);
});
test('publisher readPendingDraft accepts the EXACT live payloadFor AI Draft, unchanged',async()=>{
  const source={
    source:'Agência Brasil (EBC)',language:'pt-BR',title:article.originalTitle,
    url,dedupeKey,publishedAt:article.originalPublishedAt,
    country:'Brasil',coverageScope:'brasil',
  };
  const draft={
    title:article.title,summary:article.summary,body:article.body,
    whyItMatters:article.whyItMatters,category:article.category,
  };
  // Do not duplicate an invented approvalNote in the success fixture.
  // This contract uses the exact string the PROD writer stores in Strapi.
  const stored={...payloadFor(source,draft,'openrouter'),
    documentId:doc,publishedAt:null};
  assert.equal(stored.approvalNote,
    'Rascunho criado com IA openrouter. Revisar fonte e fatos; não publicar sem aprovação humana.');
  const calls=[];
  const publisher=cmsPublisher({
    baseUrl:'http://cms:1337',token:'test-publisher-token-1234',
    draftToken:'test-draft-token-1234',
    fetchImpl:async(address,options)=>{
      calls.push({address,method:options.method});
      assert.equal(options.method,'GET');
      if(address.endsWith('status=published'))
        return new Response('{}',{status:404});
      if(address.endsWith('status=draft'))
        return new Response(JSON.stringify({data:stored}),{status:200});
      throw Error('Unexpected CMS endpoint');
    },
  });
  assert.deepEqual(await publisher.readPendingDraft(doc),stored);
  assert.equal(calls.length,2);
  assert.ok(calls.every(x=>x.address.includes('/api/news-articles/'+doc+'?status=')));
});
test('publisher readPendingDraft rejects published or non-worker-created drafts',async()=>{
  const token='safe-publish-token-1234',draftToken='safe-draft-token-1234';
  for(const state of ['published','changed','new']){
    let calls=0;
    const publisher=cmsPublisher({baseUrl:'http://cms:1337',token,draftToken,
      fetchImpl:async(address,opts)=>{
        calls++;
        assert.equal(opts.method,'GET');
        const published=address.includes('status=published');
        if(published&&state==='published')return new Response(JSON.stringify({data:{
          ...article,publishedAt:'2026-11-12T13:00:00.000Z'}}),{status:200});
        if(published)return new Response('{}',{status:404});
        const pending={...article,publishedAt:null,originType:'externa',
          aiAssisted:true,editorialStatus:'em_revisao',image:null,
          approvalNote:'Rascunho criado com IA openrouter. Revisar fonte e fatos; não publicar sem aprovação humana.'};
        if(state==='changed')pending.approvalNote='Alterado manualmente';
        if(state==='new')pending.aiAssisted=false;
        return new Response(JSON.stringify({data:pending}),{status:200});
      }});
    await assert.rejects(publisher.readPendingDraft(doc),
      /already published|not an unchanged AI-review-pending/);
    assert.ok(calls>=1&&calls<=2);
  }
});
test('invalid or unapproved document ID fails without network or model I/O',async()=>{
  const {args,counts}=config();
  for(const id of ['','bad','../../secrets','https://evil.example/path']){
    await assert.rejects(retryPendingDraft({...args,documentId:id}),
      /recovery prerequisites/);
  }
  assert.equal(counts().modelCalls,0);
});

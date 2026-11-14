import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOURCES} from '../src/feeds.mjs';
import {slugFor} from '../src/editorial.mjs';
import {ENEM_EDITORIAL_PROPOSAL,ENEM_SOURCE_URL} from '../src/enem-human-publication.mjs';
import {ENEM_PROD_DOCUMENT_ID,runEnemAiProd} from '../src/enem-ai-prod.mjs';
import {safeEnemProdDenial} from '../src/publish-enem-ai-prod.mjs';

const source=SOURCES.find(s=>s.id==='agencia-brasil-educacao');
const sha=s=>createHash('sha256').update(s).digest('hex');
const dedupeKey=sha(ENEM_SOURCE_URL);
const now=Date.parse('2026-11-14T04:00:00.000Z');
function pending(){
  const record={
    documentId:ENEM_PROD_DOCUMENT_ID,sourceUrl:ENEM_SOURCE_URL,
    dedupeKey,sourceName:source.name,sourceLanguage:source.language,
    originalTitle:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
    originalPublishedAt:'2026-11-08T14:40:00.000Z',
    title:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
    summary:'O Enem 2026 prevê atendimento especializado, apoio emocional e recursos de acessibilidade para participantes que solicitaram o benefício',
    body:'O Enem 2026 apresenta recursos para participantes com condições específicas. Segundo a Agência Brasil, o apoio emocional passa a integrar as medidas de acessibilidade durante a prova.',
    whyItMatters:'A notícia informa condições de acesso e recursos para candidatos que precisam de atendimento especializado.',
    category:'Educação inclusiva',editorialStatus:'em_revisao',
    originType:'externa',aiAssisted:true,publishedAt:null,image:null,
    approvalNote:'Rascunho criado com IA openrouter. Revisar fonte e fatos; não publicar sem aprovação humana.',
  };
  record.slug=slugFor({dedupeKey},record.title);
  return record;
}
const evidence={
  verified:true,mode:'full_article',sourceId:'agencia-brasil-educacao',
  sourceUrl:ENEM_SOURCE_URL,licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
  digest:'f'.repeat(64),blocks:[
    {id:'E01',text:'O atendimento especializado precisa ter sido solicitado no momento da inscrição e aprovado pelo Inep, responsável pela aplicação do Enem.'},
    {id:'E02',text:'A reportagem inclui candidatos com fibromialgia entre as condições que motivam a solicitação de atendimento especializado e de recurso de acessibilidade.'},
    {id:'E03',text:'Entre os recursos de acessibilidade solicitados no ato da inscrição, destacam-se tempo adicional, correção diferenciada e auxílio para leitura.'},
  ],
};
const review={
  decision:'approve',factualSupport:'fully_supported',
  unsupportedClaims:[],issues:[],
  evidenceQuotes:[
    'O atendimento especializado precisa ter sido solicitado no momento da inscrição',
    'Entre os recursos de acessibilidade solicitados no ato da inscrição',
  ],
};
function fixture(){
  const memory=new Map(),calls=[];
  const redis={
    async set(key,value,...args){
      calls.push(['redis_set',key]);
      if(args.includes('NX')&&memory.has(key))return null;
      memory.set(key,value);return 'OK';
    },
    async eval(_lua,_keys,key,value){
      calls.push(['unlock',key]);
      if(memory.get(key)===value){memory.delete(key);return 1;}
      return 0;
    },
  };
  const publisher={
    async readPendingDraft(id){
      calls.push(['cms_read',id]);
      assert.equal(id,ENEM_PROD_DOCUMENT_ID);
      return pending();
    },
    async publishApprovedDraft(id,expected,audit,options){
      calls.push(['cms_publish',id]);
      assert.equal(id,ENEM_PROD_DOCUMENT_ID);
      assert.equal(expected.sourceUrl,ENEM_SOURCE_URL);
      assert.equal(expected.dedupeKey,dedupeKey);
      assert.equal(expected.title,pending().title);
      assert.equal(audit.evidenceMode,'full_article');
      assert.equal(audit.evidenceDigest,evidence.digest);
      assert.equal(audit.licenseReference,evidence.licenseReference);
      assert.equal(audit.evidenceQuotes.length,2);
      assert.match(audit.editorialDigest,/^[a-f0-9]{64}$/);
      assert.equal(options.correctedDraft.title,ENEM_EDITORIAL_PROPOSAL.title);
      return {published:true};
    },
  };
  const articleReader=async (_source,article)=>{
    calls.push(['evidence',article.url]);return evidence;
  };
  const args={mode:'publish',publisher,redis,articleReader,
    now,allowedSources:[source.id]};
  return {args,calls,memory};
}

test('preview reads exact PROD draft and rights, never calls models or publishes',async()=>{
  const f=fixture();delete f.args.redis;f.args.mode='preview';
  const result=await runEnemAiProd(f.args);
  assert.equal(result.status,'enem_ai_prod_preview');
  assert.equal(result.cmsWrites,0);
  assert.equal(result.aiUsed,false);
  assert.match(result.proposalDigest,/^[a-f0-9]{64}$/);
  assert.deepEqual(f.calls.map(x=>x[0]),['cms_read','evidence']);
});

test('independent fully supported AI verdict publishes ONLY same PROD CMS document',async()=>{
  const f=fixture();let modelCalls=0;
  f.args.router={async complete(request){
    modelCalls++;
    assert.equal(request.phase,'review');
    assert.deepEqual(JSON.parse(request.prompt).draft,ENEM_EDITORIAL_PROPOSAL);
    return {provider:'groq',content:JSON.stringify(review)};
  }};
  const result=await runEnemAiProd(f.args);
  assert.equal(result.status,'draft_published');
  assert.equal(result.reusedDraft,true);
  assert.equal(result.correctedByAi,false);
  assert.equal(result.slug,slugFor({dedupeKey},ENEM_EDITORIAL_PROPOSAL.title));
  assert.equal(modelCalls,1);
  assert.equal(f.calls.filter(x=>x[0]==='cms_publish').length,1);
  assert.equal(f.calls.filter(x=>x[0]==='redis_set').length,3);
  assert.equal(f.calls.at(-1)[0],'unlock');
});

test('HOLD and unrepairable candidate stays Draft, and single-shot marker blocks reattempt',async()=>{
  const f=fixture();let modelCalls=0;
  const hold={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['simulated unverified claim'],
    issues:['A fonte não sustenta a alegação.']};
  f.args.router={async complete({phase}){
    modelCalls++;
    return {provider:'groq',content:JSON.stringify(
      phase==='review'?hold:{skip:true})};
  }};
  const first=await runEnemAiProd(f.args);
  assert.equal(first.status,'draft_review_pending');
  assert.equal(first.reason,'insufficient_evidence');
  assert.equal(modelCalls,2);
  assert.equal(f.calls.filter(x=>x[0]==='cms_publish').length,0);
  const second=await runEnemAiProd(f.args);
  assert.equal(second.status,'already_attempted');
  assert.equal(second.reason,'revision_locked');
  assert.equal(modelCalls,2);
});

test('source/document/date/rights changes fail before model or CMS writes',async()=>{
  for(const mismatch of [
    {documentId:'other-id'}, {sourceUrl:'https://evil.example/story'},
    {originalPublishedAt:'2024-01-01T00:00:00.000Z'},
    {summary:'Short'},
  ]){
    const f=fixture();f.args.publisher.readPendingDraft=async()=>({
      ...pending(),...mismatch,
    });
    f.args.router={async complete(){throw Error('model must not run');}};
    await assert.rejects(runEnemAiProd(f.args));
    assert.equal(f.calls.filter(x=>x[0]==='cms_publish').length,0);
    assert.equal(f.calls.filter(x=>x[0]==='redis_set').length,0);
  }
  const f=fixture();
  f.args.articleReader=async()=>({...evidence,licenseReference:'wrong'});
  f.args.router={async complete(){throw Error('model must not run');}};
  await assert.rejects(runEnemAiProd(f.args),/licensed full-article evidence/);
  assert.equal(f.calls.length,1);
});

test('no general documentId argument or bypass of publisher/prod license gate',async()=>{
  const f=fixture();f.args.allowedSources=['perkins'];
  f.args.router={async complete(){throw Error('no model');}};
  await assert.rejects(runEnemAiProd(f.args),/not allowlisted/);
  assert.equal(f.calls.filter(x=>x[0]==='cms_publish').length,0);
  const missing=fixture();
  delete missing.args.publisher.publishApprovedDraft;
  await assert.rejects(runEnemAiProd(missing.args),/prerequisites missing/);
});

test('historic PROD Draft summary boundary whitespace is allowed without accepting truncation',async()=>{
  const f=fixture();
  f.args.mode='preview';
  const original=pending();
  f.args.publisher.readPendingDraft=async()=>({...original,
    summary:original.summary+'  '});
  const report=await runEnemAiProd(f.args);
  assert.equal(report.status,'enem_ai_prod_preview');
  assert.equal(report.cmsWrites,0);
  assert.equal(f.calls.some(x=>x[0]==='redis_set'),false);
  const different=fixture();
  different.args.mode='preview';
  different.args.publisher.readPendingDraft=async()=>({...original,
    summary:'S'.repeat(271)});
  // Legacy source content >270 non-space characters cannot be silently
  // truncated and treated as an equivalent CMS Draft.
  await assert.rejects(runEnemAiProd(different.args),/integrity|mismatch/);
});

test('PROD CLI only exposes preapproved static refusal reasons',()=>{
  const base=[
    ['PROD ENEM source or document identity mismatch','document_identity_mismatch'],
    ['PROD ENEM draft failed exact content-integrity verification','draft_content_integrity'],
    ['Draft is not an unchanged AI-review-pending candidate','draft_not_pending'],
    ['PROD ENEM licensed full-article evidence unavailable','article_evidence_unavailable'],
    ['PROD ENEM pending Draft status mismatch','draft_status_mismatch'],
  ];
  for(const [message,code] of base)
    assert.equal(safeEnemProdDenial(new Error(message)),code);
  assert.equal(safeEnemProdDenial({
    name:'ArticleEvidenceError',reason:'article_rights_unverified'}),
  'evidence_article_rights_unverified');
  assert.equal(safeEnemProdDenial(new Error('secret CMS token and full article text')),'unclassified');
  assert.equal(safeEnemProdDenial({
    name:'ArticleEvidenceError',reason:'secret source contents'}),'unclassified');
});

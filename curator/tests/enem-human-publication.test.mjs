import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {slugFor} from '../src/editorial.mjs';
import {ENEM_DOCUMENT_ID,ENEM_SOURCE_URL,ENEM_EVIDENCE_DIGEST_PREFIX,
  ENEM_EDITORIAL_PROPOSAL,prepareEnemEditorialPublication,
  publishEnemHumanReviewed} from '../src/enem-human-publication.mjs';

const key=createHash('sha256').update(ENEM_SOURCE_URL).digest('hex');
const original={
  documentId:ENEM_DOCUMENT_ID,
  sourceUrl:ENEM_SOURCE_URL,
  dedupeKey:key,sourceName:'Agência Brasil (EBC)',
  sourceLanguage:'pt-BR',
  originalTitle:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
  originalPublishedAt:'2026-11-08T14:40:00.000Z',
  title:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
  summary:'A Agência Brasil apresenta as medidas de acessibilidade e de apoio emocional em vigor para a prova do Enem 2026.',
  body:'A reportagem detalha solicitações de atendimento especializado durante o Enem 2026. Entre as medidas estão apoio emocional, auxílio para leitura e recursos associados a condições específicas.',
  whyItMatters:'A notícia aborda a acessibilidade em um exame nacional e recursos relacionados à inclusão.',
  category:'Educação inclusiva',editorialStatus:'em_revisao',publishedAt:null,
  approvalNote:'Rascunho criado com IA groq. Revisar fonte e fatos; não publicar sem aprovação humana.',
};
original.slug=slugFor({dedupeKey:key},original.title);
const evidence={
  verified:true,mode:'full_article',sourceUrl:ENEM_SOURCE_URL,
  sourceId:'agencia-brasil-educacao',
  licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
  digest:ENEM_EVIDENCE_DIGEST_PREFIX+'a'.repeat(52),
  blocks:[
    {id:'E01',text:'A Agência Brasil informa condições de atendimento especializado no Enem 2026.'},
    {id:'E02',text:'A solicitação de apoio emocional deve ser aprovada pelo Inep durante as inscrições.'},
    {id:'E03',text:'Entre os recursos estão auxílio para leitura e tempo adicional aos candidatos.'},
  ],
};
const now=Date.parse('2026-11-13T23:59:00Z');
function config(overrides={}){
  const calls=[];
  const pending=overrides.pending||original;
  const reader=async()=>{calls.push('evidence');return overrides.evidence||evidence;};
  const publisher={async readPendingDraft(doc){
    calls.push('readPendingDraft');
    assert.equal(doc,ENEM_DOCUMENT_ID);
    return pending;
  }};
  return {calls,publisher,reader,pending};
}

test('validated proposal is original, complete and excludes disputed surname',async()=>{
  const {publisher,reader,calls}=config();
  const {preview,approvalDigest}=await prepareEnemEditorialPublication({
    publisher,articleReader:reader,now,
  });
  assert.equal(preview.event,'human_editorial_review_required');
  assert.equal(approvalDigest.length,64);
  assert.equal(preview.newDraft.slug,slugFor({dedupeKey:key},ENEM_EDITORIAL_PROPOSAL.title));
  assert.deepEqual(calls,['readPendingDraft','evidence']);
  for(const field of ['summary','body','whyItMatters'])
    assert.match(preview.newDraft[field],/[.!?]$/);
  assert.doesNotMatch(JSON.stringify(preview.newDraft),/Barchin/i);
  assert.equal(preview.oldStatus,'Draft');
});
test('publish with exact reviewed digest uses same CMS document and read-back',async()=>{
  const {publisher,reader,pending}=config();
  const ready=await prepareEnemEditorialPublication({publisher,articleReader:reader,now});
  const requests=[];
  let persisted=null;
  const fetchImpl=async(url,opts)=>{
    requests.push({url,method:opts.method});
    if(opts.method==='GET'&&url.endsWith('?status=draft'))
      return new Response(JSON.stringify({data:pending}),{status:200});
    if(opts.method==='PUT'&&url.endsWith('?status=published')){
      const data=JSON.parse(opts.body).data;
      persisted={...pending,...data,publishedAt:'2026-11-13T23:59:20Z'};
      return new Response(JSON.stringify({data:persisted}),{status:200});
    }
    if(opts.method==='GET'&&url.endsWith('?status=published'))
      return new Response(JSON.stringify({data:persisted}),{status:200});
    throw new Error('unexpected mock CMS request');
  };
  const result=await publishEnemHumanReviewed({
    publisher,articleReader:reader,approvalDigest:ready.approvalDigest,
    baseUrl:'http://cms:1337',token:'valid-publisher-1234',
    draftToken:'valid-draft-1234',fetchImpl,now,
  });
  assert.deepEqual(requests.map(r=>r.method),['GET','PUT','GET']);
  assert.ok(requests.every(r=>r.url.includes('/'+ENEM_DOCUMENT_ID+'?')));
  assert.equal(result.event,'human_reviewed_draft_published_dev');
  assert.equal(result.status,'Published');
  assert.equal(persisted.editorialStatus,'aprovado');
  assert.match(persisted.approvalNote,/Não é uma aprovação automática por IA/);
  assert.equal(persisted.body,ENEM_EDITORIAL_PROPOSAL.body);
});
test('wrong digest refuses publication even with a valid article and CMS',async()=>{
  let requests=0;
  const {publisher,reader}=config();
  await assert.rejects(publishEnemHumanReviewed({
    publisher,articleReader:reader,approvalDigest:'0'.repeat(64),
    token:'valid-publisher-1234',draftToken:'valid-draft-1234',
    fetchImpl:async()=>{requests++;return new Response('{}');},now,
  }),/digest mismatch/);
  assert.equal(requests,0);
});
test('CMS draft modification between preview and PUT is rejected',async()=>{
  const {publisher,reader,pending}=config();
  const ready=await prepareEnemEditorialPublication({publisher,articleReader:reader,now});
  let count=0;
  await assert.rejects(publishEnemHumanReviewed({
    publisher,articleReader:reader,approvalDigest:ready.approvalDigest,
    token:'valid-publisher-1234',draftToken:'valid-draft-1234',
    now,fetchImpl:async()=>{
      count++;
      return new Response(JSON.stringify({data:{...pending,whyItMatters:'alterado'}}),{status:200});
    },
  }),/Draft changed/);
  assert.equal(count,1);
});
test('changed evidence, source, date or CMS original fail closed',async()=>{
  for(const overrides of [
    {evidence:{...evidence,digest:'b'.repeat(64)}},
    {pending:{...original,sourceUrl:'https://example.invalid/redirect'}},
    {pending:{...original,originalPublishedAt:'2024-01-01T00:00:00Z'}},
  ]){
    const {publisher,reader}=config(overrides);
    await assert.rejects(prepareEnemEditorialPublication({
      publisher,articleReader:reader,now,
    }),/changed|match/);
  }
});
test('publisher is DEV-private and requires distinct credentials',async()=>{
  const {publisher,reader}=config();
  await assert.rejects(publishEnemHumanReviewed({
    publisher,articleReader:reader,approvalDigest:'0'.repeat(64),
    baseUrl:'https://strapi.iercrn.org.br',token:'identical-123',
    draftToken:'identical-123',now,
  }),/distinct publisher token/);
  await assert.rejects(publishEnemHumanReviewed({
    publisher,articleReader:reader,approvalDigest:'0'.repeat(64),
    baseUrl:'https://strapi.iercrn.org.br',token:'distinct-publisher-123',
    draftToken:'distinct-draft-123',now,
  }),/private CMS URL/);
});

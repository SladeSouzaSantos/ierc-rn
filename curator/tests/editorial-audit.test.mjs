import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditPendingDraft,summarizeObjection} from '../src/editorial-audit.mjs';
import {slugFor} from '../src/editorial.mjs';

const documentId='nxh3gri9njyrag8uvbtgux4i';
const sourceUrl='https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/inclusao-acessivel';
const dedupeKey=createHash('sha256').update(sourceUrl).digest('hex');
const draft={
  title:'Educação inclusiva amplia oportunidades para estudantes',
  summary:'Uma reportagem descreve iniciativas educacionais com medidas de acessibilidade para estudantes com deficiência visual.',
  body:'A reportagem apresenta iniciativas relacionadas à inclusão escolar. O texto destaca medidas de acessibilidade e recursos adaptados para estudantes com deficiência visual.',
  whyItMatters:'A discussão contribui para compreender desafios de acessibilidade no ambiente escolar.',
  category:'Educação inclusiva',
};
const pending={
  ...draft,documentId,sourceUrl,dedupeKey,
  slug:slugFor({dedupeKey},draft.title),
  originalTitle:'Educação inclusiva e acessibilidade em escolas brasileiras',
  originalPublishedAt:'2026-11-12T11:00:00.000Z',
  sourceName:'Agência Brasil (EBC)',sourceLanguage:'pt-BR',
};
const evidence={
  verified:true,mode:'full_article',
  sourceId:'agencia-brasil-educacao',sourceUrl,
  licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
  digest:'f'.repeat(64),blocks:[
    {id:'E01',text:'A reportagem apresenta iniciativas relacionadas à inclusão escolar, inclusive recursos para estudantes com deficiência visual.'},
    {id:'E02',text:'Escolas brasileiras discutem medidas de acessibilidade e recursos pedagógicos adaptados em salas de aula.'},
    {id:'E03',text:'A discussão sobre acesso e inclusão escolar envolve professores, alunos e gestores educacionais.'},
  ],
};
function setup(overrides={}){
  const called=[];
  const progress={phase:'terminal',correctionsDone:2,
    draft,history:[{afterCorrection:2,
      issues:['Checar a origem dos dados apresentados.'],
      unsupportedClaims:['A reportagem apresenta iniciativas relacionadas à inclusão escolar']}]};
  const args={
    documentId,allowedSources:['agencia-brasil-educacao'],
    now:Date.parse('2026-11-13T23:30:00Z'),
    publisher:{readPendingDraft:async id=>{
      called.push('GET');assert.equal(id,documentId);
      return overrides.pending||pending;}},
    progressStore:{load:async f=>{
      called.push('GET encrypted');
      assert.equal(f.documentId,documentId);
      assert.equal(f.dedupeKey,dedupeKey);
      assert.equal(f.evidenceDigest,evidence.digest);
      return Object.hasOwn(overrides,'progress')?overrides.progress:progress;
    }},
    articleReader:async s=>{
      called.push('GET article');assert.equal(s.id,'agencia-brasil-educacao');
      return overrides.evidence||evidence;
    },
  };
  return {args,called};
}
test('read-only audit returns terminal hold history and no unlicensed source body',async()=>{
  const {args,called}=setup();
  const x=await auditPendingDraft(args);
  assert.deepEqual(called,['GET','GET article','GET encrypted']);
  assert.equal(x.mode,'read_only');
  assert.equal(x.terminal,true);
  assert.equal(x.correctionsDone,2);
  assert.equal(x.modelFlaggedIssues[0].unsupportedClaims.length,1);
  assert.equal(x.modelFlaggedIssues[0].unsupportedClaims[0].sourcePhrasePresent,true);
  assert.equal(x.conclusion,'requires_human_factual_review');
  assert.equal(x.lastCorrectedDraft,undefined);
  assert.equal(x.llmCalls,0);
  assert.equal(x.cmsWrites,0);
  assert.equal(x.redisMutations,0);
  assert.ok(!JSON.stringify(x).includes(evidence.blocks[0].text));
});
test('opt-in operator report includes only the model-generated latest correction',async()=>{
  const {args}=setup();
  const out=await auditPendingDraft({...args,includeDraft:true});
  assert.deepEqual(out.lastCorrectedDraft,draft);
});
test('no history never implies approval or resets lineage',async()=>{
  const {args}=setup({progress:null});
  const out=await auditPendingDraft(args);
  assert.equal(out.savedPhase,'none');
  assert.equal(out.terminal,false);
  assert.deepEqual(out.modelFlaggedIssues,[]);
  assert.equal(out.conclusion,'requires_human_factual_review');
});
test('edited CMS draft is denied before any article or Redis access',async()=>{
  const {args,called}=setup({pending:{...pending,slug:'alterado-manualmente'}});
  await assert.rejects(auditPendingDraft(args),/integrity failed/);
  assert.deepEqual(called,['GET']);
});
test('unlicensed source or stale article fails before reading evidence',async()=>{
  const bads=[
    {...pending,sourceUrl:'https://example.com/edu/noticia/falso'},
    {...pending,originalPublishedAt:'2025-01-01T00:00:00Z'},
  ];
  for(const item of bads){
    const {args,called}=setup({pending:item});
    await assert.rejects(auditPendingDraft(args),/licensed-source or recency/);
    assert.deepEqual(called,['GET']);
  }
});
test('evidence mismatch rejects before encrypted progress retrieval',async()=>{
  const {args,called}=setup({evidence:{...evidence,sourceId:'perkins'}});
  await assert.rejects(auditPendingDraft(args),/complete licensed evidence/);
  assert.deepEqual(called,['GET','GET article']);
});
test('plain-text overlap is a diagnostic hint, never an editorial approval',()=>{
  const result=summarizeObjection('Não há evidências de acessibilidade em escolas.',evidence.blocks);
  assert.equal(result.sourcePhrasePresent,false);
  assert.ok(result.wordOverlap>=0&&result.wordOverlap<=1);
  assert.ok(result.closestBlockId?.startsWith('E'));
  assert.equal(result.approved,undefined);
});

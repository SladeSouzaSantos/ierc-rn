import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateEvidenceForObjections} from '../src/evidence-guidance.mjs';
import {VERIFIED_REPAIR_SYSTEM,VERIFIED_WRITER_SYSTEM}
  from '../src/full-article-review.mjs';

test('disputed statements get lexical candidate blocks, not automatic approval',()=>{
  const evidence={blocks:[
    {id:'E01',text:'O Inep aprovou solicitações de atendimento especializado durante a inscrição para participantes do Enem.'},
    {id:'E02',text:'A reportagem cita cão de apoio emocional para algumas condições relatadas no exame.'},
    {id:'E03',text:'Uma unidade escolar recebeu novos computadores para a biblioteca.'},
  ]};
  const disputes={
    unsupportedClaims:['O Inep aprovou atendimento especializado para participantes.',
      'O cão de apoio emocional foi citado entre os recursos.'],
    issues:['Afirmação de eficácia clínica sem evidência.'],
  };
  const hints=candidateEvidenceForObjections(disputes,evidence);
  assert.equal(hints.length,3);
  assert.ok(hints[0].candidateBlockIds.includes('E01'));
  assert.ok(hints[1].candidateBlockIds.includes('E02'));
  assert.deepEqual(hints[2].candidateBlockIds,[]);
  assert.deepEqual(Object.keys(hints[0]),['objectionIndex','candidateBlockIds']);
  assert.equal(JSON.stringify(hints).includes('atendimento especializado para'),false);
});
test('missing notes never invent source citations',()=>{
  assert.deepEqual(candidateEvidenceForObjections(null,{blocks:[]}),[]);
  assert.deepEqual(candidateEvidenceForObjections({issues:['x']},{blocks:[]}),
    [{objectionIndex:0,candidateBlockIds:[]}]);
});
test('both AI writing and repair target 90–160 characters but retain 250 hard max',()=>{
  assert.match(VERIFIED_WRITER_SYSTEM,/90–160/);
  assert.match(VERIFIED_REPAIR_SYSTEM,/summary 90–160/);
  assert.match(VERIFIED_REPAIR_SYSTEM,/summary 60–250/);
  assert.match(VERIFIED_REPAIR_SYSTEM,/SUGESTÕES LEXICAIS, NÃO PROVAS/);
  assert.match(VERIFIED_REPAIR_SYSTEM,/NOVA revisão independente/);
});

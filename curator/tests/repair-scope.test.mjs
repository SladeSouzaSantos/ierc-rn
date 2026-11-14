import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateConservativeRepairScope}
  from '../src/repair-scope.mjs';
import {reviewAndRepairFullArticleDraft}
  from '../src/full-article-review.mjs';

const base={
  title:'Enem 2026 prevê apoio emocional e recursos de acessibilidade',
  summary:'O Enem 2026 terá regras de atendimento especializado, com solicitação aprovada pelo Inep, para participação no exame.',
  body:'A Agência Brasil relata regras de atendimento especializado no Enem 2026. Segundo a reportagem, o pedido foi feito na inscrição e analisado pelo Inep.',
  whyItMatters:'A notícia informa sobre os requisitos e as possibilidades de atendimento especializado no exame.',
  category:'Educação inclusiva',
};

test('a correction may remove an unverified claim and retain existing attribution',()=>{
  const updated={...base,
    summary:'O Enem 2026 prevê atendimento especializado condicionado à solicitação na inscrição e à aprovação pelo Inep.'};
  assert.deepEqual(validateConservativeRepairScope(base,updated),updated);
});

test('new minister name is blocked before independent AI review',()=>{
  const changed={...base,
    body:base.body+' O ministro Leonardo Barchin participou do evento.'};
  assert.throws(()=>validateConservativeRepairScope(base,changed),err=>
    err.editorialConstraint==='new_proper_name'&&err.editorialField==='body');
});

test('new numbers and statistics are blocked, even if they occur in full source',()=>{
  for(const field of ['title','summary','body','whyItMatters']){
    const updated={...base,[field]:base[field]+' Foram registradas 138.329 solicitações.'};
    assert.throws(()=>validateConservativeRepairScope(base,updated),err=>
      err.editorialField===field&&err.editorialConstraint==='new_number');
  }
});

test('existing numbers and names remain available in cautious rewrites',()=>{
  const change={...base,
    title:'Enem 2026: apoio emocional e acessibilidade',
    body:'A Agência Brasil descreve regras de atendimento especializado no Enem 2026. O pedido foi feito durante a inscrição e avaliado pelo Inep.'};
  assert.deepEqual(validateConservativeRepairScope(base,change),change);
});

test('correction fallback rejects out-of-scope new named person before publication',async()=>{
  const original=base;
  const held={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['Afirmação abrangente sem evidência'],
    issues:['Limitar ao que foi citado na reportagem']};
  const valid={...base,
    whyItMatters:'A notícia esclarece critérios de acesso a recursos previstos para participantes do exame.'};
  const invalid={...valid,
    body:valid.body+' O ministro Leonardo Barchin apresentou a medida.'};
  const evidence={verified:true,mode:'full_article',
    sourceUrl:'https://agenciabrasil.ebc.com.br/enem-teste',
    licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
    digest:'a'.repeat(64),blocks:[
      {id:'E01',text:'O Enem 2026 apresenta novas regras de atendimento especializado para participantes.'},
      {id:'E02',text:'A solicitação de atendimento especializado precisava ser feita durante a inscrição e aprovada pelo Inep.'},
      {id:'E03',text:'A Agência Brasil explica o acesso aos recursos para participantes do exame.'},
    ]};
  let call=0;
  const phases=[];
  const router={async complete(req){
    phases.push(req.phase);call++;
    if(call===1)return {provider:'groq',content:JSON.stringify(held)};
    if(call===2){
      assert.throws(()=>req.validateOutput(JSON.stringify(invalid)),err=>
        err.editorialConstraint==='new_proper_name');
      const checked=req.validateOutput(JSON.stringify(valid));
      assert.equal(checked.title,valid.title);
      return {provider:'gemini',content:JSON.stringify(valid)};
    }
    assert.equal(req.phase,'review');
    assert.deepEqual(JSON.parse(req.prompt).draft,valid);
    return {provider:'openrouter',content:JSON.stringify({
      decision:'approve',factualSupport:'fully_supported',
      evidenceQuotes:[
        'O Enem 2026 apresenta novas regras de atendimento especializado',
        'A solicitação de atendimento especializado precisava ser feita durante a inscrição',
      ],unsupportedClaims:[],issues:[],
    })};
  }};
  const source={url:evidence.sourceUrl,source:'Agência Brasil',title:base.title,
    publishedAt:'2026-11-08T12:00:00Z',language:'pt-br'};
  const result=await reviewAndRepairFullArticleDraft(source,original,evidence,
    {router});
  assert.equal(result.approved,true);
  assert.deepEqual(phases,['review','draft','review']);
  assert.equal(result.draft.body,valid.body);
});

test('router output that ignores validation cannot smuggle new entities',async()=>{
  const original=base;
  const evidence={verified:true,mode:'full_article',
    sourceUrl:'https://agenciabrasil.ebc.com.br/enem-teste',
    licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
    digest:'a'.repeat(64),blocks:[
      {id:'E01',text:'A solicitação do Enem exige avaliação do atendimento especializado pelo Inep.'},
      {id:'E02',text:'O Enem 2026 prevê recursos de acessibilidade para participantes.'},
      {id:'E03',text:'Os pedidos são feitos durante a inscrição.'},
    ]};
  const held={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['claim'],
    issues:['Rever pedido']};
  const poisoned={...base,
    body:base.body+' O ministro Leonardo Barchin anunciou medidas.'};
  let calls=0;
  const result=await reviewAndRepairFullArticleDraft({
    url:evidence.sourceUrl,source:'Agência Brasil',title:base.title,
    publishedAt:'2026-11-08T12:00:00Z',
  },original,evidence,{router:{async complete(){
    calls++;
    return {content:JSON.stringify(calls===1?held:poisoned),
      provider:'groq'};
  }}});
  assert.equal(result.approved,false);
  assert.equal(result.reason,'rewrite_unavailable');
  assert.equal(calls,2);
});

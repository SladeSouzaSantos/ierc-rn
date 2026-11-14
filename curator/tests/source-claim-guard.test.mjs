import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSourceAnchoredDraft} from '../src/source-claim-guard.mjs';
import {
  generateFullArticleDraft,verifyFullArticleReview,reviewAndRepairFullArticleDraft,
  VERIFIED_WRITER_SYSTEM,
} from '../src/full-article-review.mjs';

const source={
  source:'Agência Brasil',
  title:'Enem 2026 prevê atendimento especializado e recursos de acessibilidade',
  url:'https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/enem-acessibilidade',
  publishedAt:'2026-11-08T14:40:00Z',
  language:'pt-br',coverageTrack:'brasil',
};
const evidence={verified:true,mode:'full_article',
  sourceUrl:source.url,digest:'b'.repeat(64),
  licenseReference:'https://agenciabrasil.ebc.com.br/sobre',
  blocks:[
    {id:'E01',text:'O Enem 2026 prevê atendimento especializado solicitado durante a inscrição e autorizado pelo Inep.'},
    {id:'E02',text:'Os recursos de acessibilidade incluem tempo adicional e auxílio para leitura conforme o edital.'},
    {id:'E03',text:'A Agência Brasil informou que os pedidos foram analisados pelo órgão responsável pelo exame.'},
  ],
};
const draft={
  title:'Enem 2026 apresenta regras de atendimento especializado',
  summary:'Segundo a Agência Brasil, o Enem 2026 prevê atendimento especializado mediante solicitação e autorização do Inep.',
  body:'O Enem 2026 prevê recursos para participantes que solicitaram atendimento especializado na inscrição. A Agência Brasil descreve o auxílio para leitura e o tempo adicional entre as medidas.',
  whyItMatters:'A informação esclarece regras de solicitação e recursos disponíveis para participantes do exame.',
  category:'Educação inclusiva',
};
const review={
  decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:[
    'O Enem 2026 prevê atendimento especializado solicitado durante a inscrição',
    'Os recursos de acessibilidade incluem tempo adicional e auxílio para leitura',
  ],unsupportedClaims:[],issues:[],
};

test('generic sourced draft is accepted without manufacturing visual-impairment claims',()=>{
  assert.deepEqual(validateSourceAnchoredDraft(draft,source,evidence),draft);
  assert.match(VERIFIED_WRITER_SYSTEM,/Só relacione um recurso especificamente a pessoas cegas/);
  assert.match(VERIFIED_WRITER_SYSTEM,/não afirme adoção no Brasil/);
});

test('specific blind/low-vision audience association is rejected if absent from source',()=>{
  const bad={...draft,
    whyItMatters:'Para pessoas com deficiência visual, a medida assegura acesso especial ao auxílio para leitura.'};
  assert.throws(()=>validateSourceAnchoredDraft(bad,source,evidence),
    e=>e.editorialField==='whyItMatters'&&
      e.editorialConstraint==='unverified_visual_audience');
  const anchored={...evidence,blocks:[...evidence.blocks,
    {id:'E04',text:'A notícia também descreve recursos específicos para pessoas com deficiência visual.'}]};
  assert.deepEqual(validateSourceAnchoredDraft(bad,source,anchored),bad);
  // A matching audience phrase is NOT a publication approval.
});

test('unsourced statistics and minister names are independently blocked before review',()=>{
  for(const field of ['title','summary','body','whyItMatters']){
    const bad={...draft,[field]:draft[field]+' Foram 138.329 solicitações.'};
    assert.throws(()=>validateSourceAnchoredDraft(bad,source,evidence),
      e=>e.editorialField===field&&e.editorialConstraint==='source_new_number');
  }
  const minister={...draft,
    body:draft.body+' O ministro Leonardo Barchin apresentou a medida.'};
  assert.throws(()=>validateSourceAnchoredDraft(minister,source,evidence),
    e=>e.editorialField==='body'&&e.editorialConstraint==='source_new_name');
});

test('explicit source names and numbers remain eligible for independent review',()=>{
  const expanded={...evidence,blocks:[...evidence.blocks,
    {id:'E04',text:'A Agência Brasil informou que foram confirmados 138.329 pedidos no Enem 2026.'}]};
  const candidate={...draft,
    body:draft.body+' Foram confirmados 138.329 pedidos no Enem 2026.'};
  assert.deepEqual(validateSourceAnchoredDraft(candidate,source,expanded),candidate);
  // A source match is necessary, NEVER sufficient for factual publication.
});

test('writer fallback validates the original model output against source before accepting it',async()=>{
  let calls=0;
  const bad={...draft,
    whyItMatters:'Para pessoas cegas, o recurso de leitura oferece acessibilidade específica na prova.'};
  const router={async complete(request){
    assert.equal(request.phase,'draft');
    assert.throws(()=>request.validateOutput(JSON.stringify(bad)),
      e=>e.editorialConstraint==='unverified_visual_audience');
    calls++;
    return {provider:'gemini',content:JSON.stringify(draft)};
  }};
  const result=await generateFullArticleDraft(source,evidence,{router});
  assert.equal(calls,1);
  assert.equal(result.status,'draft_ready');
  assert.deepEqual(result.draft,draft);
});

test('fake reviewer APPROVE does not override unsourced numeric or audience assertions',()=>{
  const number={...draft,
    body:draft.body+' O órgão contabilizou 138.329 solicitações.'};
  assert.equal(verifyFullArticleReview(source,number,evidence,review).approved,false);
  assert.equal(verifyFullArticleReview(source,number,evidence,review).reason,
    'source_claims_unverified');
  const audience={...draft,
    whyItMatters:'Para pessoas com deficiência visual, o auxílio de leitura é garantido pelas regras do Enem.'};
  const verdict=verifyFullArticleReview(source,audience,evidence,review);
  assert.equal(verdict.approved,false);
  assert.equal(verdict.reason,'source_claims_unverified');
  assert.equal(verifyFullArticleReview(source,draft,evidence,review).approved,true);
});

test('held draft can only be repaired into a generally supported version and re-reviewed',async()=>{
  const held={...draft,
    whyItMatters:'Para pessoas com deficiência visual, as regras asseguram diretamente o acesso ao auxílio para leitura.'};
  const modelHold={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['A relação com deficiência visual não é comprovada'],
    issues:['Remover a associação específica à deficiência visual']};
  let step=0;
  const router={async complete(req){
    step++;
    if(step===1){
      assert.equal(req.phase,'review');
      return {content:JSON.stringify(modelHold),provider:'groq'};
    }
    if(step===2){
      assert.equal(req.phase,'draft');
      const edited={...draft};
      // A future model may return this even after router validation: the
      // orchestration itself must repeat the source check.
      const improperlyAnchored={...edited,
        whyItMatters:'Para pessoas com deficiência visual, o auxílio de leitura está previsto para o exame.'};
      assert.throws(()=>req.validateOutput(JSON.stringify(improperlyAnchored)),
        e=>e.editorialConstraint==='unverified_visual_audience');
      return {content:JSON.stringify(edited),provider:'gemini'};
    }
    assert.equal(step,3);
    assert.equal(req.phase,'review');
    assert.deepEqual(JSON.parse(req.prompt).draft,draft);
    return {content:JSON.stringify(review),provider:'openrouter'};
  }};
  const result=await reviewAndRepairFullArticleDraft(source,held,evidence,{router});
  assert.equal(step,3);
  assert.equal(result.approved,true);
  assert.deepEqual(result.draft,draft);
});

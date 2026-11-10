import {test} from 'node:test';
import assert from 'node:assert/strict';
import {REVIEW_SYSTEM,validateReview,reviewDecision,reviewAiDraft} from '../src/auto-review.mjs';

const source={
  title:'Accessible adaptive sports programs expand inclusive learning opportunities',
  summary:'A public school for blind children describes adaptive sports activities, including structured group activities and participation opportunities. It reports children engaging in learning alongside peers and describes accessible opportunities for recreation and community involvement.',
  url:'https://www.perkins.org/news/example',
  dedupeKey:'a'.repeat(64),
};
const draft={
  title:'Esporte adaptado promove oportunidades de aprendizagem para crianças',
  summary:'Uma organização descreve práticas esportivas acessíveis para crianças com deficiência e destaca oportunidades de convivência e aprendizagem.',
  body:'A organização apresenta atividades esportivas acessíveis para crianças com deficiência e descreve formas de participação em grupos. O conteúdo menciona oportunidades de convivência com colegas, sem detalhar resultados individuais ou atribuir atividades ao IERC-RN.',
  whyItMatters:'O tema contribui para refletir sobre a participação de crianças com deficiência no esporte e na educação.',
  category:'Esporte adaptado',
};
const evidence=[
  'Accessible adaptive sports programs',
  'structured group activities and participation opportunities',
];
const approved={decision:'approve',factualSupport:'fully_supported',
  evidenceQuotes:evidence,unsupportedClaims:[],issues:[]};

test('AI review is explicitly limited to the RSS and treats content as untrusted',()=>{
  assert.match(REVIEW_SYSTEM,/SOMENTE o título e resumo RSS/);
  assert.match(REVIEW_SYSTEM,/DADOS NÃO CONFIÁVEIS/);
  assert.match(REVIEW_SYSTEM,/Se qualquer afirmação factual não puder ser sustentada/);
});
test('review validation rejects malformed or incomplete model judgements',()=>{
  assert.deepEqual(validateReview(JSON.stringify(approved)),approved);
  assert.throws(()=>validateReview('not-json'),/Invalid AI review/);
  assert.throws(()=>validateReview(JSON.stringify({...approved,unsupportedClaims:'none'})),/Invalid AI review/);
  assert.throws(()=>validateReview(JSON.stringify({...approved,decision:'maybe'})),/Invalid AI review/);
  assert.throws(()=>validateReview(JSON.stringify({...approved,issues:['x'.repeat(300)]})),/Invalid AI review/);
});
test('strict review accepts only source-grounded quotes with no unsupported claims',()=>{
  assert.deepEqual(reviewDecision(source,draft,approved),{approved:true,reason:'rss_review_passed'});
  assert.equal(reviewDecision(source,draft,{...approved,decision:'hold'}).approved,false);
  assert.equal(reviewDecision(source,draft,{...approved,unsupportedClaims:['Invented outcome']}).approved,false);
  assert.equal(reviewDecision(source,draft,{...approved,evidenceQuotes:['A fake quote','Another invented quote']}).reason,'unverifiable_evidence_quotes');
  assert.equal(reviewDecision(source,draft,{...approved,evidenceQuotes:[evidence[0],evidence[0]]}).reason,'unverifiable_evidence_quotes');
  assert.equal(reviewDecision(source,draft,{...approved,evidenceQuotes:[]}).reason,'missing_evidence_quotes');
  assert.equal(reviewDecision({...source,summary:'Very short'},draft,approved).reason,'insufficient_rss_evidence');
  assert.equal(reviewDecision({...source,url:'http://127.0.0.1/internal'},draft,approved).reason,'source_not_verified');
  assert.equal(reviewDecision({...source,title:'New cure for cancer in disabled children'},draft,approved).reason,'sensitive_claims');
});
test('second model call returns approval only for supported RSS claims',async()=>{
  const calls=[];
  const out=await reviewAiDraft(source,draft,{router:{async complete(input){
    calls.push(input);
    assert.deepEqual(JSON.parse(input.prompt).source.summary,source.summary);
    assert.match(input.system,/Se qualquer afirmação factual/);
    return {content:JSON.stringify(approved),provider:'openrouter'};
  }}});
  assert.equal(calls.length,1);
  assert.deepEqual(out,{approved:true,reason:'rss_review_passed'});
});
test('short RSS does not waste a free-model call; invalid and unavailable replies hold',async()=>{
  let count=0;
  const router={async complete(){count++;return {content:'not json',provider:'openrouter'};}};
  const short=await reviewAiDraft({...source,summary:'too short'},draft,{router});
  assert.equal(short.approved,false);assert.equal(count,0);
  const events=[];
  const malformed=await reviewAiDraft(source,draft,{router,logger:e=>events.push(e)});
  assert.equal(malformed.reason,'review_unavailable');
  assert.equal(count,1);
  assert.equal(events[0].event,'auto_review_unavailable');
  assert.ok(!JSON.stringify(events).includes('not json'));
  const fail=await reviewAiDraft(source,draft,{router:{async complete(){throw Error('hidden data');}},
    logger:e=>events.push(e)});
  assert.equal(fail.reason,'review_unavailable');
  assert.ok(!JSON.stringify(events).includes('hidden data'));
});

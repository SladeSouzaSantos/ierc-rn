import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  encryptedProdEditorialAudit,prodEditorialAuditFingerprint,
} from '../src/editorial-audit-prod.mjs';

const secret='f'.repeat(64);
const draft={
  title:'Enem 2026 prevê apoio emocional e atendimento especializado',
  summary:'Segundo a Agência Brasil, o Enem 2026 prevê apoio emocional e recursos de acessibilidade para participantes com solicitação aprovada pelo Inep.',
  body:'A Agência Brasil informou que o Enem 2026 prevê acompanhante ou cão de apoio emocional para pessoas em situações descritas pela reportagem. Participantes solicitaram atendimento especializado durante a inscrição e o Inep precisou aprovar os pedidos.',
  whyItMatters:'O auxílio para leitura é um dos recursos de acessibilidade mencionados para participantes do exame.',
  category:'Educação inclusiva',
};
const sha=s=>createHash('sha256').update(s).digest('hex');
const fingerprint=()=>prodEditorialAuditFingerprint({
  documentId:'s5fc7fiy2wtub65mwbndg7j2',dedupeKey:'a'.repeat(64),
  original:draft,revision:sha(JSON.stringify(
    ['title','summary','body','whyItMatters','category'].map(k=>draft[k]))),
  evidence:{verified:true,mode:'full_article',digest:'b'.repeat(64)},
});
function redis(){
  const data=new Map(),writes=[];
  return {data,writes,async get(k){return data.get(k)||null;},
    async set(...args){writes.push(args);data.set(args[0],args[1]);return 'OK';}};
}
const hold={
  phase:'repair',outcome:'in_progress',correctionsDone:0,
  draft,assessment:{decision:'hold',factualSupport:'insufficient',
    unsupportedClaims:['Uma alegação que requer evidência literal.'],
    issues:['A fonte não sustenta uma parte da frase']},
  history:[{afterCorrection:0,
    unsupportedClaims:['Uma alegação que requer evidência literal.'],
    issues:['A fonte não sustenta uma parte da frase']}],
};

test('PROD audit is encrypted, digest-bound and keeps notes private from Redis',async()=>{
  const r=redis();const audit=encryptedProdEditorialAudit({
    redis:r,secret,instanceKind:'prod'});
  await audit.save(fingerprint(),hold);
  assert.equal(r.writes.length,1);
  const [key,value,exp,ttl]=r.writes[0];
  assert.match(key,/^ierc:curator:prod-editorial-audit:v1:[a-f0-9]{64}$/);
  assert.equal(exp,'EX');assert.equal(ttl,45*86400);
  assert.doesNotMatch(JSON.stringify(r.writes),
    /Uma alegação|A fonte não sustenta|Enem 2026|s5fc7fiy2wtub65mwbndg7j2/);
  assert.deepEqual(await audit.load(fingerprint()),hold);
  const changed={...fingerprint(),originalDigest:'c'.repeat(64)};
  await assert.rejects(audit.load(changed),/integrity failed/);
  const attack=JSON.parse(value);
  attack.ciphertext=(attack.ciphertext[0]==='f'?'e':'f')+
    attack.ciphertext.slice(1);
  r.data.set(key,JSON.stringify(attack));
  await assert.rejects(audit.load(fingerprint()),/integrity failed/);
});

test('PROD audit rejects non-PROD use, keys from other services and malformed payloads',async()=>{
  const r=redis();
  for(const options of [
    {redis:r,secret,instanceKind:'dev'},
    {redis:r,secret:'invalid',instanceKind:'prod'},
    {redis:r,secret:'',instanceKind:'prod'},
  ])assert.throws(()=>encryptedProdEditorialAudit(options));
  const a=encryptedProdEditorialAudit({redis:r,secret,instanceKind:'prod'});
  await assert.rejects(a.save(fingerprint(),
    {...hold,phase:'published',outcome:'ai_review_hold'}),/publication/);
  await assert.rejects(a.save(fingerprint(),
    {...hold,assessment:{...hold.assessment,decision:'approve'}}),/assessment/);
  await assert.rejects(a.save(fingerprint(),
    {...hold,history:[{afterCorrection:3,issues:[],unsupportedClaims:[]}]}),
    /history/);
  assert.equal(r.writes.length,0);
});

test('audit retains only bounded feedback and corrected prose through completion',async()=>{
  const r=redis();
  const a=encryptedProdEditorialAudit({redis:r,secret,instanceKind:'prod'});
  const long='x'.repeat(1000);
  await a.save(fingerprint(),{...hold,
    phase:'terminal',outcome:'ai_review_hold',
    history:[{afterCorrection:0,issues:[long],unsupportedClaims:[long]}]});
  const result=await a.load(fingerprint());
  assert.equal(result.history[0].issues[0].length,240);
  assert.equal(result.history[0].unsupportedClaims[0].length,240);
  assert.equal(result.outcome,'ai_review_hold');
  assert.equal(result.phase,'terminal');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encryptedEditorialProgressStore,editorialProgressFingerprint}
  from '../src/editorial-progress.mjs';

const secret='a'.repeat(64);
const documentId='nxh3gri9njyrag8uvbtgux4i';
const dedupeKey='b'.repeat(64);
const original={
  title:'Educação inclusiva amplia acesso a materiais de leitura',
  summary:'Uma matéria original descreve práticas educacionais acessíveis e o uso de materiais de apoio para estudantes com deficiência visual.',
  body:'O texto relata iniciativas escolares de leitura inclusiva. Professores e estudantes trabalham com recursos táteis, materiais adaptados e atividades de aprendizagem.',
  whyItMatters:'Essas experiências permitem discutir recursos acessíveis na educação brasileira.',
  category:'Educação inclusiva',
};
const corrected={...original,
  whyItMatters:'Os fatos relatados oferecem referências de acessibilidade para a educação brasileira.'};
const evidence={verified:true,mode:'full_article',digest:'c'.repeat(64)};
const fingerprint=()=>editorialProgressFingerprint({
  documentId,dedupeKey,original,evidence,
});
function fakeRedis(){
  const entries=new Map(),history=[];
  return {entries,history,
    async set(...args){history.push(args);entries.set(args[0],args[1]);return 'OK';},
    async get(key){return entries.get(key)||null;},
    async del(key){return entries.delete(key)?1:0;},
  };
}
const state={
  phase:'repair',correctionsDone:0,draft:original,
  assessment:{decision:'hold',factualSupport:'insufficient',
    issues:['Fonte não confirma uma implementação brasileira.'],
    unsupportedClaims:['Afirmação de impacto sem respaldo direto']},
  history:[{afterCorrection:0,
    issues:['Fonte não confirma uma implementação brasileira.'],
    unsupportedClaims:['Afirmação de impacto sem respaldo direto']}],
};

test('DEV journal stores AES-GCM ciphertext, never editorial text or objections',async()=>{
  const redis=fakeRedis();
  const store=encryptedEditorialProgressStore({redis,secret,instanceKind:'dev'});
  await store.save(fingerprint(),state);
  const [[key,blob,expiration,ttl]]=redis.history;
  assert.match(key,/^ierc:curator:editorial:v1:[a-f0-9]{64}$/);
  assert.equal(expiration,'EX');
  assert.equal(ttl,14*24*60*60);
  assert.ok(!key.includes(documentId));
  assert.ok(!blob.includes('Educação inclusiva'));
  assert.ok(!blob.includes('Afirmação de impacto'));
  assert.ok(!blob.includes('Fonte não confirma'));
  const recovered=await store.load(fingerprint());
  assert.deepEqual(recovered,state);
  await store.clear(fingerprint());
  assert.equal(await store.load(fingerprint()),null);
});

test('resumable corrected version and reviewer feedback survive worker recreation',async()=>{
  const redis=fakeRedis();
  const first=encryptedEditorialProgressStore({redis,secret,instanceKind:'dev'});
  const progress={phase:'review',correctionsDone:1,draft:corrected,
    assessment:null,history:state.history};
  await first.save(fingerprint(),progress);
  const second=encryptedEditorialProgressStore({redis,secret,instanceKind:'dev'});
  assert.deepEqual(await second.load(fingerprint()),progress);
});

test('a different licensed article digest or changed CMS original invalidates saved progress',async()=>{
  const redis=fakeRedis();
  const store=encryptedEditorialProgressStore({redis,secret,instanceKind:'dev'});
  await store.save(fingerprint(),state);
  await assert.rejects(store.load({...fingerprint(),evidenceDigest:'d'.repeat(64)}),
    /integrity failed/);
  const changed={...original,body:original.body+' Outra informação.'};
  await assert.rejects(store.load(editorialProgressFingerprint({
    documentId,dedupeKey,original:changed,evidence,
  })),/integrity failed/);
  assert.deepEqual(await store.load(fingerprint()),state);
});

test('tampered ciphertext is rejected without returning plaintext',async()=>{
  const redis=fakeRedis(),store=encryptedEditorialProgressStore({
    redis,secret,instanceKind:'dev',
  });
  await store.save(fingerprint(),state);
  const [key,stored]=[...redis.entries][0];
  const box=JSON.parse(stored);
  box.ciphertext=(box.ciphertext[0]==='a'?'b':'a')+
    box.ciphertext.slice(1); // guarantee a real one-nibble change
  redis.entries.set(key,JSON.stringify(box));
  await assert.rejects(store.load(fingerprint()),/integrity failed/);
});

test('PROD, missing encryption secret, invalid notes and unsafe stages fail closed',async()=>{
  const redis=fakeRedis();
  for(const bad of [
    {redis,secret,instanceKind:'prod'},
    {redis,secret:'',instanceKind:'dev'},
    {redis,secret:'not-random',instanceKind:'dev'},
  ])assert.throws(()=>encryptedEditorialProgressStore(bad));
  const store=encryptedEditorialProgressStore({redis,secret,instanceKind:'dev'});
  await assert.rejects(store.save(fingerprint(),{
    ...state,assessment:{...state.assessment,decision:'approve'},
  }),/private editorial objection/);
  await assert.rejects(store.save(fingerprint(),{
    ...state,phase:'repair',correctionsDone:2,
  }),/repair-stage/);
  await assert.rejects(store.save(fingerprint(),{
    ...state,history:[...state.history,{afterCorrection:3,issues:[],unsupportedClaims:[]}],
  }),/history/);
  assert.equal(redis.history.length,0);
});

test('plaintext article blocks, document IDs and API keys are not persisted',async()=>{
  const redis=fakeRedis();
  const store=encryptedEditorialProgressStore({redis,secret,instanceKind:'dev'});
  await store.save(fingerprint(),state);
  const snapshot=JSON.stringify([...redis.entries]);
  assert.ok(!snapshot.includes(documentId));
  assert.ok(!snapshot.includes(original.body));
  assert.ok(!snapshot.includes('Fonte não confirma'));
  assert.ok(!snapshot.includes('Bearer '));
});

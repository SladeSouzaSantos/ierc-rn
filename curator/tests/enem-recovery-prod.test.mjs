import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOURCES} from '../src/feeds.mjs';
import {slugFor} from '../src/editorial.mjs';
import {
  ENEM_PROD_DOCUMENT_ID,ENEM_RECOVERY_EVIDENCE_DIGEST,
  ENEM_RECOVERY_PROPOSAL_DIGEST,enemRecoveryKeys,runEnemAiProd,
} from '../src/enem-ai-prod.mjs';
import {
  checkEnemRecoveryCapacity,recoveryProvidersFromEnv,
} from '../src/recover-enem-ai-prod.mjs';
import {ENEM_SOURCE_URL,ENEM_EDITORIAL_PROPOSAL} from '../src/enem-human-publication.mjs';
import {LlmExhaustedError} from '../src/router.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const source=SOURCES.find(x=>x.id==='agencia-brasil-educacao');
const dedupeKey=sha(ENEM_SOURCE_URL);
const settings={globalMax:30,windowMs:86400000,maxAttempts:4,
  timeoutMs:15000,cooldownMs:60000,maxCooldownMs:86400000};
const providers=[
  {id:'gemini',maxCalls:10},
  {id:'openrouter',maxCalls:10},
];
const keys=enemRecoveryKeys(ENEM_PROD_DOCUMENT_ID,
  ENEM_RECOVERY_PROPOSAL_DIGEST,ENEM_RECOVERY_EVIDENCE_DIGEST);

function seed(){
  const record={
    documentId:ENEM_PROD_DOCUMENT_ID,sourceUrl:ENEM_SOURCE_URL,
    sourceName:source.name,sourceLanguage:source.language,
    originalTitle:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
    originalPublishedAt:'2026-11-08T14:40:00.000Z',
    dedupeKey,
    title:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
    summary:'O Enem 2026 prevê atendimento especializado, apoio emocional e recursos de acessibilidade para participantes que solicitaram o benefício',
    body:'O Enem 2026 apresenta recursos para participantes com condições específicas. Segundo a Agência Brasil, o apoio emocional passa a integrar as medidas de acessibilidade durante a prova.',
    whyItMatters:'A notícia informa condições de acesso e recursos para candidatos que precisam de atendimento especializado.',
    category:'Educação inclusiva',
    editorialStatus:'em_revisao',publishedAt:null,image:null,
    originType:'externa',aiAssisted:true,
  };
  record.slug=slugFor({dedupeKey},record.title);
  return record;
}
const evidence={
  verified:true,mode:'full_article',sourceId:source.id,
  sourceUrl:ENEM_SOURCE_URL,licenseReference:source.fullTextAccess.reference,
  digest:ENEM_RECOVERY_EVIDENCE_DIGEST,blocks:[
    {id:'E01',text:'O atendimento especializado precisava ser solicitado na inscrição e aprovado pelo Inep antes do exame.'},
    {id:'E02',text:'A fibromialgia é mencionada entre condições que podem motivar pedidos de atendimento especializado.'},
    {id:'E03',text:'A reportagem descreve tempo adicional, correção diferenciada e auxílio de leitura como recursos solicitados.'},
  ],
};
const approved={
  decision:'approve',factualSupport:'fully_supported',
  unsupportedClaims:[],issues:[],
  evidenceQuotes:[
    'O atendimento especializado precisava ser solicitado na inscrição',
    'A fibromialgia é mencionada entre condições que podem motivar pedidos',
  ],
};
function fixture(){
  const stored=new Map([
    [keys.previous,'claimed'],[keys.diagnostic,'claimed'],
    ['ierc:curator:llm:global','20'],
    ['ierc:curator:llm:gemini','4'],
    ['ierc:curator:llm:openrouter','6'],
  ]);
  const events=[];
  const redis={
    async get(k){events.push(['get',k]);return stored.get(k)??null;},
    async pttl(k){events.push(['pttl',k]);return -2;},
    async set(k,v,...rest){
      events.push(['set',k,rest]);
      if(rest.includes('NX')&&stored.has(k))return null;
      stored.set(k,v);return 'OK';
    },
    async eval(_script,_count,key,owner){
      events.push(['unlock',key]);
      if(stored.get(key)===owner){stored.delete(key);return 1;}
      return 0;
    },
  };
  let publishes=0;
  const publisher={
    async readPendingDraft(id){
      assert.equal(id,ENEM_PROD_DOCUMENT_ID);
      return seed();
    },
    async publishApprovedDraft(id,expected,audit,options){
      publishes++;
      assert.equal(id,ENEM_PROD_DOCUMENT_ID);
      assert.equal(expected.dedupeKey,dedupeKey);
      assert.equal(audit.evidenceDigest,evidence.digest);
      assert.equal(audit.evidenceQuotes.length,2);
      assert.equal(options.correctedDraft.title,ENEM_EDITORIAL_PROPOSAL.title);
      return {published:true};
    },
  };
  const args={
    mode:'recover',publisher,redis,
    articleReader:async()=>evidence,
    allowedSources:[source.id],
    now:Date.parse('2026-11-14T04:00:00.000Z'),
  };
  return {args,redis,stored,events,get publishes(){return publishes}};
}

test('recovery digest journal is pinned to exact reviewed PROD proposal and source',()=>{
  assert.match(ENEM_RECOVERY_PROPOSAL_DIGEST,/^[a-f0-9]{64}$/);
  assert.match(ENEM_RECOVERY_EVIDENCE_DIGEST,/^[a-f0-9]{64}$/);
  assert.equal(sha(JSON.stringify(['title','summary','body','whyItMatters','category']
    .map(k=>ENEM_EDITORIAL_PROPOSAL[k]))),ENEM_RECOVERY_PROPOSAL_DIGEST);
  assert.throws(()=>enemRecoveryKeys(ENEM_PROD_DOCUMENT_ID,
    'e'.repeat(64),ENEM_RECOVERY_EVIDENCE_DIGEST),/digest mismatch/);
  assert.throws(()=>enemRecoveryKeys(ENEM_PROD_DOCUMENT_ID,
    ENEM_RECOVERY_PROPOSAL_DIGEST,'e'.repeat(64)),/digest mismatch/);
});

test('read-only check permits free Gemini and OpenRouter but cannot reserve quota',async()=>{
  const f=fixture();
  const report=await checkEnemRecoveryCapacity(f.redis,settings,providers,keys);
  assert.equal(report.canRecover,true);
  assert.equal(report.globalRemaining,10);
  assert.deepEqual(report.providerAvailability,[
    {provider:'gemini',remaining:6,cooldownActive:false},
    {provider:'openrouter',remaining:4,cooldownActive:false},
  ]);
  assert.equal(report.cmsWrites,0);
  assert.equal(report.llmCalls,0);
  assert.equal(f.events.some(x=>x[0]==='set'||x[0]==='unlock'),false);
});

test('check refuses absent previous markers, used recovery claim and exhausted quotas',async()=>{
  const f=fixture();
  f.stored.delete(keys.previous);
  assert.equal((await checkEnemRecoveryCapacity(f.redis,settings,providers,keys))
    .canRecover,false);
  f.stored.set(keys.previous,'claimed');
  f.stored.set(keys.recovery,'claimed');
  assert.equal((await checkEnemRecoveryCapacity(f.redis,settings,providers,keys))
    .canRecover,false);
  f.stored.delete(keys.recovery);
  f.stored.set('ierc:curator:llm:global','30');
  assert.equal((await checkEnemRecoveryCapacity(f.redis,settings,providers,keys))
    .canRecover,false);
  f.stored.set('ierc:curator:llm:global','20');
  f.stored.set('ierc:curator:llm:gemini','10');
  f.stored.set('ierc:curator:llm:openrouter','10');
  assert.equal((await checkEnemRecoveryCapacity(f.redis,settings,providers,keys))
    .canRecover,false);
});

test('one controlled recovery publishes ONLY on independent factual approval',async()=>{
  const f=fixture();
  let calls=0;
  f.args.router={
    providers,async complete(request){
      calls++;
      assert.equal(request.phase,'review');
      assert.deepEqual(JSON.parse(request.prompt).draft,ENEM_EDITORIAL_PROPOSAL);
      return {provider:'gemini',content:JSON.stringify(approved)};
    },
  };
  const result=await runEnemAiProd(f.args);
  assert.equal(result.status,'draft_published');
  assert.equal(f.publishes,1);
  assert.equal(calls,1);
  assert.equal(f.stored.get(keys.previous),'claimed');
  assert.equal(f.stored.get(keys.diagnostic),'claimed');
  assert.equal(f.stored.get(keys.recovery),'claimed');
  assert.equal(f.events.filter(x=>x[0]==='set'&&x[1]===keys.recovery).length,1);
  const replay=await runEnemAiProd(f.args);
  assert.deepEqual(replay,{status:'already_attempted',reason:'revision_locked'});
  assert.equal(calls,1);
  assert.equal(f.publishes,1);
});

test('factual HOLD and failed repair never publish or reopen recovery claim',async()=>{
  const f=fixture();
  let calls=0;
  f.args.router={providers,async complete({phase}){
    calls++;
    return {provider:'gemini',content:JSON.stringify(
      phase==='review'?{
        decision:'hold',factualSupport:'insufficient',evidenceQuotes:[],
        unsupportedClaims:['unsupported fact'],issues:['source does not establish the claim'],
      }:{skip:true}
    )};
  }};
  const result=await runEnemAiProd(f.args);
  assert.equal(result.status,'draft_review_pending');
  assert.equal(f.publishes,0);
  assert.equal(f.stored.get(keys.recovery),'claimed');
  assert.equal(f.stored.get(keys.previous),'claimed');
  assert.equal(f.stored.get(keys.diagnostic),'claimed');
  const before=calls;
  const duplicate=await runEnemAiProd(f.args);
  assert.equal(duplicate.status,'already_attempted');
  assert.equal(calls,before);
});

test('provider contract and source digest mismatch fail before recovery claim or CMS write',async()=>{
  const f=fixture();
  f.args.router={providers:[{id:'groq'},{id:'gemini'}],
    async complete(){throw Error('must not call groq');}};
  await assert.rejects(runEnemAiProd(f.args),/provider contract/);
  assert.equal(f.stored.has(keys.recovery),false);
  f.args.router={providers,async complete(){
    throw new LlmExhaustedError('all_free_providers_unavailable',[]);
  }};
  f.args.articleReader=async()=>({...evidence,digest:'c'.repeat(64)});
  await assert.rejects(runEnemAiProd(f.args),/digest mismatch/);
  assert.equal(f.stored.has(keys.recovery),false);
  assert.equal(f.publishes,0);
});

const prodEnv={
  CURATOR_INSTANCE_KIND:'prod',CURATOR_ENABLED:'true',
  CURATOR_WRITE_DRAFTS:'true',CURATOR_PROD_WRITE_ACK:'PROD_WRITES_APPROVED',
  CURATOR_PROD_AUTO_PUBLISH_ACK:'PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED',
  CURATOR_CMS_URL:'http://cms:1337',CURATOR_REDIS_URL:'redis://redis:6379',
  CURATOR_AUTO_PUBLISH_ENABLED:'true',CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
  CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
  CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-educacao',
  CURATOR_ONCE_LIMIT:'1',
  CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',
  CURATOR_GEMINI_API_KEY:'dummy-gemini',CURATOR_GEMINI_MODEL:'gemini-2.5-flash',
  CURATOR_OPENROUTER_API_KEY:'dummy-openrouter',
  CURATOR_OPENROUTER_MODEL:'nvidia/nemotron-3.5-super-vl:free',
};

test('recovery command selects exactly two approved free providers, no Groq or Ollama',()=>{
  const actual=recoveryProvidersFromEnv({
    ...prodEnv,CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',
    CURATOR_GROQ_API_KEY:'dummy-groq',
    CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
  });
  assert.deepEqual(actual.providers.map(x=>x.id),['gemini','openrouter']);
  assert.equal(actual.allowedSources.includes('agencia-brasil-educacao'),true);
  assert.throws(()=>recoveryProvidersFromEnv({
    ...prodEnv,CURATOR_OPENROUTER_API_KEY:'',
  }),/two free-tier providers/);
  assert.throws(()=>recoveryProvidersFromEnv({
    ...prodEnv,CURATOR_INSTANCE_KIND:'dev',
  }),/PROD environment/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SOURCES} from '../src/feeds.mjs';
import {slugFor} from '../src/editorial.mjs';
import {ENEM_SOURCE_URL} from '../src/enem-human-publication.mjs';
import {ENEM_PROD_DOCUMENT_ID,ENEM_RECOVERY_EVIDENCE_DIGEST}
  from '../src/enem-ai-prod.mjs';
import {ENEM_EDITORIAL_PROPOSAL_V2} from '../src/enem-editorial-v2.mjs';
import {enemV2Proposal,enemV2Keys,checkEnemV2Journal,runEnemV2}
  from '../src/enem-editorial-v2-prod.mjs';
import {enemV2ProdPolicy} from '../src/enem-v2-cli-prod.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const dedupeKey=sha(ENEM_SOURCE_URL);
const source=SOURCES.find(x=>x.id==='agencia-brasil-educacao');
const providers=[
  {id:'groq',maxCalls:20},{id:'gemini',maxCalls:20},
  {id:'openrouter',maxCalls:20},
];
const settings={globalMax:60};
const review={
  decision:'approve',factualSupport:'fully_supported',
  unsupportedClaims:[],issues:[],
  evidenceQuotes:[
    'Os pedidos de atendimento especializado foram avaliados e aprovados pelo Inep',
    'O auxílio para leitura aparece entre os recursos disponíveis aos participantes',
  ],
};
const evidence={
  verified:true,mode:'full_article',sourceId:source.id,sourceUrl:ENEM_SOURCE_URL,
  licenseReference:source.fullTextAccess.reference,
  digest:ENEM_RECOVERY_EVIDENCE_DIGEST,
  blocks:[
    {id:'E01',text:'Os pedidos de atendimento especializado foram avaliados e aprovados pelo Inep durante a inscrição para o Enem.'},
    {id:'E02',text:'O auxílio para leitura aparece entre os recursos disponíveis aos participantes que solicitaram atendimento especializado.'},
    {id:'E03',text:'A Agência Brasil citou acompanhante ou cão de apoio emocional entre as novidades do Enem 2026.'},
  ],
};
function seed(){
  const s={
    documentId:ENEM_PROD_DOCUMENT_ID,
    sourceUrl:ENEM_SOURCE_URL,dedupeKey,sourceName:source.name,
    sourceLanguage:source.language,
    originalTitle:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
    originalPublishedAt:'2026-11-08T14:40:00.000Z',
    title:'Enem 2026 estreia apoio emocional e novas regras de acessibilidade',
    summary:'O Enem 2026 prevê atendimento especializado, apoio emocional e recursos de acessibilidade para participantes que solicitaram o benefício',
    body:'O Enem 2026 apresenta recursos para participantes com condições específicas. Segundo a Agência Brasil, o apoio emocional passa a integrar as medidas de acessibilidade durante a prova.',
    whyItMatters:'A notícia informa condições de acesso e recursos para candidatos que precisam de atendimento especializado.',
    category:'Educação inclusiva',originType:'externa',aiAssisted:true,
    editorialStatus:'em_revisao',publishedAt:null,image:null,
  };
  s.slug=slugFor({dedupeKey},s.title);
  return s;
}
function fixture(){
  const {revision}=enemV2Proposal();
  const keys=enemV2Keys(revision);
  const memory=new Map([
    [keys.previous,'claimed'],
    ['ierc:curator:llm:global','20'],
    ['ierc:curator:llm:groq','10'],
    ['ierc:curator:llm:gemini','4'],
    ['ierc:curator:llm:openrouter','6'],
  ]);
  const operations=[];
  const redis={
    async get(k){operations.push(['get',k]);return memory.get(k)??null;},
    async pttl(k){operations.push(['pttl',k]);return -2;},
    async set(k,v,...flags){
      operations.push(['set',k]);
      if(flags.includes('NX')&&memory.has(k))return null;
      memory.set(k,v);return 'OK';
    },
    async eval(_lua,_len,key,owner){
      operations.push(['unlock',key]);
      if(memory.get(key)===owner){memory.delete(key);return 1;}
      return 0;
    },
  };
  let publishes=0;
  const publisher={
    async readPendingDraft(id){assert.equal(id,ENEM_PROD_DOCUMENT_ID);return seed();},
    async publishApprovedDraft(id,expected,audit,options){
      publishes++;
      assert.equal(id,ENEM_PROD_DOCUMENT_ID);
      assert.equal(expected.summary,seed().summary);
      assert.equal(audit.evidenceDigest,evidence.digest);
      assert.equal(options.correctedDraft.title,ENEM_EDITORIAL_PROPOSAL_V2.title);
      return {published:true};
    },
  };
  let lastAudit=null;
  const auditStore={
    async save(fp,record){
      operations.push(['audit_save',record.outcome,record.phase]);
      assert.equal(fp.documentId,ENEM_PROD_DOCUMENT_ID);
      lastAudit=structuredClone(record);
    },
    async load(){return lastAudit;},
  };
  const args={
    publisher,articleReader:async()=>evidence,
    redis,settings,providers,auditStore,
    now:Date.parse('2026-11-14T06:00:00.000Z'),
  };
  return {args,keys,memory,operations,
    get audit(){return lastAudit;},
    get publishes(){return publishes;}};
}
test('v2 is materially narrowed, canonical and short, old claims intact',()=>{
  const {draft,revision}=enemV2Proposal();
  assert.equal(draft.summary.length>=90&&draft.summary.length<=160,true);
  assert.equal(draft.body.includes('138.329'),false);
  assert.equal(draft.body.includes('fibromialgia'),false);
  assert.equal(revision.length,64);
  const keys=enemV2Keys(revision);
  assert.notEqual(keys.attempt,keys.previous);
});
test('v2 check reads prior history and 60/20 quotas without any writes or calls',async()=>{
  const f=fixture();
  const out=await runEnemV2({...f.args,mode:'check'});
  assert.equal(out.status,'enem_v2_editorial_check');
  assert.equal(out.canPublish,true);
  assert.equal(out.globalLimit,60);
  assert.equal(out.globalRemaining,40);
  assert.deepEqual(out.providerAvailability.map(x=>x.remaining),[10,16,14]);
  assert.equal(f.operations.some(x=>x[0]==='set'||x[0]==='audit_save'),false);
  assert.equal(f.publishes,0);
});
test('one fresh approval publishes same CMS doc and writes encrypted audit stages',async()=>{
  const f=fixture();let calls=0;
  const router={providers,async complete(req){
    calls++;
    assert.equal(req.phase,'review');
    assert.deepEqual(JSON.parse(req.prompt).draft,ENEM_EDITORIAL_PROPOSAL_V2);
    return {provider:'groq',content:JSON.stringify(review)};
  }};
  const out=await runEnemV2({...f.args,mode:'publish',router});
  assert.equal(out.status,'draft_published');
  assert.equal(out.auditEncrypted,true);
  assert.equal(calls,1);
  assert.equal(f.publishes,1);
  assert.equal(f.memory.get(f.keys.previous),'claimed');
  assert.equal(f.memory.get(f.keys.attempt),'claimed');
  assert.equal(f.audit.phase,'published');
  assert.equal(f.audit.outcome,'published');
  const inspect=await runEnemV2({...f.args,mode:'inspect'});
  assert.deepEqual(inspect,f.audit);
  const repeated=await runEnemV2({...f.args,mode:'publish',router});
  await assert.fail('second publication must deny'); // unreachable
});
test('v2 without previous journal or with exhausted provider capacity fails closed',async()=>{
  const f=fixture();f.memory.delete(f.keys.previous);
  const report=await checkEnemV2Journal(f.args.redis,settings,providers,
    enemV2Proposal().revision);
  assert.equal(report.canPublish,false);
  f.memory.set(f.keys.previous,'claimed');
  f.memory.set('ierc:curator:llm:global','60');
  const report2=await checkEnemV2Journal(f.args.redis,settings,providers,
    enemV2Proposal().revision);
  assert.equal(report2.canPublish,false);
  assert.equal(f.operations.some(x=>x[0]==='audit_save'),false);
});
test('factual HOLD with failed repair retains objections for private inspection, no PUT',async()=>{
  const f=fixture();let calls=0;
  const privateIssue='A afirmação sobre benefício clínico não é sustentada pelos blocos.';
  const hold={decision:'hold',factualSupport:'insufficient',
    evidenceQuotes:[],unsupportedClaims:['Apoio emocional garante resultado.'],
    issues:[privateIssue]};
  const router={providers,async complete(request){
    calls++;
    if(request.phase==='review')return {provider:'groq',
      content:JSON.stringify(hold)};
    const payload=JSON.parse(request.prompt);
    assert.ok(Array.isArray(payload.objectionHints));
    assert.equal(payload.reviewerAssessment.issues[0],privateIssue);
    throw Error('Provider free-tier output rejected');
  }};
  const events=[];
  const out=await runEnemV2({...f.args,mode:'publish',router,
    logger:x=>events.push(x)});
  assert.equal(out.status,'draft_review_pending');
  assert.equal(out.reason,'rewrite_unavailable');
  assert.equal(f.publishes,0);
  assert.equal(f.audit.phase,'terminal');
  assert.equal(f.audit.outcome,'rewrite_unavailable');
  assert.equal(f.audit.history[0].issues[0],privateIssue);
  assert.ok(calls>=2);
  assert.doesNotMatch(JSON.stringify(events),/benefício clínico/);
});
test('PROD policy requires dedicated audit key, explicit inspection ACK and three free LLMs',()=>{
  const env={
    CURATOR_INSTANCE_KIND:'prod',CURATOR_ENABLED:'true',
    CURATOR_WRITE_DRAFTS:'true',CURATOR_PROD_WRITE_ACK:'PROD_WRITES_APPROVED',
    CURATOR_PROD_AUTO_PUBLISH_ACK:'PROD_AUTOPUBLISH_LICENSED_SOURCES_ACCEPTED',
    CURATOR_CMS_URL:'http://cms:1337',CURATOR_REDIS_URL:'redis://redis:6379',
    CURATOR_ONCE_LIMIT:'1',CURATOR_AUTO_PUBLISH_ENABLED:'true',
    CURATOR_FULL_ARTICLE_REVIEW_ENABLED:'true',
    CURATOR_AUTO_PUBLISH_ACK:'FULL_ARTICLE_REVIEW_ACCEPTED',
    CURATOR_AUTO_PUBLISH_ALLOWED_SOURCES:'agencia-brasil-educacao',
    CURATOR_PROD_EDITORIAL_AUDIT_KEY:'f'.repeat(64),
    CURATOR_GROQ_API_KEY:'dummy',CURATOR_GROQ_MODEL:'openai/gpt-oss-120b',
    CURATOR_GROQ_FREE_TIER_CONFIRMED:'true',CURATOR_GROQ_MAX_CALLS:'20',
    CURATOR_GEMINI_API_KEY:'dummy',CURATOR_GEMINI_MODEL:'gemini-2.5-flash',
    CURATOR_GEMINI_FREE_TIER_CONFIRMED:'true',CURATOR_GEMINI_MAX_CALLS:'20',
    CURATOR_OPENROUTER_API_KEY:'dummy',
    CURATOR_OPENROUTER_MODEL:'nvidia/nemotron-3.5-super-vl:free',
    CURATOR_OPENROUTER_MAX_CALLS:'20',
  };
  assert.deepEqual(enemV2ProdPolicy(env,'check').map(x=>x.id),
    ['groq','gemini','openrouter']);
  assert.throws(()=>enemV2ProdPolicy({...env,
    CURATOR_PROD_EDITORIAL_AUDIT_KEY:''},'publish'),/audit key/);
  assert.throws(()=>enemV2ProdPolicy(env,'inspect'),/explicit ACK/);
  assert.doesNotThrow(()=>enemV2ProdPolicy({...env,
    CURATOR_PROD_AUDIT_INSPECT_ACK:'PRINT_PRIVATE_EDITORIAL_NOTES'},'inspect'));
  assert.throws(()=>enemV2ProdPolicy({...env,
    CURATOR_GROQ_API_KEY:''},'publish'),/three confirmed free/);
});

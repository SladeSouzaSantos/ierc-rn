import {createHash,randomBytes} from 'node:crypto';
import {SOURCES} from './feeds.mjs';
import {validatePublicationReadyDraft,slugFor} from './editorial.mjs';
import {reviewedDraftDigest} from './cms-publish.mjs';
import {reviewAndRepairFullArticleDraft} from './full-article-review.mjs';
import {runEnemAiProd,enemRecoveryKeys,
  ENEM_PROD_DOCUMENT_ID,ENEM_RECOVERY_EVIDENCE_DIGEST,
  ENEM_RECOVERY_PROPOSAL_DIGEST} from './enem-ai-prod.mjs';
import {ENEM_SOURCE_URL} from './enem-human-publication.mjs';
import {ENEM_EDITORIAL_PROPOSAL_V2} from './enem-editorial-v2.mjs';
import {prodEditorialAuditFingerprint} from './editorial-audit-prod.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const FIELDS=['title','summary','body','whyItMatters','category'];
const source=SOURCES.find(s=>s.id==='agencia-brasil-educacao');

export function enemV2Proposal(){
  const draft=validatePublicationReadyDraft(JSON.stringify(ENEM_EDITORIAL_PROPOSAL_V2));
  if(!draft||FIELDS.some(k=>draft[k]!==ENEM_EDITORIAL_PROPOSAL_V2[k])||
     draft.summary.length<90||draft.summary.length>160)
    throw new Error('ENEM v2 editorial proposal is not a new complete short synthesis');
  const revision=sha(JSON.stringify(FIELDS.map(k=>draft[k])));
  if(revision===ENEM_RECOVERY_PROPOSAL_DIGEST)
    throw new Error('ENEM v2 must differ substantially from the previous proposal');
  return {draft,revision};
}

export function enemV2Keys(revision){
  if(!/^[a-f0-9]{64}$/.test(revision||'')||
     revision===ENEM_RECOVERY_PROPOSAL_DIGEST)
    throw new Error('Invalid ENEM v2 revision');
  return {
    attempt:'ierc:curator:enem-prod-ai:editorial-v2:'+
      sha(ENEM_PROD_DOCUMENT_ID+':'+revision+':'+ENEM_RECOVERY_EVIDENCE_DIGEST),
    previous:enemRecoveryKeys(ENEM_PROD_DOCUMENT_ID,
      ENEM_RECOVERY_PROPOSAL_DIGEST,ENEM_RECOVERY_EVIDENCE_DIGEST).recovery,
  };
}

export function auditFingerprintForV2(){
  const {draft,revision}=enemV2Proposal();
  return prodEditorialAuditFingerprint({
    documentId:ENEM_PROD_DOCUMENT_ID,dedupeKey:sha(ENEM_SOURCE_URL),
    original:draft,evidence:{verified:true,mode:'full_article',
      digest:ENEM_RECOVERY_EVIDENCE_DIGEST},revision,
  });
}

export async function checkEnemV2Journal(redis,settings,providers,revision){
  if(!Array.isArray(providers)||providers.length!==3||
     providers.map(x=>x.id).join(',')!=='groq,gemini,openrouter'||
     !['get','pttl'].every(k=>typeof redis?.[k]==='function'))
    throw new Error('ENEM v2 requires three approved free reviewers');
  const keys=enemV2Keys(revision);
  const [prior,current,globalRaw]=await Promise.all([
    redis.get(keys.previous),redis.get(keys.attempt),
    redis.get('ierc:curator:llm:global'),
  ]);
  const globalUsed=Number(globalRaw??0);
  if(!Number.isSafeInteger(globalUsed)||globalUsed<0)
    throw new Error('Corrupt ENEM v2 quota');
  const availability=[];
  for(const provider of providers){
    const key='ierc:curator:llm:'+provider.id;
    const [usedRaw,shared,review]=await Promise.all([
      redis.get(key),redis.pttl(key+':cooldown'),
      redis.pttl(key+'_review:cooldown'),
    ]);
    const used=Number(usedRaw??0);
    if(!Number.isSafeInteger(used)||used<0||
       ![shared,review].every(ttl=>Number.isSafeInteger(ttl)&&
         (ttl===-2||ttl>=0)))
      throw new Error('Corrupt ENEM v2 quota');
    availability.push({
      provider:provider.id,limit:provider.maxCalls,used,
      remaining:Math.max(0,provider.maxCalls-used),
      cooldownActive:shared>0||review>0,
    });
  }
  const globalRemaining=Math.max(0,settings.globalMax-globalUsed);
  return {
    status:'enem_v2_editorial_check',
    previousRecoveryRecorded:prior==='claimed',
    newVersionUnused:current===null,
    globalLimit:settings.globalMax,
    globalRemaining,providerAvailability:availability,
    canPublish:prior==='claimed'&&current===null&&globalRemaining>0&&
      availability.some(p=>p.remaining>0&&!p.cooldownActive),
    cmsWrites:0,llmCalls:0,
  };
}

// runEnemV2 is injection-friendly and testable without any production I/O.
export async function runEnemV2({mode,publisher,articleReader,redis,
  providers,settings,router=null,auditStore=null,
  logger=()=>{},now=Date.now()}={}){
  if(!['check','publish','inspect'].includes(mode)||
     !redis||!auditStore||
     (mode!=='inspect'&&(!publisher||typeof articleReader!=='function')))
    throw new Error('ENEM v2 PROD prerequisites missing');
  const {draft,revision}=enemV2Proposal();
  const fp=auditFingerprintForV2();
  if(mode==='inspect'){
    return await auditStore.load(fp);
  }
  const original=await runEnemAiProd({
    mode:'preview',publisher,articleReader,
    allowedSources:['agencia-brasil-educacao'],now,
  });
  if(original.evidenceDigest!==ENEM_RECOVERY_EVIDENCE_DIGEST||
     original.proposalDigest!==ENEM_RECOVERY_PROPOSAL_DIGEST)
    throw new Error('ENEM v2 licensed evidence or original proposal changed');

  const check=await checkEnemV2Journal(redis,settings,providers,revision);
  if(mode==='check')return {...check,newProposalDigest:revision,
    sourceDigest:original.evidenceDigest,auditKeyConfigured:true};
  if(!check.canPublish||!router||typeof router.complete!=='function'||
     typeof publisher.publishApprovedDraft!=='function')
    throw new Error('ENEM v2 new editorial publication is not authorized');
  if(router.providers?.map(x=>x.id).join(',')!=='groq,gemini,openrouter')
    throw new Error('ENEM v2 reviewer contract mismatch');

  const pending=await publisher.readPendingDraft(ENEM_PROD_DOCUMENT_ID);
  const evidence=await articleReader(source,{
    url:ENEM_SOURCE_URL,title:pending.originalTitle,
    publishedAt:pending.originalPublishedAt,dedupeKey:pending.dedupeKey,
  });
  if(evidence?.verified!==true||evidence?.mode!=='full_article'||
     evidence?.sourceId!==source.id||
     evidence?.sourceUrl!==ENEM_SOURCE_URL||
     evidence?.licenseReference!==source.fullTextAccess.reference||
     evidence?.digest!==ENEM_RECOVERY_EVIDENCE_DIGEST||
     !Array.isArray(evidence.blocks)||evidence.blocks.length<3)
    throw new Error('ENEM v2 source evidence changed');

  const key='ierc:curator:lock:'+pending.dedupeKey;
  const owner=randomBytes(16).toString('hex');
  if(await redis.set(key,owner,'PX',180000,'NX')!=='OK')
    return {status:'locked'};
  try{
    const keys=enemV2Keys(revision);
    // Revalidate the prior history under the lock; never delete/reuse it.
    if(await redis.get(keys.previous)!=='claimed')
      throw new Error('ENEM v2 prior editorial history missing');
    const claim=await redis.set(keys.attempt,'claimed','EX',45*86400,'NX');
    if(claim===null)return {status:'already_attempted'};
    if(claim!=='OK')throw new Error('ENEM v2 immutable claim invalid');

    let last={phase:'review',correctionsDone:0,draft,
      assessment:null,history:[]};
    const persist=async(outcome='in_progress',phase=last.phase)=>{
      await auditStore.save(fp,{...last,phase,outcome});
    };
    // Fail closed on audit encryption/storage error BEFORE the first AI call.
    await persist();
    logger({event:'enem_v2_editorial_started',
      documentIdHash:'400257654ced',
      providers:['groq','gemini','openrouter']});
    const candidate={title:pending.originalTitle,source:source.name,
      url:ENEM_SOURCE_URL,publishedAt:pending.originalPublishedAt,
      language:source.language,coverageTrack:'brasil',
      dedupeKey:pending.dedupeKey};
    const verdict=await reviewAndRepairFullArticleDraft(candidate,draft,evidence,{
      router,logger,maxCorrections:2,
      onProgress:async p=>{
        last=p;
        await persist();
      },
    });
    if(!verdict.approved){
      // Persist objections/corrected draft from last known stage even when
      // a provider returns invalid output. Never reopen the claimed journal.
      const permitted=new Set(['ai_review_hold','rewrite_unavailable',
        'review_unavailable','unchanged_draft','insufficient_evidence']);
      await persist(permitted.has(verdict.reason)?
        verdict.reason:'ai_review_hold','terminal');
      logger({event:'enem_v2_editorial_held',
        documentIdHash:'400257654ced',reason:verdict.reason});
      return {status:'draft_review_pending',reason:verdict.reason,
        auditEncrypted:true};
    }
    await persist('approved','review');
    const final=validatePublicationReadyDraft(JSON.stringify(verdict.draft));
    if(!final||FIELDS.some(k=>final[k]!==verdict.draft[k]))
      throw new Error('ENEM v2 reviewer draft invalid');
    const expected={
      sourceUrl:pending.sourceUrl,dedupeKey:pending.dedupeKey,
      slug:pending.slug,title:pending.title,summary:pending.summary,
      body:pending.body,
    };
    await publisher.publishApprovedDraft(ENEM_PROD_DOCUMENT_ID,expected,{
      evidenceQuotes:verdict.evidenceQuotes,
      reviewerProvider:verdict.reviewerProvider,
      evidenceMode:verdict.evidenceMode,
      evidenceDigest:verdict.evidenceDigest,
      licenseReference:verdict.licenseReference,
      editorialDigest:reviewedDraftDigest(final),
    },{correctedDraft:final});
    last={...last,draft:final};
    await persist('published','published');
    await redis.set('ierc:curator:seen:'+pending.dedupeKey,'1','EX',31536000);
    logger({event:'enem_v2_editorial_published',
      documentIdHash:'400257654ced',
      reviewerProvider:verdict.reviewerProvider});
    return {status:'draft_published',reusedDraft:true,
      documentIdHash:'400257654ced',auditEncrypted:true,
      slug:slugFor({dedupeKey:pending.dedupeKey},final.title)};
  }finally{
    await redis.eval(
      'if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end',
      1,key,owner,
    );
  }
}

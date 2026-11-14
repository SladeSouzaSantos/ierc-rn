import {createHash,randomBytes} from 'node:crypto';
import {SOURCES} from './feeds.mjs';
import {validateDraft,validatePublicationReadyDraft,slugFor} from './editorial.mjs';
import {reviewedDraftDigest} from './cms-publish.mjs';
import {reviewAndRepairFullArticleDraft,reviewFullArticleDraft} from './full-article-review.mjs';
import {ENEM_SOURCE_URL,ENEM_EDITORIAL_PROPOSAL} from './enem-human-publication.mjs';

// One audited, one-shot PROD publication candidate based on the factual
// proposal already reviewed and published in DEV. This is NOT a way to retry
// a rejected AI lineage or ignore an independent reviewer HOLD.
export const ENEM_PROD_DOCUMENT_ID='s5fc7fiy2wtub65mwbndg7j2';
// Anchored to the verified 2026-11-14 PROD preview, so a silently changed
// article or proposal cannot authorize a fresh publishing lineage.
export const ENEM_RECOVERY_PROPOSAL_DIGEST='06f7ad3af3577b66e1ca409149e8c0948fd90c3f5df371e35205e493d0c3cfd8';
export const ENEM_RECOVERY_EVIDENCE_DIGEST='ee52788257081d2a327b7362c585336c2f96cb93042565be37f084c0d7213cf6';
const ENEM_JOURNAL_PREFIX='ierc:curator:enem-prod-ai:';
export function enemRecoveryKeys(documentId,proposalDigest,evidenceDigest){
  if(documentId!==ENEM_PROD_DOCUMENT_ID||
     proposalDigest!==ENEM_RECOVERY_PROPOSAL_DIGEST||
     evidenceDigest!==ENEM_RECOVERY_EVIDENCE_DIGEST)
    throw new Error('ENEM PROD technical recovery source/proposal digest mismatch');
  const idRevision=createHash('sha256').update(documentId+':'+proposalDigest).digest('hex');
  const evidenceRevision=createHash('sha256')
    .update(documentId+':'+proposalDigest+':'+evidenceDigest).digest('hex');
  return Object.freeze({
    previous:ENEM_JOURNAL_PREFIX+'v1:'+idRevision,
    diagnostic:'ierc:curator:enem-prod-review-probe:v1:'+evidenceRevision,
    recovery:ENEM_JOURNAL_PREFIX+'technical-recovery-v1:'+evidenceRevision,
  });
}
const ORIGINAL_TITLE='Enem 2026 estreia apoio emocional e novas regras de acessibilidade';
const SOURCE_ID='agencia-brasil-educacao';
const FIELDS=['title','summary','body','whyItMatters','category'];
const sha=s=>createHash('sha256').update(s).digest('hex');

function proposal(){
  const valid=validatePublicationReadyDraft(JSON.stringify(ENEM_EDITORIAL_PROPOSAL));
  if(!valid||FIELDS.some(field=>valid[field]!==ENEM_EDITORIAL_PROPOSAL[field]))
    throw new Error('Static ENEM editorial proposal is not canonical and publication-ready');
  return valid;
}

function verifyPending(pending,now,allowedSources){
  if(!Array.isArray(allowedSources)||!allowedSources.includes(SOURCE_ID))
    throw new Error('ENEM source is not allowlisted for PROD autonomous publishing');
  const source=SOURCES.find(x=>x.id===SOURCE_ID);
  if(!source||source.fullTextAccess?.status!=='approved'||
     source.fullTextAccess.reference!=='https://agenciabrasil.ebc.com.br/sobre')
    throw new Error('PROD ENEM source policy mismatch');
  if(pending?.documentId!==ENEM_PROD_DOCUMENT_ID||
     pending?.sourceUrl!==ENEM_SOURCE_URL||
     pending?.sourceName!==source.name||
     pending?.originalTitle!==ORIGINAL_TITLE||
     pending?.sourceLanguage!==source.language||
     pending?.dedupeKey!==sha(ENEM_SOURCE_URL))
    throw new Error('PROD ENEM source or document identity mismatch');
  if(pending?.originType!=='externa'||pending?.aiAssisted!==true||
     pending?.editorialStatus!=='em_revisao'||pending?.publishedAt!==null||
     pending?.image!=null)
    throw new Error('PROD ENEM pending Draft status mismatch');
  if(pending?.slug!==slugFor({dedupeKey:pending.dedupeKey},pending.title))
    throw new Error('PROD ENEM source-derived slug mismatch');
  const when=Date.parse(pending.originalPublishedAt||'');
  if(!pending.originalPublishedAt?.startsWith('2026-11-08')||
     !Number.isFinite(when)||when>now+86400000||now-when>45*86400000)
    throw new Error('PROD ENEM article is outside verified 45-day evidence window');
  const original=validateDraft(JSON.stringify({
    title:pending.title,summary:pending.summary,body:pending.body,
    whyItMatters:pending.whyItMatters,category:pending.category,
  }));
  // Historical Strapi Drafts may retain boundary whitespace in summary.
  // Match the existing retry-pending integrity gate: no truncation,
  // rewording, case-folding or internal-whitespace normalization permitted.
  // The publisher separately checks the original raw summary byte-for-byte
  // before its authorized atomic PUT status=published.
  const summaryUnchanged=typeof pending.summary==='string'&&
    pending.summary.trim().length<=270&&
    original?.summary===pending.summary.trim();
  if(!original||!summaryUnchanged||
     FIELDS.filter(field=>field!=='summary')
       .some(field=>original[field]!==pending[field]))
    throw new Error('PROD ENEM draft failed exact content-integrity verification');
  return {source,original};
}

function verifyEvidence(evidence,source){
  if(evidence?.verified!==true||evidence.mode!=='full_article'||
     evidence.sourceId!==SOURCE_ID||evidence.sourceUrl!==ENEM_SOURCE_URL||
     evidence.licenseReference!==source.fullTextAccess.reference||
     !/^[a-f0-9]{64}$/.test(evidence.digest||'')||
     !Array.isArray(evidence.blocks)||evidence.blocks.length<3)
    throw new Error('PROD ENEM licensed full-article evidence unavailable');
}

// Tests inject no-network publisher/router/Redis. The actual command is
// restricted separately by PROD env acknowledgments before any I/O.
export async function runEnemAiProd({
  mode,publisher,router=null,redis=null,articleReader,allowedSources=[],
  logger=()=>{},now=Date.now(),
}={}){
  if(!['preview','probe','publish','recover'].includes(mode)||
     !publisher||typeof publisher.readPendingDraft!=='function'||
     typeof articleReader!=='function'||
     (['probe','publish','recover'].includes(mode)&&(
       !router||typeof router.complete!=='function'||
       (['publish','recover'].includes(mode)&&!publisher.publishApprovedDraft)||
       !redis||typeof redis.set!=='function'||typeof redis.eval!=='function'||
       (mode==='recover'&&typeof redis.get!=='function'))))
    throw new Error('ENEM PROD single-document review prerequisites missing');

  // Defense in depth: the technical recovery MUST exclude exhausted Groq,
  // paid routes, local Ollama, or a caller-supplied single arbitrary model.
  if(mode==='recover'&&(
    !Array.isArray(router.providers)||router.providers.length!==2||
    router.providers[0]?.id!=='gemini'||
    router.providers[1]?.id!=='openrouter'))
    throw new Error('ENEM PROD technical recovery provider contract violated');

  const pending=await publisher.readPendingDraft(ENEM_PROD_DOCUMENT_ID);
  const {source}=verifyPending(pending,now,allowedSources);
  const reviewedSeed=proposal();
  const candidate={
    title:pending.originalTitle,source:source.name,url:ENEM_SOURCE_URL,
    publishedAt:pending.originalPublishedAt,language:source.language,
    coverageTrack:'brasil',dedupeKey:pending.dedupeKey,
  };
  const evidence=await articleReader(source,{
    url:ENEM_SOURCE_URL,title:pending.originalTitle,
    publishedAt:pending.originalPublishedAt,dedupeKey:pending.dedupeKey,
  });
  verifyEvidence(evidence,source);

  const revision=sha(JSON.stringify(FIELDS.map(field=>reviewedSeed[field])));
  const docHash=sha(ENEM_PROD_DOCUMENT_ID).slice(0,12);
  if(mode==='preview'){
    return {status:'enem_ai_prod_preview',documentIdHash:docHash,
      originalDraftPublished:false,proposalDigest:revision,
      evidenceDigest:evidence.digest,
      aiUsed:false,cmsWrites:0,willPublishOnlyAfterIndependentApproval:true};
  }

  // A one-time, NON-PUBLISHING diagnostic uses the exact article and
  // proposal review path. It never calls the repair orchestrator, never
  // writes to CMS, and never reads/mutates the publication attempt journal.
  // The separate fingerprint prevents repeatedly shopping reviewer verdicts.
  if(mode==='probe'){
    const lock='ierc:curator:lock:'+pending.dedupeKey;
    const owner=randomBytes(16).toString('hex');
    if(await redis.set(lock,owner,'PX',180000,'NX')!=='OK')
      return {status:'locked'};
    try{
      const probeKey='ierc:curator:enem-prod-review-probe:v1:'+
        sha(ENEM_PROD_DOCUMENT_ID+':'+revision+':'+evidence.digest);
      const claimed=await redis.set(probeKey,'claimed','EX',45*86400,'NX');
      if(claimed===null)return {status:'probe_already_attempted'};
      if(claimed!=='OK')throw new Error('Invalid immutable ENEM AI probe claim');
      logger({event:'enem_prod_review_probe_started',documentIdHash:docHash,
        sourceBlocks:evidence.blocks.length});
      const verdict=await reviewFullArticleDraft(candidate,reviewedSeed,evidence,{
        router,logger,
      });
      const safeReasons=new Set([
        'full_article_review_passed','ai_review_hold','review_unavailable',
        'unverifiable_full_article_quotes','sensitive_claims',
      ]);
      const reason=safeReasons.has(verdict.reason)?
        verdict.reason:'review_held';
      return {status:'enem_prod_review_probe',documentIdHash:docHash,
        approved:verdict.approved===true,reason,
        cmsWrites:0,publicationAttempts:0,repairs:0};
    }finally{
      await redis.eval(
        'if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end',
        1,lock,owner);
    }
  }

  // Reuse the existing document lock; never race a scheduled/explicit retry.
  const lock='ierc:curator:lock:'+pending.dedupeKey;
  const owner=randomBytes(16).toString('hex');
  if(await redis.set(lock,owner,'PX',180000,'NX')!=='OK')
    return {status:'locked'};
  try{
    // A durable, revision-scoped one-shot marker prevents repeatedly
    // shopping model verdicts for approval after two factual reviewer HOLDs.
    // A new attempt requires a separately reviewed code/proposal revision.
    // Keep BOTH prior immutable claims unchanged. The factual review in
    // this controlled recovery did not run earlier: Groq was out of quota.
    // A new, separately named one-shot claim is permitted ONLY for the
    // exact proposal and evidence digests already confirmed on PROD.
    let attemptKey;
    if(mode==='recover'){
      const keys=enemRecoveryKeys(ENEM_PROD_DOCUMENT_ID,revision,evidence.digest);
      const [initial,diagnostic]=await Promise.all([
        redis.get(keys.previous),redis.get(keys.diagnostic),
      ]);
      if(initial!=='claimed'||diagnostic!=='claimed')
        throw new Error('ENEM PROD technical recovery requires both previous attempts');
      attemptKey=keys.recovery;
    }else{
      attemptKey=ENEM_JOURNAL_PREFIX+'v1:'+
        sha(ENEM_PROD_DOCUMENT_ID+':'+revision);
    }
    const claim=await redis.set(attemptKey,'claimed','EX',45*86400,'NX');
    if(claim===null)return {status:'already_attempted',reason:'revision_locked'};
    if(claim!=='OK')throw new Error('Invalid immutable ENEM AI attempt claim');
    if(mode==='recover')
      logger({event:'enem_prod_technical_recovery_started',
        documentIdHash:docHash,providers:['gemini','openrouter'],
        originalAndDiagnosticClaimsPreserved:true});

    const verdict=await reviewAndRepairFullArticleDraft(candidate,reviewedSeed,evidence,{
      router,logger,maxCorrections:2,
    });
    if(!verdict.approved){
      logger({event:'enem_prod_ai_held',documentIdHash:docHash,
        reason:verdict.reason});
      return {status:'draft_review_pending',reason:verdict.reason};
    }
    const finalDraft=validatePublicationReadyDraft(JSON.stringify(verdict.draft));
    if(!finalDraft||FIELDS.some(field=>finalDraft[field]!==verdict.draft[field]))
      throw new Error('AI-approved ENEM candidate failed final canonical validation');
    const expected={
      sourceUrl:pending.sourceUrl,dedupeKey:pending.dedupeKey,
      slug:pending.slug,title:pending.title,
      summary:pending.summary,body:pending.body,
    };
    // The original PROD Draft is never saved with an intermediate repair.
    // The publisher atomically updates the SAME document and publishes,
    // with independent verified evidence and a digest of the exact text.
    await publisher.publishApprovedDraft(ENEM_PROD_DOCUMENT_ID,expected,{
      evidenceQuotes:verdict.evidenceQuotes,
      reviewerProvider:verdict.reviewerProvider,
      evidenceMode:verdict.evidenceMode,
      evidenceDigest:verdict.evidenceDigest,
      licenseReference:verdict.licenseReference,
      editorialDigest:reviewedDraftDigest(finalDraft),
    },{correctedDraft:finalDraft});
    await redis.set('ierc:curator:seen:'+pending.dedupeKey,'1','EX',31536000);
    logger({event:'enem_prod_ai_published',documentIdHash:docHash,
      correctedByAi:verdict.revised,reviewerProvider:verdict.reviewerProvider});
    return {status:'draft_published',reusedDraft:true,
      correctedByAi:verdict.revised,documentIdHash:docHash,
      slug:slugFor({dedupeKey:pending.dedupeKey},finalDraft.title)};
  }finally{
    await redis.eval(
      'if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end',
      1,lock,owner);
  }
}

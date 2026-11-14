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
  if(!['preview','probe','publish'].includes(mode)||
     !publisher||typeof publisher.readPendingDraft!=='function'||
     typeof articleReader!=='function'||
     (['probe','publish'].includes(mode)&&(
       !router||typeof router.complete!=='function'||
       (mode==='publish'&&!publisher.publishApprovedDraft)||
       !redis||typeof redis.set!=='function'||typeof redis.eval!=='function')))
    throw new Error('ENEM PROD single-document review prerequisites missing');

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
    const attemptKey='ierc:curator:enem-prod-ai:v1:'+
      sha(ENEM_PROD_DOCUMENT_ID+':'+revision);
    const claim=await redis.set(attemptKey,'claimed','EX',45*86400,'NX');
    if(claim===null)return {status:'already_attempted',reason:'revision_locked'};
    if(claim!=='OK')throw new Error('Invalid immutable ENEM AI attempt claim');

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

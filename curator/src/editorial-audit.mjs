import {createHash} from 'node:crypto';
import {SOURCES} from './feeds.mjs';
import {slugFor,validateDraft} from './editorial.mjs';
import {editorialProgressFingerprint} from './editorial-progress.mjs';

// Diagnostic only. Exact lexical matches are NOT evidence of factual support:
// negation, temporal qualifiers and attribution still require human review.
const normalize=value=>String(value||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const terms=value=>new Set(normalize(value).split(' ').filter(w=>w.length>=5));

export function summarizeObjection(note,blocks){
  if(typeof note!=='string'||note.length>240||!Array.isArray(blocks))
    throw new Error('Invalid private editorial objection');
  const needle=note.trim();
  const words=terms(note);
  const options=blocks.map(b=>{
    if(!/^E\d{2}$/.test(b?.id||'')||typeof b?.text!=='string')
      throw new Error('Invalid verified article block');
    const refWords=terms(b.text);
    const overlap=words.size===0?0:[...words].filter(w=>refWords.has(w)).length/words.size;
    return {blockId:b.id,literalMatch:needle.length>=12&&b.text.includes(needle),
      wordOverlap:Number(overlap.toFixed(2))};
  }).sort((a,b)=>Number(b.literalMatch)-Number(a.literalMatch)||
    b.wordOverlap-a.wordOverlap||a.blockId.localeCompare(b.blockId));
  const best=options[0]||null;
  return {note,sourcePhrasePresent:options.some(x=>x.literalMatch),
    closestBlockId:best?.blockId||null,wordOverlap:best?.wordOverlap||0};
}

export async function auditPendingDraft({
  documentId,publisher,progressStore,allowedSources,articleReader,
  now=Date.now(),includeDraft=false,
}={}){
  if(!/^[a-zA-Z0-9]{12,90}$/.test(documentId||'')||
     typeof publisher?.readPendingDraft!=='function'||
     typeof progressStore?.load!=='function'||
     typeof articleReader!=='function'||
     !Array.isArray(allowedSources)||allowedSources.length===0)
    throw new Error('DEV read-only audit prerequisites missing');
  const pending=await publisher.readPendingDraft(documentId); // GET only.
  let url;
  try{url=new URL(pending.sourceUrl);}catch{throw new Error('Invalid pending source URL');}
  const source=SOURCES.find(s=>allowedSources.includes(s.id)&&
    s.hostname===url.hostname&&s.name===pending.sourceName&&
    s.language===pending.sourceLanguage&&
    s.previewOnly!==true&&!s.paused&&
    s.fullTextAccess?.status==='approved'&&s.section&&
    url.pathname.startsWith('/'+s.section+'/noticia/'));
  const sourceDate=Date.parse(pending.originalPublishedAt||'');
  if(!source||url.protocol!=='https:'||url.username||url.password||
     url.port||url.search||url.hash||
     !/^20\d{2}-(?:0[1-9]|1[0-2])\/[a-z0-9-]+\/?$/.test(
       url.pathname.slice(('/'+source.section+'/noticia/').length))||
     !/^[a-f0-9]{64}$/.test(pending.dedupeKey||'')||
     createHash('sha256').update(pending.sourceUrl).digest('hex')!==pending.dedupeKey||
     !Number.isFinite(sourceDate)||sourceDate>now+86400000||
     now-sourceDate>45*86400000)
    throw new Error('Pending article fails licensed-source or recency checks');
  const draft=validateDraft(JSON.stringify({
    title:pending.title,summary:pending.summary,body:pending.body,
    whyItMatters:pending.whyItMatters,category:pending.category,
  }));
  if(!draft||draft.title!==pending.title||
     draft.summary!==pending.summary?.trim()||
     draft.body!==pending.body||
     draft.whyItMatters!==pending.whyItMatters||
     draft.category!==pending.category||
     pending.slug!==slugFor({dedupeKey:pending.dedupeKey},draft.title))
    throw new Error('Pending Draft editorial integrity failed');
  const evidence=await articleReader(source,{
    url:pending.sourceUrl,title:pending.originalTitle,
    publishedAt:pending.originalPublishedAt,dedupeKey:pending.dedupeKey,
  });
  if(evidence?.verified!==true||evidence.mode!=='full_article'||
     evidence.sourceUrl!==pending.sourceUrl||evidence.sourceId!==source.id||
     evidence.licenseReference!==source.fullTextAccess.reference||
     !Array.isArray(evidence.blocks)||evidence.blocks.length<3)
    throw new Error('Current complete licensed evidence unavailable');
  // The progressStore verifies its AEAD tag and binds this fingerprint
  // to the unchanged original CMS Draft and the fresh article digest.
  const fingerprint=editorialProgressFingerprint({
    documentId,dedupeKey:pending.dedupeKey,original:draft,evidence,
  });
  const progress=await progressStore.load(fingerprint);
  const report={
    event:'editorial_audit_dev',mode:'read_only',documentIdHash:
      createHash('sha256').update(documentId).digest('hex').slice(0,12),
    originalTitle:pending.originalTitle,source:source.name,
    sourceUrl:pending.sourceUrl,licenseReference:evidence.licenseReference,
    evidenceDigestPrefix:evidence.digest.slice(0,12),
    evidenceBlocks:evidence.blocks.length,
    savedPhase:progress?.phase||'none',
    correctionsDone:progress?.correctionsDone||0,
    terminal:progress?.phase==='terminal',
    modelFlaggedIssues:progress?.history.map(h=>({
      afterCorrection:h.afterCorrection,
      issues:h.issues.map(v=>summarizeObjection(v,evidence.blocks)),
      unsupportedClaims:h.unsupportedClaims.map(v=>summarizeObjection(v,evidence.blocks)),
    }))||[],
    // A string overlap cannot establish factual truth or clear a reviewer HOLD.
    conclusion:'requires_human_factual_review',
    cmsWrites:0,llmCalls:0,redisMutations:0,
  };
  if(includeDraft&&progress)report.lastCorrectedDraft=progress.draft;
  return report;
}

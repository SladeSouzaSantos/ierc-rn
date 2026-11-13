import {createHash,randomBytes} from 'node:crypto';
import {SOURCES} from './feeds.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';
import {validateDraft,slugFor} from './editorial.mjs';
import {reviewFullArticleDraft} from './full-article-review.mjs';

/**
 * Explicit, single-ID recovery for an auto-generated Strapi draft left pending
 * after free-provider review exhaustion. Does NOT regenerate, create or edit a
 * news article; publication uses the existing scoped publisher's exact-match
 * draft preflight. Neither a URL nor a CMS title can select another domain.
 */
export async function retryPendingDraft({
  documentId,publisher,router,store,allowedSources,
  now=Date.now(),articleReader=fetchArticleEvidence,logger=()=>{},
}={}){
  if(!/^[a-zA-Z0-9]{12,90}$/.test(documentId||'') ||
     !publisher||typeof publisher.readPendingDraft!=='function'||
     typeof publisher.publishApprovedDraft!=='function'||
     !router||typeof router.complete!=='function'||
     !store||typeof store.set!=='function'||typeof store.eval!=='function'||
     !Array.isArray(allowedSources)||allowedSources.length===0||
     typeof articleReader!=='function')
    throw new Error('Explicit, licensed pending Draft recovery prerequisites missing');

  const pending=await publisher.readPendingDraft(documentId);
  let url;
  try{url=new URL(pending.sourceUrl);}catch{throw new Error('Pending Draft source URL invalid');}
  const source=SOURCES.find(s=>allowedSources.includes(s.id)&&
    s.hostname===url.hostname&&s.previewOnly!==true&&!s.paused&&
    s.fullTextAccess?.status==='approved'&&
    s.section&&url.pathname.startsWith('/'+s.section+'/noticia/'));
  if(!source||url.protocol!=='https:'||url.username||url.password||url.port||
     url.hash||url.search||pending.sourceName!==source.name||
     !/^20\d{2}-(?:0[1-9]|1[0-2])\/[a-z0-9-]+\/?$/.test(
       url.pathname.slice(('/'+source.section+'/noticia/').length))||
     typeof pending.originalTitle!=='string'||pending.originalTitle.length<14||
     typeof pending.sourceLanguage!=='string'||pending.sourceLanguage!==source.language||
     !/^[a-f0-9]{64}$/.test(pending.dedupeKey||'')||
     createHash('sha256').update(pending.sourceUrl).digest('hex')!==pending.dedupeKey)
    throw new Error('Pending Draft does not match an authorized licensed source');

  const originalDate=Date.parse(pending.originalPublishedAt||'');
  if(!Number.isFinite(originalDate)||originalDate>now+86400000||
     now-originalDate>45*86400000)
    throw new Error('Pending Draft exceeds licensed 45-day article window');
  const reviewSource={
    title:pending.originalTitle,source:source.name,url:pending.sourceUrl,
    publishedAt:pending.originalPublishedAt,language:source.language,
    coverageTrack:pending.scope==='local'?'ierc':'brasil',
    dedupeKey:pending.dedupeKey,
  };
  let draft;
  try {
    draft=validateDraft(JSON.stringify({
      title:pending.title,summary:pending.summary,body:pending.body,
      whyItMatters:pending.whyItMatters,category:pending.category,
    }));
  }catch{
    // Never disclose an invalid draft or internal CMS data in operational logs.
    throw new Error('Pending Draft changed or failed editorial integrity checks');
  }
  if(!draft||draft.title!==pending.title||draft.summary!==pending.summary||
     draft.body!==pending.body||draft.whyItMatters!==pending.whyItMatters||
     draft.category!==pending.category||pending.slug!==slugFor(reviewSource,draft.title))
    throw new Error('Pending Draft changed or failed editorial integrity checks');

  const lock='ierc:curator:lock:'+pending.dedupeKey;
  const owner=randomBytes(16).toString('hex');
  if(await store.set(lock,owner,'PX',180000,'NX')!=='OK')
    return {status:'locked'};
  const documentIdHash=createHash('sha256').update(documentId).digest('hex').slice(0,12);
  try{
    // A RETRY is one explicit operator action; no new draft and no bypass
    // if the source's original rights/evidence can no longer be verified.
    const evidence=await articleReader(source,{
      url:reviewSource.url,title:reviewSource.title,
      publishedAt:reviewSource.publishedAt,dedupeKey:reviewSource.dedupeKey,
    },{fetchImpl:createPacedEbcFetch(fetch)});
    if(evidence?.verified!==true||evidence.mode!=='full_article'||
       evidence.sourceUrl!==reviewSource.url||evidence.sourceId!==source.id||
       evidence.licenseReference!==source.fullTextAccess.reference)
      throw new Error('Pending Draft full article rights unavailable');
    const verdict=await reviewFullArticleDraft(reviewSource,draft,evidence,{router,logger});
    if(!verdict.approved){
      logger({event:'pending_review_held',documentIdHash,reason:verdict.reason});
      return {status:'draft_review_pending',reason:verdict.reason};
    }
    const expected={
      sourceUrl:pending.sourceUrl,dedupeKey:pending.dedupeKey,
      slug:pending.slug,title:pending.title,summary:pending.summary,body:pending.body,
    };
    await publisher.publishApprovedDraft(documentId,expected,{
      evidenceQuotes:verdict.evidenceQuotes,reviewerProvider:verdict.reviewerProvider,
      evidenceMode:verdict.evidenceMode,evidenceDigest:verdict.evidenceDigest,
      licenseReference:verdict.licenseReference,
    });
    await store.set('ierc:curator:seen:'+pending.dedupeKey,'1','EX',31536000);
    logger({event:'pending_draft_published',documentIdHash,review:'full_article'});
    return {status:'draft_published',reusedDraft:true};
  }finally{
    await store.eval('if redis.call("GET",KEYS[1])==ARGV[1] then return redis.call("DEL",KEYS[1]) else return 0 end',
      1,lock,owner);
  }
}

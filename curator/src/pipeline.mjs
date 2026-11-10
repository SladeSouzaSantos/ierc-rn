import { SOURCES, parseFeed, fetchSource } from './feeds.mjs';
import { parseListing } from './listings.mjs';
import { rankArticles } from './relevance.mjs';
import { processArticle, generateAiDraft } from './editorial.mjs';
import { reviewAiDraft } from './auto-review.mjs';
import {generateFullArticleDraft,reviewFullArticleDraft} from './full-article-review.mjs';
import {sanitizeArticleEvidenceError} from './article-evidence.mjs';
import {AUTO_PUBLISH_LICENSED_SOURCES} from './auto-config.mjs';

/**
 * Preview: all verified source listings, including sources held for policy review.
 * Live drafts: ONLY verified syndication feeds with previewOnly === false.
 * Round-robin guarantees a single source does not consume the entire 3-item batch.
 */
export async function runOnce({ sources = SOURCES, fetchImpl = fetch, router, store, cms,
  now = Date.now(), maxArticles = 3, maxAgeDays = 45, dryRun = true,
  aiPreview = false, reviewPreview = false, fullArticlePreview = false,
  articleReader = null, previewLookup = null,
  autoPublish = false, publisher = null,
  autoPublishSources = [], logger = () => {} }) {
  if (aiPreview && (!dryRun || cms || autoPublish || publisher))
    throw new Error('AI preview cannot write to CMS or run in live mode');
  if(reviewPreview && !aiPreview)
    throw new Error('Review preview requires read-only AI preview');
  if(fullArticlePreview && (!reviewPreview||!aiPreview))
    throw new Error('Full-article preview requires read-only editorial preview');

  if(reviewPreview && (!previewLookup || typeof previewLookup.check!=='function'))
    throw new Error('Review preview requires a read-only Redis and CMS duplicate preflight');
  if(!reviewPreview && previewLookup)
    throw new Error('Read-only duplicate preflight is exclusive to review preview');
  if(autoPublish && (dryRun || !publisher || maxArticles > 1 ||
     !Array.isArray(autoPublishSources)||autoPublishSources.length===0 ||
     !autoPublishSources.every(id=>AUTO_PUBLISH_LICENSED_SOURCES.includes(id))))
    throw new Error('Auto publication requires live mode, source allowlist, scoped publisher and one-item batch');
  if((fullArticlePreview||autoPublish) && typeof articleReader!=='function')
    throw new Error('Permission-gated full article reader is required');
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 365)
    throw new Error('Invalid article age window');
  if (!Number.isInteger(maxArticles) || maxArticles < 1 || maxArticles > 30)
    throw new Error('Invalid article batch size');
  const buckets = [];
  for (const source of sources) {
    // Connectivity quarantine is explicit and applies to previews as well:
    // do not waste the entire run repeatedly timing out on this endpoint.
    if(source.paused===true){
      logger({event:'source_paused',source:source.id,reason:source.readiness});
      continue;
    }
    if ((!dryRun || aiPreview) && source.previewOnly === true) {
      logger({ event: 'source_skipped_by_policy', source: source.id, reason: source.readiness });
      continue;
    }
    let articles;
    try {
      const body = await fetchSource(source, fetchImpl);
      const parse = source.mode === 'html' ? parseListing : parseFeed;
      const validYear = parse(body, source, now, 365);
      const listingDiagnostics = {};
      const withinWindow = source.mode === 'html'
        ? parse(body, source, now, maxAgeDays, listingDiagnostics)
        : parse(body, source, now, maxAgeDays);
      articles = rankArticles(withinWindow, source);
      logger({
        event: 'feed_checked', source: source.id, mode: source.mode || 'rss',
        previewOnly: source.previewOnly === true,
        validLastYear: validYear.length,
        withinWindow: withinWindow.length, candidates: articles.length, maxAgeDays,
        filteredByTopic: withinWindow.length-articles.length,
        ...(articles.length===0?{noCandidatesReason:withinWindow.length>0
          ?'no_matching_topics':'no_recent_items'}:{}),
        ...(source.mode === 'html' ? {listingDiagnostics} : {}),
      });
    } catch (error) {
      const message = typeof error?.message === 'string' ? error.message : '';
      const reason = /^Source HTTP \d{3}$/.test(message) ? 'http_error' :
        message === 'Unsafe source redirect' ? 'redirect_blocked' :
        message === 'Invalid RSS/Atom document' ? 'invalid_feed' :
        message === 'Source exceeds size limit' ? 'size_limit' :
        error?.name === 'TimeoutError' ? 'timeout' : 'network_or_parser_error';
      logger({ event: 'feed_unavailable', source: source.id, reason });
      continue;
    }
    if (articles.length) buckets.push({ source, articles, cursor: 0 });
  }

  // Prioritize explicitly documented IERC coverage, then national news,
  // then global practices. Preserve round-robin fairness within each tier.
  buckets.sort((a,b)=>
    (b.articles[0]?.relevance?.priority||0)-(a.articles[0]?.relevance?.priority||0) ||
    (b.articles[0]?.relevance?.score||0)-(a.articles[0]?.relevance?.score||0));

  let remaining = maxArticles;
  const results = [];
  const processedInRun=new Set();
  const skippedPreviouslyProcessed={redis:0,cms:0};
  while (remaining > 0 && buckets.some(bucket => bucket.cursor < bucket.articles.length)) {
    for (const bucket of buckets) {
      if (remaining <= 0 || bucket.cursor >= bucket.articles.length) continue;
      const article = bucket.articles[bucket.cursor++];
      // A story can appear in multiple official categories. Avoid duplicate
      // previews and extra AI calls within a single run, without Redis writes.
      if(processedInRun.has(article.dedupeKey)){
        logger({event:'cross_feed_duplicate_skipped',source:bucket.source.id});
        continue;
      }
      processedInRun.add(article.dedupeKey);
      // The track is derived from source evidence, not from AI speculation.
      // It never turns an external news item into an IERC announcement.
      if(reviewPreview){
        // Check historical CMS documents (draft AND published) and Redis seen
        // keys BEFORE either LLM call. A lookup error aborts the run.
        const reason=await previewLookup.check(article);
        if(reason!==null){
          if(reason!=='redis'&&reason!=='cms')
            throw new Error('Invalid read-only duplicate preflight result');
          skippedPreviouslyProcessed[reason]++;
          logger({event:'review_preview_skipped',source:bucket.source.id,reason});
          continue;
        }
      }
      let evidence=null;
      if(fullArticlePreview||(autoPublish&&autoPublishSources.includes(bucket.source.id))){
        try{
          evidence=await articleReader(bucket.source,article,{fetchImpl});
          if(evidence?.verified!==true||evidence?.mode!=='full_article'||evidence?.sourceUrl!==article.url)
            throw new Error('Invalid article evidence');
        }catch(error){
          const reason=sanitizeArticleEvidenceError(error);
          logger({event:'article_evidence_unavailable',source:bucket.source.id,reason});
          results.push({source:bucket.source.id,status:'article_evidence_unavailable',
            ...(dryRun?{title:article.title,publishedAt:article.publishedAt,
              originalUrl:article.url,previewOnly:false}:{}) ,
            evidenceReason:reason});
          remaining--;
          continue;
        }
      }
      let result;
      if(aiPreview){
        result=fullArticlePreview
          ? await generateFullArticleDraft(article,evidence,{router,logger})
          : await generateAiDraft(article,{router,logger});
        if(reviewPreview && result.status==='draft_ready'){
          const verdict=fullArticlePreview
            ? await reviewFullArticleDraft(article,result.draft,evidence,{router,logger})
            : await reviewAiDraft(article,result.draft,{router,logger});
          result={...result,
            status:verdict.approved?'review_approved_preview':'review_pending_preview',
            reviewReason:verdict.reason,
            ...(fullArticlePreview?{reviewBasis:'full_article'}:{})};
        }
      }else{
        result=await processArticle(article,{router,store,cms,dryRun,logger,
          fullArticleEvidence:evidence,
          autoPublish:autoPublish&&autoPublishSources.includes(bucket.source.id),publisher});
      }
      results.push({
        source: bucket.source.id,
        status: result.status,
        ...(dryRun ? {
          title: aiPreview ? article.title : result.article,
          publishedAt: article.publishedAt,
          relevanceScore: article.relevance.score,
          topics: article.relevance.topics,
          coverageTrack:article.coverageTrack,
          coverageScope:article.coverageScope,
          previewOnly: bucket.source.previewOnly === true,
          ...(aiPreview ? {
            originalUrl: article.url,
            ...(['draft_ready','review_approved_preview','review_pending_preview'].includes(result.status) ? {
              draft: result.draft, provider: result.provider,
              ...(result.reviewReason ? {reviewReason:result.reviewReason} : {}),
              ...(result.reviewBasis ? {reviewBasis:result.reviewBasis} : {}),
            } : {}),
          } : {}),
        } : {}),
      });
      if (!['seen', 'already_in_cms', 'locked'].includes(result.status)) remaining--;
    }
  }
  // Report actual completed AI drafts, not the mode selector. A supervised
  // once run uses aiPreview=false but still generates and saves a draft.
  const aiGenerated=results.some(({status})=>['draft_ready','draft_created',
    'draft_created_review_pending','draft_created_publish_failed','draft_published',
    'review_approved_preview','review_pending_preview'].includes(status));
  return { results, preview: dryRun, aiGenerated, count: results.length,
    ...(reviewPreview ? {skippedPreviouslyProcessed,
      reviewBasis:fullArticlePreview?'full_article':'rss'} : {}) };
}

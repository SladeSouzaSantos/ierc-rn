import { SOURCES, parseFeed, fetchSource } from './feeds.mjs';
import { parseListing } from './listings.mjs';
import { rankArticles } from './relevance.mjs';
import { processArticle, generateAiDraft } from './editorial.mjs';

/**
 * Preview: all verified source listings, including sources held for policy review.
 * Live drafts: ONLY verified syndication feeds with previewOnly === false.
 * Round-robin guarantees a single source does not consume the entire 3-item batch.
 */
export async function runOnce({ sources = SOURCES, fetchImpl = fetch, router, store, cms,
  now = Date.now(), maxArticles = 3, maxAgeDays = 45, dryRun = true,
  aiPreview = false, logger = () => {} }) {
  if (aiPreview && (!dryRun || cms))
    throw new Error('AI preview cannot write to CMS or run in live mode');
  if (!Number.isInteger(maxAgeDays) || maxAgeDays < 1 || maxAgeDays > 365)
    throw new Error('Invalid article age window');
  if (!Number.isInteger(maxArticles) || maxArticles < 1 || maxArticles > 30)
    throw new Error('Invalid article batch size');
  const buckets = [];
  for (const source of sources) {
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

  let remaining = maxArticles;
  const results = [];
  while (remaining > 0 && buckets.some(bucket => bucket.cursor < bucket.articles.length)) {
    for (const bucket of buckets) {
      if (remaining <= 0 || bucket.cursor >= bucket.articles.length) continue;
      const article = bucket.articles[bucket.cursor++];
      const result = aiPreview
        ? await generateAiDraft(article, {router,logger})
        : await processArticle(article, { router, store, cms, dryRun, logger });
      results.push({
        source: bucket.source.id,
        status: result.status,
        ...(dryRun ? {
          title: aiPreview ? article.title : result.article,
          publishedAt: article.publishedAt,
          relevanceScore: article.relevance.score,
          topics: article.relevance.topics,
          previewOnly: bucket.source.previewOnly === true,
          ...(aiPreview ? {
            originalUrl: article.url,
            ...(result.status === 'draft_ready' ? {
              draft: result.draft, provider: result.provider,
            } : {}),
          } : {}),
        } : {}),
      });
      if (!['seen', 'already_in_cms', 'locked'].includes(result.status)) remaining--;
    }
  }
  return { results, preview: dryRun, aiGenerated: aiPreview, count: results.length };
}

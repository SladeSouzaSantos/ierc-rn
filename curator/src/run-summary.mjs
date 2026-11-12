/**
 * Log-safe, content-free run diagnostics for the persistent scheduler.
 * A processed candidate is NOT automatically a published news article.
 */
export function summarizeRunForLog(report) {
  const byStatus = {};
  for (const item of Array.isArray(report?.results) ? report.results : []) {
    const status = item?.status;
    // Only log symbolic status identifiers; never headlines, document IDs,
    // article bodies, prompts, provider responses or credentials.
    if (typeof status !== 'string' || !/^[a-z][a-z_]{0,48}$/.test(status)) continue;
    byStatus[status] = (byStatus[status] || 0) + 1;
  }
  return {
    published: byStatus.draft_published || 0,
    draftsCreated: (byStatus.draft_created || 0) +
      (byStatus.draft_created_review_pending || 0) +
      (byStatus.draft_created_publish_failed || 0) +
      (byStatus.draft_published || 0),
    statusCounts: byStatus,
  };
}

/** Centralized portal CMS read contract, never imported in a client component. */
export type CmsRow = Record<string, unknown>;
const EDITORIAL_FILTER = "filters[editorialStatus][$eq]";
/** Extra filters must not relax publication, approval, or pagination. */
export function approvedCmsQuery(extra: Record<string, string> = {}): URLSearchParams {
  if (Object.keys(extra).some(key => key === "status" ||
    key === EDITORIAL_FILTER || key === "pagination[pageSize]")) {
    throw new Error("Editorial CMS query policy override rejected");
  }
  const query = new URLSearchParams(extra);
  query.set("status", "published");
  query.set(EDITORIAL_FILTER, "aprovado");
  query.set("pagination[pageSize]", "30");
  return query;
}
/** Defense in depth, even when the CMS returns a record outside its filters. */
export function approvedPublishedRecord(value: unknown): value is CmsRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as CmsRow;
  return row.editorialStatus === "aprovado" &&
    typeof row.publishedAt === "string" && row.publishedAt.length > 0 &&
    Number.isFinite(Date.parse(row.publishedAt));
}

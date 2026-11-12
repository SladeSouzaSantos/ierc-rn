import type { CmsArticle, CmsEvent } from "./cms";
import { sortNewsNewestFirst } from "./news-order";

/** Groups the approved CMS agenda without turning historical entries into upcoming dates. */
export function groupInstitutionalEvents(events: CmsEvent[], reference = new Date()) {
  const instant = reference.getTime();
  if (!Number.isFinite(instant)) throw new Error("Invalid reference time");

  const upcoming: CmsEvent[] = [];
  const ongoing: CmsEvent[] = [];
  const completed: CmsEvent[] = [];

  for (const event of events) {
    const starts = Date.parse(event.startsAt);
    if (!Number.isFinite(starts)) continue;
    const ends = event.endsAt ? Date.parse(event.endsAt) : Number.NaN;

    if (starts > instant) upcoming.push(event);
    else if (Number.isFinite(ends) && ends >= instant && ends >= starts) ongoing.push(event);
    else completed.push(event);
  }

  upcoming.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  ongoing.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  completed.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return { upcoming, ongoing, completed };
}

/** An editor explicitly tags an internal news article to link it from /eventos.
 * The canonical article always stays at /noticias/[slug].
 * External clippings/Radar stories can never become institutional coverage.
 */
export const INTERNAL_EVENT_NEWS_CATEGORY = "Eventos e atividades";
const labels = new Set(["eventos e atividades", "evento institucional"]);
function normalizeCategory(value?: string) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}
export function institutionalEventNews(items: CmsArticle[]) {
  return sortNewsNewestFirst(
    items.filter(item =>
      item.originType === "institucional" &&
      labels.has(normalizeCategory(item.category)) &&
      /^[a-z0-9-]{1,90}$/.test(item.slug) &&
      !!item.title && !!item.summary,
    ),
    item => item.date,
  );
}

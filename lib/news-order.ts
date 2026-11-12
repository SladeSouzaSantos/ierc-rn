/** Chronological news ordering. Missing or invalid dates come last.
 * Returns a copy to preserve source records; ties keep their original order.
 * Both Strapi publication dates and verified archival dates are ISO dates.
 */
export function sortNewsNewestFirst<T>(
  items: readonly T[],
  dateOf: (item: T) => string | undefined | null,
): T[] {
  const timestamp = (item: T): number => {
    const raw = dateOf(item);
    if (!raw || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(raw)) return -Infinity;
    const value = Date.parse(raw);
    return Number.isFinite(value) ? value : -Infinity;
  };
  return [...items].sort((a, b) => timestamp(b) - timestamp(a) || 0);
}

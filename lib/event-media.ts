/** Public event media policy, independent of the Strapi server client.
 * Only event uploads explicitly cleared for display are considered.
 * The image bytes are served through a same-origin, read-only portal route.
 */
export type EventImage = { path: string; alt: string; credit?: string };

type Bag = Record<string, unknown>;
function obj(value: unknown): Bag | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Bag : null;
}

/** Allows only Strapi's own image uploads, not arbitrary remote URLs or files. */
export function safeEventUploadPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 400) return null;
  const candidate = value.trim();
  let pathname = candidate;
  if (candidate.startsWith("http:") || candidate.startsWith("https:")) {
    try {
      const u = new URL(candidate);
      // Absolute hosts cannot be trusted here. Strapi occasionally emits
      // absolute URLs, but we require a path-only /uploads URL to avoid SSRF.
      if (u.search || u.hash || u.username || u.password) return null;
      pathname = u.pathname;
    } catch { return null; }
  }
  if (!/^\/uploads\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp|avif|gif)$/i.test(pathname)) {
    return null;
  }
  if (pathname.includes("..") || pathname.includes("//")) return null;
  return pathname;
}

/** Enforces image rights and meaningful alt text before a public card is shown. */
export function approvedEventImage(event: unknown): EventImage | null {
  const item = obj(event);
  if (!item || item.imageRightsStatus !== "autorizado") return null;
  const alt = typeof item.imageAlt === "string" ? item.imageAlt.trim() : "";
  if (!alt || alt.length > 500) return null;

  // Strapi 5 returns flat media; Strapi 4 nested data/attributes is supported.
  let media = obj(item.image);
  if (media && Object.hasOwn(media, "data")) media = obj(media.data);
  if (media && Object.hasOwn(media, "attributes")) media = obj(media.attributes);
  if (!media || typeof media.mime !== "string" ||
      !/^image\/(?:png|jpeg|webp|avif|gif)$/.test(media.mime)) return null;
  const path = safeEventUploadPath(media.url);
  if (!path) return null;
  const credit = typeof item.imageCredit === "string" ? item.imageCredit.trim().slice(0, 160) : "";
  return { path, alt, ...(credit ? { credit } : {}) };
}

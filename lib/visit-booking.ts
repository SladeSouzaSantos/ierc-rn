/** Official visit request URL supplied by the IERC-RN administration. */
export const OFFICIAL_VISIT_FORM_URL = "https://forms.gle/NY35YEEkbL6HM2YF9";

/**
 * Only allow known Google Forms destinations controlled through the CMS.
 * Discard query and hash instead of carrying third-party tracking or form data.
 * This is a destination policy, not verification of form ownership.
 */
export function safeGoogleVisitFormUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const candidate = new URL(value.trim());
    if (candidate.protocol !== "https:" || candidate.username || candidate.password ||
        candidate.port) return null;
    const short = candidate.hostname === "forms.gle" &&
      /^\/[A-Za-z0-9_-]+\/?$/.test(candidate.pathname);
    const long = candidate.hostname === "docs.google.com" &&
      /^\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform\/?$/.test(candidate.pathname);
    if (!short && !long) return null;
    return candidate.origin + candidate.pathname;
  } catch { return null; }
}

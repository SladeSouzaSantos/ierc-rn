/** Hosted monthly donation options. NO gateway API call, no card/CPF fields.
 * An institutional officer must verify merchant ownership and provision links
 * with Asaas before enabling external checkout. Fail closed by default.
 */
export const DONATION_MONTHLY_AMOUNTS = [20, 50, 100] as const;
export type MonthlyAmount = typeof DONATION_MONTHLY_AMOUNTS[number];
export type MonthlyMethod = "pix" | "credit";
export type MonthlyLinks = Record<MonthlyMethod, Partial<Record<MonthlyAmount, string>>>;
export type MonthlyDonationConfig = {
  enabled: boolean;
  links: MonthlyLinks;
};

const EMPTY_LINKS: MonthlyLinks = { pix: {}, credit: {} };
const VERIFIED_CNPJ = "08049504000108";

/** The complete URL comes from a provider-generated link, never synthesized.
 * Asaas began migrating public URLs to paths containing an account prefix
 * in September 2026; validate origin, not the legacy /c/ path shape.
 */
export function safeHostedCheckoutUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 650) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname !== "www.asaas.com" ||
        input.trim() !== input || url.username || url.password || url.port ||
        url.hash || url.search || /[\\%]/.test(input)) return null;
    // Asaas can prepend an account segment (e.g. /000/c/<id>).
    // Validate a checkout link rather than a general provider page.
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || parts[parts.length - 2] !== "c" ||
        !/^[A-Za-z0-9_-]{5,100}$/.test(parts[parts.length - 1])) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function resolveRecurringDonationConfig(
  env: Record<string, string | undefined>,
): MonthlyDonationConfig {
  if (env.IERCRN_DONATIONS_RECURRING_ENABLED !== "true" ||
      env.IERCRN_DONATIONS_RECEIVER_VERIFIED !== "true" ||
      env.IERCRN_DONATIONS_GATEWAY !== "asaas" ||
      env.IERCRN_DONATIONS_RECEIVER_CNPJ !== VERIFIED_CNPJ) {
    return { enabled: false, links: { pix: {}, credit: {} } };
  }

  const serialized = env.IERCRN_DONATIONS_HOSTED_LINKS_JSON;
  if (!serialized || serialized.length > 6000) {
    return { enabled: false, links: { pix: {}, credit: {} } };
  }
  try {
    const raw: unknown = JSON.parse(serialized);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { enabled: false, links: { pix: {}, credit: {} } };
    }
    const record = raw as Record<string, unknown>;
    if (Object.keys(record).some(k => k !== "pix" && k !== "credit")) {
      return { enabled: false, links: { pix: {}, credit: {} } };
    }

    const links: MonthlyLinks = { pix: {}, credit: {} };
    for (const method of ["pix", "credit"] as const) {
      const group = record[method];
      if (group === undefined) continue;
      if (!group || typeof group !== "object" || Array.isArray(group)) {
        return { enabled: false, links: { pix: {}, credit: {} } };
      }
      const values = group as Record<string, unknown>;
      if (Object.keys(values).some(key =>
        !DONATION_MONTHLY_AMOUNTS.some(amount => String(amount) === key))) {
        return { enabled: false, links: { pix: {}, credit: {} } };
      }
      for (const amount of DONATION_MONTHLY_AMOUNTS) {
        if (values[String(amount)] === undefined) continue;
        const link = safeHostedCheckoutUrl(values[String(amount)]);
        if (!link) {
          return { enabled: false, links: { pix: {}, credit: {} } };
        }
        links[method][amount] = link;
      }
    }
    return {
      enabled: Object.keys(links.pix).length + Object.keys(links.credit).length > 0,
      links,
    };
  } catch {
    return { enabled: false, links: { pix: {}, credit: {} } };
  }
}

export function donationConfigForServer(): MonthlyDonationConfig {
  return resolveRecurringDonationConfig(process.env);
}

import "server-only";
import { activities as baselineActivities } from "@/lib/site-data";

/**
 * Leitura de conteudo Strapi publicada, explicitamente aprovada e somente no servidor.
 * Token nunca deve ter permissao de escrita ou prefixo NEXT_PUBLIC_.
 * Sem variaveis configuradas (ou backend indisponivel), o portal existente segue funcional.
 */
type Json = Record<string, unknown>;

export type CmsArticle = {
  slug: string;
  title: string;
  summary: string;
  body?: string;
  category?: string;
  date?: string;
  sourceName?: string;
  sourceUrl?: string;
  originType?: "institucional" | "externa";
  scope?: "local" | "brasil" | "internacional";
  country?: string;
  sourceLanguage?: string;
  whyItMatters?: string;
  aiAssisted?: boolean;
  autoReviewed?: boolean;
  autoReviewBasis?: "rss" | "full_article";
};
export type CmsEvent = {
  slug: string;
  title: string;
  summary: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  registrationUrl?: string;
};
export type CmsActivity = {
  id: string;
  title: string;
  description: string;
  category: string;
};
export type CmsAthlete = {
  slug: string;
  name: string;
  summary: string;
  connectionToIerc: string;
  discipline?: string;
  sourceUrl?: string;
  sourceName?: string;
};

function string(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function url(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") ? parsed.toString() : undefined;
  } catch { return undefined; }
}
function validRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function environment(): { endpoint: string; token: string } | null {
  if (process.env.CMS_ENABLED !== "true") return null;
  const endpoint = url(process.env.CMS_API_URL);
  const token = process.env.CMS_READ_TOKEN?.trim();
  if (!endpoint || !token) return null;
  return { endpoint: endpoint.replace(/\/$/, ""), token };
}
const slugs = new Set(["news-articles", "events", "activities", "athletes"]);
async function find(collection: string, filters?: Record<string, string>): Promise<Json[]> {
  const env = environment();
  if (!env || !slugs.has(collection)) return [];
  const q = new URLSearchParams({
    status: "published",
    "filters[editorialStatus][$eq]": "aprovado",
    "pagination[pageSize]": "30",
  });
  for (const [key, value] of Object.entries(filters || {})) q.set(key, value);
  try {
    const response = await fetch(env.endpoint + "/api/" + collection + "?" + q.toString(), {
      headers: { Authorization: "Bearer " + env.token, Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) return [];
    const payload: unknown = await response.json();
    if (!validRecord(payload) || !Array.isArray(payload.data)) return [];
    return payload.data.filter((item): item is Json =>
      validRecord(item) && item.editorialStatus === "aprovado" &&
      typeof item.publishedAt === "string" && item.publishedAt.length > 0
    );
  } catch {
    // Falha fechada: nunca mostra rascunhos nem torna a pagina indisponivel.
    return [];
  }
}

function mapNewsRecord(v: Json): CmsArticle {
  return {
    slug: string(v.slug, 90), title: string(v.title, 200), summary: string(v.summary),
    body: string(v.body, 15000) || undefined,
    category: string(v.category, 50) || undefined,
    date: string(v.date, 40) || undefined,
    sourceName: string(v.sourceName, 100) || undefined,
    sourceUrl: url(v.sourceUrl),
    originType: v.originType === "externa" ? "externa" : "institucional",
    scope: v.scope === "internacional" ? "internacional" : v.scope === "brasil" ? "brasil" : "local",
    country: string(v.country, 80) || undefined,
    sourceLanguage: string(v.sourceLanguage, 15) || undefined,
    whyItMatters: string(v.whyItMatters, 1000) || undefined,
    aiAssisted: v.aiAssisted === true,
    autoReviewed: typeof v.approvalReference === "string" &&
      /^ai-(?:rss-v1|source-v2)-[a-f0-9]{12}$/.test(v.approvalReference),
    autoReviewBasis: typeof v.approvalReference === "string" &&
      /^ai-source-v2-[a-f0-9]{12}$/.test(v.approvalReference) ? "full_article" :
      typeof v.approvalReference === "string" &&
      /^ai-rss-v1-[a-f0-9]{12}$/.test(v.approvalReference) ? "rss" : undefined,
  };
}
function validNewsArticle(item: CmsArticle): boolean {
  return /^[a-z0-9-]{1,90}$/.test(item.slug) &&
    item.title.length > 0 && item.summary.length > 0;
}
function attributableExternalArticle(item: CmsArticle): boolean {
  return item.originType === "externa" && !!item.sourceName &&
    !!item.sourceUrl?.startsWith("https://");
}

export async function getCmsNews(): Promise<CmsArticle[]> {
  return (await find("news-articles")).map(mapNewsRecord).filter(validNewsArticle);
}

/** Radar has its own CMS query, retaining published + approved guards and pagination. */
export async function getCmsRadarNews(): Promise<CmsArticle[]> {
  return (await find("news-articles", {"filters[originType][$eq]": "externa"}))
    .map(mapNewsRecord)
    .filter(item => validNewsArticle(item) && attributableExternalArticle(item) &&
      item.scope !== "local");
}

export async function getCmsNewsBySlug(slug: string): Promise<CmsArticle | null> {
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  const valid=(item: CmsArticle) => validNewsArticle(item) &&
    (item.originType !== "externa" || attributableExternalArticle(item));
  const matching = (await find("news-articles", {"filters[slug][$eq]": slug}))
    .map(mapNewsRecord).find(item => item.slug === slug && valid(item));
  if(matching)return matching;

  // Legacy links used "radar-" plus the first 18 hex characters of
  // dedupeKey. If an editor later renames such a slug, resolve the exact
  // published+approved document and let the route issue a permanent redirect.
  const legacy=/^radar-([a-f0-9]{18})$/.exec(slug);
  if(!legacy)return null;
  const candidates=await find("news-articles",{
    "filters[dedupeKey][$startsWith]":legacy[1],
    "filters[originType][$eq]":"externa",
  });
  const verified=candidates.filter(item=>typeof item.dedupeKey==="string" &&
    item.dedupeKey.startsWith(legacy[1])).map(mapNewsRecord).filter(valid);
  // Never guess when a partial digest is ambiguous.
  return verified.length===1?verified[0]:null;
}
export async function getCmsEvents(): Promise<CmsEvent[]> {
  return (await find("events")).map(v => ({
    slug: string(v.slug, 90), title: string(v.title, 200), summary: string(v.summary),
    startsAt: string(v.startsAt, 40), endsAt: string(v.endsAt, 40) || undefined,
    location: string(v.location, 300) || undefined,
    registrationUrl: url(v.registrationUrl),
  })).filter(v => /^[a-z0-9-]{1,90}$/.test(v.slug) && v.title && v.summary &&
     !Number.isNaN(Date.parse(v.startsAt)));
}
export async function getCmsActivities(): Promise<CmsActivity[]> {
  return (await find("activities")).map(v => ({
    id: string(v.slug, 90), title: string(v.title, 200),
    description: string(v.summary, 1000), category: string(v.category, 100) || "Atividade",
  })).filter(v => /^[a-z0-9-]{1,90}$/.test(v.id) && v.title && v.description);
}
export async function getCmsAthletes(): Promise<CmsAthlete[]> {
  return (await find("athletes")).map(v => ({
    slug: string(v.slug, 90), name: string(v.name, 200),
    summary: string(v.summary, 4000), connectionToIerc: string(v.connectionToIerc, 2000),
    discipline: string(v.discipline, 100) || undefined,
    sourceName: string(v.sourceName, 120) || undefined,
    sourceUrl: url(v.sourceUrl),
  })).filter(v => /^[a-z0-9-]{1,90}$/.test(v.slug) &&
     v.name && v.summary && v.connectionToIerc && v.sourceUrl);
}

/** Conteudo homologado substitui ou complementa registros basicos sem quebrar o site. */
export async function getDisplayActivities(): Promise<CmsActivity[]> {
  const merged: CmsActivity[] = baselineActivities.map(item => ({
    id: item.id, title: item.title, description: item.description, category: item.category,
  }));
  for (const item of await getCmsActivities()) {
    const position = merged.findIndex(current => current.id === item.id);
    if (position === -1) merged.push(item);
    else merged[position] = item;
  }
  return merged;
}

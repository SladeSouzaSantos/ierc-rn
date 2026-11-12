import { getCmsEventImageBySlug } from "@/lib/cms";

/**
 * Same-origin event image transport. Browser never sees the private Strapi
 * network address or its CMS_READ_TOKEN; the server verifies approval and
 * image usage rights before fetching a single Strapi /uploads asset.
 */
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const allowedMime = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif",
]);

const unavailable = () => new Response(null, {
  status: 404,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,90}$/.test(slug) || process.env.CMS_ENABLED !== "true") {
    return unavailable();
  }
  const media = await getCmsEventImageBySlug(slug);
  if (!media) return unavailable();
  const endpoint = process.env.CMS_API_URL;
  if (!endpoint) return unavailable();

  try {
    const cms = new URL(endpoint);
    if (!["http:", "https:"].includes(cms.protocol) || cms.username ||
        cms.password || cms.search || cms.hash) return unavailable();
    // Image paths are separately validated to begin with /uploads/ and to
    // contain no dot segments, query strings or arbitrary hostnames.
    const imageUrl = new URL(media.path, cms.origin);
    const response = await fetch(imageUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return unavailable();

    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (!allowedMime.has(type) || (declared > MAX_IMAGE_BYTES)) {
      await response.body?.cancel();
      return unavailable();
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.byteLength > MAX_IMAGE_BYTES) return unavailable();
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Fail closed: no CMS secrets, internal hostname or media metadata
    // is exposed by an upstream failure.
    return unavailable();
  }
}

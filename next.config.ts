import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Framing, base URL injection and plugins blocked. Next hydration needs
  // nonce-aware rollout before adding script-src to the CSP.
  { key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
] as const;

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.gov.br" },
      { protocol: "https", hostname: "s2-ge.glbimg.com" },
      { protocol: "https", hostname: "cronos-media.sesisenaisp.org.br" },
    ],
  },
};

export default nextConfig;

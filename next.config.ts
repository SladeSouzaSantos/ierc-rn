import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

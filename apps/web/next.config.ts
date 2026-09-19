import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The root CLAUDE.md stays the single source of agent instructions (01 §12).
  agentRules: false,
  poweredByHeader: false,
  // No images.remotePatterns: remote images are refused (CA11, 01 §6.3).
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4000/api/:path*",
      },
    ];
  },
};

export default withNextIntl(nextConfig);

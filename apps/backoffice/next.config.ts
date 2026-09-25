import type { NextConfig } from "next";

/**
 * Sent on EVERY response of the backoffice, rather than a robots.txt Disallow: a path forbidden
 * to crawlers is never read, so its noindex would never be seen (03 §7.1; D12). The relay sets it
 * on its own answers too. Errors and redirects are checked by T10 (J9).
 */
export const NOINDEX = "noindex, nofollow, noarchive";

const nextConfig: NextConfig = {
  // The root CLAUDE.md stays the single source of agent instructions.
  agentRules: false,
  poweredByHeader: false,
  // Contracts are TypeScript sources; the relay imports their types only (21 §4, J1-E).
  transpilePackages: ["@influx/contracts"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: NOINDEX }],
      },
    ];
  },
};

export default nextConfig;

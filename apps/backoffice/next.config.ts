import type { NextConfig } from "next";
import { NOINDEX, SECURITY_HEADERS } from "./src/config/security-headers";

export { NOINDEX, SECURITY_HEADERS };

const nextConfig: NextConfig = {
  // The root CLAUDE.md stays the single source of agent instructions.
  agentRules: false,
  poweredByHeader: false,
  // The trailing-slash redirect is src/proxy.ts's: the router's went out without the headers below.
  skipTrailingSlashRedirect: true,
  // Contracts are TypeScript sources; the relay imports their types only (21 §4, J1-E).
  transpilePackages: ["@influx/contracts"],
  // Every response (03 §6.5, §7.1); the pages get their CSP with a nonce from src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;

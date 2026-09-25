import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The root CLAUDE.md stays the single source of agent instructions (01 §12).
  agentRules: false,
  poweredByHeader: false,
  // Contracts are TypeScript sources; the relay imports their types only (21 §4, J1-E).
  transpilePackages: ["@influx/contracts"],
  // No images.remotePatterns: remote images are refused (CA11, 01 §6.3).
};

export default withNextIntl(nextConfig);

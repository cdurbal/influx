import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { NOINDEX, securityHeadersFor } from "./src/config/security-headers";
import { stateBoardConfig } from "./src/config/state-board";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export { NOINDEX, securityHeadersFor };

/**
 * Sent on every response (03 §6.5, R7). The pages get their CSP with a nonce from src/proxy.ts,
 * which replaces the one here (18 T10).
 */
export const SECURITY_HEADERS = securityHeadersFor(process.env.INFLUX_ENV);

const nextConfig: NextConfig = {
  // The root CLAUDE.md stays the single source of agent instructions (01 §12).
  agentRules: false,
  poweredByHeader: false,
  // The trailing-slash redirect is src/proxy.ts's: the router's went out without the headers below.
  skipTrailingSlashRedirect: true,
  // Workspace packages are TypeScript sources, without build (21 §4 J1-E; arbitration PL-07).
  transpilePackages: [
    "@influx/contracts",
    "@influx/domain",
    "@influx/ui",
    "@influx/web-platform",
  ],
  // No images.remotePatterns: remote images are refused (CA11, 01 §6.3).
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
  // The component state board (RUA-05): a page extension, present only in development with the
  // flag on, absent otherwise (src/config/state-board.ts).
  ...stateBoardConfig(process.env),
};

export default withNextIntl(nextConfig);

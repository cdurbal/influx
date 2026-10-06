import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Security headers of every response, required before staging is exposed (21 §4 J4 point 5; 03
 * §6.5, R7). The CSP holds only the directives that need no nonce; the CSP with nonce arrives at
 * J9 (T10). HSTS without `preload` until the domains are settled (03 §6.5, integrateur).
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The root CLAUDE.md stays the single source of agent instructions (01 §12).
  agentRules: false,
  poweredByHeader: false,
  // Contracts are TypeScript sources; the relay imports their types only (21 §4, J1-E).
  transpilePackages: ["@influx/contracts"],
  // No images.remotePatterns: remote images are refused (CA11, 01 §6.3).
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
};

export default withNextIntl(nextConfig);

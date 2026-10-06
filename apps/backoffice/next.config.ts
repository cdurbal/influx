import type { NextConfig } from "next";

/**
 * Sent on EVERY response of the backoffice, rather than a robots.txt Disallow: a path forbidden
 * to crawlers is never read, so its noindex would never be seen (03 §7.1; D12). The relay sets it
 * on its own answers too. Errors and redirects are checked by T10 (J9).
 */
export const NOINDEX = "noindex, nofollow, noarchive";

/**
 * Security headers of every response (21 §4 J4 point 5; 03 §6.5, R7): those of apps/web, with
 * `Referrer-Policy: no-referrer`. The CSP with nonce arrives at J9 (T10); HSTS without `preload`
 * until the domains are settled.
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: "X-Robots-Tag", value: NOINDEX },
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
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
  // The root CLAUDE.md stays the single source of agent instructions.
  agentRules: false,
  poweredByHeader: false,
  // Contracts are TypeScript sources; the relay imports their types only (21 §4, J1-E).
  transpilePackages: ["@influx/contracts"],
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

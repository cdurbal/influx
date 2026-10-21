// Security headers of apps/web (03 §6.5, 18 T10). Read by next.config.ts (every response) and by
// src/proxy.ts (the CSP with a nonce, per request). No URL here: the Supabase host of 03 §6.5
// (`img-src`, `connect-src`) only serves the direct upload of E1, which does not exist yet; it
// enters with E1 (Lot 2), read from configuration.

/** J4S-3: outside production (staging, a workstation), nothing of `web` is ever indexed. */
export const NOINDEX = "noindex, nofollow, noarchive";

/**
 * The CSP of 03 §6.5. With a nonce (a page, through the proxy), the framework scripts and styles
 * carry it (Next.js reads it from the request's CSP). Without one (the relay, files, `_next`),
 * no inline script or style is allowed at all. `next dev` only: React needs `eval` for its
 * debugging stacks and the development server injects styles without a nonce; `next start`
 * (staging, production, T10) never sends either source.
 */
export function contentSecurityPolicy(
  nonce?: string,
  development = false,
): string {
  const nonceSource = nonce === undefined ? [] : [`'nonce-${nonce}'`];
  const scriptSources =
    nonce === undefined
      ? ["'self'"]
      : ["'self'", ...nonceSource, "'strict-dynamic'"];
  return [
    "default-src 'self'",
    `script-src ${[...scriptSources, ...(development ? ["'unsafe-eval'"] : [])].join(" ")}`,
    `style-src ${(development ? ["'self'", "'unsafe-inline'"] : ["'self'", ...nonceSource]).join(" ")}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** An unpredictable value, new for each request (18 T10). */
export function createNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64",
  );
}

/** The CSP of one page, with its own nonce (src/proxy.ts, per request). */
export function pageContentSecurityPolicy(): string {
  return contentSecurityPolicy(
    createNonce(),
    process.env.NODE_ENV === "development",
  );
}

/**
 * The headers of every response (21 §4 J4 point 5; 03 §6.5, R7). The proxy replaces the CSP of
 * the pages with that of their nonce. HSTS without `preload` until the domains are settled
 * (03 §6.5, J4S-8, integrateur).
 */
const BASE_SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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

/** The headers for an environment, read at build time from INFLUX_ENV (02 §12.3). */
export function securityHeadersFor(
  environment: string | undefined,
): readonly { key: string; value: string }[] {
  return environment === "production"
    ? BASE_SECURITY_HEADERS
    : [{ key: "X-Robots-Tag", value: NOINDEX }, ...BASE_SECURITY_HEADERS];
}

// Security headers of apps/backoffice (03 §6.5 and §7.1, 18 T10): those of apps/web, stricter.
// Read by next.config.ts (every response) and by src/proxy.ts (the CSP with a nonce, per request).

/**
 * Sent on EVERY response of the backoffice, rather than a robots.txt Disallow: a path forbidden
 * to crawlers is never read, so its noindex would never be seen (03 §7.1; D12). The relay sets it
 * on its own answers too; errors and redirects are checked by T10.4.
 */
export const NOINDEX = "noindex, nofollow, noarchive";

/**
 * The CSP of 03 §6.5 for the backoffice: no 'strict-dynamic', and `img-src 'self' blob:` without
 * the Supabase host (J3S-7): verification documents are relayed by apps/api, never served by a
 * signed URL. With a nonce (a page, through the proxy), the framework scripts and styles carry it;
 * without one (the relay, `_next`), no inline script or style is allowed. `next dev` only: React
 * needs `eval` and the development server injects styles without a nonce; `next start` never
 * sends either source.
 */
export function contentSecurityPolicy(
  nonce?: string,
  development = false,
): string {
  const nonceSource = nonce === undefined ? [] : [`'nonce-${nonce}'`];
  return [
    "default-src 'self'",
    `script-src ${["'self'", ...nonceSource, ...(development ? ["'unsafe-eval'"] : [])].join(" ")}`,
    `style-src ${(development ? ["'self'", "'unsafe-inline'"] : ["'self'", ...nonceSource]).join(" ")}`,
    "img-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
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
 * The headers of every response (21 §4 J4 point 5; 03 §6.5, R7): those of apps/web, with
 * `Referrer-Policy: no-referrer`. The proxy replaces the CSP of the pages with that of their
 * nonce. HSTS without `preload` until the domains are settled (J4S-8).
 */
export const SECURITY_HEADERS: readonly { key: string; value: string }[] = [
  { key: "X-Robots-Tag", value: NOINDEX },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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

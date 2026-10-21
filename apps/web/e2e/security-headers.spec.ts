// T10 on the production build (18 T10; 03 §6.5 and §7.1): `next build` then `next start`, as
// playwright.config.ts starts both fronts. The exact header set of every kind of response (page,
// redirect, 404, relay, file), the CSP with a nonce new for each request and carried by every
// script, and the CSP enforced by a real browser: the landing and the sign-up hydrate without a
// single violation, while an inline script and a request to another origin are refused (T10.6,
// the runtime replacement of G2, 18 §5). The values are written here as 03 §6.5 states them, never
// imported from the code under test. HSTS has no `preload` until the domains are settled
// (J4S-8, integrateur). T10.5 (cookies) is apps/api's: tests/auth-cookies.test.ts, relayed
// as is (03 PP-10).
import {
  request as httpClient,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { expect, open, test } from "./support/journey";
import {
  BACKOFFICE_ORIGIN,
  DOUBLE_ORIGIN,
  WEB_ORIGIN,
} from "./support/servers";

const NOINDEX = "noindex, nofollow, noarchive";
const NONCE = "(?<nonce>[A-Za-z0-9+/]{22}==)";

const COMMON_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
} as const;

/** apps/web runs as `development` here (playwright.config.ts): never indexed (J4S-3). */
const WEB_HEADERS = {
  ...COMMON_HEADERS,
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-robots-tag": NOINDEX,
};

const BACKOFFICE_HEADERS = {
  ...COMMON_HEADERS,
  "referrer-policy": "no-referrer",
  "x-robots-tag": NOINDEX,
};

function webPolicy(nonce: string | null): string {
  const scripts =
    nonce === null ? "'self'" : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const styles = nonce === null ? "'self'" : `'self' 'nonce-${nonce}'`;
  return (
    `default-src 'self'; script-src ${scripts}; style-src ${styles}; ` +
    "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; " +
    "frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'; " +
    "upgrade-insecure-requests"
  );
}

function backofficePolicy(nonce: string | null): string {
  const sources = nonce === null ? "'self'" : `'self' 'nonce-${nonce}'`;
  return (
    `default-src 'self'; script-src ${sources}; style-src ${sources}; ` +
    "img-src 'self' blob:; connect-src 'self'; font-src 'self'; " +
    "frame-ancestors 'none'; form-action 'self'; base-uri 'none'; object-src 'none'"
  );
}

/** The single CSP of a response (two headers would both apply), and its nonce if it has one. */
function policyOf(response: APIResponse): {
  policy: string;
  nonce: string | null;
} {
  const policies = response
    .headersArray()
    .filter(
      (header) => header.name.toLowerCase() === "content-security-policy",
    );
  expect(policies, "exactly one CSP header").toHaveLength(1);
  const policy = policies[0]?.value ?? "";
  return {
    policy,
    nonce: new RegExp(`'nonce-${NONCE}'`).exec(policy)?.groups?.nonce ?? null,
  };
}

async function fetchRaw(origin: string, path: string): Promise<APIResponse> {
  const client = await httpClient.newContext({ baseURL: origin });
  const response = await client.get(path, { maxRedirects: 0 });
  // The body is read before the context closes it.
  await response.body();
  return response;
}

function expectHeaders(
  response: APIResponse,
  expected: Readonly<Record<string, string>>,
): void {
  const headers = response.headers();
  expect(
    Object.fromEntries(
      Object.keys(expected).map((name) => [name, headers[name]]),
    ),
  ).toEqual(expected);
}

const WEB_PAGES = [
  ["/fr", 200],
  ["/en", 200],
  ["/fr/inscription/marque", 200],
  ["/en/signup/brand", 200],
  ["/fr/inscription/createur", 200],
  ["/en/signup/creator", 200],
  ["/fr/connexion", 200],
  ["/", 307],
  ["/fr/inscription/", 308],
  ["/fr/absente", 404],
] as const;

test.describe("T10.1 and T10.3: apps/web", () => {
  for (const [path, status] of WEB_PAGES) {
    test(`${path} (${status}): the exact headers and a CSP with its nonce`, async () => {
      const response = await fetchRaw(WEB_ORIGIN, path);
      expect(response.status()).toBe(status);
      expectHeaders(response, WEB_HEADERS);
      const { policy, nonce } = policyOf(response);
      expect(nonce).not.toBeNull();
      expect(policy).toBe(webPolicy(nonce));
      if (status === 200) {
        const html = await response.text();
        const scripts = html.match(/<script\b[^>]*>/g) ?? [];
        expect(scripts.length).toBeGreaterThan(0);
        expect(
          scripts.filter((tag) => !tag.includes(`nonce="${nonce}"`)),
        ).toEqual([]);
        // No inline style attribute: the CSP would refuse it (03 §6.5, no 'unsafe-inline').
        expect(html).not.toMatch(/\sstyle="/);
      }
    });
  }

  test("a new nonce for each request", async () => {
    const first = policyOf(await fetchRaw(WEB_ORIGIN, "/fr")).nonce;
    const second = policyOf(await fetchRaw(WEB_ORIGIN, "/fr")).nonce;
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  for (const path of ["/api/v1/status", "/absente.png"]) {
    test(`${path}, outside the proxy: the same headers, a CSP without nonce`, async () => {
      const response = await fetchRaw(WEB_ORIGIN, path);
      expectHeaders(response, WEB_HEADERS);
      expect(policyOf(response).policy).toBe(webPolicy(null));
    });
  }
});

const BACKOFFICE_PAGES = [
  ["/", 200],
  ["/accueil", 200],
  ["/accueil/", 308],
  ["/absente", 404],
] as const;

test.describe("T10.2 to T10.4: apps/backoffice", () => {
  for (const [path, status] of BACKOFFICE_PAGES) {
    test(`${path} (${status}): the exact headers, X-Robots-Tag included`, async () => {
      const response = await fetchRaw(BACKOFFICE_ORIGIN, path);
      expect(response.status()).toBe(status);
      expectHeaders(response, BACKOFFICE_HEADERS);
      const { policy, nonce } = policyOf(response);
      expect(nonce).not.toBeNull();
      expect(policy).toBe(backofficePolicy(nonce));
      expect(policy).not.toContain("supabase");
    });
  }

  for (const path of [
    "/api/v1/bo/status",
    "/api/v1/bo/absente",
    "/absente.png",
  ]) {
    test(`${path}, outside the proxy: X-Robots-Tag and a CSP without nonce`, async () => {
      const response = await fetchRaw(BACKOFFICE_ORIGIN, path);
      expectHeaders(response, BACKOFFICE_HEADERS);
      expect(policyOf(response).policy).toBe(backofficePolicy(null));
    });
  }
});

/** The CSP violations a page reports, collected from before its first script. */
async function watchViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.defineProperty(window, "__cspViolations", { value: seen });
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  return () =>
    page.evaluate(
      () =>
        (window as unknown as { __cspViolations: string[] }).__cspViolations,
    );
}

test.describe("T10.6: the CSP enforced by the browser", () => {
  for (const path of [
    "/fr",
    "/en",
    "/fr/inscription/marque",
    "/en/signup/creator",
  ]) {
    test(`${path} hydrates without a single violation`, async ({ page }) => {
      const violations = await watchViolations(page);
      // `open` answers the cookie banner: a click that only a hydrated page handles.
      await open(page, path);
      // The lazy images too: to the bottom of the page, then the time for them to load.
      await page.waitForLoadState("load");
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(1_000);
      expect(await violations()).toEqual([]);
    });
  }

  test("refuses an injected inline handler and a request to another origin", async ({
    page,
  }) => {
    const violations = await watchViolations(page);
    await open(page, "/fr");
    // Injected markup, as an XSS would write it. (A <script> appended by page.evaluate proves
    // nothing: the browser trusts the evaluator, and 'strict-dynamic' then trusts its script.)
    const outcome = await page.evaluate(async (otherOrigin) => {
      const holder = document.createElement("div");
      holder.innerHTML =
        '<img alt="" src="/absente-t10.png" onerror="window.__injected = true">';
      document.body.append(holder);
      let fetched = true;
      try {
        // eslint-disable-next-line no-restricted-globals -- the probe of T10.6: refused by the CSP
        await fetch(`${otherOrigin}/messages`);
      } catch {
        fetched = false;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        injected:
          (window as unknown as { __injected?: boolean }).__injected === true,
        fetched,
      };
    }, DOUBLE_ORIGIN);
    expect(outcome).toEqual({ injected: false, fetched: false });
    await expect
      .poll(async () => (await violations()).sort())
      .toEqual([
        `connect-src ${DOUBLE_ORIGIN}/messages`,
        "script-src-attr inline",
      ]);
  });
});

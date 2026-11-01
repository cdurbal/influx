// What the journeys share: the labels of the screens (the locale files themselves, never a copy:
// the wordings are provisional, RG127), the inbox of the Brevo double, and the steps of the
// journey as a member does them.
import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomInt } from "node:crypto";
import enAuth from "@/locales/en/auth.json" with { type: "json" };
import frAuth from "@/locales/fr/auth.json" with { type: "json" };
import { waitForHydration } from "./hydration";
import { mailboxAddress } from "./mailboxes";
import { BACKOFFICE_ORIGIN, DOUBLE_ORIGIN, WEB_ORIGIN } from "./servers";

export type Locale = "fr" | "en";
export type AuthLabels = typeof frAuth;

export const AUTH_LABELS: Readonly<Record<Locale, AuthLabels>> = {
  fr: frAuth,
  en: enAuth,
};

/** A random /64 of the documentation prefix (RFC 3849): one per journey. */
function documentationAddress(): string {
  const group = () => randomInt(0x10000).toString(16);
  return `2001:db8:${group()}:${group()}::1`;
}

/** The only origins a page of the journeys may reach: the two fronts (A-7). */
export const FRONT_ORIGINS: readonly string[] = [WEB_ORIGIN, BACKOFFICE_ORIGIN];

/** Not a network request: inline data and objects of the page itself. */
const LOCAL_SCHEMES = new Set(["data:", "blob:", "about:"]);

/** What the global net of the journeys caught (18 §9.3 A-7, TD8.1), in the order it happened. */
export type ForeignTraffic = { findings: () => readonly string[] };

/** The binding through which the pages report their CSP violations, across navigations. */
const CSP_BINDING = "__influxReportCspViolation";

/** A request leaving the fronts, or null for a front or a local scheme. */
export function foreignRequest(url: string): string | null {
  const parsed = new URL(url);
  if (LOCAL_SCHEMES.has(parsed.protocol)) return null;
  return FRONT_ORIGINS.includes(parsed.origin) ? null : `request ${url}`;
}

/** Records the foreign requests and the CSP violations of every page of a browser context. */
async function watchContext(
  context: BrowserContext,
  findings: string[],
): Promise<void> {
  context.on("request", (request) => {
    const finding = foreignRequest(request.url());
    if (finding !== null) findings.push(finding);
  });
  await context.exposeBinding(CSP_BINDING, (_source, violation: string) => {
    findings.push(`csp ${violation}`);
  });
  await context.addInitScript((binding) => {
    document.addEventListener("securitypolicyviolation", (event) => {
      const report = (window as unknown as Record<string, unknown>)[binding];
      if (typeof report === "function") {
        report(`${event.effectiveDirective} ${event.blockedURI}`);
      }
    });
  }, CSP_BINDING);
}

/**
 * Each journey comes from its own client address, sent as `x-real-ip` (what Railway's edge
 * writes, relayed by apps/web, 03 PP-6): the code requests per IP (05 RG44) then count per
 * journey, and a run never inherits the counters of the runs before it within the hour.
 *
 * The global net (18 §9.3 A-7, TD8.1): a request of a page to any origin but the two fronts, or a
 * CSP violation, fails the journey, in its own context and in those it opens from the browser
 * (a second person of the backoffice). The requests of the test runner itself (`page.request`,
 * the Brevo double's inbox) are not the page's. `foreignTraffic: "record"` is the explicit option
 * of the tests that provoke such traffic on purpose (T10.6, and the self-check of the net): they
 * read what was caught instead of failing.
 */
export const test = base.extend<{
  foreignTrafficMode: "fail" | "record";
  foreignTraffic: ForeignTraffic;
}>({
  foreignTrafficMode: ["fail", { option: true }],
  foreignTraffic: [
    async ({ browser, context, foreignTrafficMode }, provide) => {
      const findings: string[] = [];
      await watchContext(context, findings);
      // The contexts a test opens itself go through browser.newContext: watched alike, for the
      // time of the test only.
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (options) => {
        const opened = await newContext(options);
        await watchContext(opened, findings);
        return opened;
      };
      try {
        await provide({ findings: () => [...findings] });
      } finally {
        browser.newContext = newContext;
      }
      if (foreignTrafficMode === "fail") {
        expect(
          findings,
          "A-7: a request outside the fronts or a CSP violation",
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
  page: async ({ page, foreignTraffic }, provide) => {
    // foreignTraffic is named so that the net is in place before the page exists.
    void foreignTraffic;
    await page.setExtraHTTPHeaders({ "x-real-ip": documentationAddress() });
    await provide(page);
  },
});

export { expect, mailboxAddress };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A message with one ICU argument, as a pattern whose group 1 is the argument. */
export function messagePattern(message: string, argument: string): RegExp {
  const [before = "", after = ""] = message.split(`{${argument}}`);
  return new RegExp(`${escapeRegExp(before)}(.+?)${escapeRegExp(after)}`);
}

/** A message with one ICU argument, filled. */
export function fill(message: string, argument: string, value: string): string {
  return message.replace(`{${argument}}`, value);
}

type DoubleMessage = {
  to?: { email?: string }[];
  textContent?: string;
};

/** The code e-mails received by an address, oldest first, read in the double (loopback). */
export async function messagesTo(
  page: Page,
  address: string,
): Promise<string[]> {
  const response = await page.request.get(`${DOUBLE_ORIGIN}/messages`);
  const messages = (await response.json()) as DoubleMessage[];
  return messages
    .filter((message) => message.to?.[0]?.email === address)
    .map((message) => message.textContent ?? "");
}

/** The last code e-mail of an address: its six digits on their own line, and its whole text. */
export async function lastCodeEmail(
  page: Page,
  address: string,
): Promise<{ code: string; text: string }> {
  let text = "";
  await expect
    .poll(async () => {
      text = (await messagesTo(page, address)).at(-1) ?? "";
      return /^\d{6}$/m.test(text);
    })
    .toBe(true);
  const code = /^(\d{6})$/m.exec(text)?.[1] ?? "";
  return { code, text };
}

/**
 * A full load of a page of the journey (the cookie banner is off: no tracker, EC-J9-3), returned
 * once the page is hydrated: a gesture made before would be lost (EC-PL-01-1).
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForHydration(page);
}

/** A reload of the page on screen (D66: the journey resumes from apps/api's cookies). */
export async function reload(page: Page): Promise<void> {
  await page.reload();
  await waitForHydration(page);
}

export function title(page: Page) {
  return page.locator("h1");
}

/** The matching phrase shown above the code field (05 RG48). */
export function matchingPhrase(page: Page, t: AuthLabels) {
  return page
    .getByRole("region", { name: t.step2.phrase.label })
    .locator("p")
    .first();
}

/** The resend countdown of screen 2 (05 RG50). */
export function countdown(page: Page, t: AuthLabels) {
  return page.getByText(messagePattern(t.code.resend.countdown, "seconds"));
}

/** Screen 1: types the address and asks for a code; ends on screen 2. */
export async function requestCode(
  page: Page,
  t: AuthLabels,
  address: string,
): Promise<void> {
  await expect(title(page)).toContainText(t.step1.title);
  await page.getByLabel(t.step1.emailLabel).fill(address);
  await page.getByRole("button", { name: t.step1.submit }).click();
  await expect(title(page)).toContainText(t.step2.title);
}

/**
 * Screen 2: reads the code in the double, checks that the e-mail carries the phrase on screen
 * (RG48), and types it; the sixth digit sends it (17 §3.2).
 */
export async function enterCode(
  page: Page,
  t: AuthLabels,
  address: string,
): Promise<void> {
  const email = await lastCodeEmail(page, address);
  const phrase = (await matchingPhrase(page, t).textContent()) ?? "";
  expect(phrase).not.toBe("");
  expect(email.text).toContain(phrase);
  await page.getByLabel(t.step2.codeLabel).fill(email.code);
}

/** The language link of the page, a client navigation (D66). */
export async function switchLanguage(
  page: Page,
  from: AuthLabels,
  to: Locale,
): Promise<void> {
  await page
    .getByRole("navigation", { name: from.language.label })
    .getByRole("link", { name: AUTH_LABELS[to].language[to] })
    .click();
}

export function termsBox(page: Page, t: AuthLabels) {
  return page.getByRole("checkbox", { name: t.signup.terms.label });
}

export function consentBox(
  page: Page,
  t: AuthLabels,
  door: "advertiser" | "creator",
) {
  return page.getByRole("checkbox", {
    name: t.signup.consent[door].label,
  });
}

/**
 * The creator door, already open (by its address or by an invitation link): the code, the details
 * of a French individual, the terms and the consent, up to the success screen.
 */
export async function signUpAsCreator(
  page: Page,
  t: AuthLabels,
  address: string,
): Promise<void> {
  await requestCode(page, t, address);
  await enterCode(page, t, address);
  await page.getByLabel(t.signup.country.label.creator).selectOption("FR");
  await page
    .getByRole("radio", { name: t.signup.status.individual, exact: true })
    .check();
  await page.getByRole("checkbox", { name: t.signup.adult.label }).check();
  await termsBox(page, t).check();
  await consentBox(page, t, "creator").check();
  await page.getByRole("button", { name: t.signup.submit }).click();
  await expect(title(page)).toContainText(t.signup.success.title);
}

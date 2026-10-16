// What the journeys share: the labels of the screens (the locale files themselves, never a copy:
// the wordings are provisional, RG127), the inbox of the Brevo double, and the steps of the
// journey as a member does them.
import { expect, test as base, type Page } from "@playwright/test";
import { randomInt } from "node:crypto";
import enAuth from "@/locales/en/auth.json" with { type: "json" };
import frAuth from "@/locales/fr/auth.json" with { type: "json" };
import enLanding from "@/locales/en/landing.json" with { type: "json" };
import frLanding from "@/locales/fr/landing.json" with { type: "json" };
import { mailboxAddress } from "./mailboxes";
import { DOUBLE_ORIGIN } from "./servers";

export type Locale = "fr" | "en";
export type AuthLabels = typeof frAuth;

export const AUTH_LABELS: Readonly<Record<Locale, AuthLabels>> = {
  fr: frAuth,
  en: enAuth,
};

const COOKIE_BANNER_LABELS: Readonly<
  Record<Locale, typeof frLanding.cookieBanner>
> = {
  fr: frLanding.cookieBanner,
  en: enLanding.cookieBanner,
};

/** A random /64 of the documentation prefix (RFC 3849): one per journey. */
function documentationAddress(): string {
  const group = () => randomInt(0x10000).toString(16);
  return `2001:db8:${group()}:${group()}::1`;
}

/**
 * Each journey comes from its own client address, sent as `x-real-ip` (what Railway's edge
 * writes, relayed by apps/web, 03 PP-6): the code requests per IP (05 RG44) then count per
 * journey, and a run never inherits the counters of the runs before it within the hour.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
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

function localeOf(page: Page): Locale {
  return new URL(page.url()).pathname.startsWith("/en/") ? "en" : "fr";
}

/**
 * The cookie banner opens at each full load (its choice is kept in memory only, at this lot) and
 * covers the bottom of screen 3: the member answers it first, as a person would.
 */
async function answerCookieBanner(page: Page): Promise<void> {
  const labels = COOKIE_BANNER_LABELS[localeOf(page)];
  await page
    .getByRole("region", { name: labels.regionLabel })
    .getByRole("button", { name: labels.reject })
    .click();
}

/** A full load of a page of the journey. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await answerCookieBanner(page);
}

/** A full load that leaves the cookie banner open, unanswered. */
export async function openWithBanner(page: Page, path: string): Promise<void> {
  await page.goto(path);
}

/** The cookie banner region of the page. */
export function cookieBanner(page: Page) {
  return page.getByRole("region", {
    name: COOKIE_BANNER_LABELS[localeOf(page)].regionLabel,
  });
}

/** Refuses all cookies in the banner. */
export async function rejectCookies(page: Page): Promise<void> {
  await answerCookieBanner(page);
}

/** A reload of the page on screen (D66: the journey resumes from apps/api's cookies). */
export async function reload(page: Page): Promise<void> {
  await page.reload();
  await answerCookieBanner(page);
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

// The e-mails `account.welcome_advertiser` and `account.welcome_creator` (05 RG86, RG76; 16 RG90).
// Queued P1 at the creation of the account and written by the worker at consumption from INFLUX's
// translation files (src/locales/<language>/email.json); Brevo only carries them (16 RG67, D69).
// One text per role, in the account's language, whatever the marketing consent; no promotional
// content (RG86), no amount nor percentage (D48), no link of any kind (D69: the RG158 output check
// holds on every e-mail INFLUX writes), no name, no address.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import { escapeHtml, format, type RenderedEmail } from "./login-code-email.ts";

type EmailMessages = typeof french;

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

export type WelcomeRole = "advertiser" | "creator";

export type WelcomeEmailInput = {
  /** The account's language (05 RG15). */
  locale: UiLocale;
  /** The role of the e-mail code, never guessed from anything else. */
  role: WelcomeRole;
};

export function renderWelcomeEmail(input: WelcomeEmailInput): RenderedEmail {
  const { locale, role } = input;
  const messages = MESSAGES[locale];
  const texts =
    role === "advertiser"
      ? messages.email.account.welcomeAdvertiser
      : messages.email.account.welcomeCreator;
  const why = format(
    messages.email.transactional.why,
    { reason: texts.reason },
    locale,
    "UTC",
  );
  const paragraphs = [
    texts.intro,
    texts.how,
    texts.together,
    texts.signIn,
    texts.never,
  ];
  const text = [
    texts.title,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    why,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(texts.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(texts.preheader)}</div>`,
    `<h1>${escapeHtml(texts.title)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: texts.subject, html, text };
}

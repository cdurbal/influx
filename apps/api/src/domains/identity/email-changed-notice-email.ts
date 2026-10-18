// The e-mail `auth.email_changed_notice` (05 RG58; 16 table of the transactional codes): once both
// confirmations are in, BOTH addresses are told, each with its own text (`previous`: this address
// is no longer the account's; `current`: it now is). Written by the worker at consumption from
// INFLUX's translation files; Brevo only carries it (16 RG67, D69). Neither text names the other
// address, nor holds a link of any kind (RG158 output check).
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import { escapeHtml, format, type RenderedEmail } from "./login-code-email.ts";

type EmailMessages = typeof french;

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/** The side of the line's payload (RG58): the old address or the new one. */
export type EmailChangedNoticeSide = "previous" | "current";

export type EmailChangedNoticeInput = {
  /** The account's language. */
  locale: UiLocale;
  side: EmailChangedNoticeSide;
};

export function renderEmailChangedNoticeEmail(
  input: EmailChangedNoticeInput,
): RenderedEmail {
  const { locale, side } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.auth.emailChangedNotice[side];
  const steps = [texts.step1, texts.step2];
  const why = format(
    messages.email.transactional.why,
    { reason: texts.reason },
    locale,
    "UTC",
  );
  const text = [
    texts.title,
    "",
    texts.body,
    "",
    texts.notYou,
    ...steps.map((step, index) => `${String(index + 1)}. ${step}`),
    "",
    texts.never,
    "",
    why,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(texts.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(texts.preheader)}</div>`,
    `<h1>${escapeHtml(texts.title)}</h1>`,
    `<p>${escapeHtml(texts.body)}</p>`,
    `<p>${escapeHtml(texts.notYou)}</p>`,
    `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`,
    `<p>${escapeHtml(texts.never)}</p>`,
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: texts.subject, html, text };
}

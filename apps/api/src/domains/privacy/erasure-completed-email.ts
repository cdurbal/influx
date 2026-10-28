// The e-mail `privacy.erasure_completed`: the account is deleted (D72; 16 RG160 bis; zone-de-danger
// fiche §2.3). Queued P1 by privacy.execute_request() (0150) and written by the worker at
// consumption from INFLUX's translation files, like privacy.export_ready. It is the ANSWER of the
// request (art. 12(3)): what was deleted, what is kept and why, and that a new sign-up is a new
// account. Unlike the acknowledgement (RG160) it states a fact already done. To the address held
// since the execution only, no link, no domain, no address, nothing but the date of the deletion
// (RG158 output check). Dates in the account's time zone, with its name.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  escapeHtml,
  format,
  timeZoneName,
  type RenderedEmail,
} from "../identity/login-code-email.ts";

type EmailMessages = typeof french;

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

export type ErasureCompletedEmailInput = {
  /** The account's language, captured at the execution. */
  locale: UiLocale;
  /** The instant of the deletion (privacy.request_executions.executed_at). */
  erasedAt: Date;
  /** The account's time zone (IANA), UTC by default. */
  timeZone: string;
};

export function renderErasureCompletedEmail(
  input: ErasureCompletedEmailInput,
): RenderedEmail {
  const { locale, timeZone, erasedAt } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.privacy.erasureCompleted;
  const done = format(
    texts.done,
    { erasedAt, timeZone: timeZoneName(locale, timeZone, erasedAt) },
    locale,
    timeZone,
  );
  const preheader = format(texts.preheader, { erasedAt }, locale, timeZone);
  const why = format(
    messages.email.transactional.why,
    { reason: texts.reason },
    locale,
    timeZone,
  );
  const paragraphs = [
    done,
    texts.deleted,
    texts.kept,
    texts.newAccount,
    texts.notYou,
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
    `<div style="display:none">${escapeHtml(preheader)}</div>`,
    `<h1>${escapeHtml(texts.title)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: texts.subject, html, text };
}

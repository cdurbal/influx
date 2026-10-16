// The e-mail `privacy.export_ready`: the export of a "mes données" request is published (15 RG75
// step 7; runbook demandes-rgpd §4, expert-cybersecurite 2026-10-14; J8 commit 8). Queued P1 by
// privacy.execute_request() (0136) and written by the worker at consumption from INFLUX's
// translation files, like privacy.request_received (16 RG67, RG160). It says WHERE the file is
// (Mon compte › Mes données) and UNTIL WHEN, to the account's address only: no attachment, no link,
// no token, no domain (RG158 output check). Dates in the account's time zone, with its name.
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

export type ExportReadyEmailInput = {
  /** The account's language. */
  locale: UiLocale;
  /** The end of the export's availability (privacy.data_exports.expires_at). */
  expiresAt: Date;
  /** The account's time zone (IANA), UTC by default. */
  timeZone: string;
};

export function renderExportReadyEmail(
  input: ExportReadyEmailInput,
): RenderedEmail {
  const { locale, timeZone, expiresAt } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.privacy.exportReady;
  // The steps of a request one did not make are those of the acknowledgement (16 RG160).
  const received = messages.email.privacy.requestReceived;
  const available = format(
    texts.available,
    { expiresAt, timeZone: timeZoneName(locale, timeZone, expiresAt) },
    locale,
    timeZone,
  );
  const preheader = format(texts.preheader, { expiresAt }, locale, timeZone);
  const steps = [received.step1, received.step2, received.step3];
  const why = format(
    messages.email.transactional.why,
    { reason: texts.reason },
    locale,
    timeZone,
  );
  const paragraphs = [
    available,
    texts.howTo,
    texts.content,
    texts.noAttachment,
  ];
  const text = [
    texts.title,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    texts.notYou,
    ...steps.map((step, index) => `${String(index + 1)}. ${step}`),
    "",
    received.never,
    "",
    why,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(texts.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(preheader)}</div>`,
    `<h1>${escapeHtml(texts.title)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(texts.notYou)}</p>`,
    `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`,
    `<p>${escapeHtml(received.never)}</p>`,
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: texts.subject, html, text };
}

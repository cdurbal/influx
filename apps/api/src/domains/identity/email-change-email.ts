// The e-mails `auth.email_change_confirm_old` and `auth.email_change_confirm_new` (docs/mvp/05 RG58;
// 16 §H, RG67; 03 A-11; J7 decision 5). Sent synchronously by apps/api, one per side of a request;
// texts in src/locales/<language>/email.json, Brevo only carries them (16 RG67). The order of the
// body follows auth.login_code: title, code, validity, context, "not you?", "never", reason.
// No address (neither the old nor the new one), no link, no image, no name, no browser: the code
// is typed in the member space, never followed from the mailbox (decision 5). The subject and the
// preheader never hold the code (CA76).
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  escapeHtml,
  format,
  timeZoneName,
  type RenderedEmail,
} from "./login-code-email.ts";

type EmailMessages = typeof french;

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

export type EmailChangeSide = "old" | "new";

export type EmailChangeEmailInput = {
  side: EmailChangeSide;
  /** The account's language (05 RG15): both e-mails of a request speak it. */
  locale: UiLocale;
  code: string;
  requestedAt: Date;
  timeZone: string;
};

function textsOf(locale: UiLocale, side: EmailChangeSide) {
  const auth = MESSAGES[locale].email.auth;
  return side === "old"
    ? auth.emailChangeConfirmOld
    : auth.emailChangeConfirmNew;
}

export function renderEmailChangeEmail(
  input: EmailChangeEmailInput,
): RenderedEmail {
  const { locale, timeZone } = input;
  const texts = textsOf(locale, input.side);
  const zone = timeZoneName(locale, timeZone, input.requestedAt);
  const paragraphs = [
    texts.validity,
    format(
      texts.context,
      { requestedAt: input.requestedAt, timeZone: zone },
      locale,
      timeZone,
    ),
    texts.notYou,
    texts.never,
    format(
      MESSAGES[locale].email.transactional.why,
      { reason: texts.reason },
      locale,
      timeZone,
    ),
  ];
  const text = [
    texts.title,
    "",
    texts.codeIntro,
    "",
    input.code,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
  ]
    .join("\n")
    .trimEnd();
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(texts.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(texts.preheader)}</div>`,
    `<h1>${escapeHtml(texts.title)}</h1>`,
    `<p>${escapeHtml(texts.codeIntro)}</p>`,
    `<p style="font-size:32px;letter-spacing:4px;font-weight:bold">${escapeHtml(input.code)}</p>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    "</body></html>",
  ].join("");
  return { subject: texts.subject, html, text };
}

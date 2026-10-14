// The e-mail `auth.new_device`, "nouveau navigateur" (docs/mvp/16 RG157, RG158; 05 RG141, RG142,
// RG144; 21 EC-43). Queued P1 by the verification of a sign-in code (identity.signal_new_browser(),
// 0126) and written by the worker at consumption from INFLUX's translation files
// (src/locales/<language>/email.json); Brevo only carries it (16 RG67). Order of the body, as
// RG157 lists it: title, body, "if it was you", "if it was not you" and its three steps, "never",
// reason. No link of any kind (RG158), no image, no country, no place, no IP address, no name,
// never "appareil inconnu" nor "connexion suspecte" (RG144).
import type { UiLocale } from "@influx/contracts/auth";
import type { UserAgentSummary } from "@influx/contracts/user-agent";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  browserLabel,
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

export type NewDeviceEmailInput = {
  /** The account's language (05 RG15). */
  locale: UiLocale;
  /** The opening of the session that raised the signal. */
  signedInAt: Date;
  timeZone: string;
  browser: UserAgentSummary;
};

export function renderNewDeviceEmail(
  input: NewDeviceEmailInput,
): RenderedEmail {
  const { locale, timeZone } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.auth.newDevice;
  // RG157: an unidentified summary is "un navigateur non identifié", never left out.
  const browser =
    browserLabel(locale, input.browser) ?? messages.auth.browser.unidentified;
  const values = {
    browser,
    signedInAt: input.signedInAt,
    timeZone: timeZoneName(locale, timeZone, input.signedInAt),
  };
  const body = format(texts.body, values, locale, timeZone);
  const preheader = format(texts.preheader, values, locale, timeZone);
  const steps = [texts.step1, texts.step2, texts.step3];
  const why = format(
    messages.email.transactional.why,
    { reason: texts.reason },
    locale,
    timeZone,
  );
  const text = [
    texts.title,
    "",
    body,
    "",
    texts.ifYou,
    "",
    texts.ifNotYou,
    ...steps.map((step, index) => `${String(index + 1)}. ${step}`),
    "",
    texts.never,
    "",
    why,
  ].join("\n");
  const html = [
    `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(texts.subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(preheader)}</div>`,
    `<h1>${escapeHtml(texts.title)}</h1>`,
    `<p>${escapeHtml(body)}</p>`,
    `<p>${escapeHtml(texts.ifYou)}</p>`,
    `<p>${escapeHtml(texts.ifNotYou)}</p>`,
    `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`,
    `<p>${escapeHtml(texts.never)}</p>`,
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject: texts.subject, html, text };
}

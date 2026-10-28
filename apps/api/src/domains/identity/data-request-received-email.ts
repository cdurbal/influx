// The e-mail `privacy.request_received`, the acknowledgement of a "mes données" request (docs/mvp/16
// RG160, CA117; 15 RG73; J7 decision 6, EC-14). Queued P1 by backoffice.submit_data_subject_request()
// (0120) and written by the worker at consumption from INFLUX's translation files
// (src/locales/<language>/email.json), like auth.new_device (16 RG67, RG157): decision of architecte
// on 2026-10-14, no Brevo template. Order of the body, as RG160 point 6 lists it: title, receipt,
// what happens next, deadline, where to follow it, "not you?" and its three steps, "never", reason.
// No link of any kind, no domain, no address in the text (RG160 point 5); never a promise of
// execution, never the internal goal of 10 days. Export requests only: an erasure deposited from the
// space is authorised by the member and answered by privacy.erasure_completed (D72, RG160 bis).
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

/** The one type that is acknowledged (D72): any other, an erasure included, is never acknowledged. */
export type AcknowledgedRequestType = "access";

export type DataRequestReceivedEmailInput = {
  /** The account's language (16 RG160 point 3). */
  locale: UiLocale;
  type: AcknowledgedRequestType;
  receivedAt: Date;
  dueAt: Date;
  /** The account's time zone (IANA), UTC by default. */
  timeZone: string;
};

/** The calendar date of an instant in a time zone, comparable as a string (YYYY-MM-DD). */
function calendarDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * RG160: the deadline is the calendar date of due_at in the account's time zone, unless that date
 * falls after the one in UTC: a deadline later than the database's is never announced.
 */
export function deadlineTimeZone(dueAt: Date, timeZone: string): string {
  return calendarDate(dueAt, timeZone) > calendarDate(dueAt, "UTC")
    ? "UTC"
    : timeZone;
}

export function renderDataRequestReceivedEmail(
  input: DataRequestReceivedEmailInput,
): RenderedEmail {
  const { locale, type, timeZone } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.privacy.requestReceived;
  const dueTimeZone = deadlineTimeZone(input.dueAt, timeZone);
  const due = { dueAt: input.dueAt };
  const received = format(
    texts.received[type],
    {
      receivedAt: input.receivedAt,
      timeZone: timeZoneName(locale, timeZone, input.receivedAt),
    },
    locale,
    timeZone,
  );
  const preheader = format(texts.preheader, due, locale, dueTimeZone);
  const deadline = format(texts.deadline, due, locale, dueTimeZone);
  const subject = texts.subject[type];
  const title = texts.title[type];
  const steps = [texts.step1, texts.step2, texts.step3];
  const why = format(
    messages.email.transactional.why,
    { reason: texts.reason },
    locale,
    timeZone,
  );
  const paragraphs = [received, texts.next[type], deadline];
  const text = [
    title,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    texts.followUp,
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
    `<title>${escapeHtml(subject)}</title></head><body>`,
    `<div style="display:none">${escapeHtml(preheader)}</div>`,
    `<h1>${escapeHtml(title)}</h1>`,
    ...paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    `<p>${escapeHtml(texts.followUp)}</p>`,
    `<p>${escapeHtml(texts.notYou)}</p>`,
    `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`,
    `<p>${escapeHtml(texts.never)}</p>`,
    `<p>${escapeHtml(why)}</p>`,
    "</body></html>",
  ].join("");
  return { subject, html, text };
}

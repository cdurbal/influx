// The e-mail `internal.critical_alert` (docs/mvp/16 §H, RG86; 21 §3 EC-44; J6 start decision 1).
// Fixed content, French then English in the same e-mail (D36, language of the backoffice, is
// open): the type of the alert, its UTC instant, the audit reference and, for a recovery code,
// the codes left (MFA-4). NEVER an address, an IP, a browser, a name nor a code: the recipient
// reads the rest in the audit register. Texts live in src/locales/<language>/email.json.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import type { RenderedEmail } from "./login-code-email.ts";

/** The two audit events that raise the alert (EC-44 (1)). */
export type CriticalAlertEvent =
  "agent.break_glass_login" | "agent.recovery_code_consumed";

export type CriticalAlertEmailInput = {
  eventType: CriticalAlertEvent;
  occurredAt: Date;
  /** The seq of the audit line, as the register shows it. */
  auditReference: string;
  /** Codes left after a recovery code; null for a break-glass sign-in. */
  recoveryCodesLeft: number | null;
};

/** French first: the order of the bilingual body. */
const LANGUAGES: readonly { locale: UiLocale; texts: Texts }[] = [
  { locale: "fr", texts: french.email.internal.criticalAlert },
  { locale: "en", texts: english.email.internal.criticalAlert },
];

type Texts = typeof french.email.internal.criticalAlert;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** `{name}`, `{name, date, long}` and `{name, time, medium}` (24 h), always in UTC. */
function format(
  template: string,
  values: Readonly<Record<string, string | number | Date>>,
  locale: UiLocale,
): string {
  return template.replace(
    /\{(\w+)(?:, (date|time), (long|medium))?\}/g,
    (_match, name: string, kind?: string) => {
      const value = values[name];
      if (value === undefined) {
        throw new Error(`missing value for {${name}}`);
      }
      if (kind === undefined) {
        return String(value);
      }
      if (!(value instanceof Date)) {
        throw new Error(`{${name}} is not a date`);
      }
      const options: Intl.DateTimeFormatOptions =
        kind === "date"
          ? { dateStyle: "long", timeZone: "UTC" }
          : {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hourCycle: "h23",
              timeZone: "UTC",
            };
      return new Intl.DateTimeFormat(locale, options).format(value);
    },
  );
}

function paragraphsOf(
  input: CriticalAlertEmailInput,
  locale: UiLocale,
  texts: Texts,
): string[] {
  const fact =
    input.eventType === "agent.break_glass_login"
      ? texts.breakGlassLogin
      : format(
          texts.recoveryCodeConsumed,
          { remaining: input.recoveryCodesLeft ?? 0 },
          locale,
        );
  return [
    fact,
    format(texts.occurredAt, { occurredAt: input.occurredAt }, locale),
    format(texts.auditReference, { reference: input.auditReference }, locale),
    texts.action,
  ];
}

export function renderCriticalAlertEmail(
  input: CriticalAlertEmailInput,
): RenderedEmail {
  const subject = french.email.internal.criticalAlert.subject;
  const blocks = LANGUAGES.map(({ locale, texts }) => ({
    locale,
    title: texts.title,
    paragraphs: paragraphsOf(input, locale, texts),
  }));
  const text = blocks
    .flatMap((block) => [
      block.title,
      "",
      ...block.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ])
    .join("\n")
    .trimEnd();
  const html = [
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">`,
    `<title>${escapeHtml(subject)}</title></head><body>`,
    ...blocks.map(
      (block) =>
        `<div lang="${block.locale}"><h1>${escapeHtml(block.title)}</h1>` +
        block.paragraphs
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join("") +
        "</div>",
    ),
    "</body></html>",
  ].join("");
  return { subject, html, text };
}

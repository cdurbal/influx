// The e-mail `auth.login_code` (docs/mvp/16 RG156, RG158, RG159; 05 RG49, RG135; 03 A-7, A-8).
// Texts live in INFLUX's translation files (src/locales/<language>/email.json); Brevo only
// carries them (16 RG67). Order of the body, imposed: title, code, phrase, validity, context,
// "not you?", "never", reason. No link, no image, no country, no IP address, no name, no role,
// nothing that says whether an account exists; the same e-mail for a sign-up and a sign-in.
// The subject and the preheader never hold the code nor the phrase (CA76).
import type { UiLocale } from "@influx/contracts/auth";
import {
  UNIDENTIFIED_USER_AGENT,
  type UserAgentFamily,
  type UserAgentSummary,
  type UserAgentSystem,
} from "@influx/contracts/user-agent";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };

type EmailMessages = typeof french;

const MESSAGES: Readonly<Record<UiLocale, EmailMessages>> = {
  fr: french,
  en: english,
};

/** Browser and system names are not translated (05, additif du J3, "Nouvelles clés"). */
const FAMILY_NAMES: Readonly<Record<UserAgentFamily, string>> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  safari: "Safari",
  samsung_internet: "Samsung Internet",
  opera: "Opera",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

const SYSTEM_NAMES: Readonly<Record<UserAgentSystem, string>> = {
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
  chromeos: "ChromeOS",
};

/** The time zone of the e-mail: the account's, otherwise UTC (05 RG135). */
export const DEFAULT_EMAIL_TIME_ZONE = "UTC";

export type LoginCodeEmailInput = {
  /** Language of the text (05 RG49). */
  locale: UiLocale;
  code: string;
  /** In the language of the PAGE, as shown on the screen (05 RG129). */
  phrase: string;
  requestedAt: Date;
  timeZone: string;
  /** The closed-list summary, never the raw agent (05 Q14 point 5). */
  browser: UserAgentSummary;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

type Values = Readonly<Record<string, string | Date>>;

/**
 * A minimal ICU formatter: `{name}`, `{name, date, long}` and `{name, time, short}`, the only
 * forms of these templates. A missing value is a programming error.
 */
function format(
  template: string,
  values: Values,
  locale: UiLocale,
  timeZone: string,
): string {
  return template.replace(
    /\{(\w+)(?:, (date|time), (long|short))?\}/g,
    (_match, name: string, kind?: string, style?: string) => {
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
          ? { dateStyle: style === "long" ? "long" : "short", timeZone }
          : { timeStyle: style === "long" ? "long" : "short", timeZone };
      return new Intl.DateTimeFormat(locale, options).format(value);
    },
  );
}

/** Name of the time zone as the language of the text writes it (`UTC`). */
function timeZoneName(locale: UiLocale, timeZone: string, at: Date): string {
  const part = new Intl.DateTimeFormat(locale, {
    timeZone,
    timeZoneName: "short",
  })
    .formatToParts(at)
    .find((item) => item.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** The translated label of a summary, or null for "unidentified" (then contextNoBrowser). */
export function browserLabel(
  locale: UiLocale,
  summary: UserAgentSummary,
): string | null {
  if (summary === UNIDENTIFIED_USER_AGENT) {
    return null;
  }
  const [family, system] = summary.split(".") as [
    UserAgentFamily,
    UserAgentSystem,
  ];
  const familyName = FAMILY_NAMES[family];
  const systemName = SYSTEM_NAMES[system];
  const labels = MESSAGES[locale].auth.browser;
  return format(
    labels.summary,
    { family: familyName, os: systemName },
    locale,
    DEFAULT_EMAIL_TIME_ZONE,
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderLoginCodeEmail(
  input: LoginCodeEmailInput,
): RenderedEmail {
  const { locale, timeZone } = input;
  const messages = MESSAGES[locale];
  const texts = messages.email.auth.loginCode;
  const browser = browserLabel(locale, input.browser);
  const zone = timeZoneName(locale, timeZone, input.requestedAt);
  const context =
    browser === null
      ? format(
          texts.contextNoBrowser,
          { requestedAt: input.requestedAt, timeZone: zone },
          locale,
          timeZone,
        )
      : format(
          texts.context,
          { requestedAt: input.requestedAt, timeZone: zone, browser },
          locale,
          timeZone,
        );
  const paragraphs = [
    format(texts.phrase, { phrase: input.phrase }, locale, timeZone),
    texts.phraseHelp,
    texts.validity,
    context,
    texts.notYou,
    texts.never,
    format(
      messages.email.transactional.why,
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

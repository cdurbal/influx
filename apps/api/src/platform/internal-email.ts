// The internal e-mails of INFLUX (docs/mvp/16 §H; D36: French then English in the same e-mail, the
// language of the backoffice being open): the critical alert of EC-44 (domains/identity) and the
// technical alerts of D60 (domains/ops, 15 RG165). Fixed texts from src/locales/<language>/
// email.json, values formatted here, always in UTC; never an address, an IP, a name nor a code.
import type { UiLocale } from "@influx/contracts/auth";

/** What the transactional sender takes from a rendered e-mail (same shape as login-code-email.ts). */
export type RenderedInternalEmail = {
  subject: string;
  html: string;
  text: string;
};

/** One language of the bilingual body. */
export type InternalEmailBlock = {
  locale: UiLocale;
  title: string;
  paragraphs: readonly string[];
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** `{name}`, `{name, date, long}` and `{name, time, medium}` (24 h), always in UTC. */
export function formatInternalText(
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

/** The text and HTML bodies of the blocks, French first, as given. */
export function renderInternalEmail(
  subject: string,
  blocks: readonly InternalEmailBlock[],
): RenderedInternalEmail {
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

// The e-mail `internal.technical_alert` (15 RG165; 02 §20.5): written by INFLUX (D69), French then
// English in one e-mail (D36), like the critical alert of EC-44 whose rendering it shares. It
// carries the code, the title, the instants in UTC, the measured value and the threshold, the
// expected action; NEVER anything of 02 §20.8 (no address, IP, URL, nor raw error message): the
// values are counts, shares, durations, codes, route models and identifiers. Texts live in
// src/locales/<language>/email.json.
import type { UiLocale } from "@influx/contracts/auth";
import english from "../../locales/en/email.json" with { type: "json" };
import french from "../../locales/fr/email.json" with { type: "json" };
import {
  formatInternalText as format,
  renderInternalEmail,
  type RenderedInternalEmail,
} from "../../platform/internal-email.ts";
import { DURATION_BUCKETS_MS } from "./buckets.ts";
import type {
  AlertValue,
  ErrorGroupSighting,
  NotificationKind,
} from "./technical-alerts.ts";

type Texts = typeof french.email.internal.technicalAlert;
type CodeTexts = Texts["codes"]["AL49"];

const LANGUAGES: readonly { locale: UiLocale; texts: Texts }[] = [
  { locale: "fr", texts: french.email.internal.technicalAlert },
  { locale: "en", texts: english.email.internal.technicalAlert },
];

/** The codes the e-mail knows: every alert of RG165, and AL48. */
export const TECHNICAL_ALERT_CODES = Object.keys(
  french.email.internal.technicalAlert.codes,
) as readonly (keyof Texts["codes"])[];

export type TechnicalAlertEmailInput = {
  code: string;
  kind: NotificationKind;
  /** notifiedCount after this e-mail (the number of a reminder). */
  sequence: number;
  openedAt: Date;
  observedAt: Date;
  value: AlertValue;
  /** AL51: the groups of the round (or of the digest). */
  groups?: {
    newGroups: readonly ErrorGroupSighting[];
    regressions: readonly ErrorGroupSighting[];
    digest: boolean;
  };
};

function codeTexts(texts: Texts, code: string): CodeTexts {
  const found = (
    texts.codes as Readonly<Record<string, CodeTexts | undefined>>
  )[code];
  if (found === undefined) {
    throw new Error(`no text for the alert ${code}`);
  }
  return found;
}

const PROBE_TARGET_KEYS = new Set(
  Object.keys(french.email.internal.technicalAlert.targets),
);

/** A missing value that means "nothing", not "not set": no breaker, no beat, no history. */
const NONE_WHEN_MISSING: ReadonlySet<string> = new Set([
  "breaker",
  "failureCode",
  "statusCode",
  "usualCallsPerMinute",
  "lastBeatAt",
  "ageSeconds",
  "lastAt",
]);

/**
 * The value, as words of one language: a share in basis points becomes a percentage (`shareBp` →
 * `share`), an instant a UTC date, a probe target its label, a missing measure "non fixé".
 */
function presented(
  value: AlertValue,
  locale: UiLocale,
  texts: Texts,
): Record<string, string> {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  });
  const instant = (iso: string) =>
    format(
      "{at, date, long} {at, time, medium} UTC",
      { at: new Date(iso) },
      locale,
    );
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key.endsWith("Bp")) {
      const name = key === "thresholdBp" ? "threshold" : key.slice(0, -2);
      out[name] =
        raw === null ? texts.notSet : percent.format(Number(raw) / 10_000);
      continue;
    }
    if (raw === null) {
      out[key] = NONE_WHEN_MISSING.has(key) ? texts.none : texts.notSet;
      continue;
    }
    if (key.endsWith("At") && typeof raw === "string") {
      out[key] = instant(raw);
      continue;
    }
    if (
      key === "target" &&
      typeof raw === "string" &&
      PROBE_TARGET_KEYS.has(raw)
    ) {
      out[key] =
        (texts.targets as Readonly<Record<string, string>>)[raw] ?? raw;
      continue;
    }
    out[key] = typeof raw === "number" ? number.format(raw) : raw;
  }
  // AL53: the p95 is known to its bucket (02 §20.5): "≤ 1 000 ms", or beyond the last bound.
  if ("p95Beyond" in value) {
    const last = DURATION_BUCKETS_MS[DURATION_BUCKETS_MS.length - 1] ?? 0;
    out.p95 =
      value.p95Beyond === 1
        ? format(texts.p95Beyond, { bound: number.format(last) }, locale)
        : value.p95UpperMs === null
          ? texts.notSet
          : format(
              texts.p95Within,
              { bound: number.format(Number(value.p95UpperMs)) },
              locale,
            );
  }
  return out;
}

function groupLines(
  groups: NonNullable<TechnicalAlertEmailInput["groups"]>,
  locale: UiLocale,
  texts: Texts,
): string[] {
  const line = (group: ErrorGroupSighting) =>
    format(
      texts.groups.line,
      {
        errorType: group.errorType,
        route: group.route ?? texts.groups.noRoute,
        id: group.id,
        at: new Date(group.at),
      },
      locale,
    );
  const paragraphs: string[] = [];
  if (groups.newGroups.length > 0) {
    paragraphs.push(
      format(
        groups.digest ? texts.groups.digest : texts.groups.newGroups,
        { count: groups.newGroups.length },
        locale,
      ),
      ...groups.newGroups.map(line),
    );
  }
  if (groups.regressions.length > 0) {
    paragraphs.push(
      format(
        texts.groups.regressions,
        { count: groups.regressions.length },
        locale,
      ),
      ...groups.regressions.map(line),
    );
  }
  return paragraphs;
}

function paragraphsOf(
  input: TechnicalAlertEmailInput,
  locale: UiLocale,
  texts: Texts,
): string[] {
  const own = codeTexts(texts, input.code);
  const facts = {
    code: input.code,
    title: own.title,
    sequence: input.sequence,
  };
  const paragraphs = [format(texts.fact[input.kind], facts, locale)];
  if (input.groups !== undefined) {
    paragraphs.push(...groupLines(input.groups, locale, texts));
  } else if (own.measure !== "") {
    paragraphs.push(
      format(own.measure, presented(input.value, locale, texts), locale),
    );
  }
  if (input.kind !== "raised") {
    paragraphs.push(
      format(texts.openedAt, { openedAt: input.openedAt }, locale),
    );
  }
  paragraphs.push(
    format(texts.observedAt, { observedAt: input.observedAt }, locale),
  );
  if (input.kind !== "resolved") {
    paragraphs.push(own.action);
  }
  paragraphs.push(texts.screen);
  return paragraphs;
}

export function renderTechnicalAlertEmail(
  input: TechnicalAlertEmailInput,
): RenderedInternalEmail {
  const [first, second] = LANGUAGES;
  if (first === undefined || second === undefined) {
    throw new Error("two languages expected");
  }
  const subjectOf = ({ texts }: (typeof LANGUAGES)[number], locale: UiLocale) =>
    format(
      texts.subject[input.kind],
      { code: input.code, title: codeTexts(texts, input.code).title },
      locale,
    );
  // French first, then the English title alone (the code is already said).
  const subject = `${subjectOf(first, "fr")} / ${codeTexts(second.texts, input.code).title}`;
  const blocks = LANGUAGES.map(({ locale, texts }) => ({
    locale,
    title: texts.heading,
    paragraphs: paragraphsOf(input, locale, texts),
  }));
  return renderInternalEmail(subject, blocks);
}

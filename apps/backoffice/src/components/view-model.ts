// What the screens of the backoffice v0 show, computed from the answers of apps/api (docs/mvp/17b
// §2, §3.11 to §3.13; 05 RG99, RG100, RG105). Pure functions, outside the components: dates and
// countries in French (D36 open), the message of a refusal, the pairs a selection replays. No rule
// is decided here — apps/api and the database decide; this module only words and gathers.
import type {
  AccountRow,
  SyncDestination,
} from "@influx/contracts/backoffice-accounts";
import {
  PROSPECTING_LEGAL_BASES,
  REPLAY_BATCH_CAP,
  type ApolloSetting,
} from "@influx/contracts/backoffice-actions";
import { ISO_COUNTRY_CODES } from "@influx/contracts/countries";
import type { RelayResult } from "@/browser/relay-client";
import { messages } from "@/messages/fr";

const LOCALE = "fr-FR";

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "short",
  timeStyle: "short",
});
const dateOnly = new Intl.DateTimeFormat(LOCALE, { dateStyle: "short" });
const longDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: "long" });
const timeOnly = new Intl.DateTimeFormat(LOCALE, { timeStyle: "short" });

/** "16/10/2026 09:42", in the browser's time zone. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return dateOnly.format(new Date(iso));
}

/** A calendar date "YYYY-MM-DD" (no time zone): read as is, never shifted. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

export function formatLongDate(iso: string): string {
  return longDate.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeOnly.format(new Date(iso));
}

let regionNames: Intl.DisplayNames | null = null;

/** The French name of an ISO 3166-1 code, or the code itself when unknown. */
export function countryName(code: string): string {
  regionNames ??= new Intl.DisplayNames([LOCALE], { type: "region" });
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The ISO codes sorted by their French name, for a select. */
export function countryOptions(): { code: string; name: string }[] {
  return ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: countryName(code),
  })).sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}

/** 05 RG144: "Firefox sur Windows"; never a version, never a place. */
export function browserLabel(summary: string): string {
  const [family = "", system = ""] = summary.split(".");
  const familyLabel = messages.browserFamily[family];
  const systemLabel = messages.browserSystem[system];
  return familyLabel === undefined || systemLabel === undefined
    ? messages.browserUnidentified
    : messages.browser(familyLabel, systemLabel);
}

/** 05 RG105: the share as a whole percentage, or null when nobody was concerned. */
export function sharePercent(synced: number, eligible: number): number | null {
  return eligible === 0 ? null : Math.round((synced * 100) / eligible);
}

/**
 * The message of a failed call (02 §9.2: never the technical message), or `reauth` when the action
 * waits for R (B-5): the screen then shows the confirmation of identity and retries.
 */
export function failureOf(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
): string | "reauth" | "signedOut" {
  if (result.kind === "unauthenticated") {
    return "signedOut";
  }
  switch (result.code) {
    case "reauthentication_required":
      return "reauth";
    case "forbidden":
      return messages.failure.forbidden;
    case "not_found":
      return messages.failure.notFound;
    case "conflict":
      return messages.failure.conflict;
    case "rate_limited":
      return messages.failure.rateLimited;
    case "validation_failed":
      return messages.failure.validation;
    default:
      return messages.failure.unavailable;
  }
}

export type ReplayPair = { accountId: string; destination: SyncDestination };

/** The destinations of a row whose state is a failure to handle (RG101; RG100: never a normal case). */
export function failedDestinations(row: AccountRow): SyncDestination[] {
  return (["brevo", "apollo"] as const).filter(
    (destination) => row.sync[destination].state === "failed",
  );
}

/** The pairs a selection of rows replays: its failed destinations only (RG103, CA60). */
export function replayPairs(
  rows: readonly AccountRow[],
  selected: ReadonlySet<string>,
): ReplayPair[] {
  return rows
    .filter((row) => selected.has(row.id))
    .flatMap((row) =>
      failedDestinations(row).map((destination) => ({
        accountId: row.id,
        destination,
      })),
    );
}

/** RG101: the cap shown before the gesture; the server applies it (CA59). */
export const REPLAY_CAP = REPLAY_BATCH_CAP;

/** "FR BE, de" ⇒ the known codes, and the unknown ones to say. */
export function parseCountryList(text: string): {
  codes: string[];
  unknown: string[];
} {
  const known = new Set<string>(ISO_COUNTRY_CODES);
  const tokens = text
    .split(/[\s,;]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token !== "");
  const codes = [...new Set(tokens.filter((token) => known.has(token)))];
  const unknown = tokens.filter((token) => !known.has(token));
  return { codes, unknown };
}

type LegalBasis = (typeof PROSPECTING_LEGAL_BASES)[number];

const BASIS_WORDS: Readonly<Record<string, LegalBasis>> = {
  consentement: "consentement_requis",
  interet: "interet_legitime_avec_opposition",
};

/** One line per country, "DE consentement"; null when a line is malformed or a country repeats. */
export function parseByCountry(
  text: string,
): { countryCode: string; basis: LegalBasis }[] | null {
  const known = new Set<string>(ISO_COUNTRY_CODES);
  const entries: { countryCode: string; basis: LegalBasis }[] = [];
  for (const line of text.split("\n")) {
    const words = line.trim().split(/\s+/);
    if (words.length === 1 && words[0] === "") {
      continue;
    }
    const [code = "", word = ""] = words;
    const basis = BASIS_WORDS[word.toLowerCase()];
    const countryCode = code.toUpperCase();
    if (words.length !== 2 || basis === undefined || !known.has(countryCode)) {
      return null;
    }
    entries.push({ countryCode, basis });
  }
  return new Set(entries.map((entry) => entry.countryCode)).size ===
    entries.length
    ? entries
    : null;
}

export function formatByCountry(
  entries: readonly { countryCode: string; basis: LegalBasis }[],
): string {
  return entries
    .map(
      (entry) =>
        `${entry.countryCode} ${entry.basis === "consentement_requis" ? "consentement" : "interet"}`,
    )
    .join("\n");
}

/** A first name for an internal account id, from a map the screen read; a neutral word otherwise. */
export function personName(
  names: ReadonlyMap<string, string | null>,
  accountId: string,
): string {
  return names.get(accountId) ?? messages.dualControl.unknownPerson;
}

/** 05 RG98: the characters a partial search may carry through the relay (EC-J8-58). */
export const PARTIAL_SEARCH_SHAPE = /^[A-Za-z0-9_-]{3,64}$/;

/** A rough shape check before the call; apps/api validates the address. */
export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An Apollo key and its value, in words (PD1: the exact value the confirmation applies). */
export function apolloSettingWords(setting: ApolloSetting): string {
  const t = messages.apollo;
  switch (setting.key) {
    case "apollo_scope":
      return t.settingLine(t.scope, t.scopes[setting.value]);
    case "apollo_prospecting_countries":
      return t.settingLine(
        t.countries,
        setting.value.length === 0
          ? t.countriesEmpty
          : setting.value.map(countryName).join(", "),
      );
    case "apollo_legal_basis":
      return t.settingLine(
        t.legalBasis,
        [
          t.legalBases[setting.value.default],
          ...setting.value.byCountry.map((entry) =>
            t.countryBasis(
              countryName(entry.countryCode),
              t.legalBases[entry.basis],
            ),
          ),
        ].join(" · "),
      );
  }
}

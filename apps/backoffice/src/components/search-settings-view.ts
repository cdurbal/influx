// The settings of the creator search, in words and in requests (docs/mvp/10 RG2, RG57; jalons/l3g/modele.md §6,
// §7; l3g-fiche invariants 9, 10, 12; D84, D38 Q2; L3G-13). Pure functions, outside the components. No rule is
// decided here: the base holds the values and refuses what is not allowed, the dual control asks another
// administrator, apps/api answers 409 `no_peer_admin` when none can confirm. This module words a setting, reads
// what an administrator typed into the request the contract types, and says what a refusal means. Counts only,
// never a creator; no amount, no tariff.
import {
  SEARCH_SETTING_REASONS,
  type DualControlRequestBody,
} from "@influx/contracts/backoffice-actions";
import {
  searchSettingValueSchemas,
  type SearchSetting,
  type SearchSettingKey,
  type SearchSettingsResponse,
  type SupplyCounters,
} from "@influx/contracts/search-settings";
import { messages } from "@/messages/fr";
import { humanCode } from "./queue-review-facts";
import { parseCount } from "./verification-decision-view";
import { countryName, formatDay, formatDateTime } from "./view-model";

const t = messages.searchSettings;

export type SearchSettingReason = (typeof SEARCH_SETTING_REASONS)[number];
export const REASONS = SEARCH_SETTING_REASONS;

/** The address of the screen, and of the dual control a request leads to. */
export const SEARCH_SETTINGS_HREF = "/reglages/recherche";

const numbers = new Intl.NumberFormat("fr-FR");
function n(value: number): string {
  return numbers.format(value);
}

/** One setting in a sentence: the value in force, or the value an action of the dual control proposes. */
export function settingWords(setting: SearchSetting): string {
  const w = t.words;
  switch (setting.key) {
    case "is_open_to_advertisers":
      return w.isOpen(setting.value);
    case "k_anonymity_threshold":
      return w.k(n(setting.value));
    case "page_size":
      return w.pageSize(n(setting.value));
    case "max_pages":
      return w.maxPages(n(setting.value));
    case "rate_limits":
      return w.rateLimits(
        n(setting.value.perHour),
        n(setting.value.perDay),
        n(setting.value.profileOpensPerDay),
      );
    case "cold_profile_quota":
      return w.coldQuota(n(setting.value.slots), n(setting.value.recentDays));
    case "critical_mass_thresholds":
      return w.thresholds(
        n(setting.value.publishedProfiles),
        n(setting.value.perTopic),
      );
    case "region_display_threshold":
      return w.region(n(setting.value));
    case "selection_limits":
      return w.selection(
        n(setting.value.listsPerAccount),
        n(setting.value.itemsPerList),
        n(setting.value.requestsPerDay),
      );
    case "identified_view":
      return w.identified(n(setting.value.pageSize), n(setting.value.maxPages));
  }
}

/**
 * J8: the value in force and the value requested, each in words. The value in force is the one the settings reader
 * answers for the key of the request (admin only, like the dual control itself); null when it could not be read, and
 * the screen then says so rather than showing nothing.
 */
export type SettingsList = SearchSettingsResponse["settings"];

export function settingChangeOf(
  settings: SettingsList | null,
  requested: SearchSetting,
): { current: string | null; requested: string } {
  const found = settings?.find((setting) => setting.key === requested.key);
  return {
    current: found === undefined ? null : settingWords(found),
    requested: settingWords(requested),
  };
}

/** J8: a facet of the search by its name, then its code (« Thématique (F1) »); the code alone when it has no name here. */
export function facetWords(code: string): string {
  const names = messages.identifiedSearch.facets;
  const known: Readonly<Record<string, string>> = {
    F1: names.topic,
    F3: names.networks,
    F4: names.audienceBands,
    F6: names.audienceCountry,
    F8: names.languages,
    F11: names.formats,
    F17: names.badges,
  };
  const name = known[code];
  return name === undefined ? code : `${name} (${code})`;
}

type SettingValues = { [S in SearchSetting as S["key"]]: S["value"] };

/** The value of a key as the reader answered it, or null when it is absent. */
export function settingOf<Key extends SearchSettingKey>(
  settings: SearchSettingsResponse["settings"],
  key: Key,
): SettingValues[Key] | null {
  const found = settings.find((setting) => setting.key === key);
  return found === undefined ? null : (found.value as SettingValues[Key]);
}

/** The keys the screen only reads (the ones it changes have their own section), in the order of the key list. */
export const READ_ONLY_KEYS: readonly SearchSettingKey[] = [
  "page_size",
  "max_pages",
  "rate_limits",
  "cold_profile_quota",
  "region_display_threshold",
  "selection_limits",
  "identified_view",
];

// --- The requests ----------------------------------------------------------------------------------------------

export type SettingField = "reason" | "publishedProfiles" | "perTopic" | "k";
export type SettingProblem = { field: SettingField; text: string };
export type SettingRequest =
  | { ok: true; body: DualControlRequestBody }
  | { ok: false; problem: SettingProblem };

function fail(field: SettingField, text: string): SettingRequest {
  return { ok: false, problem: { field, text } };
}

function reasonProblem(
  reason: SearchSettingReason | null,
): SettingRequest | null {
  return reason === null ? fail("reason", t.problems.reason) : null;
}

/** The switch: the request is the opposite of the value in force. */
export function openingRequest(
  isOpen: boolean,
  reason: SearchSettingReason | null,
): SettingRequest {
  const refused = reasonProblem(reason);
  if (refused !== null || reason === null) {
    return refused ?? fail("reason", t.problems.reason);
  }
  return {
    ok: true,
    body: {
      code: "search.change_setting",
      setting: { key: "is_open_to_advertisers", value: !isOpen },
      reasonCode: reason,
    },
  };
}

type Whole = { ok: true; value: number } | { ok: false; text: string };

function wholeOf(text: string, min: number, max: number): Whole {
  const value = parseCount(text.trim());
  if (value === null) {
    return { ok: false, text: t.problems.whole };
  }
  return value < min || value > max
    ? { ok: false, text: t.problems.range(min, max) }
    : { ok: true, value };
}

/** The thresholds of the critical mass, 1 to 100 000 each (the contract's own bounds). */
export function thresholdsRequest(
  input: { publishedProfiles: string; perTopic: string },
  current: { publishedProfiles: number; perTopic: number } | null,
  reason: SearchSettingReason | null,
): SettingRequest {
  const published = wholeOf(input.publishedProfiles, 1, 100_000);
  if (!published.ok) {
    return fail("publishedProfiles", published.text);
  }
  const topic = wholeOf(input.perTopic, 1, 100_000);
  if (!topic.ok) {
    return fail("perTopic", topic.text);
  }
  if (
    current !== null &&
    current.publishedProfiles === published.value &&
    current.perTopic === topic.value
  ) {
    return fail("publishedProfiles", t.problems.unchanged);
  }
  if (reason === null) {
    return fail("reason", t.problems.reason);
  }
  const value = {
    publishedProfiles: published.value,
    perTopic: topic.value,
  };
  if (
    !searchSettingValueSchemas.critical_mass_thresholds.safeParse(value).success
  ) {
    return fail("publishedProfiles", t.problems.refused);
  }
  return {
    ok: true,
    body: {
      code: "search.change_setting",
      setting: { key: "critical_mass_thresholds", value },
      reasonCode: reason,
    },
  };
}

/** k, 5 to 50 (the contract's own bounds). */
export function anonymityRequest(
  input: string,
  current: number | null,
  reason: SearchSettingReason | null,
): SettingRequest {
  const k = wholeOf(input, 5, 50);
  if (!k.ok) {
    return fail("k", k.text);
  }
  if (current === k.value) {
    return fail("k", t.problems.unchanged);
  }
  if (reason === null) {
    return fail("reason", t.problems.reason);
  }
  return {
    ok: true,
    body: {
      code: "search.change_setting",
      setting: { key: "k_anonymity_threshold", value: k.value },
      reasonCode: reason,
    },
  };
}

/** What a refused request means, in a sentence; null leaves the generic answer of the screen. */
export function requestRefusal(
  code: string | undefined,
  issues: readonly string[],
): string | null {
  if (code === "conflict" && issues.includes("no_peer_admin")) {
    return messages.dualControl.noPeerAdmin;
  }
  if (code === "validation_failed") {
    return t.problems.refused;
  }
  return null;
}

// --- The counters of the critical mass ---------------------------------------------------------------------------

export type CountRow = {
  key: string;
  label: string;
  published: string;
  searchable: string;
};

export type CountersView = {
  snapshot: string;
  global: string;
  topics: CountRow[];
  countries: CountRow[];
  curve: CountRow[];
};

/** The counters as the screen shows them: counts only (04 §5.5), by topic, by country and the curve. */
export function countersViewOf(counters: SupplyCounters): CountersView {
  const row = (key: string, label: string, p: number, s: number): CountRow => ({
    key,
    label,
    published: n(p),
    searchable: n(s),
  });
  return {
    snapshot: t.mass.snapshot(
      formatDay(counters.snapshotOn),
      formatDateTime(counters.computedAt),
    ),
    global: t.mass.global(
      n(counters.global.published),
      n(counters.global.searchable),
    ),
    topics: counters.topics.map((c) =>
      row(c.code, humanCode(c.code), c.published, c.searchable),
    ),
    countries: counters.countries.map((c) =>
      row(c.code, countryName(c.code), c.published, c.searchable),
    ),
    curve: counters.curve.map((c) =>
      row(c.snapshotOn, formatDay(c.snapshotOn), c.published, c.searchable),
    ),
  };
}

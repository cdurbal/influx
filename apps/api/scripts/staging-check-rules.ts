// The pure part of `pnpm --filter @influx/api staging:check` (docs/mvp/jalons/d70-plan.md, commit 3):
// no network, no file, unit-tested (tests/staging-check.test.ts). It reads the closed list of the
// runbook, turns the JSON of `railway variables --json` into NAMES, and judges the modes and the
// settings. Nothing here returns a value: a verdict names a variable or a setting, never what it
// holds (skill env-secrets rule 8).
import { apolloSettingOf } from "../src/domains/backoffice/apollo-settings.ts";
import type { OutboxDestination } from "../src/domains/leads/repository.ts";
import {
  ratePerMinuteOf,
  retryScheduleOf,
} from "../src/domains/leads/settings.ts";

export const RAILWAY_SERVICES = ["api", "worker", "web", "backoffice"] as const;
export type RailwayService = (typeof RAILWAY_SERVICES)[number];

export type ClosedList = { required: string[]; optional: string[] };
export type ClosedLists = Record<RailwayService, ClosedList>;

/** The table of the runbook lives between these two comments (docs/mvp/runbooks/staging.md). */
export const CLOSED_LIST_BEGIN = "<!-- staging-check:begin -->";
export const CLOSED_LIST_END = "<!-- staging-check:end -->";

const VARIABLE_NAME = /`([A-Z][A-Z0-9_]*)`/g;

function namesIn(cell: string): string[] {
  return [...cell.matchAll(VARIABLE_NAME)].map((match) => match[1] ?? "");
}

/**
 * The closed list of each service, from the table of the runbook: one row per service,
 * `| \`service\` | required names | optional names |`. Refused: no table, a service missing or
 * twice, a name listed twice for one service.
 */
export function closedListsOf(runbook: string): ClosedLists {
  const begin = runbook.indexOf(CLOSED_LIST_BEGIN);
  const end = runbook.indexOf(CLOSED_LIST_END);
  if (begin === -1 || end < begin) {
    throw new Error("the runbook has no closed list (staging-check markers)");
  }
  const lists: Partial<ClosedLists> = {};
  for (const line of runbook.slice(begin, end).split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    // "| `api` | … | … |" splits into ["", "`api`", "…", "…", ""].
    const service = /^`([a-z]+)`$/.exec(cells[1] ?? "")?.[1];
    if (cells.length !== 5 || service === undefined) {
      continue;
    }
    if (!(RAILWAY_SERVICES as readonly string[]).includes(service)) {
      throw new Error(`the closed list names an unknown service: ${service}`);
    }
    const key = service as RailwayService;
    if (lists[key] !== undefined) {
      throw new Error(`the closed list names ${key} twice`);
    }
    const required = namesIn(cells[2] ?? "");
    const optional = namesIn(cells[3] ?? "");
    const all = [...required, ...optional];
    if (new Set(all).size !== all.length) {
      throw new Error(`the closed list of ${key} names a variable twice`);
    }
    lists[key] = { required, optional };
  }
  for (const service of RAILWAY_SERVICES) {
    if (lists[service] === undefined || lists[service].required.length === 0) {
      throw new Error(`the closed list has no row for ${service}`);
    }
  }
  return lists as ClosedLists;
}

/** The variables Railway adds by itself (RAILWAY_ENVIRONMENT_NAME, RAILWAY_GIT_COMMIT_SHA…). */
export function isProvidedByRailway(name: string): boolean {
  return name.startsWith("RAILWAY_");
}

/** The non-secret variables whose VALUE the check reads, compares and never prints. */
export const MODE_VARIABLES = [
  "INFLUX_ENV",
  "BREVO_MODE",
  "SYNC_MODE",
] as const;
export type ModeVariable = (typeof MODE_VARIABLES)[number];

export type RailwayVariables = {
  /** Sorted, those Railway adds by itself left out. */
  names: string[];
  modes: Partial<Record<ModeVariable, string>>;
};

/**
 * The output of `railway variables -s <service> -e staging --json`: a JSON object of name → value.
 * Only the names and the three mode variables are kept; the parse error is replaced by a message of
 * ours, since the one of JSON.parse quotes the text it read.
 */
export function railwayVariablesOf(json: string): RailwayVariables {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("the output of railway variables is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("the output of railway variables is not a JSON object");
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  const modes: Partial<Record<ModeVariable, string>> = {};
  for (const [name, value] of entries) {
    if ((MODE_VARIABLES as readonly string[]).includes(name)) {
      modes[name as ModeVariable] = typeof value === "string" ? value : "";
    }
  }
  return {
    names: entries
      .map(([name]) => name)
      .filter((name) => !isProvidedByRailway(name))
      .sort(),
    modes,
  };
}

export type NameComparison = { missing: string[]; unexpected: string[] };

/** Every required name present, nothing outside the required and optional names. */
export function compareNames(
  list: ClosedList,
  names: readonly string[],
): NameComparison {
  const present = new Set(names);
  const allowed = new Set([...list.required, ...list.optional]);
  return {
    missing: list.required.filter((name) => !present.has(name)).sort(),
    unexpected: names.filter((name) => !allowed.has(name)).sort(),
  };
}

/** The modes of D70 (02 §12.4): staging everywhere, live wherever the service sends. */
export const EXPECTED_MODES: Record<
  RailwayService,
  Partial<Record<ModeVariable, string>>
> = {
  api: { INFLUX_ENV: "staging", BREVO_MODE: "live" },
  worker: { INFLUX_ENV: "staging", BREVO_MODE: "live", SYNC_MODE: "live" },
  web: { INFLUX_ENV: "staging" },
  backoffice: { INFLUX_ENV: "staging" },
};

/** The mode variables of `expected` that are absent or hold another value: names only. */
export function wrongModes(
  expected: Partial<Record<ModeVariable, string>>,
  modes: Partial<Record<ModeVariable, string | undefined>>,
): string[] {
  return MODE_VARIABLES.filter(
    (name) => expected[name] !== undefined && modes[name] !== expected[name],
  );
}

/** The redirection lists of development, refused in a deployed environment (02 §12.4 point 2). */
export const DEVELOPMENT_ONLY_VARIABLES = [
  "BREVO_TEST_RECIPIENTS",
  "NON_PRODUCTION_RECIPIENT_ALLOWLIST",
] as const;

/**
 * apps/api/.env.local (D70): the values of staging, live, without the development lists. Returns the
 * names at fault (absent, another value, or present when refused).
 */
export function envLocalIssues(
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  const issues = wrongModes(EXPECTED_MODES.worker, env);
  for (const name of DEVELOPMENT_ONLY_VARIABLES) {
    if (env[name] !== undefined && env[name] !== "") {
      issues.push(name);
    }
  }
  return issues;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/**
 * The settings that every sign-up needs (05 RG162, D69: no template id is read any more), as the
 * worker of a deployed environment requires them at start: the two Brevo lists, a readable retry
 * schedule, a rate limit for each destination with a key, and the three Apollo keys when the worker
 * has an Apollo key (an empty list of countries is valid, RG84). Returns the keys at fault.
 */
export function syncSettingsIssues(
  settings: Readonly<Record<string, unknown>>,
  withApollo: boolean,
): string[] {
  const issues: string[] = [];
  const lists = settings.brevo_list_ids;
  if (
    typeof lists !== "object" ||
    lists === null ||
    !isPositiveInteger((lists as Record<string, unknown>).advertisers) ||
    !isPositiveInteger((lists as Record<string, unknown>).creators)
  ) {
    issues.push("brevo_list_ids");
  }
  if (retryScheduleOf(settings) === null) {
    issues.push("retry_schedule");
  }
  const destinations: OutboxDestination[] = [
    "brevo_contact",
    "brevo_transactional",
    ...(withApollo ? (["apollo_contact"] as const) : []),
  ];
  if (
    destinations.some(
      (destination) => ratePerMinuteOf(settings, destination) === null,
    )
  ) {
    issues.push("rate_limits");
  }
  if (withApollo) {
    for (const key of [
      "apollo_scope",
      "apollo_legal_basis",
      "apollo_prospecting_countries",
    ] as const) {
      if (apolloSettingOf(key, settings[key]) === null) {
        issues.push(key);
      }
    }
  }
  return issues;
}

export type Verdict = { label: string; ok: boolean; detail?: string };

/** One line per verdict: `OK  label` or `KO  label: detail`. Names only, never a value. */
export function verdictLine(verdict: Verdict): string {
  return verdict.ok
    ? `OK  ${verdict.label}`
    : `KO  ${verdict.label}${verdict.detail === undefined ? "" : `: ${verdict.detail}`}`;
}

/** The verdict of a name comparison, `missing …; unexpected …`. */
export function namesVerdict(
  service: RailwayService,
  comparison: NameComparison,
): Verdict {
  const parts = [
    comparison.missing.length > 0
      ? `missing ${comparison.missing.join(", ")}`
      : "",
    comparison.unexpected.length > 0
      ? `unexpected ${comparison.unexpected.join(", ")}`
      : "",
  ].filter((part) => part !== "");
  return {
    label: `railway ${service}: variable names equal the closed list of the runbook`,
    ok: parts.length === 0,
    ...(parts.length === 0 ? {} : { detail: parts.join("; ") }),
  };
}

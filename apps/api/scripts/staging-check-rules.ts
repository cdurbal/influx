// The pure part of `pnpm --filter @influx/api staging:check` (docs/mvp/archives/jalons/d70-plan.md, commit 3):
// no network, no file, unit-tested (tests/staging-check.test.ts). It reads the closed list of the
// runbook, turns the JSON of `railway variables --json` into NAMES, and judges the modes and the
// settings. Nothing here returns a value: a verdict names a variable or a setting, never what it
// holds (skill env-secrets rule 8).
import { createHash } from "node:crypto";
import { startSettingsIssues } from "../src/domains/leads/start-check.ts";

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

/** The names the closed list holds for Railway's build, not for the code (Railpack, D64). */
export const READ_BY_RAILWAY_BUILD: readonly string[] = [
  "RAILPACK_NODE_VERSION",
];

/**
 * EC-J9-7: the closed list is drawn from what the code reads (runbook §5). The names of a service's
 * list that its configuration does not read (`readByCode`: the keys of its schema), Railway's build
 * variables aside: a variable set on Railway that no code reads is either a leftover or a typo.
 */
export function namesNotRead(
  list: ClosedList,
  readByCode: readonly string[],
): string[] {
  const read = new Set([...readByCode, ...READ_BY_RAILWAY_BUILD]);
  return [...list.required, ...list.optional]
    .filter((name) => !read.has(name))
    .sort();
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

export const STAGING_R2_BUCKET_PREFIX = "influx-staging-";

const STAGING_R2_ENDPOINT_PATTERN =
  /^https:\/\/[0-9a-f]{32}\.r2\.cloudflarestorage\.com$/;
const EU_R2_ENDPOINT_PATTERN =
  /^https:\/\/[0-9a-f]{32}\.eu\.r2\.cloudflarestorage\.com$/;

export type R2EndpointKind = "missing" | "staging" | "eu" | "invalid";
export type R2BucketPrefixKind = "missing" | "staging" | "invalid";

export type RailwayR2Summary = {
  endpointKind: R2EndpointKind;
  bucketPrefixKind: R2BucketPrefixKind;
  /** SHA-256 hex digest of R2_ACCESS_KEY_ID, never the raw token id, or null when absent. */
  accessKeyIdDigest: string | null;
};

export type RailwayVariables = {
  /** Sorted, those Railway adds by itself left out. */
  names: string[];
  modes: Partial<Record<ModeVariable, string>>;
  r2: RailwayR2Summary;
};

function classifyR2Endpoint(value: string | undefined): R2EndpointKind {
  if (value === undefined || value === "") {
    return "missing";
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "invalid";
  }
  const isOriginOnly =
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!isOriginOnly) {
    return "invalid";
  }
  if (STAGING_R2_ENDPOINT_PATTERN.test(url.origin)) {
    return "staging";
  }
  if (EU_R2_ENDPOINT_PATTERN.test(url.origin)) {
    return "eu";
  }
  return "invalid";
}

function classifyR2BucketPrefix(value: string | undefined): R2BucketPrefixKind {
  if (value === undefined || value === "") {
    return "missing";
  }
  return value === STAGING_R2_BUCKET_PREFIX ? "staging" : "invalid";
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Summarises R2 configuration without retaining any raw secret or account identifier. */
export function r2SummaryOf(
  variables: Readonly<Record<string, unknown>>,
): RailwayR2Summary {
  const endpoint =
    typeof variables.R2_ENDPOINT === "string"
      ? variables.R2_ENDPOINT
      : undefined;
  const bucketPrefix =
    typeof variables.R2_BUCKET_PREFIX === "string"
      ? variables.R2_BUCKET_PREFIX
      : undefined;
  const accessKeyId =
    typeof variables.R2_ACCESS_KEY_ID === "string" &&
    variables.R2_ACCESS_KEY_ID !== ""
      ? variables.R2_ACCESS_KEY_ID
      : undefined;
  return {
    endpointKind: classifyR2Endpoint(endpoint),
    bucketPrefixKind: classifyR2BucketPrefix(bucketPrefix),
    accessKeyIdDigest:
      accessKeyId === undefined ? null : sha256Hex(accessKeyId),
  };
}

/**
 * The output of `railway variables -s <service> -e staging --json`: a JSON object of name → value.
 * Only the names, the three mode variables and the non-secret R2 summary are kept; the parse error
 * is replaced by a message of ours, since the one of JSON.parse quotes the text it read.
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
  const raw = parsed as Record<string, unknown>;
  const entries = Object.entries(raw);
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
    r2: r2SummaryOf(raw),
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

/**
 * The settings that every sign-up needs (05 RG162, D69: no template id is read any more), judged as
 * the worker of a deployed environment judges them at start (src/domains/leads/start-check.ts, the
 * same function): the two Brevo lists, a readable retry schedule, a rate limit for each destination
 * with a key (Brevo always, deployed: 16 RG116), and the three Apollo keys when the worker has an
 * Apollo key (an empty list of countries is valid, RG84). Returns the settings at fault, by name.
 */
export function syncSettingsIssues(
  settings: Readonly<Record<string, unknown>>,
  withApollo: boolean,
): string[] {
  return startSettingsIssues(settings, [
    "brevo_contact",
    "brevo_transactional",
    ...(withApollo ? (["apollo_contact"] as const) : []),
  ]);
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

function r2EndpointIssue(kind: R2EndpointKind): string | null {
  switch (kind) {
    case "staging":
      return null;
    case "missing":
      return "R2_ENDPOINT missing";
    case "eu":
      return "R2_ENDPOINT (.eu. forbidden on staging)";
    case "invalid":
      return "R2_ENDPOINT invalid";
  }
}

function r2BucketPrefixIssue(kind: R2BucketPrefixKind): string | null {
  switch (kind) {
    case "staging":
      return null;
    case "missing":
      return "R2_BUCKET_PREFIX missing";
    case "invalid":
      return `R2_BUCKET_PREFIX (must be ${STAGING_R2_BUCKET_PREFIX})`;
  }
}

/** Verifies that api or worker on staging uses a non-.eu. endpoint, influx-staging- prefix, and has R2_ACCESS_KEY_ID. */
export function r2ServiceVerdict(
  service: Extract<RailwayService, "api" | "worker">,
  r2: RailwayR2Summary,
): Verdict {
  const issues = [
    r2EndpointIssue(r2.endpointKind),
    r2BucketPrefixIssue(r2.bucketPrefixKind),
    r2.accessKeyIdDigest === null ? "R2_ACCESS_KEY_ID missing" : null,
  ].filter((issue): issue is string => issue !== null);
  return {
    label: `railway ${service}: R2 staging endpoint and bucket prefix`,
    ok: issues.length === 0,
    ...(issues.length === 0 ? {} : { detail: issues.join("; ") }),
  };
}

/** Verifies that api and worker on staging use distinct R2_ACCESS_KEY_ID tokens without printing either value. */
export function r2DistinctTokensVerdict(
  api: RailwayR2Summary,
  worker: RailwayR2Summary,
): Verdict {
  if (api.accessKeyIdDigest === null || worker.accessKeyIdDigest === null) {
    return {
      label: "railway api/worker: distinct R2_ACCESS_KEY_ID tokens",
      ok: false,
      detail: "R2_ACCESS_KEY_ID missing on api or worker",
    };
  }
  const distinct = api.accessKeyIdDigest !== worker.accessKeyIdDigest;
  return {
    label: "railway api/worker: distinct R2_ACCESS_KEY_ID tokens",
    ok: distinct,
    ...(distinct
      ? {}
      : { detail: "R2_ACCESS_KEY_ID must differ between api and worker" }),
  };
}

/** Checks R2 variables in apps/api/.env.local for staging: non-.eu. endpoint, influx-staging-, keys set. */
export function envLocalR2Issues(
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  const summary = r2SummaryOf(env);
  const issues: string[] = [];
  const endpointIssue = r2EndpointIssue(summary.endpointKind);
  if (endpointIssue !== null) {
    issues.push(endpointIssue);
  }
  if (summary.accessKeyIdDigest === null) {
    issues.push("R2_ACCESS_KEY_ID missing");
  }
  if (
    env.R2_SECRET_ACCESS_KEY === undefined ||
    env.R2_SECRET_ACCESS_KEY === ""
  ) {
    issues.push("R2_SECRET_ACCESS_KEY missing");
  }
  const prefixIssue = r2BucketPrefixIssue(summary.bucketPrefixKind);
  if (prefixIssue !== null) {
    issues.push(prefixIssue);
  }
  return issues;
}

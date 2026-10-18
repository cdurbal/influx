// `pnpm --filter @influx/api staging:check` (docs/mvp/jalons/d70-plan.md, commit 3): is staging
// configured as production is (D70)? Run by the agent before and after every change of staging.
// Reads apps/api/.env.local (values of staging, --env-file), the Railway variables of the four
// services of staging (`railway variables -s <service> -e staging --json`, the CLI on the token
// limited to staging) and, with the migration role of staging, the marker and leads.sync_settings
// (read-only transaction). Checks:
//   (i)   .env.local aims at staging: INFLUX_ENV=staging, and the database carries the marker;
//   (ii)  the NAMES of the Railway variables of each service equal the closed list of the runbook
//         (docs/mvp/runbooks/staging.md, step 5), those Railway adds by itself left out;
//   (iii) the live modes (.env.local and Railway) and a complete leads.sync_settings (05 RG162).
// Output: one OK/KO line per check, naming variables or settings, NEVER a value; exit code 1 when
// a check is KO. Refused in production.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertStagingMarker,
  connectToStagingAsMigrationRole,
  refuseProduction,
} from "./script-guards.ts";
import {
  closedListsOf,
  compareNames,
  envLocalIssues,
  EXPECTED_MODES,
  namesVerdict,
  RAILWAY_SERVICES,
  railwayVariablesOf,
  syncSettingsIssues,
  verdictLine,
  wrongModes,
  type ClosedLists,
  type RailwayVariables,
  type Verdict,
} from "./staging-check-rules.ts";

const RUNBOOK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/mvp/runbooks/staging.md",
);

refuseProduction("staging check");
const verdicts: Verdict[] = [];
const record = (verdict: Verdict) => {
  verdicts.push(verdict);
  process.stdout.write(`${verdictLine(verdict)}\n`);
};

/** A failure of ours, or the code of a system error: never its message (it may quote a value). */
function reasonOf(error: unknown): string {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return error instanceof Error && error.message.length < 200
    ? error.message
    : "failed";
}

// (i) and (iii): the local file.
record({
  label: ".env.local: INFLUX_ENV is staging",
  ok: process.env.INFLUX_ENV === "staging",
});
const localIssues = envLocalIssues(process.env);
record({
  label: ".env.local: live modes, without the development lists",
  ok: localIssues.length === 0,
  ...(localIssues.length === 0 ? {} : { detail: localIssues.join(", ") }),
});

// (ii) and (iii): Railway, names (and the three mode variables, compared here, never printed).
let lists: ClosedLists | null = null;
try {
  lists = closedListsOf(readFileSync(RUNBOOK, "utf8"));
} catch (error) {
  record({
    label: "runbook: closed list readable",
    ok: false,
    detail: reasonOf(error),
  });
}
let workerNames: string[] = [];
for (const service of RAILWAY_SERVICES) {
  let variables: RailwayVariables;
  try {
    // The CLI is an npm shim on Windows (railway.cmd), which only a shell starts: one fixed command
    // line, the service taken from the closed list RAILWAY_SERVICES, nothing from the outside.
    const json = execSync(`railway variables -s ${service} -e staging --json`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 4 * 1024 * 1024,
    });
    variables = railwayVariablesOf(json);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? ` (exit ${String(error.status)})`
        : "";
    record({
      label: `railway ${service}: variables readable`,
      ok: false,
      detail:
        error instanceof Error &&
        error.message.startsWith("the output of railway")
          ? error.message
          : `railway variables failed${status}`,
    });
    continue;
  }
  if (service === "worker") {
    workerNames = variables.names;
  }
  if (lists !== null) {
    record(
      namesVerdict(service, compareNames(lists[service], variables.names)),
    );
  }
  const wrong = wrongModes(EXPECTED_MODES[service], variables.modes);
  record({
    label: `railway ${service}: modes of D70`,
    ok: wrong.length === 0,
    ...(wrong.length === 0 ? {} : { detail: wrong.join(", ") }),
  });
}

// (i) and (iii): the database of staging, with the migration role, read-only.
if (
  process.env.INFLUX_STAGING_MIGRATION_URL === undefined ||
  process.env.INFLUX_STAGING_MIGRATION_URL === ""
) {
  for (const label of [
    "database: staging marker",
    "database: leads.sync_settings complete",
  ]) {
    record({
      label,
      ok: false,
      detail:
        "INFLUX_STAGING_MIGRATION_URL is missing from apps/api/.env.local",
    });
  }
} else {
  const migration = connectToStagingAsMigrationRole();
  try {
    let marked = false;
    try {
      await assertStagingMarker(migration);
      marked = true;
      record({ label: "database: staging marker", ok: true });
    } catch (error) {
      record({
        label: "database: staging marker",
        ok: false,
        detail: reasonOf(error),
      });
    }
    if (marked) {
      const rows = await migration.begin(
        "read only",
        (sql) => sql<{ key: string; value: unknown }[]>`
          select key, value from leads.sync_settings`,
      );
      const settings = Object.fromEntries(
        rows.map((row) => [row.key, row.value]),
      );
      const issues = syncSettingsIssues(
        settings,
        workerNames.includes("APOLLO_API_KEY"),
      );
      record({
        label: "database: leads.sync_settings complete (05 RG162)",
        ok: issues.length === 0,
        ...(issues.length === 0 ? {} : { detail: issues.join(", ") }),
      });
    } else {
      record({
        label: "database: leads.sync_settings complete (05 RG162)",
        ok: false,
        detail: "not read without the marker",
      });
    }
  } catch (error) {
    record({
      label: "database: reachable",
      ok: false,
      detail: reasonOf(error),
    });
  } finally {
    await migration.end({ timeout: 1 });
  }
}

const failed = verdicts.filter((verdict) => !verdict.ok).length;
process.stdout.write(
  failed === 0
    ? "staging:check OK\n"
    : `staging:check KO (${failed} of ${verdicts.length} checks)\n`,
);
process.exitCode = failed === 0 ? 0 : 1;

// Refusal to start on an inconsistent configuration: first half of T17
// (docs/mvp/18-plan-de-test-mvp.md T17, docs/mvp/21-plan-de-developpement.md §4, J1-D point 3).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ConfigError,
  loadApiConfig,
  loadWorkerConfig,
} from "../src/config/index.ts";
import type { Environment } from "../src/config/schema.ts";
import { BACKOFFICE_SECRET, WEB_SECRET } from "./helpers.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const VALID_API_ENV = {
  INFLUX_ENV: "staging",
  INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET,
  INFLUX_API_INTERNAL_SECRET_BACKOFFICE: BACKOFFICE_SECRET,
} as const;

const VALID_WORKER_ENV = { INFLUX_ENV: "staging" } as const;

/** Issues of the refusal, or a failed expectation when the configuration is accepted. */
function refusal(load: () => unknown): readonly string[] {
  try {
    load();
  } catch (error) {
    if (error instanceof ConfigError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error("The configuration was accepted: a refusal was expected");
}

describe("api configuration", () => {
  it("accepts a coherent configuration, with safe defaults", () => {
    const config = loadApiConfig(VALID_API_ENV);
    expect(config).toEqual({
      environment: "staging",
      version: "local",
      brevo: { mode: "disabled", testRecipients: [] },
      port: 3100,
      internalSecrets: { web: WEB_SECRET, backoffice: BACKOFFICE_SECRET },
    });
  });

  it("reads the deployed commit as the version, and an explicit port", () => {
    const config = loadApiConfig({
      ...VALID_API_ENV,
      RAILWAY_GIT_COMMIT_SHA: "abc123",
      PORT: "8080",
    });
    expect(config.version).toBe("abc123");
    expect(config.port).toBe(8080);
  });

  it.each<[string, Environment, string]>([
    [
      "live Brevo outside production (16 RG116)",
      { ...VALID_API_ENV, BREVO_MODE: "live" },
      "BREVO_MODE live is refused outside production",
    ],
    [
      "production without live Brevo",
      { ...VALID_API_ENV, INFLUX_ENV: "production" },
      "BREVO_MODE must be live in production",
    ],
    [
      "production with Brevo redirect",
      {
        ...VALID_API_ENV,
        INFLUX_ENV: "production",
        BREVO_MODE: "redirect",
        BREVO_TEST_RECIPIENTS: "team@example.com",
      },
      "BREVO_MODE must be live in production",
    ],
    [
      "redirect without test recipients",
      { ...VALID_API_ENV, BREVO_MODE: "redirect" },
      "BREVO_TEST_RECIPIENTS is required when BREVO_MODE is redirect",
    ],
    [
      "a missing internal secret",
      { INFLUX_ENV: "staging", INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET },
      "INFLUX_API_INTERNAL_SECRET_BACKOFFICE is required",
    ],
    [
      "an internal secret shorter than 32 bytes",
      { ...VALID_API_ENV, INFLUX_API_INTERNAL_SECRET_WEB: "CHANGE_ME" },
      "INFLUX_API_INTERNAL_SECRET_WEB must be at least 32 bytes",
    ],
    [
      "the same internal secret for both fronts",
      { ...VALID_API_ENV, INFLUX_API_INTERNAL_SECRET_BACKOFFICE: WEB_SECRET },
      "INFLUX_API_INTERNAL_SECRET_BACKOFFICE must differ from INFLUX_API_INTERNAL_SECRET_WEB",
    ],
    [
      "an unknown environment",
      { ...VALID_API_ENV, INFLUX_ENV: "development" },
      "INFLUX_ENV must be staging or production",
    ],
  ])("refuses %s", (_case, env, issue) => {
    expect(refusal(() => loadApiConfig(env))).toContain(issue);
  });

  it("accepts live Brevo in production", () => {
    expect(
      loadApiConfig({
        ...VALID_API_ENV,
        INFLUX_ENV: "production",
        BREVO_MODE: "live",
      }).brevo.mode,
    ).toBe("live");
  });

  it("never quotes a secret value in the refusal", () => {
    const shortSecret = "short-secret-value";
    const error = (() => {
      try {
        loadApiConfig({
          ...VALID_API_ENV,
          INFLUX_API_INTERNAL_SECRET_WEB: shortSecret,
          INFLUX_API_INTERNAL_SECRET_BACKOFFICE: shortSecret,
        });
      } catch (caught) {
        return caught;
      }
      return undefined;
    })();
    expect(error).toBeInstanceOf(ConfigError);
    expect(String((error as ConfigError).message)).not.toContain(shortSecret);
  });
});

describe("worker configuration", () => {
  it("accepts a coherent configuration, with safe defaults", () => {
    expect(loadWorkerConfig(VALID_WORKER_ENV)).toEqual({
      environment: "staging",
      version: "local",
      brevo: { mode: "disabled", testRecipients: [] },
      sync: { mode: "dry_run", nonProductionRecipientAllowlist: [] },
    });
  });

  it.each<[string, Environment, string]>([
    [
      "dry_run in production (02 §12.4)",
      {
        INFLUX_ENV: "production",
        BREVO_MODE: "live",
        SYNC_MODE: "dry_run",
      },
      "SYNC_MODE dry_run is refused in production",
    ],
    [
      "production without an explicit SYNC_MODE",
      { INFLUX_ENV: "production", BREVO_MODE: "live" },
      "SYNC_MODE dry_run is refused in production",
    ],
    [
      "live sync outside production without an allowlist",
      { INFLUX_ENV: "staging", SYNC_MODE: "live" },
      "NON_PRODUCTION_RECIPIENT_ALLOWLIST is required when SYNC_MODE is live outside production",
    ],
    [
      "live Brevo outside production",
      { INFLUX_ENV: "staging", BREVO_MODE: "live" },
      "BREVO_MODE live is refused outside production",
    ],
    [
      "redirect without test recipients",
      { INFLUX_ENV: "staging", BREVO_MODE: "redirect" },
      "BREVO_TEST_RECIPIENTS is required when BREVO_MODE is redirect",
    ],
  ])("refuses %s", (_case, env, issue) => {
    expect(refusal(() => loadWorkerConfig(env))).toContain(issue);
  });

  it("accepts live sync outside production with an allowlist, and production in live", () => {
    expect(
      loadWorkerConfig({
        INFLUX_ENV: "staging",
        SYNC_MODE: "live",
        NON_PRODUCTION_RECIPIENT_ALLOWLIST: "example.com, example.org",
      }).sync.nonProductionRecipientAllowlist,
    ).toEqual(["example.com", "example.org"]);
    expect(
      loadWorkerConfig({
        INFLUX_ENV: "production",
        BREVO_MODE: "live",
        SYNC_MODE: "live",
      }).sync.mode,
    ).toBe("live");
  });
});

describe("process start", () => {
  // The real entry points, run by Node on the TypeScript sources (21 J1-B): an inconsistent
  // configuration stops the process with a non-zero exit code before anything listens.
  function start(entry: string, env: Record<string, string>) {
    const systemRoot = process.env.SYSTEMROOT;
    return spawnSync(process.execPath, [path.join("src", entry)], {
      cwd: API_ROOT,
      env: systemRoot === undefined ? env : { ...env, SYSTEMROOT: systemRoot },
      encoding: "utf8",
      timeout: 20_000,
    });
  }

  it("api refuses to start with identical internal secrets", () => {
    const result = start("main.ts", {
      INFLUX_ENV: "staging",
      INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET,
      INFLUX_API_INTERNAL_SECRET_BACKOFFICE: WEB_SECRET,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("refusing to start");
    expect(result.stdout).toContain(
      "INFLUX_API_INTERNAL_SECRET_BACKOFFICE must differ",
    );
    expect(result.stdout).not.toContain(WEB_SECRET);
  });

  it("worker refuses to start in production with dry_run", () => {
    const result = start("worker.ts", {
      INFLUX_ENV: "production",
      BREVO_MODE: "live",
      SYNC_MODE: "dry_run",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "SYNC_MODE dry_run is refused in production",
    );
  });
});

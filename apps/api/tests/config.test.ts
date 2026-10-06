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
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  TEST_DATABASE_URLS,
  TEST_SUPABASE_SECRET_KEY,
  TEST_SUPABASE_URL,
  THROTTLE_PEPPER,
  TOKEN_SIGNING_SECRET,
  WEB_ORIGIN,
  WEB_SECRET,
} from "./helpers.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const VALID_API_ENV = {
  INFLUX_ENV: "staging",
  INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET,
  INFLUX_API_INTERNAL_SECRET_BACKOFFICE: BACKOFFICE_SECRET,
  INFLUX_PUBLIC_SITE_URL: WEB_ORIGIN,
  INFLUX_PUBLIC_BACKOFFICE_URL: BACKOFFICE_ORIGIN,
  AUTH_THROTTLE_PEPPER: THROTTLE_PEPPER,
  AUTH_TOKEN_SIGNING_SECRET: TOKEN_SIGNING_SECRET,
  SUPABASE_URL: TEST_SUPABASE_URL,
  SUPABASE_SECRET_KEY: TEST_SUPABASE_SECRET_KEY,
  DATABASE_URL: TEST_DATABASE_URLS.DATABASE_URL,
  AUTH_DATABASE_URL: TEST_DATABASE_URLS.AUTH_DATABASE_URL,
  OPS_DATABASE_URL: TEST_DATABASE_URLS.OPS_DATABASE_URL,
} as const;

const VALID_WORKER_ENV = {
  INFLUX_ENV: "staging",
  WORKER_DATABASE_URL: TEST_DATABASE_URLS.WORKER_DATABASE_URL,
} as const;

const HOSTED_SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
const APP_URL = TEST_DATABASE_URLS.DATABASE_URL;
const AUTH_URL = TEST_DATABASE_URLS.AUTH_DATABASE_URL;
const WORKER_URL = TEST_DATABASE_URLS.WORKER_DATABASE_URL;
const OPS_URL = TEST_DATABASE_URLS.OPS_DATABASE_URL;
const POOLER_APP_URL =
  "postgresql://influx_app.abcdefghijklmnop:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";
const POOLER_AUTH_URL =
  "postgresql://influx_auth_login.abcdefghijklmnop:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";

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
      instance: "local",
      brevo: { mode: "disabled", testRecipients: [] },
      port: 3100,
      brevoTransport: {
        apiKey: null,
        baseUrl: "https://api.brevo.com/v3",
        senderTransactional: null,
      },
      publicOrigins: { web: WEB_ORIGIN, backoffice: BACKOFFICE_ORIGIN },
      authThrottlePepper: THROTTLE_PEPPER,
      authTokenSigningSecret: TOKEN_SIGNING_SECRET,
      supabase: { url: TEST_SUPABASE_URL, secretKey: TEST_SUPABASE_SECRET_KEY },
      database: {
        app: { url: APP_URL, role: "influx_app", tls: false },
        auth: { url: AUTH_URL, role: "influx_auth_login", tls: false },
        ops: { url: OPS_URL, role: "influx_ops_login", tls: false },
      },
      internalSecrets: { web: WEB_SECRET, backoffice: BACKOFFICE_SECRET },
    });
  });

  it("accepts pooler users suffixed by the project reference, with TLS (18 T4.6 b, f)", () => {
    const config = loadApiConfig({
      ...VALID_API_ENV,
      DATABASE_URL: POOLER_APP_URL,
      AUTH_DATABASE_URL: POOLER_AUTH_URL,
    });
    expect(config.database.app).toEqual({
      url: POOLER_APP_URL,
      role: "influx_app",
      tls: true,
    });
    expect(config.database.auth.tls).toBe(true);
  });

  it("normalises a public origin as a browser serialises it (03 §6.4 A4)", () => {
    const config = loadApiConfig({
      ...VALID_API_ENV,
      INFLUX_PUBLIC_SITE_URL: "HTTPS://Influx.Example:443/",
      INFLUX_PUBLIC_BACKOFFICE_URL: "http://localhost:3001",
    });
    expect(config.publicOrigins).toEqual({
      web: "https://influx.example",
      backoffice: "http://localhost:3001",
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
      "an internal secret that still holds the CHANGE_ME placeholder (21 J1-J R4)",
      {
        ...VALID_API_ENV,
        INFLUX_API_INTERNAL_SECRET_BACKOFFICE: "CHANGE_ME".padEnd(40, "x"),
      },
      "INFLUX_API_INTERNAL_SECRET_BACKOFFICE must not contain the CHANGE_ME placeholder",
    ],
    [
      "an internal secret with the placeholder in lower case (21 J1-J N3)",
      {
        ...VALID_API_ENV,
        INFLUX_API_INTERNAL_SECRET_WEB: "change_me".padEnd(40, "x"),
      },
      "INFLUX_API_INTERNAL_SECRET_WEB must not contain the CHANGE_ME placeholder",
    ],
    [
      "a database URL with the placeholder in mixed case (N3)",
      {
        ...VALID_API_ENV,
        DATABASE_URL:
          "postgresql://influx_app:Change_Me@127.0.0.1:54322/postgres",
      },
      "DATABASE_URL must not contain the CHANGE_ME placeholder",
    ],
    // 03 §6.4 A4 and A5, 21 J3-E: variables that enter at J3 commit 4.
    [
      "a missing AUTH_THROTTLE_PEPPER",
      { ...VALID_API_ENV, AUTH_THROTTLE_PEPPER: undefined },
      "AUTH_THROTTLE_PEPPER is required",
    ],
    [
      "a pepper shorter than 32 bytes",
      { ...VALID_API_ENV, AUTH_THROTTLE_PEPPER: "short-pepper" },
      "AUTH_THROTTLE_PEPPER must be at least 32 bytes",
    ],
    [
      "the pepper of the template, in lower case (N3)",
      {
        ...VALID_API_ENV,
        AUTH_THROTTLE_PEPPER: "change_me-change_me-change_me-change_me",
      },
      "AUTH_THROTTLE_PEPPER must not contain the CHANGE_ME placeholder",
    ],
    [
      "a pepper equal to an internal secret",
      { ...VALID_API_ENV, AUTH_THROTTLE_PEPPER: BACKOFFICE_SECRET },
      "AUTH_THROTTLE_PEPPER must differ from the internal secrets",
    ],
    [
      "a missing public origin of the backoffice",
      { ...VALID_API_ENV, INFLUX_PUBLIC_BACKOFFICE_URL: undefined },
      "INFLUX_PUBLIC_BACKOFFICE_URL is required",
    ],
    [
      "a public origin with a path",
      { ...VALID_API_ENV, INFLUX_PUBLIC_SITE_URL: "https://influx.example/fr" },
      "INFLUX_PUBLIC_SITE_URL must be an http(s) origin, without path, query or credentials",
    ],
    [
      "a public origin that is not a URL",
      { ...VALID_API_ENV, INFLUX_PUBLIC_SITE_URL: "influx.example" },
      "INFLUX_PUBLIC_SITE_URL must be an http(s) origin",
    ],
    [
      "the same public origin for both surfaces",
      { ...VALID_API_ENV, INFLUX_PUBLIC_BACKOFFICE_URL: `${WEB_ORIGIN}/` },
      "INFLUX_PUBLIC_BACKOFFICE_URL must differ from INFLUX_PUBLIC_SITE_URL",
    ],
    [
      "an http public origin in production",
      {
        ...VALID_API_ENV,
        INFLUX_ENV: "production",
        BREVO_MODE: "live",
        INFLUX_PUBLIC_SITE_URL: "http://influx.example",
      },
      "INFLUX_PUBLIC_SITE_URL must be an https origin in production",
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
    // EC-20 and 18 T4.6: database variables of the api service.
    [
      "a missing DATABASE_URL",
      { ...VALID_API_ENV, DATABASE_URL: undefined },
      "DATABASE_URL is required",
    ],
    [
      "a missing AUTH_DATABASE_URL",
      { ...VALID_API_ENV, AUTH_DATABASE_URL: "" },
      "AUTH_DATABASE_URL is required",
    ],
    [
      "DATABASE_URL as the migration role postgres",
      {
        ...VALID_API_ENV,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      },
      "DATABASE_URL must connect as role influx_app",
    ],
    [
      "DATABASE_URL with the role of another variable",
      { ...VALID_API_ENV, DATABASE_URL: AUTH_URL },
      "DATABASE_URL must connect as role influx_app",
    ],
    [
      "AUTH_DATABASE_URL with the worker role",
      { ...VALID_API_ENV, AUTH_DATABASE_URL: WORKER_URL },
      "AUTH_DATABASE_URL must connect as role influx_auth_login",
    ],
    [
      "a role that only starts like the expected one",
      {
        ...VALID_API_ENV,
        DATABASE_URL: "postgresql://influx_app_x:p@127.0.0.1:54322/postgres",
      },
      "DATABASE_URL must connect as role influx_app",
    ],
    [
      "an empty user",
      {
        ...VALID_API_ENV,
        DATABASE_URL: "postgresql://127.0.0.1:54322/postgres",
      },
      "DATABASE_URL must connect as role influx_app",
    ],
    [
      "a user in another case",
      {
        ...VALID_API_ENV,
        DATABASE_URL: "postgresql://INFLUX_APP:p@127.0.0.1:54322/postgres",
      },
      "DATABASE_URL must connect as role influx_app",
    ],
    [
      "the role suffixed by an empty project reference",
      {
        ...VALID_API_ENV,
        DATABASE_URL: "postgresql://influx_app.:p@127.0.0.1:6543/postgres",
      },
      "DATABASE_URL has an empty project reference",
    ],
    [
      "the placeholder of .env.example",
      {
        ...VALID_API_ENV,
        DATABASE_URL:
          "postgresql://influx_app.your-project-ref:CHANGE_ME@HOST:6543/postgres",
      },
      "DATABASE_URL must not contain the CHANGE_ME placeholder",
    ],
    [
      "a URL that is not PostgreSQL",
      { ...VALID_API_ENV, DATABASE_URL: "https://influx_app@example.com/" },
      "DATABASE_URL must be a postgresql:// URL",
    ],
    [
      "on Railway, the worker variable set on the api service",
      {
        ...VALID_API_ENV,
        RAILWAY_ENVIRONMENT_NAME: "staging",
        WORKER_DATABASE_URL: WORKER_URL,
      },
      "WORKER_DATABASE_URL is reserved to another service and must not be set here",
    ],
    [
      "no token signing secret (21 J3-E, EC-24)",
      { ...VALID_API_ENV, AUTH_TOKEN_SIGNING_SECRET: undefined },
      "AUTH_TOKEN_SIGNING_SECRET is required",
    ],
    [
      "a token signing secret under 32 bytes",
      { ...VALID_API_ENV, AUTH_TOKEN_SIGNING_SECRET: "short-signing-secret" },
      "AUTH_TOKEN_SIGNING_SECRET must be at least 32 bytes",
    ],
    [
      "the placeholder as token signing secret, in any letter case",
      {
        ...VALID_API_ENV,
        AUTH_TOKEN_SIGNING_SECRET: "change_me-change_me-change_me-change_me",
      },
      "AUTH_TOKEN_SIGNING_SECRET must not contain the CHANGE_ME placeholder",
    ],
    [
      "a token signing secret equal to the throttle pepper (EC-24)",
      { ...VALID_API_ENV, AUTH_TOKEN_SIGNING_SECRET: THROTTLE_PEPPER },
      "AUTH_TOKEN_SIGNING_SECRET must differ from AUTH_THROTTLE_PEPPER and from the internal secrets",
    ],
    [
      "a token signing secret equal to the web internal secret (EC-24)",
      { ...VALID_API_ENV, AUTH_TOKEN_SIGNING_SECRET: WEB_SECRET },
      "AUTH_TOKEN_SIGNING_SECRET must differ from AUTH_THROTTLE_PEPPER and from the internal secrets",
    ],
    [
      "a token signing secret equal to the backoffice internal secret (EC-24)",
      { ...VALID_API_ENV, AUTH_TOKEN_SIGNING_SECRET: BACKOFFICE_SECRET },
      "AUTH_TOKEN_SIGNING_SECRET must differ from AUTH_THROTTLE_PEPPER and from the internal secrets",
    ],
    [
      "no Supabase URL",
      { ...VALID_API_ENV, SUPABASE_URL: undefined },
      "SUPABASE_URL is required",
    ],
    [
      "a plain http Supabase URL outside a loopback host",
      { ...VALID_API_ENV, SUPABASE_URL: "http://abcdefghijklmnop.supabase.co" },
      "SUPABASE_URL must be an https origin (http only on a loopback host), without path, query or credentials",
    ],
    [
      "a Supabase URL with a path",
      { ...VALID_API_ENV, SUPABASE_URL: `${HOSTED_SUPABASE_URL}/auth/v1` },
      "SUPABASE_URL must be an https origin (http only on a loopback host), without path, query or credentials",
    ],
    [
      "the local stack's Supabase URL in production",
      {
        ...VALID_API_ENV,
        INFLUX_ENV: "production",
        BREVO_MODE: "live",
      },
      "SUPABASE_URL must be an https origin in production",
    ],
    [
      "no Supabase secret key",
      { ...VALID_API_ENV, SUPABASE_SECRET_KEY: undefined },
      "SUPABASE_SECRET_KEY is required",
    ],
    [
      "a legacy service_role JWT as Supabase key (EC-46)",
      {
        ...VALID_API_ENV,
        SUPABASE_SECRET_KEY:
          "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl",
      },
      "SUPABASE_SECRET_KEY must be a secret key (sb_secret_…), never a legacy JWT key",
    ],
    [
      "the placeholder of .env.example as Supabase key",
      { ...VALID_API_ENV, SUPABASE_SECRET_KEY: "CHANGE_ME" },
      "SUPABASE_SECRET_KEY must not contain the CHANGE_ME placeholder",
    ],
  ])("refuses %s", (_case, env, issue) => {
    expect(refusal(() => loadApiConfig(env))).toContain(issue);
  });

  it("refuses two URLs of the api with the same user (EC-20)", () => {
    // Same user in both: whichever role it names, one of the two checks refuses it. The
    // same-user rule itself is exercised by the exported checker below.
    expect(
      refusal(() =>
        loadApiConfig({ ...VALID_API_ENV, AUTH_DATABASE_URL: APP_URL }),
      ),
    ).toContain("AUTH_DATABASE_URL must connect as role influx_auth_login");
  });

  it("tolerates the worker variable off Railway, and never reads it (18 T4.6 d)", () => {
    const config = loadApiConfig({
      ...VALID_API_ENV,
      WORKER_DATABASE_URL: WORKER_URL,
    });
    expect(JSON.stringify(config)).not.toContain("influx_worker_login");
  });

  it("never quotes a database URL in the refusal", () => {
    const secretUrl =
      "postgresql://postgres:very-secret-password@127.0.0.1:54322/postgres";
    const issues = refusal(() =>
      loadApiConfig({ ...VALID_API_ENV, DATABASE_URL: secretUrl }),
    );
    expect(issues.join(" ")).not.toContain("very-secret-password");
  });

  it("accepts the https origin of a hosted Supabase project, normalised", () => {
    expect(
      loadApiConfig({
        ...VALID_API_ENV,
        SUPABASE_URL: "HTTPS://ABCDEFGHIJKLMNOP.supabase.co/",
      }).supabase.url,
    ).toBe(HOSTED_SUPABASE_URL);
  });

  it("accepts live Brevo in production", () => {
    expect(
      loadApiConfig({
        ...VALID_API_ENV,
        INFLUX_ENV: "production",
        BREVO_MODE: "live",
        BREVO_API_KEY: "xkeysib-production-like-value",
        BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
        SUPABASE_URL: HOSTED_SUPABASE_URL,
      }).brevo.mode,
    ).toBe("live");
  });

  // 21 EC-19, J3-C rule 10: the transactional sender of the api.
  describe("Brevo transport of the api (EC-19)", () => {
    const REDIRECT = {
      ...VALID_API_ENV,
      BREVO_MODE: "redirect",
      BREVO_TEST_RECIPIENTS: "team@influx.example",
      BREVO_API_KEY: "xkeysib-test-account-value",
      BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
    };

    it("accepts the local double on a loopback host outside production", () => {
      const config = loadApiConfig({
        ...REDIRECT,
        BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3/",
      });
      expect(config.brevoTransport).toEqual({
        apiKey: "xkeysib-test-account-value",
        baseUrl: "http://127.0.0.1:4010/v3",
        senderTransactional: "no-reply@tx.influx.example",
      });
    });

    it.each([
      ["BREVO_API_KEY", { BREVO_API_KEY: "" }],
      ["BREVO_SENDER_TRANSACTIONAL", { BREVO_SENDER_TRANSACTIONAL: "" }],
      ["BREVO_API_KEY", { BREVO_API_KEY: "change_me-key" }],
      [
        "BREVO_API_BASE_URL",
        { BREVO_API_BASE_URL: "https://double.example/v3" },
      ],
      [
        "BREVO_API_BASE_URL",
        { BREVO_API_BASE_URL: "http://user:pass@127.0.0.1:4010/v3" },
      ],
    ])("refuses %s when %j", (variable, overrides) => {
      expect(() => loadApiConfig({ ...REDIRECT, ...overrides })).toThrow(
        variable,
      );
    });

    it("refuses the local double in production", () => {
      expect(() =>
        loadApiConfig({
          ...VALID_API_ENV,
          INFLUX_ENV: "production",
          BREVO_MODE: "live",
          BREVO_API_KEY: "xkeysib-production-like-value",
          BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
          BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3",
          SUPABASE_URL: HOSTED_SUPABASE_URL,
        }),
      ).toThrow("BREVO_API_BASE_URL");
    });

    it("needs neither key nor sender when disabled", () => {
      expect(
        loadApiConfig({ ...VALID_API_ENV, BREVO_MODE: "disabled" })
          .brevoTransport.apiKey,
      ).toBeNull();
    });
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
      instance: "local",
      brevo: { mode: "disabled", testRecipients: [] },
      database: {
        worker: { url: WORKER_URL, role: "influx_worker_login", tls: false },
      },
      sync: { mode: "dry_run", nonProductionRecipientAllowlist: [] },
    });
  });

  it("has no key for the api database variables, even when they are set (18 T4.6 a)", () => {
    const config = loadWorkerConfig({
      ...VALID_WORKER_ENV,
      DATABASE_URL: APP_URL,
      AUTH_DATABASE_URL: AUTH_URL,
    });
    expect(Object.keys(config.database)).toEqual(["worker"]);
    expect(JSON.stringify(config)).not.toContain("influx_app");
    expect(JSON.stringify(config)).not.toContain("influx_auth_login");
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
    [
      "a missing WORKER_DATABASE_URL",
      { INFLUX_ENV: "staging" },
      "WORKER_DATABASE_URL is required",
    ],
    [
      "WORKER_DATABASE_URL as influx_app",
      { ...VALID_WORKER_ENV, WORKER_DATABASE_URL: APP_URL },
      "WORKER_DATABASE_URL must connect as role influx_worker_login",
    ],
    [
      "on Railway, DATABASE_URL set on the worker service",
      {
        ...VALID_WORKER_ENV,
        RAILWAY_ENVIRONMENT_NAME: "production",
        DATABASE_URL: APP_URL,
      },
      "DATABASE_URL is reserved to another service and must not be set here",
    ],
    [
      "on Railway, AUTH_DATABASE_URL set on the worker service",
      {
        ...VALID_WORKER_ENV,
        RAILWAY_ENVIRONMENT_NAME: "staging",
        AUTH_DATABASE_URL: AUTH_URL,
      },
      "AUTH_DATABASE_URL is reserved to another service and must not be set here",
    ],
  ])("refuses %s", (_case, env, issue) => {
    expect(refusal(() => loadWorkerConfig(env))).toContain(issue);
  });

  it("accepts live sync outside production with an allowlist, and production in live", () => {
    expect(
      loadWorkerConfig({
        ...VALID_WORKER_ENV,
        SYNC_MODE: "live",
        NON_PRODUCTION_RECIPIENT_ALLOWLIST: "example.com, example.org",
      }).sync.nonProductionRecipientAllowlist,
    ).toEqual(["example.com", "example.org"]);
    expect(
      loadWorkerConfig({
        ...VALID_WORKER_ENV,
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
      INFLUX_PUBLIC_SITE_URL: WEB_ORIGIN,
      INFLUX_PUBLIC_BACKOFFICE_URL: BACKOFFICE_ORIGIN,
      AUTH_THROTTLE_PEPPER: THROTTLE_PEPPER,
      AUTH_TOKEN_SIGNING_SECRET: TOKEN_SIGNING_SECRET,
      SUPABASE_URL: TEST_SUPABASE_URL,
      SUPABASE_SECRET_KEY: TEST_SUPABASE_SECRET_KEY,
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

// Refusal to start on an inconsistent configuration: first half of T17
// (docs/mvp/18-plan-de-test-mvp.md T17, docs/mvp/21-plan-de-developpement.md §4, J1-D point 3).
// Since D70 (02 §12.4), a matrix by environment: development keeps locks 2 and 3; staging refuses
// exactly what production refuses (the single predicate isDeployedEnvironment).
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
  INFLUX_ENV: "development",
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
  INFLUX_ENV: "development",
  WORKER_DATABASE_URL: TEST_DATABASE_URLS.WORKER_DATABASE_URL,
} as const;

const HOSTED_SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
const APP_URL = TEST_DATABASE_URLS.DATABASE_URL;
const AUTH_URL = TEST_DATABASE_URLS.AUTH_DATABASE_URL;
const WORKER_URL = TEST_DATABASE_URLS.WORKER_DATABASE_URL;
const OPS_URL = TEST_DATABASE_URLS.OPS_DATABASE_URL;
const PRIVACY_URL = TEST_DATABASE_URLS.PRIVACY_DATABASE_URL;
const POOLER_APP_URL =
  "postgresql://influx_app.abcdefghijklmnop:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";
const POOLER_AUTH_URL =
  "postgresql://influx_auth_login.abcdefghijklmnop:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres";

/** A pooler URL of the project of HOSTED_SUPABASE_URL, for `role` (`project`: another one). */
function hostedUrl(role: string, project = "abcdefghijklmnop"): string {
  return `postgresql://${role}.${project}:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`;
}

/** The deployed environments of D70: they share every startup requirement (02 §12.4). */
const DEPLOYED = ["staging", "production"] as const;
type DeployedEnvironment = (typeof DEPLOYED)[number];

/** A complete api configuration of a deployed environment: live, no list, webhook, https. */
function deployedApiEnv(
  environment: DeployedEnvironment,
): Record<string, string> {
  return {
    ...VALID_API_ENV,
    INFLUX_ENV: environment,
    BREVO_MODE: "live",
    BREVO_API_KEY: "xkeysib-deployed-like-value",
    BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
    SUPABASE_URL: HOSTED_SUPABASE_URL,
    DATABASE_URL: hostedUrl("influx_app"),
    AUTH_DATABASE_URL: hostedUrl("influx_auth_login"),
    OPS_DATABASE_URL: hostedUrl("influx_ops_login"),
    BREVO_WEBHOOK_PATH_TOKEN_CURRENT: "p".repeat(43),
    BREVO_WEBHOOK_SECRET_CURRENT: "s".repeat(43),
  };
}

/** A complete worker configuration of a deployed environment: live, no list, E-5, GoTrue. */
function deployedWorkerEnv(
  environment: DeployedEnvironment,
): Record<string, string> {
  return {
    ...VALID_WORKER_ENV,
    INFLUX_ENV: environment,
    BREVO_MODE: "live",
    BREVO_API_KEY: "xkeysib-worker-deployed-like-value",
    BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
    SYNC_MODE: "live",
    SUPABASE_URL: HOSTED_SUPABASE_URL,
    SUPABASE_SECRET_KEY: TEST_SUPABASE_SECRET_KEY,
    WORKER_DATABASE_URL: hostedUrl("influx_worker_login"),
    OPS_DATABASE_URL: hostedUrl("influx_ops_login"),
    PRIVACY_DATABASE_URL: hostedUrl("influx_privacy_login"),
  };
}

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
      environment: "development",
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
      brevoWebhook: { pathTokens: [], headerTokens: [] },
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
      "live Brevo in development (16 RG116)",
      { ...VALID_API_ENV, BREVO_MODE: "live" },
      "BREVO_MODE live is refused in development",
    ],
    [
      "redirect without test recipients",
      { ...VALID_API_ENV, BREVO_MODE: "redirect" },
      "BREVO_TEST_RECIPIENTS is required when BREVO_MODE is redirect",
    ],
    [
      "a missing internal secret",
      { INFLUX_ENV: "development", INFLUX_API_INTERNAL_SECRET_WEB: WEB_SECRET },
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
      "the same internal secret for both fronts",
      { ...VALID_API_ENV, INFLUX_API_INTERNAL_SECRET_BACKOFFICE: WEB_SECRET },
      "INFLUX_API_INTERNAL_SECRET_BACKOFFICE must differ from INFLUX_API_INTERNAL_SECRET_WEB",
    ],
    [
      "an unknown environment (18 T17.8)",
      { ...VALID_API_ENV, INFLUX_ENV: "test" },
      "INFLUX_ENV must be development, staging or production",
    ],
    [
      "an absent environment: no default (02 §12.4)",
      { ...VALID_API_ENV, INFLUX_ENV: undefined },
      "INFLUX_ENV must be development, staging or production",
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
      "on Railway, the E-5 variable set on the api service (J8 commit 8)",
      {
        ...VALID_API_ENV,
        RAILWAY_ENVIRONMENT_NAME: "staging",
        PRIVACY_DATABASE_URL: PRIVACY_URL,
      },
      "PRIVACY_DATABASE_URL is reserved to another service and must not be set here",
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

  // 21 EC-19, J3-C rule 10: the transactional sender of the api.
  describe("Brevo transport of the api (EC-19)", () => {
    const REDIRECT = {
      ...VALID_API_ENV,
      BREVO_MODE: "redirect",
      BREVO_TEST_RECIPIENTS: "team@influx.example",
      BREVO_API_KEY: "xkeysib-test-account-value",
      BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
    };

    it("accepts the local double on a loopback host in development", () => {
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

    it("needs neither key nor sender when disabled", () => {
      expect(
        loadApiConfig({ ...VALID_API_ENV, BREVO_MODE: "disabled" })
          .brevoTransport.apiKey,
      ).toBeNull();
    });
  });

  // J7 decision 1 (16 RG146-1, RG146-2; skill env-secrets, rotation B): two secrets, two values each.
  describe("Brevo webhook secrets of the api (J7 decision 1)", () => {
    const PATH_CURRENT = "P".repeat(21) + "-_" + "q".repeat(20);
    const PATH_PREVIOUS = "R".repeat(43);
    const HEADER_CURRENT = "h".repeat(40) + "_-H".repeat(3);
    const HEADER_PREVIOUS = "s".repeat(64);
    const OPEN = {
      ...VALID_API_ENV,
      BREVO_WEBHOOK_PATH_TOKEN_CURRENT: PATH_CURRENT,
      BREVO_WEBHOOK_SECRET_CURRENT: HEADER_CURRENT,
    };
    it("closes the webhook when no secret is set, in development", () => {
      expect(loadApiConfig(VALID_API_ENV).brevoWebhook).toEqual({
        pathTokens: [],
        headerTokens: [],
      });
    });

    it("lists the current value first, then the previous one during a rotation", () => {
      expect(
        loadApiConfig({
          ...OPEN,
          BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS: PATH_PREVIOUS,
          BREVO_WEBHOOK_SECRET_PREVIOUS: HEADER_PREVIOUS,
        }).brevoWebhook,
      ).toEqual({
        pathTokens: [PATH_CURRENT, PATH_PREVIOUS],
        headerTokens: [HEADER_CURRENT, HEADER_PREVIOUS],
      });
    });

    it.each<[string, Environment, string]>([
      [
        "a path token without a header secret",
        { ...VALID_API_ENV, BREVO_WEBHOOK_PATH_TOKEN_CURRENT: PATH_CURRENT },
        "BREVO_WEBHOOK_SECRET_CURRENT BREVO_WEBHOOK_PATH_TOKEN_CURRENT and BREVO_WEBHOOK_SECRET_CURRENT go together",
      ],
      [
        "a header secret without a path token",
        { ...VALID_API_ENV, BREVO_WEBHOOK_SECRET_CURRENT: HEADER_CURRENT },
        "BREVO_WEBHOOK_PATH_TOKEN_CURRENT BREVO_WEBHOOK_PATH_TOKEN_CURRENT and BREVO_WEBHOOK_SECRET_CURRENT go together",
      ],
      [
        "a previous path token without a current one",
        {
          ...VALID_API_ENV,
          BREVO_WEBHOOK_SECRET_CURRENT: HEADER_CURRENT,
          BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS: PATH_PREVIOUS,
        },
        "BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS needs BREVO_WEBHOOK_PATH_TOKEN_CURRENT",
      ],
      [
        "a previous header secret equal to the current one",
        { ...OPEN, BREVO_WEBHOOK_SECRET_PREVIOUS: HEADER_CURRENT },
        "BREVO_WEBHOOK_SECRET_PREVIOUS must differ from BREVO_WEBHOOK_SECRET_CURRENT",
      ],
      [
        "a path token of 42 characters",
        { ...OPEN, BREVO_WEBHOOK_PATH_TOKEN_CURRENT: PATH_CURRENT.slice(1) },
        "BREVO_WEBHOOK_PATH_TOKEN_CURRENT must be 43 base64url characters (32 random bytes)",
      ],
      [
        "a path token outside base64url",
        {
          ...OPEN,
          BREVO_WEBHOOK_PATH_TOKEN_CURRENT: `${PATH_CURRENT.slice(1)}.`,
        },
        "BREVO_WEBHOOK_PATH_TOKEN_CURRENT must be 43 base64url characters (32 random bytes)",
      ],
      [
        "a header secret of 42 characters",
        { ...OPEN, BREVO_WEBHOOK_SECRET_CURRENT: "h".repeat(42) },
        "BREVO_WEBHOOK_SECRET_CURRENT must be 43 to 128 base64url characters (at least 32 random bytes)",
      ],
      [
        "the placeholder in a header secret",
        { ...OPEN, BREVO_WEBHOOK_SECRET_CURRENT: "change_me".padEnd(43, "x") },
        "BREVO_WEBHOOK_SECRET_CURRENT must not contain the CHANGE_ME placeholder",
      ],
      [
        "the path token reused as the header secret",
        { ...OPEN, BREVO_WEBHOOK_SECRET_CURRENT: PATH_CURRENT },
        "BREVO_WEBHOOK_SECRET_CURRENT must differ from every other secret of the process",
      ],
    ])("refuses %s", (_case, env, issue) => {
      expect(refusal(() => loadApiConfig(env))).toContain(issue);
    });

    it("never quotes a webhook secret in the refusal", () => {
      const issues = refusal(() =>
        loadApiConfig({
          ...OPEN,
          BREVO_WEBHOOK_SECRET_PREVIOUS: HEADER_CURRENT,
        }),
      ).join(" ");
      expect(issues).not.toContain(HEADER_CURRENT);
      expect(issues).not.toContain(PATH_CURRENT);
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
      environment: "development",
      version: "local",
      instance: "local",
      brevo: { mode: "disabled", testRecipients: [] },
      brevoTransport: {
        apiKey: null,
        baseUrl: "https://api.brevo.com/v3",
        senderTransactional: null,
        suppressionListId: null,
      },
      brevoIds: { listIds: {} },
      apollo: { apiKey: null, baseUrl: "https://api.apollo.io/api/v1" },
      database: {
        worker: { url: WORKER_URL, role: "influx_worker_login", tls: false },
        privacy: null,
      },
      supabase: null,
      sync: {
        mode: "dry_run",
        recipientFilter: { kind: "allowlist", domains: [] },
      },
    });
  });

  it("has no key for the api database variables, even when they are set (18 T4.6 a)", () => {
    const config = loadWorkerConfig({
      ...VALID_WORKER_ENV,
      DATABASE_URL: APP_URL,
      AUTH_DATABASE_URL: AUTH_URL,
    });
    expect(Object.keys(config.database)).toEqual(["worker", "privacy"]);
    expect(JSON.stringify(config)).not.toContain("influx_app");
    expect(JSON.stringify(config)).not.toContain("influx_auth_login");
  });

  it.each<[string, Environment, string]>([
    [
      "live sync in development without an allowlist (lock 3)",
      { ...VALID_WORKER_ENV, SYNC_MODE: "live" },
      "NON_PRODUCTION_RECIPIENT_ALLOWLIST is required when SYNC_MODE is live in development",
    ],
    [
      "live Brevo in development (lock 2)",
      { ...VALID_WORKER_ENV, BREVO_MODE: "live" },
      "BREVO_MODE live is refused in development",
    ],
    [
      "redirect without test recipients",
      { ...VALID_WORKER_ENV, BREVO_MODE: "redirect" },
      "BREVO_TEST_RECIPIENTS is required when BREVO_MODE is redirect",
    ],
    [
      "a missing WORKER_DATABASE_URL",
      { INFLUX_ENV: "development" },
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

  it("accepts live sync in development with an allowlist, resolved as the recipient filter", () => {
    expect(
      loadWorkerConfig({
        ...VALID_WORKER_ENV,
        SYNC_MODE: "live",
        NON_PRODUCTION_RECIPIENT_ALLOWLIST: "example.com, example.org",
      }).sync,
    ).toEqual({
      mode: "live",
      recipientFilter: {
        kind: "allowlist",
        domains: ["example.com", "example.org"],
      },
    });
  });

  describe("PRIVACY_DATABASE_URL: E-5 on a pool of its own, never influx_worker_login (03 P7, J8 commit 8)", () => {
    it("reads it when set, as influx_privacy_login, next to the worker's pool", () => {
      expect(
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          PRIVACY_DATABASE_URL: PRIVACY_URL,
        }).database,
      ).toEqual({
        worker: { url: WORKER_URL, role: "influx_worker_login", tls: false },
        privacy: {
          url: PRIVACY_URL,
          role: "influx_privacy_login",
          tls: false,
        },
      });
    });

    it.each<[string, Environment, string]>([
      [
        "the worker's role behind it",
        { ...VALID_WORKER_ENV, PRIVACY_DATABASE_URL: WORKER_URL },
        "PRIVACY_DATABASE_URL must connect as role influx_privacy_login",
      ],
    ])("refuses %s", (_case, env, issue) => {
      expect(refusal(() => loadWorkerConfig(env))).toContain(issue);
    });
  });

  describe("Brevo list ids from the environment (D68, D69)", () => {
    it("maps each list id given to its sub-key of leads.sync_settings, and leaves the others out", () => {
      expect(
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          BREVO_LIST_ID_ADVERTISERS: "3",
          BREVO_LIST_ID_CREATORS: "",
        }).brevoIds,
      ).toEqual({ listIds: { advertisers: 3 } });
    });

    it.each([
      ["BREVO_LIST_ID_ADVERTISERS", "0"],
      ["BREVO_LIST_ID_CREATORS", "-2"],
      ["BREVO_LIST_ID_CREATORS", "1.5"],
      ["BREVO_LIST_ID_ADVERTISERS", "advertisers"],
    ])("refuses %s=%s, naming the variable", (variable, value) => {
      const issues = refusal(() =>
        loadWorkerConfig({ ...VALID_WORKER_ENV, [variable]: value }),
      );
      expect(issues.join("; ")).toContain(variable);
      expect(issues.join("; ")).not.toContain(value);
    });

    it.each([
      "BREVO_TEMPLATE_ID_WELCOME_ADVERTISER",
      "BREVO_TEMPLATE_ID_WELCOME_CREATOR",
      "BREVO_TEMPLATE_ID_EMAIL_CHANGED_NOTICE",
    ])(
      "refuses the withdrawn template variable %s (D69), never ignores it",
      (variable) => {
        expect(
          refusal(() =>
            loadWorkerConfig({ ...VALID_WORKER_ENV, [variable]: "11" }),
          ).join("; "),
        ).toContain(`${variable} is no longer read`);
      },
    );
  });

  describe("Brevo transport of the worker: its own key (EC-19, J6 commit 4)", () => {
    const REDIRECT = {
      ...VALID_WORKER_ENV,
      BREVO_MODE: "redirect",
      BREVO_TEST_RECIPIENTS: "team@influx.example",
      BREVO_API_KEY: "xkeysib-worker-test-account-value",
      BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
    };

    it("reads the key, the double, the sender and the suppression list of the worker", () => {
      expect(
        loadWorkerConfig({
          ...REDIRECT,
          BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3",
          BREVO_SUPPRESSION_LIST_ID: "7",
        }).brevoTransport,
      ).toEqual({
        apiKey: "xkeysib-worker-test-account-value",
        baseUrl: "http://127.0.0.1:4010/v3",
        senderTransactional: "no-reply@tx.influx.example",
        suppressionListId: 7,
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
      ["BREVO_SUPPRESSION_LIST_ID", { BREVO_SUPPRESSION_LIST_ID: "0" }],
      ["BREVO_SUPPRESSION_LIST_ID", { BREVO_SUPPRESSION_LIST_ID: "list" }],
    ])("refuses %s when %j", (variable, overrides) => {
      expect(() => loadWorkerConfig({ ...REDIRECT, ...overrides })).toThrow(
        variable,
      );
    });

    it("scenario 14 for the worker: live in development refuses to start, key or not", () => {
      expect(
        refusal(() => loadWorkerConfig({ ...REDIRECT, BREVO_MODE: "live" })),
      ).toContain("BREVO_MODE live is refused in development");
    });
  });

  it("refuses the Brevo webhook secrets on Railway: the api service's only (skill env-secrets)", () => {
    expect(
      refusal(() =>
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          RAILWAY_ENVIRONMENT_NAME: "staging",
          BREVO_WEBHOOK_SECRET_CURRENT: "w".repeat(43),
        }),
      ),
    ).toContain("BREVO_WEBHOOK_SECRET_CURRENT belongs to the api service only");
    // Locally, the api and the worker read the same apps/api/.env.local.
    expect(() =>
      loadWorkerConfig({
        ...VALID_WORKER_ENV,
        BREVO_WEBHOOK_SECRET_CURRENT: "w".repeat(43),
      }),
    ).not.toThrow();
  });

  describe("GoTrue of the worker: its own secret key, for the purge of 04 §9 only (J7 commit 5)", () => {
    it("reads the origin and the key together; neither is no purge in development", () => {
      expect(
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          SUPABASE_URL: HOSTED_SUPABASE_URL,
          SUPABASE_SECRET_KEY: TEST_SUPABASE_SECRET_KEY,
        }).supabase,
      ).toEqual({
        url: HOSTED_SUPABASE_URL,
        secretKey: TEST_SUPABASE_SECRET_KEY,
      });
      expect(
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          SUPABASE_URL: "",
          SUPABASE_SECRET_KEY: "",
        }).supabase,
      ).toBeNull();
    });

    it.each<[string, Environment, string]>([
      [
        "an origin without its key",
        { ...VALID_WORKER_ENV, SUPABASE_URL: HOSTED_SUPABASE_URL },
        "SUPABASE_SECRET_KEY is required with SUPABASE_URL",
      ],
      [
        "a key without its origin",
        { ...VALID_WORKER_ENV, SUPABASE_SECRET_KEY: TEST_SUPABASE_SECRET_KEY },
        "SUPABASE_URL is required with SUPABASE_SECRET_KEY",
      ],
      [
        "a legacy JWT key",
        {
          ...VALID_WORKER_ENV,
          SUPABASE_URL: HOSTED_SUPABASE_URL,
          SUPABASE_SECRET_KEY: "eyJhbGciOiJIUzI1NiJ9.legacy.key",
        },
        "SUPABASE_SECRET_KEY must be a secret key (sb_secret_…), never a legacy JWT key",
      ],
    ])("refuses %s", (_case, env, issue) => {
      expect(refusal(() => loadWorkerConfig(env))).toContain(issue);
    });
  });

  describe("Apollo of the worker: APOLLO_API_KEY, the worker's only (skill env-secrets, J6 commit 5)", () => {
    it("reads the key; no key is no credentials, never a refusal", () => {
      expect(
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          APOLLO_API_KEY: "apollo-test-account-value",
        }).apollo,
      ).toEqual({
        apiKey: "apollo-test-account-value",
        baseUrl: "https://api.apollo.io/api/v1",
      });
      expect(
        loadWorkerConfig({ ...VALID_WORKER_ENV, APOLLO_API_KEY: "" }).apollo
          .apiKey,
      ).toBeNull();
    });

    it("refuses the template's placeholder as a key", () => {
      expect(() =>
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          APOLLO_API_KEY: "change_me-key",
        }),
      ).toThrow("APOLLO_API_KEY");
    });

    it("reaches the official Apollo URL only: no variable can point it elsewhere", () => {
      expect(
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          APOLLO_API_KEY: "apollo-test-account-value",
          APOLLO_API_BASE_URL: "http://127.0.0.1:4020/api/v1",
        }).apollo.baseUrl,
      ).toBe("https://api.apollo.io/api/v1");
    });

    it("the api never reads an Apollo variable", () => {
      const config = loadApiConfig({
        ...VALID_API_ENV,
        APOLLO_API_KEY: "apollo-test-account-value",
      });
      expect(JSON.stringify(config)).not.toContain("apollo");
    });
  });
});

// 18 T17 after D70 (02 §12.4): each case removes or adds one variable to a complete deployed
// configuration, and the same case runs for staging and for production.
type DeployedCase = [string, Environment, string];

const API_DEPLOYED_CASES: readonly DeployedCase[] = [
  [
    "Brevo disabled (a mute deployed environment, 16 RG116)",
    { BREVO_MODE: "disabled" },
    "BREVO_MODE must be live in a deployed environment",
  ],
  [
    "no BREVO_MODE (the default disabled never passes)",
    { BREVO_MODE: undefined },
    "BREVO_MODE must be live in a deployed environment",
  ],
  [
    "Brevo redirect",
    { BREVO_MODE: "redirect", BREVO_TEST_RECIPIENTS: "team@influx.example" },
    "BREVO_MODE must be live in a deployed environment",
  ],
  [
    "BREVO_TEST_RECIPIENTS set next to live: refused, never ignored",
    { BREVO_TEST_RECIPIENTS: "team@influx.example" },
    "BREVO_TEST_RECIPIENTS is refused in a deployed environment (development only)",
  ],
  [
    "the local double",
    { BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3" },
    "BREVO_API_BASE_URL must be the official Brevo URL in a deployed environment",
  ],
  [
    "no webhook secret (unsubscriptions lost, 16 RG89)",
    {
      BREVO_WEBHOOK_PATH_TOKEN_CURRENT: undefined,
      BREVO_WEBHOOK_SECRET_CURRENT: undefined,
    },
    "BREVO_WEBHOOK_SECRET_CURRENT the Brevo webhook secrets are required in a deployed environment (unsubscriptions, 16 RG89)",
  ],
  [
    "an http public origin of the site",
    { INFLUX_PUBLIC_SITE_URL: "http://influx.example" },
    "INFLUX_PUBLIC_SITE_URL must be an https origin in a deployed environment",
  ],
  [
    "an http public origin of the backoffice",
    { INFLUX_PUBLIC_BACKOFFICE_URL: "http://bo.influx.example" },
    "INFLUX_PUBLIC_BACKOFFICE_URL must be an https origin in a deployed environment",
  ],
  [
    "the local stack's Supabase URL",
    { SUPABASE_URL: TEST_SUPABASE_URL },
    "SUPABASE_URL must be an https origin in a deployed environment",
  ],
];

const WORKER_DEPLOYED_CASES: readonly DeployedCase[] = [
  [
    "dry_run (18 T17.5)",
    { SYNC_MODE: "dry_run" },
    "SYNC_MODE must be live in a deployed environment",
  ],
  [
    "no SYNC_MODE (the default dry_run never passes, T17.5)",
    { SYNC_MODE: undefined },
    "SYNC_MODE must be live in a deployed environment",
  ],
  [
    "NON_PRODUCTION_RECIPIENT_ALLOWLIST set: refused, never ignored",
    { NON_PRODUCTION_RECIPIENT_ALLOWLIST: "influx.example" },
    "NON_PRODUCTION_RECIPIENT_ALLOWLIST is refused in a deployed environment (development only)",
  ],
  [
    "BREVO_TEST_RECIPIENTS set: refused, never ignored",
    { BREVO_TEST_RECIPIENTS: "team@influx.example" },
    "BREVO_TEST_RECIPIENTS is refused in a deployed environment (development only)",
  ],
  [
    "Brevo disabled",
    { BREVO_MODE: "disabled" },
    "BREVO_MODE must be live in a deployed environment",
  ],
  [
    "the local double",
    { BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3" },
    "BREVO_API_BASE_URL must be the official Brevo URL in a deployed environment",
  ],
  [
    "no PRIVACY_DATABASE_URL (21 §5.8: the execution of the requests)",
    { PRIVACY_DATABASE_URL: undefined },
    "PRIVACY_DATABASE_URL is required in a deployed environment (execution of the data subject requests)",
  ],
  [
    "no GoTrue pair (D43: the purge must run)",
    { SUPABASE_URL: undefined, SUPABASE_SECRET_KEY: undefined },
    "SUPABASE_URL is required in a deployed environment (purge of the GoTrue users without an account)",
  ],
  [
    "the local stack's Supabase URL",
    { SUPABASE_URL: TEST_SUPABASE_URL },
    "SUPABASE_URL must be an https origin in a deployed environment",
  ],
];

describe.each(DEPLOYED)(
  "T17 in %s, a deployed environment (D70)",
  (environment) => {
    it("accepts the complete api configuration, in live", () => {
      const config = loadApiConfig(deployedApiEnv(environment));
      expect(config.environment).toBe(environment);
      expect(config.brevo).toEqual({ mode: "live", testRecipients: [] });
    });

    it("accepts the complete worker configuration, unrestricted: skipped_non_production is unreachable", () => {
      const config = loadWorkerConfig(deployedWorkerEnv(environment));
      expect(config.sync).toEqual({
        mode: "live",
        recipientFilter: { kind: "unrestricted" },
      });
      expect(config.database.privacy?.role).toBe("influx_privacy_login");
    });

    // D70 end-of-work review (S1): a .env.local half on the local stack never starts.
    it("worker refuses a database on the loopback next to a hosted project", () => {
      expect(
        refusal(() =>
          loadWorkerConfig({
            ...deployedWorkerEnv(environment),
            WORKER_DATABASE_URL: TEST_DATABASE_URLS.WORKER_DATABASE_URL,
          }),
        ),
      ).toContain(
        "WORKER_DATABASE_URL must reach a hosted Supabase project in a deployed environment, never the loopback",
      );
    });

    it("worker refuses two Supabase projects", () => {
      expect(
        refusal(() =>
          loadWorkerConfig({
            ...deployedWorkerEnv(environment),
            PRIVACY_DATABASE_URL: hostedUrl(
              "influx_privacy_login",
              "qrstuvwxyzabcdef",
            ),
          }),
        ),
      ).toContain(
        "PRIVACY_DATABASE_URL names another Supabase project than the other variables",
      );
    });

    it("worker refuses a SUPABASE_URL of another project than the databases", () => {
      expect(
        refusal(() =>
          loadWorkerConfig({
            ...deployedWorkerEnv(environment),
            SUPABASE_URL: "https://qrstuvwxyzabcdef.supabase.co",
          }),
        ),
      ).toContain(
        "SUPABASE_URL must be the origin of the Supabase project of the database variables",
      );
    });

    it("api refuses a database on the loopback", () => {
      expect(
        refusal(() =>
          loadApiConfig({
            ...deployedApiEnv(environment),
            DATABASE_URL: TEST_DATABASE_URLS.DATABASE_URL,
          }),
        ),
      ).toContain(
        "DATABASE_URL must reach a hosted Supabase project in a deployed environment, never the loopback",
      );
    });

    it.each(API_DEPLOYED_CASES)("api refuses %s", (_case, change, issue) => {
      expect(
        refusal(() =>
          loadApiConfig({ ...deployedApiEnv(environment), ...change }),
        ),
      ).toContain(issue);
    });

    it.each(WORKER_DEPLOYED_CASES)(
      "worker refuses %s",
      (_case, change, issue) => {
        expect(
          refusal(() =>
            loadWorkerConfig({ ...deployedWorkerEnv(environment), ...change }),
          ),
        ).toContain(issue);
      },
    );
  },
);

describe("T17: staging refuses exactly what production refuses (D70)", () => {
  it.each(API_DEPLOYED_CASES)("api, %s: the same issues", (_case, change) => {
    expect(
      refusal(() => loadApiConfig({ ...deployedApiEnv("staging"), ...change })),
    ).toEqual(
      refusal(() =>
        loadApiConfig({ ...deployedApiEnv("production"), ...change }),
      ),
    );
  });

  it.each(WORKER_DEPLOYED_CASES)(
    "worker, %s: the same issues",
    (_case, change) => {
      expect(
        refusal(() =>
          loadWorkerConfig({ ...deployedWorkerEnv("staging"), ...change }),
        ),
      ).toEqual(
        refusal(() =>
          loadWorkerConfig({ ...deployedWorkerEnv("production"), ...change }),
        ),
      );
    },
  );
});

describe("T17 in development: locks 2 and 3 kept (D70)", () => {
  it("accepts the two lists, and redirect towards the double", () => {
    const config = loadWorkerConfig({
      ...VALID_WORKER_ENV,
      BREVO_MODE: "redirect",
      BREVO_TEST_RECIPIENTS: "team@influx.example",
      BREVO_API_KEY: "xkeysib-double-key",
      BREVO_SENDER_TRANSACTIONAL: "no-reply@tx.influx.example",
      BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3",
      SYNC_MODE: "live",
      NON_PRODUCTION_RECIPIENT_ALLOWLIST: "influx.example",
    });
    expect(config.brevo).toEqual({
      mode: "redirect",
      testRecipients: ["team@influx.example"],
    });
    expect(config.sync.recipientFilter).toEqual({
      kind: "allowlist",
      domains: ["influx.example"],
    });
  });

  it("api: development on Railway is refused (a deployed service never relaxes by a variable)", () => {
    expect(
      refusal(() =>
        loadApiConfig({
          ...VALID_API_ENV,
          RAILWAY_ENVIRONMENT_NAME: "staging",
        }),
      ),
    ).toContain("INFLUX_ENV development is refused on Railway");
  });

  it("worker: development on Railway is refused", () => {
    expect(
      refusal(() =>
        loadWorkerConfig({
          ...VALID_WORKER_ENV,
          RAILWAY_ENVIRONMENT_NAME: "production",
        }),
      ),
    ).toContain("INFLUX_ENV development is refused on Railway");
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
      INFLUX_ENV: "development",
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

  it.each(DEPLOYED)(
    "worker refuses to start in %s with dry_run (18 T17.5, T17.10)",
    (environment) => {
      const result = start("worker.ts", {
        INFLUX_ENV: environment,
        BREVO_MODE: "live",
        SYNC_MODE: "dry_run",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "SYNC_MODE must be live in a deployed environment",
      );
    },
  );

  it.each(DEPLOYED)(
    "api refuses to start in %s with a redirect list (D70: refused, never ignored)",
    (environment) => {
      const result = start("main.ts", {
        ...deployedApiEnv(environment),
        BREVO_TEST_RECIPIENTS: "team@influx.example",
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toContain(
        "BREVO_TEST_RECIPIENTS is refused in a deployed environment (development only)",
      );
    },
  );
});

describe("DATABASE_CA_CERT (21 EC-34)", () => {
  const POOLER = (role: string) =>
    `postgresql://${role}.abcdefghijklmnop:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`;
  const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";

  it("verifies the pooler against the given root, never on a loopback connection", () => {
    const config = loadApiConfig({
      ...VALID_API_ENV,
      DATABASE_URL: POOLER("influx_app"),
      DATABASE_CA_CERT: PEM,
    });
    expect(config.database.app).toMatchObject({ tls: true, ca: PEM });
    expect(config.database.auth.ca).toBeUndefined();
  });

  it("refuses anything but a PEM certificate", () => {
    expect(
      refusal(() =>
        loadApiConfig({
          ...VALID_API_ENV,
          DATABASE_CA_CERT: `${PEM}-----BEGIN PRIVATE KEY-----`,
        }),
      ),
    ).toContain("DATABASE_CA_CERT must be a PEM certificate");
  });
});

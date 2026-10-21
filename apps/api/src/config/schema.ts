// Environment schemas of apps/api (docs/mvp/21-plan-de-developpement.md §4, J1-D and J1-F).
// Pure module: it never reads process.env (src/config/index.ts does). A variable enters these
// schemas in the commit that reads it (J1-D, point 1).
import * as z from "zod";

/**
 * `02` §12.4 (D70): `development` is the local stack, the CI, the tests and their helpers;
 * `staging` and `production` are deployed environments. No default: absent or unknown is refused.
 */
export const INFLUX_ENVIRONMENTS = [
  "development",
  "staging",
  "production",
] as const;
export type InfluxEnvironment = (typeof INFLUX_ENVIRONMENTS)[number];

/**
 * The single predicate of D70 (`02` §12.4): every value but `development` takes the strict startup
 * requirements, so that a value added one day is strict by default. Used by these schemas only; the
 * business code never reads the environment.
 */
export function isDeployedEnvironment(environment: InfluxEnvironment): boolean {
  return environment !== "development";
}

/** `16` RG116 amended by D70: `live` in a deployed environment, `disabled` or `redirect` elsewhere. */
export const BREVO_MODES = ["disabled", "redirect", "live"] as const;
export type BrevoMode = (typeof BREVO_MODES)[number];

/** `02` §12.4 (D70): `live` in a deployed environment, `dry_run` by default in `development`. */
export const SYNC_MODES = ["live", "dry_run"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

const DEFAULT_API_PORT = 3100;
const MIN_INTERNAL_SECRET_BYTES = 32;
const LOCAL_VERSION = "local";

/** A variable set to an empty value (`NAME=`) counts as absent. */
function emptyAsAbsent(value: unknown): unknown {
  return value === "" ? undefined : value;
}

/** Comma-separated list, trimmed, empty items dropped; absent means an empty list. */
function commaSeparated<Item extends z.ZodType<string>>(item: Item) {
  return z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0)
        : (value ?? []),
    z.array(item),
  );
}

const requiredText = z.string({
  error: (issue) =>
    issue.input === undefined ? "is required" : "must be a string",
});

/** Placeholder of the `.env.example` files: a copied template must never start (`03` PP-8). */
const PLACEHOLDER = "CHANGE_ME";

/** The placeholder, whatever its letter case: `change_me` is refused too (21 J1-J N3). */
function holdsPlaceholder(value: string): boolean {
  return value.toUpperCase().includes(PLACEHOLDER);
}

/** A secret of at least 32 bytes that is not the template's placeholder. */
const secretOf32Bytes = requiredText
  .refine(
    (value) =>
      new TextEncoder().encode(value).length >= MIN_INTERNAL_SECRET_BYTES,
    { message: `must be at least ${MIN_INTERNAL_SECRET_BYTES} bytes` },
  )
  // The length check alone accepts a padded placeholder (21 J1-J R4).
  .refine((value) => !holdsPlaceholder(value), {
    message: `must not contain the ${PLACEHOLDER} placeholder`,
  });

const internalSecret = secretOf32Bytes;

/** Hosts of the local stack and CI: plain http and TLS-less database connections allowed. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * URL of the Supabase project (SUPABASE_URL, 21 J3-E): its origin only, https except on a
 * loopback host (local stack, CI). The api reaches GoTrue there, never a table (EC-46).
 */
const supabaseUrl = requiredText.transform((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: "custom", message: "must be an http(s) URL" });
    return z.NEVER;
  }
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
  const hasAllowedScheme =
    url.protocol === "https:" || (url.protocol === "http:" && isLoopback);
  const isOriginOnly =
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!hasAllowedScheme || !isOriginOnly) {
    context.addIssue({
      code: "custom",
      message:
        "must be an https origin (http only on a loopback host), without path, query or credentials",
    });
    return z.NEVER;
  }
  return url.origin;
});

/** Prefix of a Supabase secret API key; the legacy service_role JWT is refused (21 EC-46). */
export const SUPABASE_SECRET_KEY_PREFIX = "sb_secret_";

/** SUPABASE_SECRET_KEY: a `sb_secret_…` key, never the template's placeholder. */
const supabaseSecretKey = requiredText
  .refine((value) => !holdsPlaceholder(value), {
    message: `must not contain the ${PLACEHOLDER} placeholder`,
  })
  .refine((value) => value.startsWith(SUPABASE_SECRET_KEY_PREFIX), {
    message: `must be a secret key (${SUPABASE_SECRET_KEY_PREFIX}…), never a legacy JWT key`,
  });

/** Official base URL of the Brevo API (16 §M8). Any other value is the local double only. */
export const BREVO_OFFICIAL_BASE_URL = "https://api.brevo.com/v3";

/**
 * Official base URL of the Apollo API (skill apollo-lead-sync), the only one the worker reaches: no
 * variable, so no double can be configured in any environment; the tests inject theirs.
 */
export const APOLLO_OFFICIAL_BASE_URL = "https://api.apollo.io/api/v1";

/**
 * BREVO_API_BASE_URL (21 J3-C rule 10, EC-19): the official URL, or the Brevo double of
 * @influx/test-kit on a loopback host. The loopback is refused in a deployed environment.
 */
const brevoApiBaseUrl = z.preprocess(
  emptyAsAbsent,
  z
    .string()
    .default(BREVO_OFFICIAL_BASE_URL)
    .transform((value, context) => {
      if (value === BREVO_OFFICIAL_BASE_URL) {
        return value;
      }
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        context.addIssue({ code: "custom", message: "must be an http(s) URL" });
        return z.NEVER;
      }
      const isLoopbackDouble =
        (url.protocol === "http:" || url.protocol === "https:") &&
        LOOPBACK_HOSTS.has(url.hostname) &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === "";
      if (!isLoopbackDouble) {
        context.addIssue({
          code: "custom",
          message: `must be ${BREVO_OFFICIAL_BASE_URL}, or the local double on a loopback host`,
        });
        return z.NEVER;
      }
      return value.replace(/\/+$/, "");
    }),
);

/**
 * Public origin of a surface (`https://influx.example`, `http://localhost:3000`): scheme, host
 * and port only, compared as is to the `origin` header of a write (03 §6.4 A4). Normalised by
 * URL (lower-case host, default port removed), as a browser serialises it.
 */
const publicOrigin = requiredText.transform((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: "custom", message: "must be an http(s) origin" });
    return z.NEVER;
  }
  const isOriginOnly =
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!isOriginOnly) {
    context.addIssue({
      code: "custom",
      message: "must be an http(s) origin, without path, query or credentials",
    });
    return z.NEVER;
  }
  return url.origin;
});

// ---------------------------------------------------------------------------------------------
// Database URLs (21 §3 EC-1 and EC-20, 03 §4 P7): one connection role per variable, one variable
// per Railway service. The user of each URL is checked here; the role actually obtained, and the
// absence of rolsuper / rolbypassrls, are checked in the database when the pool opens (src/db/).
// ---------------------------------------------------------------------------------------------

/** Connection role expected behind each database variable (03 P7, closed list). */
export const DATABASE_URL_ROLES = {
  DATABASE_URL: "influx_app",
  AUTH_DATABASE_URL: "influx_auth_login",
  WORKER_DATABASE_URL: "influx_worker_login",
  OPS_DATABASE_URL: "influx_ops_login",
  // E-5 (J8 commit 8): a pool of its own on the worker service, never influx_worker_login (03 P7).
  PRIVACY_DATABASE_URL: "influx_privacy_login",
} as const;
export type DatabaseUrlVariable = keyof typeof DATABASE_URL_ROLES;
export type ConnectionRole = (typeof DATABASE_URL_ROLES)[DatabaseUrlVariable];

/** Variables each service reads; any other one is reserved to another service. */
export const API_DATABASE_VARIABLES = [
  "DATABASE_URL",
  "AUTH_DATABASE_URL",
  "OPS_DATABASE_URL",
] as const satisfies readonly DatabaseUrlVariable[];
export const WORKER_DATABASE_VARIABLES = [
  "WORKER_DATABASE_URL",
] as const satisfies readonly DatabaseUrlVariable[];
/**
 * Read by the worker when set, required in a deployed environment (J8 commit 8): without it, no "mes données"
 * request is executed, and an approved one waits (03 P7, E-5).
 */
export const WORKER_OPTIONAL_DATABASE_VARIABLES = [
  "PRIVACY_DATABASE_URL",
] as const satisfies readonly DatabaseUrlVariable[];

export type DatabaseConnection = {
  /** Full URL, password included: never logged. */
  url: string;
  /** Postgres role the pool must obtain (current_user = session_user). */
  role: ConnectionRole;
  /**
   * TLS with certificate verification, except on a loopback host (local stack, CI).
   * `03` P7 rule 1: certificate verification is never disabled.
   */
  tls: boolean;
  /**
   * Root certificate (PEM) that the TLS of the pooler is verified against, when the system store
   * does not know it (DATABASE_CA_CERT, 21 EC-34). Absent: the system store.
   */
  ca?: string;
};

export type DatabaseUrlCheck =
  | { ok: true; connection: DatabaseConnection; user: string }
  | { ok: false; message: string };

/**
 * Checks one database URL. The user is `<role>` on the local stack (direct connection) or
 * `<role>.<project ref>` through the Supavisor pooler: the part before the first `.` must be
 * EXACTLY the expected role (18 T4.6 b). Messages never quote the value.
 */
export function checkDatabaseUrl(
  value: string,
  expectedRole: ConnectionRole,
): DatabaseUrlCheck {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, message: "must be a postgresql:// URL" };
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return { ok: false, message: "must be a postgresql:// URL" };
  }
  if (holdsPlaceholder(value)) {
    return {
      ok: false,
      message: `must not contain the ${PLACEHOLDER} placeholder`,
    };
  }
  let user: string;
  try {
    user = decodeURIComponent(url.username);
  } catch {
    return { ok: false, message: "has a malformed user" };
  }
  const separator = user.indexOf(".");
  const role = separator === -1 ? user : user.slice(0, separator);
  if (role !== expectedRole) {
    return { ok: false, message: `must connect as role ${expectedRole}` };
  }
  if (separator !== -1 && user.length === separator + 1) {
    return { ok: false, message: "has an empty project reference" };
  }
  return {
    ok: true,
    user,
    connection: {
      url: value,
      role: expectedRole,
      tls: !LOOPBACK_HOSTS.has(url.hostname),
    },
  };
}

type DatabaseEnv = Partial<Record<DatabaseUrlVariable, string>> & {
  INFLUX_ENV: InfluxEnvironment;
  SUPABASE_URL?: string | undefined;
  RAILWAY_ENVIRONMENT_NAME?: string | undefined;
  DATABASE_CA_CERT?: string | undefined;
};

/**
 * The Supabase project a URL names: `<ref>` of a pooler user `<role>.<ref>`, of a direct host
 * `db.<ref>.supabase.co` or of an API origin `https://<ref>.supabase.co`; null otherwise.
 */
function supabaseProjectOf(url: URL, user: string): string | null {
  const separator = user.indexOf(".");
  if (separator !== -1) {
    return user.slice(separator + 1);
  }
  const host = /^(?:db\.)?([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  return host?.[1] ?? null;
}

/**
 * Startup refusals of EC-20: exact role per URL, never two URLs of one process with the same
 * user, and on Railway no database variable reserved to another service (18 T4.6 a to d). In a
 * deployed environment (D70 end-of-work review, S1), never the loopback and ONE Supabase project
 * for every URL and SUPABASE_URL: a .env.local half on the local stack would otherwise send for
 * real from the local queue, and purge the staging GoTrue against a local account table.
 */
function checkDatabaseVariables(
  env: DatabaseEnv,
  required: readonly DatabaseUrlVariable[],
  context: z.RefinementCtx,
  optional: readonly DatabaseUrlVariable[] = [],
): void {
  const read = [...required, ...optional];
  const users = new Map<string, DatabaseUrlVariable>();
  const isDeployed = isDeployedEnvironment(env.INFLUX_ENV);
  const projects = new Set<string>();
  for (const variable of read) {
    const value = env[variable];
    if (value === undefined) {
      if (required.includes(variable)) {
        context.addIssue({
          code: "custom",
          path: [variable],
          message: "is required",
        });
      }
      continue;
    }
    const check = checkDatabaseUrl(value, DATABASE_URL_ROLES[variable]);
    if (!check.ok) {
      context.addIssue({
        code: "custom",
        path: [variable],
        message: check.message,
      });
      continue;
    }
    const sameUser = users.get(check.user);
    if (sameUser !== undefined) {
      context.addIssue({
        code: "custom",
        path: [variable],
        message: `must not use the same user as ${sameUser}`,
      });
      continue;
    }
    users.set(check.user, variable);
    if (isDeployed) {
      const url = new URL(value);
      const project = supabaseProjectOf(url, check.user);
      if (LOOPBACK_HOSTS.has(url.hostname) || project === null) {
        context.addIssue({
          code: "custom",
          path: [variable],
          message:
            "must reach a hosted Supabase project in a deployed environment, never the loopback",
        });
      } else if (projects.size > 0 && !projects.has(project)) {
        context.addIssue({
          code: "custom",
          path: [variable],
          message: "names another Supabase project than the other variables",
        });
      } else {
        projects.add(project);
      }
    }
  }
  if (isDeployed && env.SUPABASE_URL !== undefined) {
    const supabase = new URL(env.SUPABASE_URL);
    const project = supabaseProjectOf(supabase, "");
    if (project === null || (projects.size > 0 && !projects.has(project))) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message:
          "must be the origin of the Supabase project of the database variables",
      });
    }
  }
  // On Railway, a variable of another service is a misconfiguration that would otherwise go
  // unnoticed. Locally (shared .env.local), it is tolerated and simply never read (T4.6 d).
  if (env.RAILWAY_ENVIRONMENT_NAME !== undefined) {
    const all = Object.keys(DATABASE_URL_ROLES) as DatabaseUrlVariable[];
    for (const variable of all) {
      if (!read.includes(variable) && env[variable] !== undefined) {
        context.addIssue({
          code: "custom",
          path: [variable],
          message: "is reserved to another service and must not be set here",
        });
      }
    }
  }
}

/** Connection of a variable already accepted by checkDatabaseVariables (transform step). */
function databaseConnection(
  env: DatabaseEnv,
  variable: DatabaseUrlVariable,
): DatabaseConnection {
  const check = checkDatabaseUrl(
    env[variable] ?? "",
    DATABASE_URL_ROLES[variable],
  );
  if (!check.ok) {
    // Unreachable: superRefine refused the configuration before the transform runs.
    throw new Error(`${variable} was not validated`);
  }
  return check.connection.tls && env.DATABASE_CA_CERT !== undefined
    ? { ...check.connection, ca: env.DATABASE_CA_CERT }
    : check.connection;
}

const optionalText = z.preprocess(emptyAsAbsent, z.string().optional());

/** DATABASE_CA_CERT (EC-34): one or more PEM certificates, never a private key. */
const databaseCaCert = z.preprocess(
  emptyAsAbsent,
  z
    .string()
    .refine(
      (value) =>
        value.trim().startsWith("-----BEGIN CERTIFICATE-----") &&
        !value.includes("PRIVATE KEY"),
      { message: "must be a PEM certificate" },
    )
    .optional(),
);

const databaseEnvShape = {
  DATABASE_CA_CERT: databaseCaCert,
  DATABASE_URL: optionalText,
  AUTH_DATABASE_URL: optionalText,
  WORKER_DATABASE_URL: optionalText,
  OPS_DATABASE_URL: optionalText,
  PRIVACY_DATABASE_URL: optionalText,
  RAILWAY_ENVIRONMENT_NAME: optionalText,
};

const baseEnvShape = {
  INFLUX_ENV: z.enum(INFLUX_ENVIRONMENTS, {
    error: "must be development, staging or production",
  }),
  BREVO_MODE: z.preprocess(
    emptyAsAbsent,
    z
      .enum(BREVO_MODES, { error: "must be disabled, redirect or live" })
      .default("disabled"),
  ),
  BREVO_TEST_RECIPIENTS: commaSeparated(
    z.email({ error: "must list e-mail addresses" }),
  ),
  RAILWAY_GIT_COMMIT_SHA: z.preprocess(emptyAsAbsent, z.string().optional()),
  // Replica of the service, provided by Railway (D60: one metric line per instance).
  RAILWAY_REPLICA_ID: z.preprocess(emptyAsAbsent, z.string().optional()),
};

type BaseEnv = {
  INFLUX_ENV: InfluxEnvironment;
  BREVO_MODE: BrevoMode;
  BREVO_TEST_RECIPIENTS: string[];
  RAILWAY_ENVIRONMENT_NAME?: string | undefined;
};

/**
 * Startup refusals shared by api and worker (`16` RG116, `21` J1-D point 3, `02` §12.4 after D70).
 * A deployed environment sends for real: `live` only, and no redirect list, refused rather than
 * ignored (a dormant list would revive at the first change of INFLUX_ENV). `development` never
 * sends for real, and never runs on Railway.
 */
function checkBrevoMode(env: BaseEnv, context: z.RefinementCtx): void {
  const isDeployed = isDeployedEnvironment(env.INFLUX_ENV);
  if (env.BREVO_MODE === "live" && !isDeployed) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_MODE"],
      message: "live is refused in development",
    });
  }
  if (env.BREVO_MODE !== "live" && isDeployed) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_MODE"],
      message: "must be live in a deployed environment",
    });
  }
  if (isDeployed && env.BREVO_TEST_RECIPIENTS.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_TEST_RECIPIENTS"],
      message: "is refused in a deployed environment (development only)",
    });
  }
  if (!isDeployed && env.RAILWAY_ENVIRONMENT_NAME !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["INFLUX_ENV"],
      message: "development is refused on Railway",
    });
  }
  if (env.BREVO_MODE === "redirect" && env.BREVO_TEST_RECIPIENTS.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_TEST_RECIPIENTS"],
      message: "is required when BREVO_MODE is redirect",
    });
  }
}

/** The Brevo variables of a sending service: api and worker, each its own key (21 EC-19). */
const brevoTransportShape = {
  BREVO_API_KEY: optionalText,
  BREVO_API_BASE_URL: brevoApiBaseUrl,
  BREVO_SENDER_TRANSACTIONAL: z.preprocess(
    emptyAsAbsent,
    z.email({ error: "must be an e-mail address" }).optional(),
  ),
};

type BrevoTransportEnv = BaseEnv & {
  BREVO_API_KEY?: string | undefined;
  BREVO_API_BASE_URL: string;
  BREVO_SENDER_TRANSACTIONAL?: string | undefined;
};

/**
 * EC-19 and J3-C rule 10, for api and worker: a sending mode needs its key and its sender; the key
 * is never the template's placeholder; the local double is never reached from a deployed environment.
 */
function checkBrevoTransport(
  env: BrevoTransportEnv,
  context: z.RefinementCtx,
): void {
  if (env.BREVO_MODE !== "disabled") {
    if (env.BREVO_API_KEY === undefined) {
      context.addIssue({
        code: "custom",
        path: ["BREVO_API_KEY"],
        message: "is required unless BREVO_MODE is disabled",
      });
    }
    if (env.BREVO_SENDER_TRANSACTIONAL === undefined) {
      context.addIssue({
        code: "custom",
        path: ["BREVO_SENDER_TRANSACTIONAL"],
        message: "is required unless BREVO_MODE is disabled",
      });
    }
  }
  if (env.BREVO_API_KEY !== undefined && holdsPlaceholder(env.BREVO_API_KEY)) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_API_KEY"],
      message: `must not contain the ${PLACEHOLDER} placeholder`,
    });
  }
  if (
    isDeployedEnvironment(env.INFLUX_ENV) &&
    env.BREVO_API_BASE_URL !== BREVO_OFFICIAL_BASE_URL
  ) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_API_BASE_URL"],
      message: "must be the official Brevo URL in a deployed environment",
    });
  }
}

/**
 * The Brevo webhook (16 RG146, decision 1 of the J7 start; skill env-secrets, rotation B): two
 * secrets, two values each (`_CURRENT`, and `_PREVIOUS` during a rotation), on the api service only.
 * - BREVO_WEBHOOK_PATH_TOKEN_*: the path segment, 43 base64url characters (32 random bytes). It
 *   routes only: Railway's edge logs paths (RG146-2).
 * - BREVO_WEBHOOK_SECRET_*: the custom header `brevo-webhook-token`, 43 to 128 base64url
 *   characters: the authentication (RG146-1).
 * Both absent: the webhook is closed (every call is refused as an unknown route), allowed in
 * development only: in a deployed environment, a closed webhook would lose unsubscriptions (RG89).
 */
export const BREVO_WEBHOOK_VARIABLES = [
  "BREVO_WEBHOOK_PATH_TOKEN_CURRENT",
  "BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS",
  "BREVO_WEBHOOK_SECRET_CURRENT",
  "BREVO_WEBHOOK_SECRET_PREVIOUS",
] as const;

type BrevoWebhookVariable = (typeof BREVO_WEBHOOK_VARIABLES)[number];

const brevoWebhookPathToken = z.preprocess(
  emptyAsAbsent,
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, {
      message: "must be 43 base64url characters (32 random bytes)",
    })
    .optional(),
);

const brevoWebhookSecret = z.preprocess(
  emptyAsAbsent,
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{43,128}$/, {
      message:
        "must be 43 to 128 base64url characters (at least 32 random bytes)",
    })
    .optional(),
);

const brevoWebhookShape = {
  BREVO_WEBHOOK_PATH_TOKEN_CURRENT: brevoWebhookPathToken,
  BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS: brevoWebhookPathToken,
  BREVO_WEBHOOK_SECRET_CURRENT: brevoWebhookSecret,
  BREVO_WEBHOOK_SECRET_PREVIOUS: brevoWebhookSecret,
};

type BrevoWebhookEnv = BaseEnv &
  Partial<Record<BrevoWebhookVariable, string | undefined>>;

/**
 * Refusals of the webhook secrets: a placeholder; a previous value without a current one, or equal
 * to it; a path token without a header secret or the reverse; deployed, none at all; and one
 * value reused for another secret of the process (`others`): one secret, one use.
 */
function checkBrevoWebhook(
  env: BrevoWebhookEnv,
  others: readonly (string | undefined)[],
  context: z.RefinementCtx,
): void {
  for (const variable of BREVO_WEBHOOK_VARIABLES) {
    const value = env[variable];
    if (value !== undefined && holdsPlaceholder(value)) {
      context.addIssue({
        code: "custom",
        path: [variable],
        message: `must not contain the ${PLACEHOLDER} placeholder`,
      });
    }
  }
  for (const secret of ["PATH_TOKEN", "SECRET"] as const) {
    const current = env[`BREVO_WEBHOOK_${secret}_CURRENT`];
    const previous = env[`BREVO_WEBHOOK_${secret}_PREVIOUS`];
    if (previous !== undefined && current === undefined) {
      context.addIssue({
        code: "custom",
        path: [`BREVO_WEBHOOK_${secret}_PREVIOUS`],
        message: `needs BREVO_WEBHOOK_${secret}_CURRENT`,
      });
    }
    if (previous !== undefined && previous === current) {
      context.addIssue({
        code: "custom",
        path: [`BREVO_WEBHOOK_${secret}_PREVIOUS`],
        message: `must differ from BREVO_WEBHOOK_${secret}_CURRENT`,
      });
    }
  }
  const hasPath = env.BREVO_WEBHOOK_PATH_TOKEN_CURRENT !== undefined;
  const hasSecret = env.BREVO_WEBHOOK_SECRET_CURRENT !== undefined;
  if (hasPath !== hasSecret) {
    context.addIssue({
      code: "custom",
      path: [
        hasPath
          ? "BREVO_WEBHOOK_SECRET_CURRENT"
          : "BREVO_WEBHOOK_PATH_TOKEN_CURRENT",
      ],
      message:
        "BREVO_WEBHOOK_PATH_TOKEN_CURRENT and BREVO_WEBHOOK_SECRET_CURRENT go together",
    });
  }
  if (isDeployedEnvironment(env.INFLUX_ENV) && !(hasPath && hasSecret)) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_WEBHOOK_SECRET_CURRENT"],
      message:
        "the Brevo webhook secrets are required in a deployed environment (unsubscriptions, 16 RG89)",
    });
  }
  const values = BREVO_WEBHOOK_VARIABLES.map((variable) => env[variable]);
  for (const variable of BREVO_WEBHOOK_VARIABLES) {
    const value = env[variable];
    if (value === undefined) {
      continue;
    }
    const reused =
      others.includes(value) ||
      values.filter((other) => other === value).length > 1;
    if (reused) {
      context.addIssue({
        code: "custom",
        path: [variable],
        message: "must differ from every other secret of the process",
      });
    }
  }
}

export type BaseConfig = {
  environment: InfluxEnvironment;
  /** Deployed commit, written in every log line (D60). */
  version: string;
  /** Replica of the service (RAILWAY_REPLICA_ID, `local` otherwise): ops metric lines (D60). */
  instance: string;
  brevo: {
    mode: BrevoMode;
    testRecipients: readonly string[];
  };
};

export type InternalSecrets = {
  web: string;
  backoffice: string;
};

/** Public origins of the two surfaces (INFLUX_PUBLIC_SITE_URL, INFLUX_PUBLIC_BACKOFFICE_URL). */
export type PublicOrigins = {
  web: string;
  backoffice: string;
};

/**
 * The transactional sender of the api (21 EC-19): the login code only (D43). Absent key and
 * sender are allowed with BREVO_MODE=disabled only, where nothing is ever sent.
 */
export type BrevoTransportConfig = {
  apiKey: string | null;
  baseUrl: string;
  senderTransactional: string | null;
};

export type ApiConfig = BaseConfig & {
  port: number;
  /** Transport of the Brevo transactional sender (key, base URL, sender), EC-19. */
  brevoTransport: BrevoTransportConfig;
  /** Origin of each surface, expected on its writes (03 §6.4 A4, 21 J1-F). */
  publicOrigins: PublicOrigins;
  /**
   * Pepper of the rate-limiting digests: client addresses (03 §6.4 A5) and, from J3 commit 6,
   * e-mail addresses (04 §12.10 point 4). Its rotation resets the counters.
   */
  authThrottlePepper: string;
  /**
   * Signing key of the short tokens only, login journey and sign-up (21 EC-24, J3-C rule 8). The
   * session identifier is never signed.
   */
  authTokenSigningSecret: string;
  /** GoTrue of the Supabase project, reached with the secret key only (21 J3-C, EC-46). */
  supabase: {
    url: string;
    secretKey: string;
  };
  /**
   * DATABASE_URL (influx_app), AUTH_DATABASE_URL (influx_auth_login), EC-20, and, from J4,
   * OPS_DATABASE_URL (influx_ops_login, E-6: the monitoring of D60).
   */
  database: {
    app: DatabaseConnection;
    auth: DatabaseConnection;
    ops: DatabaseConnection;
  };
  /** One secret per front: apps/api derives the calling surface from it (J1-G). */
  internalSecrets: InternalSecrets;
  /**
   * The accepted values of the two webhook secrets, current first (J7 decision 1); both lists
   * empty when the webhook is closed.
   */
  brevoWebhook: BrevoWebhookSecrets;
};

/** D68: the sub-keys of leads.sync_settings.brevo_list_ids, as given. */
export type BrevoIdsFromEnvironment = {
  listIds: Readonly<Record<string, number>>;
};

/** D68: each optional variable of the worker and the sub-key of brevo_list_ids it sets. */
export const BREVO_ID_VARIABLES = {
  BREVO_LIST_ID_ADVERTISERS: "advertisers",
  BREVO_LIST_ID_CREATORS: "creators",
} as const;

type BrevoIdVariable = keyof typeof BREVO_ID_VARIABLES;

/**
 * D69: the template variables of D68, withdrawn with the Brevo templates (every queue e-mail is
 * written by INFLUX). Refused when set, so that a stale configuration is noticed, never ignored.
 */
export const WITHDRAWN_BREVO_TEMPLATE_VARIABLES = [
  "BREVO_TEMPLATE_ID_WELCOME_ADVERTISER",
  "BREVO_TEMPLATE_ID_WELCOME_CREATOR",
  "BREVO_TEMPLATE_ID_EMAIL_CHANGED_NOTICE",
] as const;

export type BrevoWebhookSecrets = {
  pathTokens: readonly string[];
  headerTokens: readonly string[];
};

/**
 * The recipients a live connector may reach, resolved by the configuration (`02` §12.4, D70): the
 * allow-list of NON_PRODUCTION_RECIPIENT_ALLOWLIST in development (verrou 3), no restriction in a
 * deployed environment. Discriminated, never null: the drain never reads the environment.
 */
export type RecipientFilter =
  { kind: "allowlist"; domains: readonly string[] } | { kind: "unrestricted" };

export type WorkerConfig = BaseConfig & {
  /** The worker's OWN Brevo key (EC-19), the double in development, the exclusion list. */
  brevoTransport: BrevoTransportConfig & {
    /** BREVO_SUPPRESSION_LIST_ID: the marketing exclusion list (16 RG45), null when unset. */
    suppressionListId: number | null;
  };
  /**
   * D68: the Brevo ids of the environment, written into leads.sync_settings at start; only the
   * variables set appear, never a null (05 RG163). Empty: the base is left alone.
   */
  brevoIds: BrevoIdsFromEnvironment;
  /** APOLLO_API_KEY, the worker's only (skill env-secrets): null when absent. */
  apollo: {
    apiKey: string | null;
    baseUrl: string;
  };
  /**
   * WORKER_DATABASE_URL (influx_worker_login, E-3 and E-4, EC-20) and PRIVACY_DATABASE_URL
   * (influx_privacy_login, E-5 only, J8 commit 8): two pools, never one role for both (03 P7).
   * `privacy` is null when unset in development: no request is executed.
   */
  database: {
    worker: DatabaseConnection;
    privacy: DatabaseConnection | null;
  };
  /**
   * GoTrue of the Supabase project, with the worker's OWN secret key (skill env-secrets: one key per
   * service), for the purge of the users without an account (04 §9, J7 decision 3) and the user of
   * an erased account (E-5, J8 commit 8) only. Required in a deployed environment; null in
   * development when unset, and then neither runs (an erasure then waits, never closed).
   */
  supabase: {
    url: string;
    secretKey: string;
  } | null;
  sync: {
    mode: SyncMode;
    recipientFilter: RecipientFilter;
    /**
     * 05 RG160 (D67): deployed, a qualified line without a key fails credentials_missing; in
     * development it is skipped_no_credentials (02 §12.4 lock 1, 18 T17.1).
     */
    keyRequired: boolean;
  };
  /**
   * 05 RG162 (D67): deployed, the worker refuses to start without the settings every sign-up
   * needs; in development it starts and names them (leads.settings.missing_at_start).
   */
  settingsRequiredAtStart: boolean;
};

export const apiEnvSchema = z
  .object({
    ...baseEnvShape,
    PORT: z.preprocess(
      emptyAsAbsent,
      z.coerce
        .number({ error: "must be a port number" })
        .int()
        .min(1)
        .max(65535)
        .default(DEFAULT_API_PORT),
    ),
    INFLUX_API_INTERNAL_SECRET_WEB: internalSecret,
    INFLUX_API_INTERNAL_SECRET_BACKOFFICE: internalSecret,
    INFLUX_PUBLIC_SITE_URL: publicOrigin,
    INFLUX_PUBLIC_BACKOFFICE_URL: publicOrigin,
    AUTH_THROTTLE_PEPPER: secretOf32Bytes,
    AUTH_TOKEN_SIGNING_SECRET: secretOf32Bytes,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SECRET_KEY: supabaseSecretKey,
    ...brevoTransportShape,
    ...brevoWebhookShape,
    ...databaseEnvShape,
  })
  .superRefine((env, context) => {
    checkBrevoMode(env, context);
    checkDatabaseVariables(env, API_DATABASE_VARIABLES, context);
    checkBrevoTransport(env, context);
    checkBrevoWebhook(
      env,
      [
        env.INFLUX_API_INTERNAL_SECRET_WEB,
        env.INFLUX_API_INTERNAL_SECRET_BACKOFFICE,
        env.AUTH_THROTTLE_PEPPER,
        env.AUTH_TOKEN_SIGNING_SECRET,
        env.SUPABASE_SECRET_KEY,
        env.BREVO_API_KEY,
      ],
      context,
    );
    if (
      env.INFLUX_API_INTERNAL_SECRET_WEB ===
      env.INFLUX_API_INTERNAL_SECRET_BACKOFFICE
    ) {
      context.addIssue({
        code: "custom",
        path: ["INFLUX_API_INTERNAL_SECRET_BACKOFFICE"],
        message: "must differ from INFLUX_API_INTERNAL_SECRET_WEB",
      });
    }
    // One secret, one use: a pepper equal to a relay secret would be known to the fronts.
    if (
      env.AUTH_THROTTLE_PEPPER === env.INFLUX_API_INTERNAL_SECRET_WEB ||
      env.AUTH_THROTTLE_PEPPER === env.INFLUX_API_INTERNAL_SECRET_BACKOFFICE
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_THROTTLE_PEPPER"],
        message: "must differ from the internal secrets",
      });
    }
    // EC-24: the signing key of the short tokens is used for nothing else. Equal to the pepper, a
    // leaked throttle digest would help forge a token; equal to a relay secret, a front would sign.
    if (
      env.AUTH_TOKEN_SIGNING_SECRET === env.AUTH_THROTTLE_PEPPER ||
      env.AUTH_TOKEN_SIGNING_SECRET === env.INFLUX_API_INTERNAL_SECRET_WEB ||
      env.AUTH_TOKEN_SIGNING_SECRET ===
        env.INFLUX_API_INTERNAL_SECRET_BACKOFFICE
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_TOKEN_SIGNING_SECRET"],
        message:
          "must differ from AUTH_THROTTLE_PEPPER and from the internal secrets",
      });
    }
    // Each surface is told apart by its origin: the backoffice is a host of its own (D12).
    if (env.INFLUX_PUBLIC_SITE_URL === env.INFLUX_PUBLIC_BACKOFFICE_URL) {
      context.addIssue({
        code: "custom",
        path: ["INFLUX_PUBLIC_BACKOFFICE_URL"],
        message: "must differ from INFLUX_PUBLIC_SITE_URL",
      });
    }
    if (isDeployedEnvironment(env.INFLUX_ENV)) {
      for (const variable of [
        "SUPABASE_URL",
        "INFLUX_PUBLIC_SITE_URL",
        "INFLUX_PUBLIC_BACKOFFICE_URL",
      ] as const) {
        if (!env[variable].startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: [variable],
            message: "must be an https origin in a deployed environment",
          });
        }
      }
    }
  })
  .transform((env): ApiConfig => ({
    environment: env.INFLUX_ENV,
    version: env.RAILWAY_GIT_COMMIT_SHA ?? LOCAL_VERSION,
    instance: env.RAILWAY_REPLICA_ID ?? LOCAL_VERSION,
    brevo: {
      mode: env.BREVO_MODE,
      testRecipients: env.BREVO_TEST_RECIPIENTS,
    },
    port: env.PORT,
    brevoTransport: {
      apiKey: env.BREVO_API_KEY ?? null,
      baseUrl: env.BREVO_API_BASE_URL,
      senderTransactional: env.BREVO_SENDER_TRANSACTIONAL ?? null,
    },
    publicOrigins: {
      web: env.INFLUX_PUBLIC_SITE_URL,
      backoffice: env.INFLUX_PUBLIC_BACKOFFICE_URL,
    },
    authThrottlePepper: env.AUTH_THROTTLE_PEPPER,
    authTokenSigningSecret: env.AUTH_TOKEN_SIGNING_SECRET,
    supabase: {
      url: env.SUPABASE_URL,
      secretKey: env.SUPABASE_SECRET_KEY,
    },
    database: {
      app: databaseConnection(env, "DATABASE_URL"),
      auth: databaseConnection(env, "AUTH_DATABASE_URL"),
      ops: databaseConnection(env, "OPS_DATABASE_URL"),
    },
    internalSecrets: {
      web: env.INFLUX_API_INTERNAL_SECRET_WEB,
      backoffice: env.INFLUX_API_INTERNAL_SECRET_BACKOFFICE,
    },
    brevoWebhook: {
      pathTokens: presentValues(
        env.BREVO_WEBHOOK_PATH_TOKEN_CURRENT,
        env.BREVO_WEBHOOK_PATH_TOKEN_PREVIOUS,
      ),
      headerTokens: presentValues(
        env.BREVO_WEBHOOK_SECRET_CURRENT,
        env.BREVO_WEBHOOK_SECRET_PREVIOUS,
      ),
    },
  }));

function presentValues(...values: (string | undefined)[]): string[] {
  return values.filter((value): value is string => value !== undefined);
}

/** A Brevo list id (D68): a positive integer, absent when unset or empty. */
const brevoId = z.preprocess(
  emptyAsAbsent,
  z.coerce
    .number({ error: "must be a Brevo id" })
    .int({ error: "must be a Brevo id" })
    .positive({ error: "must be a Brevo id" })
    .optional(),
);

const brevoIdShape = Object.fromEntries(
  Object.keys(BREVO_ID_VARIABLES).map((variable) => [variable, brevoId]),
) as Record<BrevoIdVariable, typeof brevoId>;

const withdrawnTemplateShape = Object.fromEntries(
  WITHDRAWN_BREVO_TEMPLATE_VARIABLES.map((variable) => [
    variable,
    optionalText,
  ]),
) as Record<
  (typeof WITHDRAWN_BREVO_TEMPLATE_VARIABLES)[number],
  typeof optionalText
>;

function brevoIdsOf(
  env: Partial<Record<BrevoIdVariable, number | undefined>>,
): BrevoIdsFromEnvironment {
  const listIds: Record<string, number> = {};
  for (const [variable, key] of Object.entries(BREVO_ID_VARIABLES)) {
    const value = env[variable as BrevoIdVariable];
    if (value !== undefined) {
      listIds[key] = value;
    }
  }
  return { listIds };
}

export const workerEnvSchema = z
  .object({
    ...baseEnvShape,
    SYNC_MODE: z.preprocess(
      emptyAsAbsent,
      z
        .enum(SYNC_MODES, { error: "must be live or dry_run" })
        .default("dry_run"),
    ),
    NON_PRODUCTION_RECIPIENT_ALLOWLIST: commaSeparated(
      z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, {
        message: "must list e-mail domains",
      }),
    ),
    ...brevoTransportShape,
    BREVO_SUPPRESSION_LIST_ID: z.preprocess(
      emptyAsAbsent,
      z.coerce
        .number({ error: "must be a Brevo list id" })
        .int({ error: "must be a Brevo list id" })
        .positive({ error: "must be a Brevo list id" })
        .optional(),
    ),
    ...brevoIdShape,
    ...withdrawnTemplateShape,
    APOLLO_API_KEY: optionalText,
    SUPABASE_URL: z.preprocess(emptyAsAbsent, supabaseUrl.optional()),
    SUPABASE_SECRET_KEY: z.preprocess(
      emptyAsAbsent,
      supabaseSecretKey.optional(),
    ),
    // Read only to be refused on Railway: the webhook secrets are the api service's alone.
    ...brevoWebhookShape,
    ...databaseEnvShape,
  })
  .superRefine((env, context) => {
    checkBrevoMode(env, context);
    checkBrevoTransport(env, context);
    for (const variable of WITHDRAWN_BREVO_TEMPLATE_VARIABLES) {
      if (env[variable] !== undefined) {
        context.addIssue({
          code: "custom",
          path: [variable],
          message:
            "is no longer read (D69: the e-mails are written by INFLUX, remove it)",
        });
      }
    }
    // Skill env-secrets (porteurs): never on the worker service. Locally, both processes read the
    // same apps/api/.env.local, as for the database variables (EC-20 point 4).
    if (env.RAILWAY_ENVIRONMENT_NAME !== undefined) {
      for (const variable of BREVO_WEBHOOK_VARIABLES) {
        if (env[variable] !== undefined) {
          context.addIssue({
            code: "custom",
            path: [variable],
            message: "belongs to the api service only",
          });
        }
      }
    }
    if (
      env.APOLLO_API_KEY !== undefined &&
      holdsPlaceholder(env.APOLLO_API_KEY)
    ) {
      context.addIssue({
        code: "custom",
        path: ["APOLLO_API_KEY"],
        message: `must not contain the ${PLACEHOLDER} placeholder`,
      });
    }
    checkDatabaseVariables(
      env,
      WORKER_DATABASE_VARIABLES,
      context,
      WORKER_OPTIONAL_DATABASE_VARIABLES,
    );
    const isDeployed = isDeployedEnvironment(env.INFLUX_ENV);
    // 21 §5.8, J8 commit 8: the execution of the "mes données" requests is a gate of any deployed
    // environment (D70: staging requires what production requires).
    if (isDeployed && env.PRIVACY_DATABASE_URL === undefined) {
      context.addIssue({
        code: "custom",
        path: ["PRIVACY_DATABASE_URL"],
        message:
          "is required in a deployed environment (execution of the data subject requests)",
      });
    }
    // 04 §9: the purge of GoTrue needs both; deployed, it must run (D43, 02 §18.5).
    for (const [variable, other] of [
      ["SUPABASE_URL", "SUPABASE_SECRET_KEY"],
      ["SUPABASE_SECRET_KEY", "SUPABASE_URL"],
    ] as const) {
      if (
        env[variable] === undefined &&
        (isDeployed || env[other] !== undefined)
      ) {
        context.addIssue({
          code: "custom",
          path: [variable],
          message: isDeployed
            ? "is required in a deployed environment (purge of the GoTrue users without an account)"
            : `is required with ${other}`,
        });
      }
    }
    if (
      isDeployed &&
      env.SUPABASE_URL !== undefined &&
      !env.SUPABASE_URL.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "must be an https origin in a deployed environment",
      });
    }
    // 02 §12.4: a silently mute deployed environment is as serious as a real send from a test.
    if (env.SYNC_MODE !== "live" && isDeployed) {
      context.addIssue({
        code: "custom",
        path: ["SYNC_MODE"],
        message: "must be live in a deployed environment",
      });
    }
    if (isDeployed && env.NON_PRODUCTION_RECIPIENT_ALLOWLIST.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["NON_PRODUCTION_RECIPIENT_ALLOWLIST"],
        message: "is refused in a deployed environment (development only)",
      });
    }
    if (
      env.SYNC_MODE === "live" &&
      !isDeployed &&
      env.NON_PRODUCTION_RECIPIENT_ALLOWLIST.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["NON_PRODUCTION_RECIPIENT_ALLOWLIST"],
        message: "is required when SYNC_MODE is live in development",
      });
    }
  })
  .transform((env): WorkerConfig => ({
    environment: env.INFLUX_ENV,
    version: env.RAILWAY_GIT_COMMIT_SHA ?? LOCAL_VERSION,
    instance: env.RAILWAY_REPLICA_ID ?? LOCAL_VERSION,
    brevo: {
      mode: env.BREVO_MODE,
      testRecipients: env.BREVO_TEST_RECIPIENTS,
    },
    brevoTransport: {
      apiKey: env.BREVO_API_KEY ?? null,
      baseUrl: env.BREVO_API_BASE_URL,
      senderTransactional: env.BREVO_SENDER_TRANSACTIONAL ?? null,
      suppressionListId: env.BREVO_SUPPRESSION_LIST_ID ?? null,
    },
    brevoIds: brevoIdsOf(env),
    apollo: {
      apiKey: env.APOLLO_API_KEY ?? null,
      baseUrl: APOLLO_OFFICIAL_BASE_URL,
    },
    database: {
      worker: databaseConnection(env, "WORKER_DATABASE_URL"),
      privacy:
        env.PRIVACY_DATABASE_URL === undefined
          ? null
          : databaseConnection(env, "PRIVACY_DATABASE_URL"),
    },
    supabase:
      env.SUPABASE_URL !== undefined && env.SUPABASE_SECRET_KEY !== undefined
        ? { url: env.SUPABASE_URL, secretKey: env.SUPABASE_SECRET_KEY }
        : null,
    sync: {
      mode: env.SYNC_MODE,
      recipientFilter: isDeployedEnvironment(env.INFLUX_ENV)
        ? { kind: "unrestricted" }
        : {
            kind: "allowlist",
            domains: env.NON_PRODUCTION_RECIPIENT_ALLOWLIST,
          },
      keyRequired: isDeployedEnvironment(env.INFLUX_ENV),
    },
    settingsRequiredAtStart: isDeployedEnvironment(env.INFLUX_ENV),
  }));

/** Refusal to start. Its message names variables and rules, never a value. */
export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(service: string, issues: readonly string[]) {
    super(`Invalid ${service} configuration: ${issues.join("; ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export type Environment = Readonly<Record<string, string | undefined>>;

function parseEnvironment<Config>(
  service: string,
  schema: z.ZodType<Config>,
  env: Environment,
): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(
      service,
      result.error.issues.map(
        (issue) => `${issue.path.map(String).join(".")} ${issue.message}`,
      ),
    );
  }
  return result.data;
}

export function parseApiEnvironment(env: Environment): ApiConfig {
  return parseEnvironment("api", apiEnvSchema, env);
}

export function parseWorkerEnvironment(env: Environment): WorkerConfig {
  return parseEnvironment("worker", workerEnvSchema, env);
}

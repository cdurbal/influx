// Environment schemas of apps/api (docs/mvp/21-plan-de-developpement.md §4, J1-D and J1-F).
// Pure module: it never reads process.env (src/config/index.ts does). A variable enters these
// schemas in the commit that reads it (J1-D, point 1).
import * as z from "zod";

export const INFLUX_ENVIRONMENTS = ["staging", "production"] as const;
export type InfluxEnvironment = (typeof INFLUX_ENVIRONMENTS)[number];

/** `16` RG116: `disabled` and `redirect` never exist in production, `live` only there. */
export const BREVO_MODES = ["disabled", "redirect", "live"] as const;
export type BrevoMode = (typeof BREVO_MODES)[number];

/** `02` §12.4: `dry_run` outside production, `live` in production. */
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
 * @influx/test-kit on a loopback host. The loopback is refused in production (superRefine).
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
  RAILWAY_ENVIRONMENT_NAME?: string | undefined;
  DATABASE_CA_CERT?: string | undefined;
};

/**
 * Startup refusals of EC-20: exact role per URL, never two URLs of one process with the same
 * user, and on Railway no database variable reserved to another service (18 T4.6 a to d).
 */
function checkDatabaseVariables(
  env: DatabaseEnv,
  read: readonly DatabaseUrlVariable[],
  context: z.RefinementCtx,
): void {
  const users = new Map<string, DatabaseUrlVariable>();
  for (const variable of read) {
    const value = env[variable];
    if (value === undefined) {
      context.addIssue({
        code: "custom",
        path: [variable],
        message: "is required",
      });
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
  RAILWAY_ENVIRONMENT_NAME: optionalText,
};

const baseEnvShape = {
  INFLUX_ENV: z.enum(INFLUX_ENVIRONMENTS, {
    error: "must be staging or production",
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
};

/** Startup refusals shared by api and worker (`16` RG116, `21` J1-D point 3). */
function checkBrevoMode(env: BaseEnv, context: z.RefinementCtx): void {
  const isProduction = env.INFLUX_ENV === "production";
  if (env.BREVO_MODE === "live" && !isProduction) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_MODE"],
      message: "live is refused outside production",
    });
  }
  if (env.BREVO_MODE !== "live" && isProduction) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_MODE"],
      message: "must be live in production",
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
 * is never the template's placeholder; the local double is never reached from production.
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
    env.INFLUX_ENV === "production" &&
    env.BREVO_API_BASE_URL !== BREVO_OFFICIAL_BASE_URL
  ) {
    context.addIssue({
      code: "custom",
      path: ["BREVO_API_BASE_URL"],
      message: "must be the official Brevo URL in production",
    });
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
};

export type WorkerConfig = BaseConfig & {
  /** The worker's OWN Brevo key (EC-19), the double outside production, the exclusion list. */
  brevoTransport: BrevoTransportConfig & {
    /** BREVO_SUPPRESSION_LIST_ID: the marketing exclusion list (16 RG45), null when unset. */
    suppressionListId: number | null;
  };
  /** APOLLO_API_KEY, the worker's only (skill env-secrets): null when absent, as in staging. */
  apollo: {
    apiKey: string | null;
    baseUrl: string;
  };
  /** WORKER_DATABASE_URL (influx_worker_login) ONLY, EC-20. */
  database: {
    worker: DatabaseConnection;
  };
  sync: {
    mode: SyncMode;
    nonProductionRecipientAllowlist: readonly string[];
  };
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
    ...databaseEnvShape,
  })
  .superRefine((env, context) => {
    checkBrevoMode(env, context);
    checkDatabaseVariables(env, API_DATABASE_VARIABLES, context);
    checkBrevoTransport(env, context);
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
    if (
      env.INFLUX_ENV === "production" &&
      !env.SUPABASE_URL.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        path: ["SUPABASE_URL"],
        message: "must be an https origin in production",
      });
    }
    if (env.INFLUX_ENV === "production") {
      for (const variable of [
        "INFLUX_PUBLIC_SITE_URL",
        "INFLUX_PUBLIC_BACKOFFICE_URL",
      ] as const) {
        if (!env[variable].startsWith("https://")) {
          context.addIssue({
            code: "custom",
            path: [variable],
            message: "must be an https origin in production",
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
  }));

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
    APOLLO_API_KEY: optionalText,
    ...databaseEnvShape,
  })
  .superRefine((env, context) => {
    checkBrevoMode(env, context);
    checkBrevoTransport(env, context);
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
    checkDatabaseVariables(env, WORKER_DATABASE_VARIABLES, context);
    const isProduction = env.INFLUX_ENV === "production";
    if (env.SYNC_MODE === "dry_run" && isProduction) {
      context.addIssue({
        code: "custom",
        path: ["SYNC_MODE"],
        message: "dry_run is refused in production",
      });
    }
    if (
      env.SYNC_MODE === "live" &&
      !isProduction &&
      env.NON_PRODUCTION_RECIPIENT_ALLOWLIST.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["NON_PRODUCTION_RECIPIENT_ALLOWLIST"],
        message: "is required when SYNC_MODE is live outside production",
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
    apollo: {
      apiKey: env.APOLLO_API_KEY ?? null,
      baseUrl: APOLLO_OFFICIAL_BASE_URL,
    },
    database: {
      worker: databaseConnection(env, "WORKER_DATABASE_URL"),
    },
    sync: {
      mode: env.SYNC_MODE,
      nonProductionRecipientAllowlist: env.NON_PRODUCTION_RECIPIENT_ALLOWLIST,
    },
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

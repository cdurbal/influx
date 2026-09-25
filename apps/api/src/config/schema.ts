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

const internalSecret = requiredText
  .refine(
    (value) =>
      new TextEncoder().encode(value).length >= MIN_INTERNAL_SECRET_BYTES,
    { message: `must be at least ${MIN_INTERNAL_SECRET_BYTES} bytes` },
  )
  // The length check alone accepts a padded placeholder (21 J1-J R4).
  .refine((value) => !value.includes(PLACEHOLDER), {
    message: `must not contain the ${PLACEHOLDER} placeholder`,
  });

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

export type BaseConfig = {
  environment: InfluxEnvironment;
  /** Deployed commit, written in every log line (D60). */
  version: string;
  brevo: {
    mode: BrevoMode;
    testRecipients: readonly string[];
  };
};

export type InternalSecrets = {
  web: string;
  backoffice: string;
};

export type ApiConfig = BaseConfig & {
  port: number;
  /** One secret per front: apps/api derives the calling surface from it (J1-G). */
  internalSecrets: InternalSecrets;
};

export type WorkerConfig = BaseConfig & {
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
  })
  .superRefine((env, context) => {
    checkBrevoMode(env, context);
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
  })
  .transform((env): ApiConfig => ({
    environment: env.INFLUX_ENV,
    version: env.RAILWAY_GIT_COMMIT_SHA ?? LOCAL_VERSION,
    brevo: {
      mode: env.BREVO_MODE,
      testRecipients: env.BREVO_TEST_RECIPIENTS,
    },
    port: env.PORT,
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
  })
  .superRefine((env, context) => {
    checkBrevoMode(env, context);
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
    brevo: {
      mode: env.BREVO_MODE,
      testRecipients: env.BREVO_TEST_RECIPIENTS,
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

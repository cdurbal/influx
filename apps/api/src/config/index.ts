// The ONLY readers of process.env in apps/api (ESLint: no process.env outside src/config/).
// Code never reads an environment file: in development, Node loads `.env.local` through the
// `--env-file-if-exists` flag of the dev scripts; in production nothing is loaded (J1-D, point 4).
import {
  parseApiEnvironment,
  parseWorkerEnvironment,
  type ApiConfig,
  type Environment,
  type WorkerConfig,
} from "./schema.ts";

export { ConfigError } from "./schema.ts";
export type { ApiConfig, WorkerConfig } from "./schema.ts";

export function loadApiConfig(env: Environment = process.env): ApiConfig {
  return parseApiEnvironment(env);
}

export function loadWorkerConfig(env: Environment = process.env): WorkerConfig {
  return parseWorkerEnvironment(env);
}

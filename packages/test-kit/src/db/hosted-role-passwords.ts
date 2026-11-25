// The passwords of the five connection roles of a HOSTED project (staging or production; 03 P7,
// rule 5 of 0001: no password in a migration), shared by scripts/staging-role-passwords.ts and
// scripts/production-role-passwords.ts. One random password per role; the SQL carries SCRAM
// verifiers only, so that no clear password is ever sent to the database nor kept in its statement
// logs; the clear password only appears in the connection URL, through the Supavisor pooler
// (transaction mode, port 6543), for the ONE Railway service that reads it (02 §12.3). Nothing here
// prints, writes or connects: the callers write the result to .operator-secrets/.
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { SCRAM_VERIFIER_PATTERN, scramSha256Verifier } from "./scram.ts";

/** Connection role → variable → Railway service (02 §12.3, EC-20). */
export const HOSTED_LOGIN_ROLES = [
  ["influx_app", "DATABASE_URL", "api"],
  ["influx_auth_login", "AUTH_DATABASE_URL", "api"],
  ["influx_ops_login", "OPS_DATABASE_URL", "api"],
  ["influx_worker_login", "WORKER_DATABASE_URL", "worker"],
  // J8 commit 8 (0136, 03 P7 E-5): the worker's second pool, never influx_worker_login.
  ["influx_privacy_login", "PRIVACY_DATABASE_URL", "worker"],
] as const;

/** A Supabase project ref: 20 lowercase letters and digits. */
export const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

/** The host of the Supavisor pooler of a region. */
export const POOLER_HOST_PATTERN = /^[a-z0-9.-]+\.pooler\.supabase\.com$/;

export type HostedRolePasswords = {
  /** `alter role … with password 'SCRAM-SHA-256$…';`, one per role. */
  sql: string[];
  /** `<service> <VARIABLE>=postgresql://…`, one per role. */
  urls: string[];
};

/** Draws one password per role of HOSTED_LOGIN_ROLES; each call gives new, distinct passwords. */
export function drawHostedRolePasswords(
  ref: string,
  host: string,
  draw: () => string = () => randomBytes(32).toString("base64url"),
): HostedRolePasswords {
  if (!PROJECT_REF_PATTERN.test(ref) || !POOLER_HOST_PATTERN.test(host)) {
    throw new Error(
      "a project ref of 20 lowercase letters and digits and a pooler host " +
        "(<region>.pooler.supabase.com) are required",
    );
  }
  const sql: string[] = [];
  const urls: string[] = [];
  const drawn = new Set<string>();
  for (const [role, variable, service] of HOSTED_LOGIN_ROLES) {
    const password = draw();
    if (drawn.has(password)) {
      throw new Error("two roles drew the same password: refused");
    }
    drawn.add(password);
    const verifier = scramSha256Verifier(password);
    if (!SCRAM_VERIFIER_PATTERN.test(verifier)) {
      throw new Error("malformed SCRAM verifier");
    }
    sql.push(`alter role ${role} with password '${verifier}';`);
    urls.push(
      `${service.padEnd(7)} ${variable}=postgresql://${role}.${ref}:${password}@${host}:6543/postgres`,
    );
  }
  return { sql, urls };
}

/**
 * The project ref of SUPABASE_URL in the text of an env file (apps/api/.env.local holds the values
 * of staging, D70), or null. Only the host is kept: no other value is ever returned.
 */
export function supabaseRefOfEnvFile(text: string): string | null {
  const value = parseEnv(text).SUPABASE_URL;
  if (value === undefined || value === "") {
    return null;
  }
  let host: string;
  try {
    host = new URL(value).hostname;
  } catch {
    return null;
  }
  const ref = host.endsWith(".supabase.co")
    ? host.slice(0, -".supabase.co".length)
    : "";
  return PROJECT_REF_PATTERN.test(ref) ? ref : null;
}

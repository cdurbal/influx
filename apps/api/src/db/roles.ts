// The constant tables that name the Postgres roles taken by a transaction (docs/mvp/03 §4 P7,
// rules 4 and 5 of withUserTransaction). A role name is NEVER built from a value read in the
// database or received: it is looked up here, and an unknown value is refused before any
// statement is sent (18 T4.8). This is the ONLY file of src/db/ that contains `set local role`
// (18 T6.6).
import type { ConnectionRole } from "../config/schema.ts";

/** Business roles of identity.account_role (0002). */
export const BUSINESS_ROLES = [
  "advertiser",
  "creator",
  "agent",
  "admin",
] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

/** Statement that takes the Postgres role of a business role, from influx_app only. */
const USER_ROLE_STATEMENTS: Readonly<Record<BusinessRole, string>> = {
  advertiser: "set local role influx_advertiser",
  creator: "set local role influx_creator",
  agent: "set local role influx_agent",
  admin: "set local role influx_admin",
};

/** Kinds of elevated pool: one connection role, one variable, one service each (EC-20). */
export const ELEVATED_POOL_KINDS = ["auth", "worker"] as const;
export type ElevatedPoolKind = (typeof ELEVATED_POOL_KINDS)[number];

/** Statement that takes the elevated role of a pool, from its own connection role only. */
const ELEVATED_ROLE_STATEMENTS: Readonly<Record<ElevatedPoolKind, string>> = {
  auth: "set local role influx_auth",
  worker: "set local role influx_worker",
};

/** Connection role each pool must obtain (current_user = session_user outside a transaction). */
export const POOL_CONNECTION_ROLES = {
  app: "influx_app",
  auth: "influx_auth_login",
  worker: "influx_worker_login",
} as const satisfies Record<"app" | ElevatedPoolKind, ConnectionRole>;

export function isBusinessRole(value: unknown): value is BusinessRole {
  return (BUSINESS_ROLES as readonly unknown[]).includes(value);
}

/**
 * The `set local role` statement of a business role, or null for any other value (`service`, an
 * empty string, a value holding `;` or `"`…). Own-property lookup only: `constructor` or
 * `__proto__` never resolve to an inherited member.
 */
export function userRoleStatement(value: unknown): string | null {
  return isBusinessRole(value) &&
    Object.prototype.hasOwnProperty.call(USER_ROLE_STATEMENTS, value)
    ? USER_ROLE_STATEMENTS[value]
    : null;
}

export function elevatedRoleStatement(kind: ElevatedPoolKind): string {
  return ELEVATED_ROLE_STATEMENTS[kind];
}

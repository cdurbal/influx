// The local Supabase stack used by the database tests (docs/mvp/18 §3, "Où tournent les tests en
// base"; 21 J2 points 5 and 7). Fixed passwords are reserved to this stack and to CI (03 P7,
// rule 5 of 0001): every helper here refuses a host that is not the loopback.
import postgres from "postgres";

export const LOCAL_HOST = "127.0.0.1";
/** Direct connection (`[db] port` of supabase/config.toml): no pooler locally (18 §3 point 4). */
export const LOCAL_PORT = 54322;
export const LOCAL_DATABASE = "postgres";

/** Well-known credentials of the local stack, printed by `supabase status`. */
const LOCAL_MIGRATION_PASSWORD = "postgres";

/** Connection roles of 03 P7 and their fixed LOCAL passwords (never used anywhere else). */
export const LOCAL_ROLE_PASSWORDS = {
  influx_app: "local-only-influx-app-password",
  influx_auth_login: "local-only-influx-auth-login-password",
  influx_worker_login: "local-only-influx-worker-login-password",
  influx_ops_login: "local-only-influx-ops-login-password",
} as const;

export type LoginRole = keyof typeof LOCAL_ROLE_PASSWORDS;
export const LOGIN_ROLES = Object.keys(LOCAL_ROLE_PASSWORDS) as LoginRole[];

/** URL of a connection role on the local stack: user without pooler suffix (EC-20). */
export function localRoleUrl(role: LoginRole): string {
  return `postgresql://${role}:${LOCAL_ROLE_PASSWORDS[role]}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DATABASE}`;
}

const MISSING_STACK =
  "pile Supabase locale absente : lancer `corepack pnpm exec supabase start` puis " +
  "`corepack pnpm exec supabase db reset` et `corepack pnpm db:role-passwords` " +
  "(docs/mvp/18 §3). Les tests en base ne sont jamais sautés.";

type Options = { max?: number };

function connect(
  user: string,
  password: string,
  options: Options,
): postgres.Sql {
  return postgres({
    host: LOCAL_HOST,
    port: LOCAL_PORT,
    database: LOCAL_DATABASE,
    username: user,
    password,
    max: options.max ?? 4,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
  });
}

/** The migration role (`postgres` of the project): owner of our objects, BYPASSRLS on Supabase. */
export function connectAsMigrationRole(options: Options = {}): postgres.Sql {
  return connect("postgres", LOCAL_MIGRATION_PASSWORD, options);
}

/**
 * The local superuser, used ONLY to read pg_authid (R4 of the J2 security review): `postgres`
 * of Supabase cannot read it.
 */
export function connectAsLocalSuperuser(options: Options = {}): postgres.Sql {
  return connect("supabase_admin", LOCAL_MIGRATION_PASSWORD, options);
}

export function connectAsLoginRole(
  role: LoginRole,
  options: Options = {},
): postgres.Sql {
  return connect(role, LOCAL_ROLE_PASSWORDS[role], options);
}

/**
 * Fails with an explicit message when the local stack is not reachable, or when the migrations
 * have not been applied (18 §3 rule 2: never a silent skip).
 */
export async function requireLocalStack(): Promise<void> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const rows = await sql<{ applied: boolean }[]>`
      select to_regclass('audit.audit_events') is not null as applied`;
    if (rows[0]?.applied !== true) {
      throw new Error(
        `migrations absentes de la base locale. ${MISSING_STACK}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("migrations absentes")
    ) {
      throw error;
    }
    throw new Error(MISSING_STACK, { cause: error });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

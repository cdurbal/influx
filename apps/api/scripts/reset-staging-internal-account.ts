// `pnpm --filter @influx/api staging:reset-internal-account -- --email=<address> [--password-only]`:
// gives an internal account (agent or admin) of the STAGING project a new random password and,
// unless --password-only, a fresh TOTP enrollment (D70: staging is run by the agents themselves).
// Stopgap until the backoffice reset of 03 MFA-6 (another admin, typed reason, 2V and R) exists;
// never on production, where MFA-6 to MFA-9 apply.
//
// Inputs from apps/api/.env.local (values of staging, D70), loaded by --env-file, as for
// seed-staging-demo-accounts.ts: INFLUX_STAGING_MIGRATION_URL, optional INFLUX_STAGING_DB_CA_FILE
// or DATABASE_CA_CERT (EC-34), SUPABASE_URL, SUPABASE_SECRET_KEY, INFLUX_PUBLIC_BACKOFFICE_URL.
//
// What it does, in an order that a second run completes when a step fails:
//   1  the GoTrue password (administration API, as updateUserById);
//   2  without --password-only: every TOTP factor of the user deleted at GoTrue, then one
//      transaction: factor unpinned, usable recovery codes revoked, pending enrollment tokens
//      consumed, open backoffice sessions revoked (mfa_reset), a new 72-hour enrollment token.
//      No audit line: the migration role may not execute audit.append(); the intervention is
//      written to the incident register by hand (runbook §12, as §11).
// The password and the activation link are written ONCE to .operator-secrets/ (ignored by Git),
// never to the output. Refused: production, a database without the staging marker, a Supabase
// project other than the database's, a member, an inactive or break-glass account.
import { writeOperatorSecrets } from "@influx/test-kit/operator-secrets";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";
import { randomInternalPassword } from "./demo-accounts.ts";
import {
  assertStagingMarker,
  connectToStagingAsMigrationRole,
  refuseProduction,
  requiredStagingUrl,
  stagingGoTrue,
} from "./script-guards.ts";

refuseProduction("internal account reset");
const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    email: { type: "string" },
    "password-only": { type: "boolean", default: false },
  },
});
const email = values.email?.toLowerCase();
if (email === undefined || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("--email=<address> is required");
}
const resetTotp = !values["password-only"];
const gotrue = stagingGoTrue();
const backoffice = requiredStagingUrl("INFLUX_PUBLIC_BACKOFFICE_URL").origin;

async function goTrue(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(`${gotrue.authUrl}/admin${path}`, {
    method,
    headers: {
      apikey: gotrue.secretKey,
      authorization: `Bearer ${gotrue.secretKey}`,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  const parsed: unknown = text === "" ? null : JSON.parse(text);
  if (!response.ok) {
    const code =
      typeof parsed === "object" && parsed !== null && "error_code" in parsed
        ? String(parsed.error_code)
        : "";
    // Never the body: it may echo the request.
    throw new Error(`GoTrue ${method} refused: ${response.status} ${code}`);
  }
  return parsed;
}

const migration = connectToStagingAsMigrationRole();
try {
  await assertStagingMarker(migration);
  const [account] = await migration<
    {
      id: string;
      auth_user_id: string | null;
      status: string;
      is_active: boolean | null;
      is_break_glass: boolean | null;
    }[]
  >`
    select a.id::text, a.auth_user_id::text, a.status::text, p.is_active, p.is_break_glass
      from identity.accounts a
      left join identity.agent_profiles p on p.account_id = a.id
     where a.email = ${email}
       and exists (select 1 from identity.account_roles r
                    where r.account_id = a.id and r.role in ('agent', 'admin'))`;
  if (account === undefined) {
    throw new Error("no internal account (agent or admin) with this address");
  }
  if (
    account.auth_user_id === null ||
    account.status !== "active" ||
    account.is_active !== true
  ) {
    throw new Error("this internal account is not active: refused");
  }
  if (account.is_break_glass === true) {
    throw new Error("the break-glass account is never reset by a script (B7)");
  }
  const userId = account.auth_user_id;

  // 1. The password.
  const password = randomInternalPassword(email);
  await goTrue("PUT", `/users/${userId}`, { password });

  let enrollmentToken: string | null = null;
  if (resetTotp) {
    // 2a. GoTrue first: a verified factor left there while nothing is pinned would make the
    // enrollment fail closed (agent.unexpected_mfa_factor); a second run completes 2b.
    const listed = await goTrue("GET", `/users/${userId}/factors`);
    const factors = Array.isArray(listed) ? listed : [];
    for (const factor of factors as { id?: unknown; factor_type?: unknown }[]) {
      if (factor.factor_type === "totp" && typeof factor.id === "string") {
        await goTrue("DELETE", `/users/${userId}/factors/${factor.id}`);
      }
    }

    // 2b. The database, in one transaction.
    enrollmentToken = randomBytes(32).toString("base64url");
    const tokenHash = enrollmentTokenHashOf(enrollmentToken);
    if (tokenHash === null) {
      throw new Error("malformed enrollment token");
    }
    await migration.begin(async (tx) => {
      await tx`update identity.agent_profiles
                  set mfa_factor_id = null, mfa_enrolled_at = null
                where account_id = ${account.id}::uuid`;
      await tx`update identity.mfa_recovery_codes set revoked_at = now()
                where account_id = ${account.id}::uuid
                  and consumed_at is null and revoked_at is null`;
      await tx`update identity.mfa_enrollment_tokens set consumed_at = now()
                where account_id = ${account.id}::uuid and consumed_at is null`;
      await tx`update identity.sessions
                  set revoked_at = now(), revocation_reason = 'mfa_reset'
                where account_id = ${account.id}::uuid and surface = 'backoffice'
                  and revoked_at is null`;
      await tx`insert into identity.mfa_enrollment_tokens (account_id, token_hash, expires_at)
               values (${account.id}::uuid, ${tokenHash}, now() + interval '72 hours')`;
    });
  }

  const file = writeOperatorSecrets("staging-internal-account-reset", [
    "Internal account reset on staging: keep it in the password manager, then delete this file.",
    `  ${email}  password "${password}"`,
    ...(enrollmentToken === null
      ? ["  TOTP unchanged: sign in with the existing authenticator."]
      : [
          `  activation link ${backoffice}/activation#${enrollmentToken} (72 h): enroll the TOTP again`,
        ]),
  ]);
  process.stdout.write(
    `internal account reset on staging (${resetTotp ? "password and TOTP" : "password only"}); ` +
      `the secrets are in ${file} (ignored by Git, never print it)\n`,
  );
} finally {
  await migration.end({ timeout: 1 });
}

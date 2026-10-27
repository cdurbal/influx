// The bootstrap of the backoffice of an empty project: the FIRST admin and the break-glass account
// (03 MFA-10, blocking finding B7; 15 RG99, RG103; EC-45). Every other internal account is created
// by an invitation of that admin (POST /v1/bo/internal-invitations), never by a script. Used by
// scripts/bootstrap-production-admins.ts and by its database test.
// - Both are `admin` accounts with a password (EC-57) and a 72-hour enrollment token whose SHA-256
//   alone is stored: the TOTP is enrolled by the person at the first sign-in (B-2); the break-glass
//   one on an offline device, its recovery codes printed and sealed (MFA-10).
// - The break-glass address must be DISTINCT, never an alias of the admin's (MFA-10): the same
//   mailbox after lowercasing, without a `+tag` and, at gmail.com, without dots, is refused.
// - No audit line: the migration role may not execute audit.append(); the bootstrap is written to
//   the incident register by hand (runbook production §0).
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";
import { localPasswordVerdict } from "../src/domains/identity/password-policy.ts";
import { isPasswordWithinBounds } from "../src/platform/supabase.ts";
// An operator script, outside the api process: the type of the migration role's connection.
// eslint-disable-next-line no-restricted-imports -- see the line above
import type postgres from "postgres";

export type BootstrapAccount = {
  email: string;
  password: string;
  enrollmentToken: string;
  firstName: string;
  isBreakGlass: boolean;
};

export type BootstrapRequest = {
  admin: BootstrapAccount;
  breakGlass: BootstrapAccount;
  countryCode: string;
  preferredLanguage: "fr" | "en";
};

export type HostedGoTrue = { authUrl: string; secretKey: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The mailbox an address reaches: lowercased, without `+tag`, without dots at gmail.com. */
export function mailboxOf(email: string): string {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const untagged = local.split("+")[0] ?? "";
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  return `${gmail ? untagged.replaceAll(".", "") : untagged}@${gmail ? "gmail.com" : domain}`;
}

/** Refuses, before anything is written, a request that breaks MFA-10, EC-57 or the columns. */
export function checkBootstrapRequest(request: BootstrapRequest): void {
  const { admin, breakGlass } = request;
  if (admin.isBreakGlass || !breakGlass.isBreakGlass) {
    throw new Error("one admin and one break-glass account are expected");
  }
  for (const account of [admin, breakGlass]) {
    if (!EMAIL_PATTERN.test(account.email)) {
      throw new Error("malformed address");
    }
    if (
      !isPasswordWithinBounds(account.password) ||
      localPasswordVerdict(account.password, account.email) !== "accepted"
    ) {
      throw new Error("password breaks B-1 / EC-57");
    }
    if (enrollmentTokenHashOf(account.enrollmentToken) === null) {
      throw new Error("malformed enrollment token");
    }
    const length = [...account.firstName].length;
    if (length < 1 || length > 80) {
      throw new Error("a first name is 1 to 80 characters");
    }
  }
  if (mailboxOf(admin.email) === mailboxOf(breakGlass.email)) {
    throw new Error(
      "the break-glass address must be distinct, never an alias of the admin's (03 MFA-10)",
    );
  }
  if (!/^[A-Z]{2}$/.test(request.countryCode)) {
    throw new Error("the country is an ISO 3166-1 alpha-2 code");
  }
}

async function goTrueAdmin(
  gotrue: HostedGoTrue,
  method: "POST" | "DELETE",
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

/**
 * Creates the admin and the break-glass account. Refused when either address is already known
 * (identity or GoTrue) or a break-glass account exists. A failed transaction deletes the GoTrue
 * users it created, so that a second run starts from nothing.
 */
export async function bootstrapInternalAdmins(
  migration: postgres.Sql,
  gotrue: HostedGoTrue,
  request: BootstrapRequest,
): Promise<void> {
  checkBootstrapRequest(request);
  const accounts = [request.admin, request.breakGlass];
  const emails = accounts.map((account) => account.email);
  const known = await migration<{ email: string }[]>`
    select email from identity.accounts where email in ${migration(emails)}
    union
    select email from auth.users where email in ${migration(emails)}`;
  if (known.length > 0) {
    throw new Error("an address of the bootstrap is already known: refused");
  }
  const [breakGlass] = await migration<{ present: boolean }[]>`
    select exists (select 1 from identity.agent_profiles where is_break_glass) as present`;
  if (breakGlass?.present === true) {
    throw new Error("a break-glass account already exists (15 RG103): refused");
  }

  const userIds: string[] = [];
  try {
    for (const account of accounts) {
      const user = (await goTrueAdmin(gotrue, "POST", "/users", {
        email: account.email,
        email_confirm: true,
        password: account.password,
      })) as { id?: unknown };
      if (typeof user.id !== "string") {
        throw new Error("GoTrue returned no user id");
      }
      userIds.push(user.id);
    }
    await migration.begin(async (tx) => {
      for (const [index, account] of accounts.entries()) {
        const [row] = await tx<{ id: string }[]>`
          insert into identity.accounts
            (auth_user_id, email, email_verified_at, country_code, preferred_language,
             display_name, is_adult_attested, adult_attested_at, declared_status)
          values (${userIds[index] ?? null}, ${account.email}, now(), ${request.countryCode},
                  ${request.preferredLanguage}, ${account.firstName}, true, now(),
                  'business'::identity.declared_status)
          returning id::text`;
        const accountId = row?.id;
        if (accountId === undefined) {
          throw new Error("internal account not inserted");
        }
        await tx`insert into identity.account_roles (account_id, role)
                 values (${accountId}, 'admin'::identity.account_role)`;
        await tx`insert into identity.agent_profiles (account_id, first_name, is_break_glass)
                 values (${accountId}, ${account.firstName}, ${account.isBreakGlass})`;
        await tx`insert into identity.mfa_enrollment_tokens (account_id, token_hash, expires_at)
                 values (${accountId}, ${enrollmentTokenHashOf(account.enrollmentToken)},
                         now() + interval '72 hours')`;
      }
    });
  } catch (error) {
    for (const id of userIds) {
      await goTrueAdmin(gotrue, "DELETE", `/users/${id}`).catch(
        () => undefined,
      );
    }
    throw error;
  }
}

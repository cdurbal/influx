// The four demonstration accounts of the LOCAL stack and of CI (docs/mvp/21 §4, J3 commit 11; J3-C
// rule 11; EC-30, EC-45, EC-57; G-1 point 2). Used by scripts/seed-demo-accounts.ts and by the
// database test that walks the "Terminé quand" of the J3.
// - Addresses in `example.test` only; nothing here is a real secret: the passwords and the
//   enrollment tokens are fixed values of the local stack and of CI, like the role passwords of
//   @influx/test-kit (03 P7, rule 5 of 0001).
// - EC-30 at J3: the GoTrue users are created by the administration API of the LOCAL GoTrue, the
//   `identity` rows by the migration role. identity.provision_account() arrives at J5.
// - Members have no password (D37): they sign in with the code the Brevo double receives.
//   Internal accounts get a password (EC-57: 12 characters to 72 UTF-8 bytes) and a fixed
//   enrollment token (72 hours), whose SHA-256 alone is stored (enrollmentTokenHashOf).
import { createHash } from "node:crypto";
import type { connectAsMigrationRole } from "@influx/test-kit/db";
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";
import { localPasswordVerdict } from "../src/domains/identity/password-policy.ts";
import { isPasswordWithinBounds } from "../src/platform/supabase.ts";

export type DemoRole = "advertiser" | "creator" | "agent" | "admin";

export type DemoAccount = {
  role: DemoRole;
  email: string;
  /** Internal accounts only; null for a member (code by e-mail, D37). */
  password: string | null;
  /** Internal accounts only: the token of the activation link (G-1 point 2). */
  enrollmentToken: string | null;
  preferredLanguage: "fr" | "en";
  displayName: string;
};

/** The fictitious terms version, marked as such in its label and its address. */
export const DEMO_TERMS_LABEL = "demo-fictive-1";
const DEMO_TERMS_URI = "demo://terms/fictive-not-a-legal-document";
const DEMO_TERMS_TEXT =
  "INFLUX demonstration terms: fictitious, not a legal document, local stack and CI only.";

/** Fixed local passwords of the internal demo accounts: no word of their address, no "influx". */
const DEMO_PASSWORDS: Readonly<Record<"agent" | "admin", string>> = {
  agent: "copper lantern drifts north",
  admin: "silver harbor wakes slowly",
};

/** A fixed token of 32 bytes in base64url (43 characters), derived from a constant label. */
function fixedEnrollmentToken(role: "agent" | "admin", tag: string): string {
  return createHash("sha256")
    .update(`influx local demo enrollment token|${role}|${tag}`, "utf8")
    .digest("base64url");
}

/**
 * The four accounts. `tag` names the set: empty for THE demonstration accounts
 * (`demo-agent@example.test`…), a random value for a test that must not touch them.
 */
export function demoAccounts(tag = ""): DemoAccount[] {
  const address = (role: DemoRole) =>
    tag === ""
      ? `demo-${role}@example.test`
      : `demo-${tag}-${role}@example.test`;
  return [
    {
      role: "advertiser",
      email: address("advertiser"),
      password: null,
      enrollmentToken: null,
      preferredLanguage: "fr",
      displayName: "Marque de démonstration",
    },
    {
      role: "creator",
      email: address("creator"),
      password: null,
      enrollmentToken: null,
      preferredLanguage: "en",
      displayName: "Demo creator",
    },
    {
      role: "agent",
      email: address("agent"),
      password: DEMO_PASSWORDS.agent,
      enrollmentToken: fixedEnrollmentToken("agent", tag),
      preferredLanguage: "fr",
      displayName: "Agent de démonstration",
    },
    {
      role: "admin",
      email: address("admin"),
      password: DEMO_PASSWORDS.admin,
      enrollmentToken: fixedEnrollmentToken("admin", tag),
      preferredLanguage: "fr",
      displayName: "Administrateur de démonstration",
    },
  ];
}

/** EC-57 (b) and B-1: every demo password passes the local rules a chosen password passes. */
export function checkDemoPasswords(accounts: readonly DemoAccount[]): void {
  for (const account of accounts) {
    if (account.password === null) {
      continue;
    }
    if (
      !isPasswordWithinBounds(account.password) ||
      localPasswordVerdict(account.password, account.email) !== "accepted"
    ) {
      throw new Error(`demo password of ${account.role} breaks B-1 / EC-57`);
    }
  }
}

/** The local GoTrue: its URL and the `sb_secret_…` key of the local stack (never a real one). */
export type LocalGoTrue = { authUrl: string; secretKey: string };

/** A connection of the migration role on the local stack (@influx/test-kit/db). */
type MigrationSql = ReturnType<typeof connectAsMigrationRole>;

export type SeedOutcome = "created" | "already_present";

async function createGoTrueUser(
  gotrue: LocalGoTrue,
  account: DemoAccount,
): Promise<string> {
  const response = await fetch(`${gotrue.authUrl}/admin/users`, {
    method: "POST",
    headers: {
      apikey: gotrue.secretKey,
      authorization: `Bearer ${gotrue.secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: account.email,
      email_confirm: true,
      ...(account.password === null ? {} : { password: account.password }),
    }),
    signal: AbortSignal.timeout(5_000),
  });
  const body = (await response.json()) as { id?: unknown; code?: unknown };
  if (!response.ok || typeof body.id !== "string") {
    throw new Error(
      `GoTrue refused the demo user ${account.role}: ${response.status} ${String(body.code)}`,
    );
  }
  return body.id;
}

/**
 * Creates the four accounts, or does nothing when they all exist. A partial set is an error:
 * the way out is `supabase db reset`, then the script again.
 */
export async function seedDemoAccounts(
  migration: MigrationSql,
  gotrue: LocalGoTrue,
  accounts: readonly DemoAccount[],
): Promise<SeedOutcome> {
  checkDemoPasswords(accounts);
  const emails = accounts.map((account) => account.email);
  const existing = await migration<{ email: string }[]>`
    select email from identity.accounts where email in ${migration(emails)}
    union
    select email from auth.users where email in ${migration(emails)}`;
  if (existing.length === accounts.length) {
    return "already_present";
  }
  if (existing.length > 0) {
    throw new Error(
      "demo accounts partly present: run `supabase db reset`, then this script again",
    );
  }
  const authUserIds = new Map<DemoRole, string>();
  for (const account of accounts) {
    authUserIds.set(account.role, await createGoTrueUser(gotrue, account));
  }

  await migration.begin(async (tx) => {
    // The fictitious terms version, per language, unless a current one exists.
    const termsHash = createHash("sha256")
      .update(DEMO_TERMS_TEXT, "utf8")
      .digest();
    const termsOf = new Map<string, { id: string; hash: Buffer }>();
    for (const locale of ["fr", "en"]) {
      const [current] = await tx<{ id: string; content_hash: Buffer }[]>`
        select id::text, content_hash from identity.terms_versions
         where document_kind = 'terms_of_service' and locale = ${locale}
           and effective_to is null`;
      if (current !== undefined) {
        termsOf.set(locale, { id: current.id, hash: current.content_hash });
        continue;
      }
      const [inserted] = await tx<{ id: string }[]>`
        insert into identity.terms_versions
          (document_kind, locale, version_label, content_uri, content_hash, requires_acceptance,
           published_at, effective_from)
        values ('terms_of_service', ${locale}, ${DEMO_TERMS_LABEL}, ${DEMO_TERMS_URI},
                ${termsHash}, true, now(), now())
        returning id::text`;
      if (inserted === undefined) {
        throw new Error("demo terms version not inserted");
      }
      termsOf.set(locale, { id: inserted.id, hash: termsHash });
    }

    for (const account of accounts) {
      const [row] = await tx<{ id: string }[]>`
        insert into identity.accounts
          (auth_user_id, email, email_verified_at, country_code, preferred_language,
           display_name, is_adult_attested, adult_attested_at, declared_status)
        values (${authUserIds.get(account.role) ?? null}, ${account.email}, now(), 'FR',
                ${account.preferredLanguage}, ${account.displayName}, true, now(),
                ${account.role === "creator" ? "individual" : "business"}::identity.declared_status)
        returning id::text`;
      const accountId = row?.id;
      if (accountId === undefined) {
        throw new Error("demo account not inserted");
      }
      await tx`insert into identity.account_roles (account_id, role)
               values (${accountId}, ${account.role}::identity.account_role)`;
      if (account.enrollmentToken === null) {
        const terms = termsOf.get(account.preferredLanguage);
        if (terms === undefined) {
          throw new Error("no terms version for the demo member");
        }
        await tx`insert into identity.terms_acceptances
                   (account_id, terms_version_id, content_hash, channel, locale)
                 values (${accountId}, ${terms.id}, ${terms.hash}, 'signup',
                         ${account.preferredLanguage})`;
        continue;
      }
      const tokenHash = enrollmentTokenHashOf(account.enrollmentToken);
      if (tokenHash === null) {
        throw new Error("malformed demo enrollment token");
      }
      await tx`insert into identity.agent_profiles (account_id, first_name)
               values (${accountId}, 'Démo')`;
      await tx`insert into identity.mfa_enrollment_tokens (account_id, token_hash, expires_at)
               values (${accountId}, ${tokenHash}, now() + interval '72 hours')`;
    }
  });
  return "created";
}

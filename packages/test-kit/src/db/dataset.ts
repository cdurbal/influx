// Data set of the database tests (docs/mvp/18 T2 rule 6, 9.5 D-4): two accounts (A and B) per
// business role, and at least one row in every Lot 0 table except billing.commission_rates,
// which stays EMPTY (T16.3). Synthetic data only, on the reserved `.test` domain (18 §1.3 rule 3).
// Loaded by the migration role after `supabase db reset`; idempotent, so that a local run can be
// repeated. It lives here, NOT in supabase/seed (which feeds staging).
import { createHash, randomBytes } from "node:crypto";
import type postgres from "postgres";

export const BUSINESS_ROLE_NAMES = [
  "advertiser",
  "creator",
  "agent",
  "admin",
] as const;
export type BusinessRoleName = (typeof BUSINESS_ROLE_NAMES)[number];
export type Side = "a" | "b";

const ROLE_DIGIT: Readonly<Record<BusinessRoleName, string>> = {
  advertiser: "1",
  creator: "2",
  agent: "3",
  admin: "4",
};
const SIDE_DIGIT: Readonly<Record<Side, string>> = { a: "a", b: "b" };

/** Fixed, recognisable identifiers: 00000000-0000-4000-8000-0000000002b0 = creator B. */
export function accountIdOf(role: BusinessRoleName, side: Side): string {
  return `00000000-0000-4000-8000-000000000${ROLE_DIGIT[role]}${SIDE_DIGIT[side]}0`;
}

function authUserIdOf(role: BusinessRoleName, side: Side): string {
  return `00000000-0000-4000-9000-000000000${ROLE_DIGIT[role]}${SIDE_DIGIT[side]}0`;
}

export const TERMS_VERSION_ID = "00000000-0000-4000-8000-00000000ff01";
/** A second version, never accepted by the data set: target of the insertion probes of T2. */
export const PROBE_TERMS_VERSION_ID = "00000000-0000-4000-8000-00000000ff03";
export const OWNERSHIP_ASSIGNMENT_ID = "00000000-0000-4000-8000-00000000ff02";

export function isInternalRole(role: BusinessRoleName): boolean {
  return role === "agent" || role === "admin";
}

export type DataSetAccount = {
  id: string;
  role: BusinessRoleName;
  side: Side;
  /** Raw session identifier (the cookie value) and its SHA-256, stored in identity.sessions. */
  sessionToken: Buffer;
  sessionTokenHash: Buffer;
};

export type DataSet = {
  accounts: Readonly<
    Record<BusinessRoleName, Readonly<Record<Side, DataSetAccount>>>
  >;
};

async function insertAccount(
  tx: postgres.TransactionSql,
  role: BusinessRoleName,
  side: Side,
): Promise<void> {
  const id = accountIdOf(role, side);
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       display_name, is_adult_attested, adult_attested_at)
    values (${id}, ${authUserIdOf(role, side)}, ${`t2-${role}-${side}@example.test`}, now(),
            'FR', 'fr', ${`T2 ${role} ${side}`}, true, now())
    on conflict do nothing`;
  await tx`
    insert into identity.account_roles (account_id, role)
    values (${id}, ${role}::identity.account_role)
    on conflict do nothing`;
  if (isInternalRole(role)) {
    await tx`
      insert into identity.agent_profiles (account_id, first_name, activated_at, mfa_enrolled_at)
      values (${id}, ${`T2${role}${side}`}, now(), now())
      on conflict do nothing`;
  } else {
    await tx`
      insert into identity.terms_acceptances
        (id, account_id, terms_version_id, content_hash, channel, locale)
      values (${`00000000-0000-4000-8000-00000000${ROLE_DIGIT[role]}${SIDE_DIGIT[side]}01`},
              ${id}, ${TERMS_VERSION_ID}, '\\x00'::bytea, 'signup', 'fr')
      on conflict do nothing`;
    await tx`
      insert into identity.consent_events (id, account_id, purpose, granted, source)
      values (${`00000000-0000-4000-8000-00000000${ROLE_DIGIT[role]}${SIDE_DIGIT[side]}02`},
              ${id}, 'marketing_email', true, 'signup_form')
      on conflict do nothing`;
  }
}

/** A fresh session per load: sessions expire, and a test needs the raw token. */
async function insertSession(
  tx: postgres.TransactionSql,
  role: BusinessRoleName,
  side: Side,
): Promise<DataSetAccount> {
  const sessionToken = randomBytes(32);
  const sessionTokenHash = createHash("sha256").update(sessionToken).digest();
  const internal = isInternalRole(role);
  await tx`
    insert into identity.sessions
      (token_hash, account_id, surface, aal, idle_expires_at, absolute_expires_at)
    values (${sessionTokenHash}, ${accountIdOf(role, side)},
            ${internal ? "backoffice" : "member"}::identity.session_surface,
            ${internal ? "aal2" : "aal1"}::identity.session_aal,
            now() + ${internal ? "25 minutes" : "10 days"}::interval,
            now() + ${internal ? "7 hours" : "100 days"}::interval)`;
  return {
    id: accountIdOf(role, side),
    role,
    side,
    sessionToken,
    sessionTokenHash,
  };
}

export async function loadDataSet(migration: postgres.Sql): Promise<DataSet> {
  return migration.begin(async (tx) => {
    await tx`
      insert into identity.terms_versions
        (id, document_kind, locale, version_label, content_uri, content_hash,
         requires_acceptance, published_at, effective_from)
      values (${TERMS_VERSION_ID}, 'terms_of_service', 'fr', 't2-test',
              'https://example.test/terms/t2', sha256('t2'::bytea), true, now(), now())
      on conflict do nothing`;
    await tx`
      insert into identity.terms_versions
        (id, document_kind, locale, version_label, content_uri, content_hash,
         requires_acceptance, published_at, effective_from)
      values (${PROBE_TERMS_VERSION_ID}, 'privacy_policy', 'fr', 't2-probe',
              'https://example.test/privacy/t2', sha256('t2-probe'::bytea), false, now(), now())
      on conflict do nothing`;

    const accounts = {} as Record<
      BusinessRoleName,
      Record<Side, DataSetAccount>
    >;
    for (const role of BUSINESS_ROLE_NAMES) {
      for (const side of ["a", "b"] as const) {
        await insertAccount(tx, role, side);
      }
    }
    for (const role of BUSINESS_ROLE_NAMES) {
      accounts[role] = {
        a: await insertSession(tx, role, "a"),
        b: await insertSession(tx, role, "b"),
      };
    }

    await tx`
      insert into backoffice.ownership_assignments (id, account_id, agent_account_id, reason_code)
      values (${OWNERSHIP_ASSIGNMENT_ID}, ${accountIdOf("advertiser", "a")},
              ${accountIdOf("agent", "a")}, 'test_data_set')
      on conflict do nothing`;

    // At least one verification record, so that its read rights are observable.
    const [checks] = await tx<
      { count: string }[]
    >`select count(*) from audit.chain_checks`;
    if (checks?.count === "0") {
      await tx`select * from audit.verify_chain()`;
    }
    return { accounts };
  });
}

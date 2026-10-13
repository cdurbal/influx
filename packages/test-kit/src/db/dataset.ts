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

/**
 * The French terms of service of the data set, in force on a fresh stack. The publication of the
 * drafts (21 EC-62) closes it on a workstation: the data set then accepts the version in force.
 */
export const TERMS_VERSION_ID = "00000000-0000-4000-8000-00000000ff01";
/**
 * A second version (privacy policy, French), never accepted by the data set: on a fresh stack,
 * the version in force that the insertion probes of T2 accept (expected-rights.ts).
 */
export const PROBE_TERMS_VERSION_ID = "00000000-0000-4000-8000-00000000ff03";
export const OWNERSHIP_ASSIGNMENT_ID = "00000000-0000-4000-8000-00000000ff02";
export const RECOVERY_CODE_ID = "00000000-0000-4000-8000-00000000ff04";
export const ENROLLMENT_TOKEN_ID = "00000000-0000-4000-8000-00000000ff05";
/** Journal line of agent A (0015, RG68: an internal address may request a code): target of the
 * probes of influx_auth. */
export const TRANSACTIONAL_SEND_REFERENCE =
  "00000000-0000-4000-8000-00000000ff06";
/** Fact of the queue line of the data set (0101): lead.created of advertiser A. */
export const OUTBOX_EVENT_ID = "00000000-0000-4000-8000-00000000ff07";

export function isInternalRole(role: BusinessRoleName): boolean {
  return role === "agent" || role === "admin";
}

/** 0104: declared_status is NOT NULL; an advertiser is business by construction (05 RG22). */
function declaredStatusOf(role: BusinessRoleName): "individual" | "business" {
  return role === "creator" ? "individual" : "business";
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
       display_name, is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${authUserIdOf(role, side)}, ${`t2-${role}-${side}@example.test`}, now(),
            'FR', 'fr', ${`T2 ${role} ${side}`}, true, now(),
            ${declaredStatusOf(role)}::identity.declared_status)
    on conflict do nothing`;
  await tx`
    insert into identity.account_roles (account_id, role)
    values (${id}, ${role}::identity.account_role)
    on conflict do nothing`;
  if (isInternalRole(role)) {
    // A pinned TOTP factor (0012, G-1 point 1): without it, influx_auth may open no
    // backoffice session for the account (C6-2).
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${id}, ${`T2${role}${side}`}, now(), now(),
              ${`00000000-0000-4000-a000-000000000${ROLE_DIGIT[role]}${SIDE_DIGIT[side]}0`})
      on conflict do nothing`;
  } else {
    // The French terms of service IN FORCE: TERMS_VERSION_ID on a fresh stack, or the draft
    // published since on a workstation (21 EC-62), which closes it. Inserted once only: the
    // trigger of 0005 refuses a version no longer in force even when the row already exists.
    const acceptanceId = `00000000-0000-4000-8000-00000000${ROLE_DIGIT[role]}${SIDE_DIGIT[side]}01`;
    await tx`
      insert into identity.terms_acceptances
        (id, account_id, terms_version_id, content_hash, channel, locale)
      select ${acceptanceId}, ${id}, v.id, '\\x00'::bytea, 'signup', 'fr'
        from identity.terms_versions v
       where v.document_kind = 'terms_of_service' and v.locale = 'fr'
         and v.effective_to is null and v.effective_from <= now()
         and not exists (select 1 from identity.terms_acceptances a
                          where a.id = ${acceptanceId})`;
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
  // Dates, aal and the first second-factor proof are computed by identity.prepare_session()
  // (0012, EC-29): only the columns influx_auth may write are given.
  await tx`
    insert into identity.sessions
      (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${sessionTokenHash}, ${accountIdOf(role, side)},
            ${internal ? "backoffice" : "member"}::identity.session_surface,
            ${internal ? "totp" : null}::identity.mfa_method,
            ${internal ? "firefox.linux" : "safari.ios"})`;
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
         requires_acceptance, published_at, effective_from, content)
      values (${TERMS_VERSION_ID}, 'terms_of_service', 'fr', 't2-test',
              'https://example.test/terms/t2', sha256('t2'::bytea), true, now(), now(), 't2')
      on conflict do nothing`;
    await tx`
      insert into identity.terms_versions
        (id, document_kind, locale, version_label, content_uri, content_hash,
         requires_acceptance, published_at, effective_from, content)
      values (${PROBE_TERMS_VERSION_ID}, 'privacy_policy', 'fr', 't2-probe',
              'https://example.test/privacy/t2', sha256('t2-probe'::bytea), false, now(), now(),
              't2-probe')
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

    // One row in each table of the second factor, the throttle and the journal (0013 to 0015),
    // so that T2 sees a refusal and not an empty table (18 T2 rule 3).
    await tx`
      insert into identity.mfa_recovery_codes (id, account_id, batch_id, code_hash)
      values (${RECOVERY_CODE_ID}, ${accountIdOf("agent", "a")}, ${RECOVERY_CODE_ID},
              sha256('t2-recovery-code'::bytea))
      on conflict do nothing`;
    await tx`
      insert into identity.mfa_enrollment_tokens (id, account_id, token_hash, expires_at)
      values (${ENROLLMENT_TOKEN_ID}, ${accountIdOf("agent", "b")},
              sha256('t2-enrollment-token'::bytea), now() + interval '72 hours')
      on conflict do nothing`;
    await tx`
      insert into identity.totp_replay_guards (account_id, code_hmac)
      values (${accountIdOf("admin", "a")}, sha256('t2-totp'::bytea))
      on conflict do nothing`;
    await tx`
      insert into identity.auth_request_throttle (scope, scope_key_hash, window_code)
      values ('code_request_email', sha256('t2-throttle'::bytea), '1h')
      on conflict do nothing`;
    await tx`
      insert into leads.transactional_sends (reference, email_code, priority, account_id, locale)
      values (${TRANSACTIONAL_SEND_REFERENCE}, 'auth.login_code', 'p0',
              ${accountIdOf("agent", "a")}, 'fr')
      on conflict do nothing`;

    // One row in each table of the Lot 1 migrations (0101, 0105, 0106; 0103 loads its own keys).
    // Both advertisers hold a profile, so that `propre` is observable against account B.
    for (const side of ["a", "b"] as const) {
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name)
        values (${accountIdOf("advertiser", side)}, ${`T2 brand ${side}`})
        on conflict do nothing`;
    }
    await tx`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, payload, idempotency_key)
      values (${OUTBOX_EVENT_ID}, 'lead.created', 'brevo_contact',
              ${`account:${accountIdOf("advertiser", "a")}`},
              jsonb_build_object('event_id', ${OUTBOX_EVENT_ID}::uuid,
                                 'account_id', ${accountIdOf("advertiser", "a")}::uuid),
              ${`lead.created:${OUTBOX_EVENT_ID}`})
      on conflict do nothing`;
    await tx`
      insert into leads.contact_sync_states (account_id, destination)
      values (${accountIdOf("advertiser", "a")}, 'brevo_contact')
      on conflict do nothing`;
    await tx`
      insert into identity.email_delivery_incidents
        (account_id, email_address, channel, incident_type, provider, provider_event_id,
         occurred_at)
      values (${accountIdOf("creator", "a")}, 't2-creator-a@example.test', 'marketing',
              'soft_bounce', 'brevo', 't2-incident', now())
      on conflict do nothing`;

    // One row in each table of the ops schema (0016, J4), at a fixed past minute: the metric
    // policies of influx_ops only bound ITS inserts, the migration role writes the data set.
    await tx`
      insert into ops.error_groups
        (fingerprint, source, service, error_type, message, route, first_version, last_version)
      values (sha256('t2-ops-group'::bytea), 'server', 'api', 'TypeError', 't2 data set',
              '/v1/status', 'local', 'local')
      on conflict do nothing`;
    await tx`
      insert into ops.error_occurrences (group_fingerprint, service, version, route, message)
      select sha256('t2-ops-group'::bytea), 'api', 'local', '/v1/status', 't2 data set'
       where not exists (select 1 from ops.error_occurrences)`;
    await tx`
      insert into ops.request_metrics
        (minute, service, instance, method, route, request_count, server_error_count,
         throttled_count, duration_buckets)
      values ('2026-01-01T00:00:00Z', 'api', 't2', 'GET', '/v1/status', 1, 0, 0,
              '{1,0,0,0,0,0,0,0,0}')
      on conflict do nothing`;
    await tx`
      insert into ops.process_metrics
        (minute, service, instance, event_loop_delay_p99_ms, event_loop_delay_max_ms, rss_bytes,
         heap_used_bytes, cpu_percent)
      values ('2026-01-01T00:00:00Z', 'api', 't2', 1, 2, 1, 1, 0)
      on conflict do nothing`;

    // One processed raw Brevo line and its outcome (0116), address already cleared: a line
    // WITHOUT an outcome would be taken by leads.process_brevo_inbound_event() in the TM1 cases.
    // One finished E-4 run at a fixed past period (0117): never the current one, claimable.
    await tx`
      insert into leads.brevo_inbound_events (origin, dedup_key, event, occurred_at)
      select 'webhook', sha256('t2-brevo-inbound'::bytea), 'delivered', now()
       where not exists (select 1 from leads.brevo_inbound_events
                          where dedup_key = sha256('t2-brevo-inbound'::bytea))`;
    await tx`
      insert into leads.brevo_inbound_outcomes (event_id, outcome)
      select id, 'informative' from leads.brevo_inbound_events
       where dedup_key = sha256('t2-brevo-inbound'::bytea)
      on conflict do nothing`;
    await tx`
      insert into ops.periodic_runs
        (task_code, period_key, started_at, finished_at, outcome)
      values ('brevo_inbound_purge', '2026-01-01', '2026-01-01T00:00:00Z',
              '2026-01-01T00:01:00Z', 'succeeded')
      on conflict do nothing`;

    // J7 commit 2bis (0118, 0120): one open address change request and one open ACCESS request
    // per member account (A and B, so that `propre` is observable), and one rescue report. The
    // TM cases deposit ERASURE requests, and supersede the open address change in their own
    // rolled-back transactions.
    for (const role of ["advertiser", "creator"] as const) {
      for (const side of ["a", "b"] as const) {
        const account = accountIdOf(role, side);
        await tx`
          insert into identity.email_change_requests
            (account_id, old_email, new_email, old_code_hash, new_code_hash)
          select a.id, a.email, ${`t2-new-${role}-${side}@example.test`},
                 sha256(convert_to(${`t2-old-${role}-${side}`}, 'UTF8')),
                 sha256(convert_to(${`t2-new-${role}-${side}`}, 'UTF8'))
            from identity.accounts a
           where a.id = ${account}
             and not exists (select 1 from identity.email_change_requests r
                              where r.account_id = ${account})`;
        await tx`
          insert into backoffice.data_subject_requests (request_type, requester_account_id)
          select 'access', ${account}::uuid
           where not exists (select 1 from backoffice.data_subject_requests r
                              where r.requester_account_id = ${account})`;
      }
    }
    await tx`
      insert into backoffice.code_delivery_reports (login_email, contact_email, message, locale)
      select 't2-login@example.test', 't2-contact@example.test', 't2 data set', 'fr'
       where not exists (select 1 from backoffice.code_delivery_reports)`;

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

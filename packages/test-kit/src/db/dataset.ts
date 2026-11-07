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
/**
 * A pending dual control request of admin A (0130), never confirmed nor consumed: the row that
 * makes the read of influx_admin observable (18 T2 rule 3). Its expiry passes after a day; it
 * stays pending (no expiry writer before the periodic task).
 */
export const DUAL_CONTROL_REQUEST_ID = "00000000-0000-4000-8000-00000000ff08";
/** An internal invitation of admin A (0131), proposing agent, never accepted. */
export const INTERNAL_INVITATION_ID = "00000000-0000-4000-8000-00000000ff09";
/** A member invitation of agent A (0131), proposing creator, never redeemed. */
export const MEMBER_INVITATION_ID = "00000000-0000-4000-8000-00000000ff0a";
/**
 * The 2V request (0137, privacy.approve_data_request) that approved the execution of the ACCESS
 * request of creator B: requested by admin A, confirmed by admin B, consumed.
 */
export const PRIVACY_DUAL_CONTROL_REQUEST_ID =
  "00000000-0000-4000-8000-00000000ff0b";
/**
 * The active logo rows of advertisers A and B (0204, L2B): rows only, no object in Storage (the
 * database tests never reach Storage).
 */
export const BRAND_LOGO_IDS = {
  a: "00000000-0000-4000-8000-00000000ff0c",
  b: "00000000-0000-4000-8000-00000000ff0d",
} as const;
/**
 * A CLOSED entry of queue 1 per advertiser (0207, L2C): a revision withdrawn, so that no case
 * finds an open entry it did not open (the unique open entry per account).
 */
export const REVIEW_ENTRY_IDS = {
  a: "00000000-0000-4000-8000-00000000ff0e",
  b: "00000000-0000-4000-8000-00000000ff0f",
} as const;
/** The withdrawn revision of each entry above (0207). */
export const FIELD_REVISION_IDS = {
  a: "00000000-0000-4000-8000-00000000ff10",
  b: "00000000-0000-4000-8000-00000000ff11",
} as const;
/**
 * The primary network line of creators A and B (0217, L2D): fixed, so that the exact audience of
 * the data set and the insert templates of T2 can name the line they belong to.
 */
export const CREATOR_SOCIAL_ACCOUNT_IDS = {
  a: "00000000-0000-4000-8000-00000000ff12",
  b: "00000000-0000-4000-8000-00000000ff13",
} as const;

/**
 * The verification rows of creators A and B (0221, L2E commit 05): an APPROVED account request on
 * the primary line, its observed code, a purged evidence row and a revoked badge, all inert (no
 * open request, no holding badge, nothing for the purge task), so that `propre` is observable
 * against account B and no case finds a request or a badge it did not open.
 */
export const VERIFICATION_IDS = {
  request: {
    a: "00000000-0000-4000-8000-00000000ff14",
    b: "00000000-0000-4000-8000-00000000ff15",
  },
  code: {
    a: "00000000-0000-4000-8000-00000000ff16",
    b: "00000000-0000-4000-8000-00000000ff17",
  },
  evidence: {
    a: "00000000-0000-4000-8000-00000000ff18",
    b: "00000000-0000-4000-8000-00000000ff19",
  },
  badge: {
    a: "00000000-0000-4000-8000-00000000ff1a",
    b: "00000000-0000-4000-8000-00000000ff1b",
  },
} as const;

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

    // One row per advertiser in each table of the full brand profile (0202, L2B), so that
    // `propre` is observable against account B; the T2 insert templates add other codes to A.
    const brandRows = {
      a: {
        sector: "beauty_personal_care",
        market: "FR",
        language: "fr",
        topic: "beauty",
        network: "instagram",
        format: "instagram_reel",
        audience: "FR",
        right: "organic_repost",
      },
      b: {
        sector: "fashion_accessories",
        market: "GB",
        language: "en",
        topic: "fashion",
        network: "tiktok",
        format: "tiktok_video",
        audience: "BE",
        right: "media_buy",
      },
    } as const;
    for (const side of ["a", "b"] as const) {
      const account = accountIdOf("advertiser", side);
      const rows = brandRows[side];
      await tx`
        insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code)
        values (${account}, 1, ${rows.sector}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_target_markets (account_id, slot, country_code)
        values (${account}, 1, ${rows.market}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_working_languages (account_id, language_code)
        values (${account}, ${rows.language}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_topics (account_id, slot, topic_code)
        values (${account}, 1, ${rows.topic}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_networks (account_id, network_code)
        values (${account}, ${rows.network}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_formats (account_id, format_code)
        values (${account}, ${rows.format}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_audience_countries (account_id, slot, country_code)
        values (${account}, 1, ${rows.audience}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_usage_rights (account_id, usage_right_code)
        values (${account}, ${rows.right}) on conflict do nothing`;
      await tx`
        insert into profiles.advertiser_contact_details
          (account_id, contact_first_name, contact_email, contact_phone)
        values (${account}, ${`T2 contact ${side}`}, ${`t2-contact-${side}@example.test`},
                '+33100000000')
        on conflict do nothing`;
      // 0204: an active logo row per advertiser, and the Storage usage of the previous UTC day
      // (today's quota of the tests stays whole)
      await tx`
        insert into profiles.brand_logo_objects
          (id, account_id, state, received_bytes, byte_size, width, height, activated_at)
        values (${BRAND_LOGO_IDS[side]}, ${account}, 'active', 40000, 20000, 512, 512, now())
        on conflict do nothing`;
      await tx`
        insert into profiles.storage_daily_usage
          (account_id, bucket_id, usage_day, upload_count, received_bytes)
        values (${account}, 'brand-logo', (now() at time zone 'UTC')::date - 1, 1, 40000)
        on conflict do nothing`;
      // 0207: a closed entry of queue 1 and its withdrawn revision per advertiser
      await tx`
        insert into profiles.advertiser_review_entries (id, account_id, kind, state, closed_at)
        values (${REVIEW_ENTRY_IDS[side]}, ${account}, 'revision', 'withdrawn', now())
        on conflict do nothing`;
      await tx`
        insert into profiles.profile_field_revisions
          (id, account_id, field_code, proposed_value, status, advertiser_review_entry_id,
           closed_at)
        values (${FIELD_REVISION_IDS[side]}, ${account}, 'advertiser.presentation',
                '"T2 presentation"'::jsonb, 'withdrawn', ${REVIEW_ENTRY_IDS[side]}, now())
        on conflict do nothing`;
    }
    // 0216 (L2D): the storefront of each creator and one row in each of its lists, so that
    // `propre` is observable against account B; the T2 insert templates add other codes to A.
    // Fixed aliases, in the alphabet of profiles.new_creator_alias() (a stack that ran the reprise
    // of 0216 after the data set keeps the drawn ones).
    const creatorRows = {
      a: {
        alias: "ZZZZ22",
        topic: "beauty",
        language: "fr",
        tone: "educational",
        format: "instagram_reel",
        right: "organic_repost",
      },
      b: {
        alias: "ZZZZ23",
        topic: "fashion",
        language: "en",
        tone: "humorous",
        format: "tiktok_video",
        right: "media_buy",
      },
    } as const;
    for (const side of ["a", "b"] as const) {
      const account = accountIdOf("creator", side);
      const rows = creatorRows[side];
      await tx`
        insert into profiles.creator_public_profiles
          (account_id, alias, residence_country_code, headline)
        values (${account}, ${rows.alias}, 'FR', ${`T2 headline ${side}`})
        on conflict do nothing`;
      await tx`
        insert into profiles.creator_topics (account_id, slot, topic_code)
        values (${account}, 1, ${rows.topic}) on conflict do nothing`;
      await tx`
        insert into profiles.creator_publication_languages (account_id, slot, language_code)
        values (${account}, 1, ${rows.language}) on conflict do nothing`;
      await tx`
        insert into profiles.creator_tones (account_id, slot, tone_code)
        values (${account}, 1, ${rows.tone}) on conflict do nothing`;
      await tx`
        insert into profiles.creator_formats (account_id, format_code)
        values (${account}, ${rows.format}) on conflict do nothing`;
      await tx`
        insert into profiles.creator_usage_rights (account_id, usage_right_code, inclusion)
        values (${account}, ${rows.right}, 'included') on conflict do nothing`;
    }
    // 0217 (L2D): the identifying objects of each creator. The identity row comes with the
    // storefront (trigger, or the reprise of 0217 on an older stack); one primary network line with
    // its exact figures and one row per audience dimension; one refused sector; one history row
    // (append-only: inserted once, never updated).
    const identityRows = {
      a: {
        network: "instagram",
        handle: "t2_creator_a",
        followers: 47312,
        country: "FR",
        age: "18_24",
        gender: "female",
        sector: "gambling",
      },
      b: {
        network: "tiktok",
        handle: "t2_creator_b",
        followers: 1200,
        country: "GB",
        age: "25_34",
        gender: "male",
        sector: "alcohol",
      },
    } as const;
    for (const side of ["a", "b"] as const) {
      const account = accountIdOf("creator", side);
      const rows = identityRows[side];
      const line = CREATOR_SOCIAL_ACCOUNT_IDS[side];
      await tx`
        insert into profiles.creator_identities (account_id) values (${account})
        on conflict do nothing`;
      await tx`
        insert into profiles.creator_social_accounts
          (id, account_id, network_code, is_primary, handle, followers_count, posts_last_30_days,
           avg_comments_per_post)
        values (${line}, ${account}, ${rows.network}, true, ${rows.handle}, ${rows.followers},
                14, 35)
        on conflict do nothing`;
      await tx`
        insert into profiles.creator_audience_countries
          (social_account_id, account_id, slot, country_code, share_percent)
        values (${line}, ${account}, 0, ${rows.country}, 72) on conflict do nothing`;
      await tx`
        insert into profiles.creator_audience_ages
          (social_account_id, account_id, age_band_code, share_percent)
        values (${line}, ${account}, ${rows.age}, 40) on conflict do nothing`;
      await tx`
        insert into profiles.creator_audience_genders
          (social_account_id, account_id, gender_code, share_percent)
        values (${line}, ${account}, ${rows.gender}, 61) on conflict do nothing`;
      await tx`
        insert into profiles.creator_refused_sectors (account_id, sector_code)
        values (${account}, ${rows.sector}) on conflict do nothing`;
      await tx`
        insert into profiles.creator_network_metrics_history
          (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
           avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
        select ${account}, ${line}, ${rows.network}, ${rows.followers}, 14, 35, 'declared', true,
               ${account}
         where not exists (select 1 from profiles.creator_network_metrics_history
                            where account_id = ${account})`;
    }
    // 0221 (L2E): one inert verification trail per creator (VERIFICATION_IDS), decided by agent A
    for (const side of ["a", "b"] as const) {
      const account = accountIdOf("creator", side);
      const rows = identityRows[side];
      const agent = accountIdOf("agent", "a");
      const ids = {
        request: VERIFICATION_IDS.request[side],
        code: VERIFICATION_IDS.code[side],
        evidence: VERIFICATION_IDS.evidence[side],
        badge: VERIFICATION_IDS.badge[side],
      };
      await tx`
        insert into verification.verification_requests
          (id, account_id, social_account_id, network_code, level, status, submitted_at,
           sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
        values (${ids.request}, ${account}, ${CREATOR_SOCIAL_ACCOUNT_IDS[side]}, ${rows.network},
                'account_verified', 'approved', now(), now() + interval '1 day',
                now() + interval '3 days', ${agent}, now(), now())
        on conflict do nothing`;
      await tx`
        insert into verification.ownership_codes
          (id, request_id, account_id, kind, code, expires_at, observed_by_account_id,
           observed_at, observed_handle)
        values (${ids.code}, ${ids.request}, ${account}, 'network',
                ${`INFLUX-T2DATAS${side.toUpperCase()}`}, now() + interval '7 days', ${agent},
                now(), ${rows.handle})
        on conflict do nothing`;
      await tx`
        insert into verification.evidence_files
          (id, request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
           activated_at, retention_due_at, purge_requested_at, deleted_at)
        values (${ids.evidence}, ${ids.request}, ${account}, 'purged', 40000, 20000, 1290, 2796,
                sha256(${`t2-evidence-${side}`}::bytea), now(), now() + interval '45 days',
                now(), now())
        on conflict do nothing`;
      await tx`
        insert into verification.badges
          (id, account_id, social_account_id, network_code, request_id, level,
           granted_by_account_id, granted_at, evidence_source, observed_handle_at_decision, state,
           revoked_at, revocation_reason_code)
        values (${ids.badge}, ${account}, ${CREATOR_SOCIAL_ACCOUNT_IDS[side]}, ${rows.network},
                ${ids.request}, 'account_verified', ${agent}, now(), 'public_profile',
                ${rows.handle}, 'revoked', now(), 'influx_error')
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

    // J9 commit 8 (0147): one row in each table of the active monitoring, at the same fixed past
    // hour; the hourly lines are those of the minute rows above (the hour counts as rolled up). The
    // alert state is resolved long ago: begin_alert_round() never returns it. The tally's key is a
    // digest of a fixed label, never of an address.
    await tx`
      insert into ops.worker_heartbeats
        (worker_id, instance, version, started_at, beat_at, loop_turn_at)
      values ('worker-t2-dataset', 't2', 'local', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
              '2026-01-01T00:00:00Z')
      on conflict do nothing`;
    await tx`
      insert into ops.probe_results
        (checked_at, instance, target, outcome, status_code, failure_code, duration_ms)
      values ('2026-01-01T00:00:30Z', 't2', 'api_health', 'up', 200, null, 12)
      on conflict do nothing`;
    await tx`
      insert into ops.database_samples (minute, connections, max_connections)
      values ('2026-01-01T00:00:00Z', 1, 100)
      on conflict do nothing`;
    await tx`
      insert into ops.signal_counts (minute, service, instance, signal, count)
      values ('2026-01-01T00:00:00Z', 'api', 't2', 'webhook_brevo_authenticated', 1)
      on conflict do nothing`;
    await tx`
      insert into ops.alert_states
        (scope, code, subject_key, state, opened_at, last_notified_at, notified_count, resolved_at)
      values ('worker', 'AL52', 't2-dataset', 'resolved', '2026-01-01T00:00:00Z',
              '2026-01-01T00:00:00Z', 1, '2026-01-01T00:10:00Z')
      on conflict do nothing`;
    await tx`
      insert into ops.request_metrics_hourly
        (hour, service, method, route, request_count, server_error_count, throttled_count,
         duration_buckets)
      values ('2026-01-01T00:00:00Z', 'api', 'GET', '/v1/status', 1, 0, 0, '{1,0,0,0,0,0,0,0,0}')
      on conflict do nothing`;
    await tx`
      insert into ops.process_metrics_hourly
        (hour, service, instance, minutes, event_loop_delay_p99_avg_ms, event_loop_delay_max_ms,
         rss_avg_bytes, rss_max_bytes, heap_used_avg_bytes, cpu_avg_percent, cpu_max_percent)
      values ('2026-01-01T00:00:00Z', 'api', 't2', 1, 1, 2, 1, 1, 1, 0, 0)
      on conflict do nothing`;
    await tx`
      insert into ops.probe_results_hourly (hour, target, checks, failures, duration_buckets)
      values ('2026-01-01T00:00:00Z', 'api_health', 1, 0, '{1,0,0,0,0,0,0,0,0}')
      on conflict do nothing`;
    await tx`
      insert into identity.code_failure_tallies (key_hash, hour, failure_count)
      values (sha256('t2-code-failure'::bytea), '2026-01-01T00:00:00Z', 1)
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

    // J8 commit 2 (0130): one dual control request (0129 and 0130 load their catalogues). Its
    // dates are computed by the trigger; the payload names advertiser B, who already holds a
    // role, so that it can never be executed.
    await tx`
      insert into backoffice.dual_control_requests
        (id, action_code, payload, reason_code, requested_by_account_id)
      values (${DUAL_CONTROL_REQUEST_ID}, 'identity.grant_role',
              jsonb_build_object('account_id', ${accountIdOf("advertiser", "b")}::uuid,
                                 'role', 'advertiser'),
              'test_data_set', ${accountIdOf("admin", "a")})
      on conflict do nothing`;

    // J8 commit 3 (0131): one invitation of each kind, never used (their dates come from the
    // triggers: they expire after 72 hours and 30 days and simply stay readable).
    await tx`
      insert into identity.internal_invitations
        (id, email, proposed_role, token_hash, created_by_account_id, reason_code)
      values (${INTERNAL_INVITATION_ID}, 't2-internal-invitation@example.test', 'agent',
              sha256('t2-internal-invitation'::bytea), ${accountIdOf("admin", "a")},
              'new_team_member')
      on conflict do nothing`;
    await tx`
      insert into backoffice.member_invitations
        (id, code_hash, email, proposed_role, preferred_language, created_by_account_id)
      values (${MEMBER_INVITATION_ID}, sha256('t2-member-invitation'::bytea),
              't2-member-invitation@example.test', 'creator', 'fr', ${accountIdOf("agent", "a")})
      on conflict do nothing`;

    // J8 commit 8 (0137): one row in each privacy table (18 T2 rule 3). The ACCESS request of
    // creator B is approved (2V of admins A and B, consumed), executed, notified and CLOSED, its
    // export already purged: nothing of it is pending for E-5, nothing is downloadable. Written
    // step by step through the triggers (the migration role bypasses the policies only).
    const creatorB = accountIdOf("creator", "b");
    const [execution] = await tx<{ count: number }[]>`
      select count(*)::int as count from privacy.request_executions where account_id = ${creatorB}`;
    if (execution?.count === 0) {
      const [request] = await tx<{ id: string }[]>`
        select id::text from backoffice.data_subject_requests
         where requester_account_id = ${creatorB} and request_type = 'access'
           and status <> 'closed'
         order by received_at limit 1`;
      if (request !== undefined) {
        await tx`
          insert into backoffice.dual_control_requests
            (id, action_code, payload, reason_code, requested_by_account_id)
          values (${PRIVACY_DUAL_CONTROL_REQUEST_ID}, 'privacy.approve_data_request',
                  jsonb_build_object('request_id', ${request.id}::uuid, 'request_type', 'access'),
                  'request_instructed', ${accountIdOf("admin", "a")})
          on conflict do nothing`;
        await tx`
          update backoffice.dual_control_requests
             set state = 'confirmed', confirmed_by_account_id = ${accountIdOf("admin", "b")}
           where id = ${PRIVACY_DUAL_CONTROL_REQUEST_ID} and state = 'pending'`;
        await tx`
          update backoffice.dual_control_requests set consumed_at = now()
           where id = ${PRIVACY_DUAL_CONTROL_REQUEST_ID} and state = 'confirmed'
             and consumed_at is null`;
        await tx`
          insert into privacy.request_executions
            (request_id, request_type, account_id, dual_control_request_id, approved_by_account_id)
          values (${request.id}, 'access', ${creatorB}, ${PRIVACY_DUAL_CONTROL_REQUEST_ID},
                  ${accountIdOf("admin", "b")})`;
        await tx`
          update backoffice.data_subject_requests set status = 'in_progress'
           where id = ${request.id}`;
        await tx`
          update privacy.request_executions set executed_at = now()
           where request_id = ${request.id}`;
        await tx`
          insert into privacy.data_exports
            (request_id, account_id, content, sha256, size_bytes, categories)
          values (${request.id}, ${creatorB}, '{}', sha256(convert_to('{}', 'UTF8')), 2,
                  array['account'])`;
        await tx`
          update privacy.data_exports set content = null where request_id = ${request.id}`;
        await tx`
          update privacy.request_executions
             set notification_message_id = 't2-export-ready', completed_at = now()
           where request_id = ${request.id}`;
        await tx`
          update backoffice.data_subject_requests
             set status = 'closed', outcome_code = 'satisfaite'
           where id = ${request.id}`;
      }
    }

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

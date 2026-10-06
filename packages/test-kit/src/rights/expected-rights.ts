// THE table of expected rights of T2 (docs/mvp/18 T2, 21 J2 point 6), derived from the matrix of
// docs/mvp/03 §3 and the GRANTs of migrations 0001 to 0008 (reviewed by expert-cybersecurite on
// 2026-09-26, 21 J2 "Revue de sécurité des migrations").
//
// Rules (18 T2):
// 1. one column per POSTGRES role; the `service` column of 03 §3 is split between influx_auth and
//    influx_worker. influx_auth receives its table rights at J3 (0012 to 0015, column by column,
//    03 P7 E-1 / E-2); influx_worker still has none (J6). An elevated role has no business
//    context: its probes act on account A of the advertiser role (t2-rls-matrix.test.ts);
// 2. every expectation cites its source; an absent cell means `refus_droit`: refusal is the
//    default, never the exception;
// 3. every table lists the templates its probes need, and the data set of test-kit places at
//    least one row in it, except billing.commission_rates which stays EMPTY (T16.3);
// 4. append-only tables carry `appendOnly` (T3.1, T3.2 apply to them);
// 5. a table of our schemas absent from this file fails the build (T2.2), and an entry whose table
//    no longer exists fails it too (T2.3).
//
// ANY CHANGE TO THIS FILE IS A CHANGE OF RIGHTS: the commit carries `security-reviewed: <date>`
// (03 I-4, 18 C-8), checked by the CI like a migration.

/** Postgres roles taken at execution time (18 T2.1): J2, plus influx_ops at J4 (0016). */
export const PROBED_ROLES = [
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_auth",
  "influx_worker",
  "influx_ops",
] as const;
export type ProbedRole = (typeof PROBED_ROLES)[number];

export const OPERATIONS = ["select", "insert", "update", "delete"] as const;
export type Operation = (typeof OPERATIONS)[number];

/**
 * Forms of 18 T2. `filtré` is not written here: it is what `propre` and `autorisé` become when
 * the role is taken without context, or in aal1 for agent and admin (T2.5), and is derived.
 * `vide` (added at J2, 21 §3 EC-35): the right exists but the table is empty BY DESIGN
 * (billing.commission_rates read by the administrator), so no row can ever be seen.
 */
export type Form = "refus_droit" | "propre" | "autorisé" | "vide";

export type Expectation = {
  form: Exclude<Form, "refus_droit">;
  source: string;
};

export type TableRights = {
  table: string;
  source: string;
  appendOnly?: true;
  /** Column readable by every role that may read the table (column grants, 0004). */
  probeColumn: string;
  /** Column holding the account of a row, for `propre` (own rows only). */
  ownerColumn?: string;
  /** SET clause of the update probes, for the tables some role may update. */
  updateSet?: string;
  /**
   * Insert template for the tables some role may insert into: `$1` is the account the row is
   * written for (A for the own-row probe, B for the other one).
   */
  insertTemplate?: string;
  /**
   * SQLSTATE of an insertion refused WITHOUT context, when a BEFORE INSERT trigger refuses it
   * before the policy does (default 42501). The row is refused either way.
   */
  filteredInsertCode?: string;
  expected: Partial<
    Record<ProbedRole, Partial<Record<Operation, Expectation>>>
  >;
};

const MEMBERS = ["influx_advertiser", "influx_creator"] as const;
const INTERNAL = ["influx_agent", "influx_admin"] as const;
const BUSINESS = [...MEMBERS, ...INTERNAL] as const;

/** The same expectation for several roles. */
function forRoles(
  roles: readonly ProbedRole[],
  operations: Partial<Record<Operation, Expectation>>,
): Partial<Record<ProbedRole, Partial<Record<Operation, Expectation>>>> {
  return Object.fromEntries(roles.map((role) => [role, operations]));
}

function merge(
  ...parts: Partial<
    Record<ProbedRole, Partial<Record<Operation, Expectation>>>
  >[]
): Partial<Record<ProbedRole, Partial<Record<Operation, Expectation>>>> {
  const result: Partial<
    Record<ProbedRole, Partial<Record<Operation, Expectation>>>
  > = {};
  for (const part of parts) {
    for (const [role, operations] of Object.entries(part) as [
      ProbedRole,
      Partial<Record<Operation, Expectation>>,
    ][]) {
      result[role] = { ...result[role], ...operations };
    }
  }
  return result;
}

/** influx_auth reads for the sign-in, column by column (0012 §6, 03 P7 E-2, EC-5). */
const AUTH_SIGN_IN_READ: Expectation = {
  form: "autorisé",
  source: "0012 §6: sign-in reads of influx_auth (E-2), named columns",
};

const REFERENCE_READ: Expectation = {
  form: "autorisé",
  source:
    "03 §3 (reference lists read by every role with a context); 0003 GRANT SELECT",
};

export const TABLE_RIGHTS: readonly TableRights[] = [
  {
    table: "reference.countries",
    source: "0003",
    probeColumn: "code",
    expected: forRoles(BUSINESS, { select: REFERENCE_READ }),
  },
  {
    table: "reference.currencies",
    source: "0003",
    probeColumn: "code",
    expected: forRoles(BUSINESS, { select: REFERENCE_READ }),
  },
  {
    table: "reference.languages",
    source: "0003",
    probeColumn: "code",
    expected: forRoles(BUSINESS, { select: REFERENCE_READ }),
  },
  {
    table: "identity.accounts",
    source: "0004 §6.1",
    probeColumn: "id",
    ownerColumn: "id",
    updateSet: "display_name = display_name",
    expected: merge(
      forRoles(MEMBERS, {
        select: {
          form: "propre",
          source: "03 §3.1 « Compte — lire ses propres données » S",
        },
        update: {
          form: "propre",
          source: "03 §3.1 « Compte — modifier ses propres données » S",
        },
      }),
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "03 §3.1 « Compte — lister et consulter (tous) » L·J",
        },
        update: {
          form: "propre",
          source: "03 §3.1 « Compte — modifier ses propres données » S",
        },
      }),
      { influx_auth: { select: AUTH_SIGN_IN_READ } },
    ),
  },
  {
    table: "identity.account_roles",
    source: "0004 §6.2",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    expected: merge(
      forRoles(MEMBERS, {
        select: {
          form: "propre",
          source: "03 §3.1 « Compte — lire ses propres données » S",
        },
      }),
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "03 §3.1 « Compte — lister et consulter (tous) » L·J",
        },
      }),
      { influx_auth: { select: AUTH_SIGN_IN_READ } },
    ),
  },
  {
    table: "identity.agent_profiles",
    source: "0004 §6.3, 0012 §6",
    probeColumn: "account_id",
    expected: merge(
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "0004 §6.3 (internal information, never for a member)",
        },
      }),
      {
        influx_auth: {
          select: {
            form: "autorisé",
            source:
              "0012 §6: active, break-glass and pinned factor, for the backoffice sign-in (G-1)",
          },
        },
      },
    ),
  },
  {
    table: "identity.sessions",
    source: "0004 §6.4, 0012",
    probeColumn: "id",
    ownerColumn: "account_id",
    // Writable by influx_auth only (EC-29); a no-op on a column it may update.
    updateSet: "mfa_method = mfa_method",
    // A backoffice session of the elevated subject (agent A); dates and aal are computed (0012).
    insertTemplate:
      "insert into identity.sessions (token_hash, account_id, surface, mfa_method) " +
      "values (sha256(gen_random_uuid()::text::bytea), $1, 'backoffice', 'totp')",
    expected: merge(
      forRoles(BUSINESS, {
        select: {
          form: "propre",
          source: "03 §3.1 « Sessions — lister les siennes » S",
        },
      }),
      {
        influx_auth: {
          select: {
            form: "autorisé",
            source: "0012 §6: E-2 reads the session it creates or refreshes",
          },
          insert: {
            form: "autorisé",
            source:
              "EC-29 point 1: creation by influx_auth (E-2), named columns",
          },
          update: {
            form: "autorisé",
            source:
              "EC-40: freshness of R and revocation after failed R, backoffice sessions only",
          },
        },
      },
    ),
  },
  {
    table: "identity.mfa_recovery_codes",
    source:
      "0013 §1 (EC-17): no right for any execution role; definer functions only",
    probeColumn: "id",
    expected: {},
  },
  {
    table: "identity.mfa_enrollment_tokens",
    source: "0013 §2 (G-1 point 2): no right for any execution role",
    probeColumn: "id",
    expected: {},
  },
  {
    table: "identity.totp_replay_guards",
    source: "0013 §3 (EC-39): no right for any execution role",
    probeColumn: "account_id",
    expected: {},
  },
  {
    table: "identity.auth_request_throttle",
    source:
      "0014 (EC-3, EC-47): no right for any execution role; definer functions only",
    probeColumn: "scope",
    expected: {},
  },
  {
    table: "identity.terms_versions",
    source: "0005 §5.1",
    probeColumn: "id",
    expected: forRoles(BUSINESS, {
      select: {
        form: "autorisé",
        source: "03 §3.1 « terms_versions — lire la version en vigueur » L",
      },
    }),
  },
  {
    table: "identity.terms_acceptances",
    source: "0005 §5.2",
    appendOnly: true,
    probeColumn: "id",
    ownerColumn: "account_id",
    insertTemplate:
      "insert into identity.terms_acceptances (account_id, terms_version_id, channel, locale) " +
      "values ($1, '00000000-0000-4000-8000-00000000ff03', 're_acceptance', 'fr')",
    // identity.prepare_terms_acceptance() (0005) reads the version with the caller's rights:
    // without context the version is invisible and the trigger refuses first, 23503, with the
    // same message as an unknown version (21 §3 EC-35).
    filteredInsertCode: "23503",
    expected: merge(
      forRoles(MEMBERS, {
        select: {
          form: "propre",
          source: "03 §3.1 « terms_acceptances — lire » S",
        },
        insert: {
          form: "propre",
          source: "03 §3.1 « terms_acceptances — écrire » C(5)",
        },
      }),
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "03 §3.1 « terms_acceptances — lire » L·J",
        },
      }),
    ),
  },
  {
    table: "identity.consent_events",
    source: "0005 §5.3",
    appendOnly: true,
    probeColumn: "id",
    ownerColumn: "account_id",
    insertTemplate:
      "insert into identity.consent_events (account_id, purpose, granted, source) " +
      "values ($1, 'marketing_email', false, 'account_settings')",
    expected: merge(
      forRoles(MEMBERS, {
        select: {
          form: "propre",
          source: "03 §3.5 consent, own history; 0005 §5.3",
        },
        insert: {
          form: "propre",
          source: "03 §3.5 C(36): a member changes his own consent",
        },
      }),
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "03 §3.5 consent read, never written, by agent and admin",
        },
      }),
    ),
  },
  {
    table: "audit.event_types",
    source: "0006 §8",
    probeColumn: "code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source: "0006 §8 (closed list of codes, internal read)",
      },
    }),
  },
  {
    table: "audit.audit_events",
    source: "0006 §8",
    appendOnly: true,
    probeColumn: "seq",
    expected: {
      influx_admin: {
        select: {
          form: "autorisé",
          source: "03 §3.6 register read by admin; C(38) agent: EC-31",
        },
      },
    },
  },
  {
    table: "audit.chain_checks",
    source: "0006 §8",
    appendOnly: true,
    // Not `id`: an identity column GENERATED ALWAYS refuses `set id = id` before any privilege.
    probeColumn: "chain_key",
    expected: {
      influx_admin: {
        select: {
          form: "autorisé",
          source: "03 §3.6 verifications read by admin",
        },
      },
    },
  },
  {
    table: "billing.commission_rates",
    source: "0007",
    probeColumn: "id",
    expected: {
      influx_admin: {
        select: {
          form: "vide",
          source: "03 §3.5 C(32): read by admin, EMPTY at the MVP (T16.3)",
        },
      },
    },
  },
  {
    table: "backoffice.ownership_assignments",
    source: "0008",
    probeColumn: "id",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source: "0008 (ownership history, internal read)",
      },
    }),
  },
  {
    table: "leads.transactional_sends",
    source: "0015 (D43, EC-6, EC-7)",
    // influx_auth reads id, reference and status only (not account_id): the probes address the
    // table by status, a no-op on the outcome of the queued P0 lines (policy: p0 and queued).
    probeColumn: "status",
    insertTemplate:
      "insert into leads.transactional_sends (email_code, priority, account_id, locale) " +
      "values ('auth.login_code', 'p0', $1, 'fr')",
    expected: {
      influx_auth: {
        select: {
          form: "autorisé",
          source: "0015: E-1 reads back its P0 line (id, reference, status)",
        },
        insert: {
          form: "autorisé",
          source: "0015, D43: E-1 journals the P0 sign-in code",
        },
        update: {
          form: "autorisé",
          source:
            "0015, D43: the outcome of the single attempt (sent or failed)",
        },
      },
    },
  },
  {
    table: "ops.error_groups",
    source: "0016 (D60, 02 §20.5; E-6)",
    // The two columns influx_ops reads for the upsert of a fingerprint; the update probe is a
    // no-op on the count, which the trigger lets through (it only refuses a decrease).
    probeColumn: "occurrence_count",
    insertTemplate:
      "insert into ops.error_groups (fingerprint, source, service, error_type, message, route, " +
      "first_version, last_version) values (sha256(convert_to($1::text, 'UTF8')), 'server', 'api', " +
      "'TypeError', 't2 probe', '/v1/status', 'local', 'local')",
    expected: {
      influx_ops: {
        select: {
          form: "autorisé",
          source:
            "0016: upsert of a group reads fingerprint and occurrence_count",
        },
        insert: {
          form: "autorisé",
          source: "0016, E-6: a new error group (description only)",
        },
        update: {
          form: "autorisé",
          source: "0016, E-6: occurrence count and last version",
        },
      },
    },
  },
  {
    table: "ops.error_occurrences",
    source: "0016 (D60, 02 §20.5, §20.8; E-6)",
    probeColumn: "message",
    insertTemplate:
      "insert into ops.error_occurrences (group_fingerprint, service, version, route, account_id, " +
      "message) values (sha256('t2-ops-group'::bytea), 'api', 'local', '/v1/status', $1, 't2 probe')",
    expected: {
      influx_ops: {
        insert: {
          form: "autorisé",
          source: "0016, E-6: a kept occurrence, never read back",
        },
      },
    },
  },
  {
    table: "ops.request_metrics",
    source: "0016 (D60, 02 §20.5; E-6)",
    probeColumn: "request_count",
    insertTemplate:
      "insert into ops.request_metrics (minute, service, instance, method, route, request_count, " +
      "server_error_count, throttled_count, duration_buckets) values (date_trunc('minute', now()) " +
      "- interval '1 minute', 'api', left(replace($1::text, '-', ''), 32), 'GET', '/v1/status', 1, " +
      "0, 0, '{1,0,0,0,0,0,0,0,0}')",
    expected: {
      influx_ops: {
        insert: {
          form: "autorisé",
          source: "0016, E-6: one line per ended minute, never read back",
        },
      },
    },
  },
  {
    table: "ops.process_metrics",
    source: "0016 (D60, 02 §20.5; E-6)",
    probeColumn: "cpu_percent",
    insertTemplate:
      "insert into ops.process_metrics (minute, service, instance, event_loop_delay_p99_ms, " +
      "event_loop_delay_max_ms, rss_bytes, heap_used_bytes, cpu_percent) values " +
      "(date_trunc('minute', now()) - interval '1 minute', 'api', left(replace($1::text, '-', ''), " +
      "32), 1, 2, 1, 1, 0)",
    expected: {
      influx_ops: {
        insert: {
          form: "autorisé",
          source: "0016, E-6: process health per ended minute, never read back",
        },
      },
    },
  },
];

/**
 * Schemas of ours (0001, and auth_hooks from 0010): T2.2 enumerates their tables. auth_hooks holds
 * one function and no table; the right of supabase_auth_admin on it is checked by the EC-41 cases
 * of db-tests/t8-auth-settings.test.ts (it is not an influx_% role, so T2.7 does not see it).
 */
export const OUR_SCHEMAS = [
  "auth_hooks",
  "influx",
  "reference",
  "identity",
  "audit",
  "billing",
  "backoffice",
  "leads",
  "profiles",
  "verification",
  "campaigns",
  "search",
  "matching",
  "messaging",
  "ops",
] as const;

/**
 * Schemas owned by the migration role that are NOT ours (T2.2 exclusions, named). 18 T2.2 names
 * `supabase_migrations` only; the local stack also shows `_realtime` and `extensions`, created by
 * Supabase under the `postgres` role (21 §3 EC-35).
 */
export const FOREIGN_SCHEMAS_OWNED_BY_MIGRATION_ROLE = [
  "supabase_migrations",
  "_realtime",
  "extensions",
] as const;

/**
 * T2.7: the EXACT snapshot of the privileges held by the roles of the closed list of 03 P7 on our
 * schemas — tables, columns, functions (owner's implicit EXECUTE included) and schemas. Format:
 * `role|kind|object|privileges`. Anything more, or less, fails. Taken from the local database
 * after 0001-0008 and reviewed line by line against 03 §3 and P7 on 2026-09-26; extended on
 * 2026-09-28 with the grants of 0011 to 0015 (J3 commit 6: influx_auth column by column, the
 * narrow audit functions, the identity definers), each line checked against its migration; and on
 * 2026-10-05 with those of 0016 (J4: influx_ops on the ops schema).
 */
export const EXPECTED_PRIVILEGES: readonly string[] = [
  "influx_admin|column|identity.accounts.display_name|UPDATE",
  "influx_admin|column|identity.accounts.preferred_language|UPDATE",
  "influx_admin|column|identity.accounts.timezone|UPDATE",
  "influx_admin|column|identity.sessions.aal|SELECT",
  "influx_admin|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_admin|column|identity.sessions.account_id|SELECT",
  "influx_admin|column|identity.sessions.country_code|SELECT",
  "influx_admin|column|identity.sessions.created_at|SELECT",
  "influx_admin|column|identity.sessions.idle_expires_at|SELECT",
  "influx_admin|column|identity.sessions.id|SELECT",
  "influx_admin|column|identity.sessions.last_activity_at|SELECT",
  "influx_admin|column|identity.sessions.revocation_reason|SELECT",
  "influx_admin|column|identity.sessions.revoked_at|SELECT",
  "influx_admin|column|identity.sessions.surface|SELECT",
  "influx_admin|column|identity.sessions.updated_at|SELECT",
  "influx_admin|column|identity.sessions.user_agent_summary|SELECT",
  "influx_admin|function|identity.grant_role(uuid,identity.account_role,text)|EXECUTE",
  "influx_admin|function|identity.revoke_own_session(uuid,identity.session_revocation_reason)|EXECUTE",
  "influx_admin|function|identity.touch_session(uuid)|EXECUTE",
  "influx_admin|function|influx.current_aal()|EXECUTE",
  "influx_admin|function|influx.current_account_id()|EXECUTE",
  "influx_admin|function|influx.current_account_role()|EXECUTE",
  "influx_admin|function|influx.has_aal2()|EXECUTE",
  "influx_admin|schema|audit|USAGE",
  "influx_admin|schema|backoffice|USAGE",
  "influx_admin|schema|billing|USAGE",
  "influx_admin|schema|identity|USAGE",
  "influx_admin|schema|influx|USAGE",
  "influx_admin|schema|reference|USAGE",
  "influx_admin|table|audit.audit_events|SELECT",
  "influx_admin|table|audit.chain_checks|SELECT",
  "influx_admin|table|audit.event_types|SELECT",
  "influx_admin|table|backoffice.ownership_assignments|SELECT",
  "influx_admin|table|billing.commission_rates|SELECT",
  "influx_admin|table|identity.account_roles|SELECT",
  "influx_admin|table|identity.accounts|SELECT",
  "influx_admin|table|identity.agent_profiles|SELECT",
  "influx_admin|table|identity.consent_events|SELECT",
  "influx_admin|table|identity.terms_acceptances|SELECT",
  "influx_admin|table|identity.terms_versions|SELECT",
  "influx_admin|table|reference.countries|SELECT",
  "influx_admin|table|reference.currencies|SELECT",
  "influx_admin|table|reference.languages|SELECT",
  "influx_advertiser|column|identity.account_roles.account_id|SELECT",
  "influx_advertiser|column|identity.account_roles.created_at|SELECT",
  "influx_advertiser|column|identity.account_roles.granted_at|SELECT",
  "influx_advertiser|column|identity.account_roles.role|SELECT",
  "influx_advertiser|column|identity.accounts.adult_attested_at|SELECT",
  "influx_advertiser|column|identity.accounts.country_code|SELECT",
  "influx_advertiser|column|identity.accounts.created_at|SELECT",
  "influx_advertiser|column|identity.accounts.display_name|SELECT,UPDATE",
  "influx_advertiser|column|identity.accounts.email_verified_at|SELECT",
  "influx_advertiser|column|identity.accounts.email|SELECT",
  "influx_advertiser|column|identity.accounts.id|SELECT",
  "influx_advertiser|column|identity.accounts.is_adult_attested|SELECT",
  "influx_advertiser|column|identity.accounts.last_seen_at|SELECT",
  "influx_advertiser|column|identity.accounts.preferred_language|SELECT,UPDATE",
  "influx_advertiser|column|identity.accounts.status|SELECT",
  "influx_advertiser|column|identity.accounts.timezone|SELECT,UPDATE",
  "influx_advertiser|column|identity.accounts.updated_at|SELECT",
  "influx_advertiser|column|identity.consent_events.account_id|INSERT",
  "influx_advertiser|column|identity.consent_events.evidence|INSERT",
  "influx_advertiser|column|identity.consent_events.granted|INSERT",
  "influx_advertiser|column|identity.consent_events.purpose|INSERT",
  "influx_advertiser|column|identity.consent_events.source|INSERT",
  "influx_advertiser|column|identity.sessions.aal|SELECT",
  "influx_advertiser|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_advertiser|column|identity.sessions.account_id|SELECT",
  "influx_advertiser|column|identity.sessions.country_code|SELECT",
  "influx_advertiser|column|identity.sessions.created_at|SELECT",
  "influx_advertiser|column|identity.sessions.idle_expires_at|SELECT",
  "influx_advertiser|column|identity.sessions.id|SELECT",
  "influx_advertiser|column|identity.sessions.last_activity_at|SELECT",
  "influx_advertiser|column|identity.sessions.revocation_reason|SELECT",
  "influx_advertiser|column|identity.sessions.revoked_at|SELECT",
  "influx_advertiser|column|identity.sessions.surface|SELECT",
  "influx_advertiser|column|identity.sessions.updated_at|SELECT",
  "influx_advertiser|column|identity.sessions.user_agent_summary|SELECT",
  "influx_advertiser|column|identity.terms_acceptances.account_id|INSERT",
  "influx_advertiser|column|identity.terms_acceptances.channel|INSERT",
  "influx_advertiser|column|identity.terms_acceptances.ip_address|INSERT",
  "influx_advertiser|column|identity.terms_acceptances.locale|INSERT",
  "influx_advertiser|column|identity.terms_acceptances.nature|INSERT",
  "influx_advertiser|column|identity.terms_acceptances.terms_version_id|INSERT",
  "influx_advertiser|column|identity.terms_acceptances.user_agent|INSERT",
  "influx_advertiser|function|identity.revoke_own_session(uuid,identity.session_revocation_reason)|EXECUTE",
  "influx_advertiser|function|identity.touch_session(uuid)|EXECUTE",
  "influx_advertiser|function|influx.current_aal()|EXECUTE",
  "influx_advertiser|function|influx.current_account_id()|EXECUTE",
  "influx_advertiser|function|influx.current_account_role()|EXECUTE",
  "influx_advertiser|function|influx.has_aal2()|EXECUTE",
  "influx_advertiser|schema|identity|USAGE",
  "influx_advertiser|schema|influx|USAGE",
  "influx_advertiser|schema|reference|USAGE",
  "influx_advertiser|table|identity.consent_events|SELECT",
  "influx_advertiser|table|identity.terms_acceptances|SELECT",
  "influx_advertiser|table|identity.terms_versions|SELECT",
  "influx_advertiser|table|reference.countries|SELECT",
  "influx_advertiser|table|reference.currencies|SELECT",
  "influx_advertiser|table|reference.languages|SELECT",
  "influx_agent|column|identity.accounts.display_name|UPDATE",
  "influx_agent|column|identity.accounts.preferred_language|UPDATE",
  "influx_agent|column|identity.accounts.timezone|UPDATE",
  "influx_agent|column|identity.sessions.aal|SELECT",
  "influx_agent|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_agent|column|identity.sessions.account_id|SELECT",
  "influx_agent|column|identity.sessions.country_code|SELECT",
  "influx_agent|column|identity.sessions.created_at|SELECT",
  "influx_agent|column|identity.sessions.idle_expires_at|SELECT",
  "influx_agent|column|identity.sessions.id|SELECT",
  "influx_agent|column|identity.sessions.last_activity_at|SELECT",
  "influx_agent|column|identity.sessions.revocation_reason|SELECT",
  "influx_agent|column|identity.sessions.revoked_at|SELECT",
  "influx_agent|column|identity.sessions.surface|SELECT",
  "influx_agent|column|identity.sessions.updated_at|SELECT",
  "influx_agent|column|identity.sessions.user_agent_summary|SELECT",
  "influx_agent|function|identity.revoke_own_session(uuid,identity.session_revocation_reason)|EXECUTE",
  "influx_agent|function|identity.touch_session(uuid)|EXECUTE",
  "influx_agent|function|influx.current_aal()|EXECUTE",
  "influx_agent|function|influx.current_account_id()|EXECUTE",
  "influx_agent|function|influx.current_account_role()|EXECUTE",
  "influx_agent|function|influx.has_aal2()|EXECUTE",
  "influx_agent|schema|audit|USAGE",
  "influx_agent|schema|backoffice|USAGE",
  "influx_agent|schema|identity|USAGE",
  "influx_agent|schema|influx|USAGE",
  "influx_agent|schema|reference|USAGE",
  "influx_agent|table|audit.event_types|SELECT",
  "influx_agent|table|backoffice.ownership_assignments|SELECT",
  "influx_agent|table|identity.account_roles|SELECT",
  "influx_agent|table|identity.accounts|SELECT",
  "influx_agent|table|identity.agent_profiles|SELECT",
  "influx_agent|table|identity.consent_events|SELECT",
  "influx_agent|table|identity.terms_acceptances|SELECT",
  "influx_agent|table|identity.terms_versions|SELECT",
  "influx_agent|table|reference.countries|SELECT",
  "influx_agent|table|reference.currencies|SELECT",
  "influx_agent|table|reference.languages|SELECT",
  "influx_app|function|identity.resolve_session(bytea)|EXECUTE",
  "influx_app|schema|identity|USAGE",
  "influx_audit_writer|column|audit.event_types.code|SELECT",
  "influx_audit_writer|column|audit.event_types.is_active|SELECT",
  "influx_audit_writer|column|audit.event_types.subject_type|SELECT",
  "influx_audit_writer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_audit_writer|function|audit.append_auth_event(text,uuid)|EXECUTE",
  "influx_audit_writer|function|audit.append_elevated(text,uuid)|EXECUTE",
  "influx_audit_writer|function|audit.payload_hash(text,bigint,timestamp with time zone,timestamp with time zone,text,audit.actor_type,uuid,text,uuid,jsonb,text)|EXECUTE",
  "influx_audit_writer|schema|audit|USAGE",
  "influx_audit_writer|table|audit.audit_events|INSERT,SELECT",
  "influx_auth|column|identity.account_roles.account_id|SELECT",
  "influx_auth|column|identity.account_roles.role|SELECT",
  "influx_auth|column|identity.accounts.auth_user_id|SELECT",
  "influx_auth|column|identity.accounts.email|SELECT",
  "influx_auth|column|identity.accounts.id|SELECT",
  "influx_auth|column|identity.accounts.status|SELECT",
  "influx_auth|column|identity.agent_profiles.account_id|SELECT",
  "influx_auth|column|identity.agent_profiles.is_active|SELECT",
  "influx_auth|column|identity.agent_profiles.is_break_glass|SELECT",
  "influx_auth|column|identity.agent_profiles.mfa_factor_id|SELECT",
  "influx_auth|column|identity.sessions.aal|SELECT",
  "influx_auth|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_auth|column|identity.sessions.account_id|INSERT,SELECT",
  "influx_auth|column|identity.sessions.idle_expires_at|SELECT",
  "influx_auth|column|identity.sessions.id|SELECT",
  "influx_auth|column|identity.sessions.mfa_method|INSERT,SELECT,UPDATE",
  "influx_auth|column|identity.sessions.mfa_verified_at|SELECT,UPDATE",
  "influx_auth|column|identity.sessions.revocation_reason|UPDATE",
  "influx_auth|column|identity.sessions.revoked_at|SELECT,UPDATE",
  "influx_auth|column|identity.sessions.surface|INSERT,SELECT",
  "influx_auth|column|identity.sessions.token_hash|INSERT",
  "influx_auth|column|identity.sessions.user_agent_summary|INSERT",
  "influx_auth|column|leads.transactional_sends.account_id|INSERT",
  "influx_auth|column|leads.transactional_sends.email_code|INSERT",
  "influx_auth|column|leads.transactional_sends.failure_code|UPDATE",
  "influx_auth|column|leads.transactional_sends.id|SELECT",
  "influx_auth|column|leads.transactional_sends.locale|INSERT",
  "influx_auth|column|leads.transactional_sends.priority|INSERT",
  "influx_auth|column|leads.transactional_sends.provider_message_id|UPDATE",
  "influx_auth|column|leads.transactional_sends.recipient_email|INSERT",
  "influx_auth|column|leads.transactional_sends.reference|SELECT",
  "influx_auth|column|leads.transactional_sends.status|SELECT,UPDATE",
  "influx_auth|column|leads.transactional_sends.template_ref|INSERT",
  "influx_auth|column|leads.transactional_sends.template_version|INSERT",
  "influx_auth|function|audit.append_auth_event(text,uuid)|EXECUTE",
  "influx_auth|function|audit.append_elevated(text,uuid)|EXECUTE",
  "influx_auth|function|identity.accept_totp_code(uuid,bytea)|EXECUTE",
  "influx_auth|function|identity.auth_failure_count(identity.throttle_scope,bytea,identity.throttle_window)|EXECUTE",
  "influx_auth|function|identity.consume_recovery_code(uuid,bytea)|EXECUTE",
  "influx_auth|function|identity.enrollment_token_is_valid(uuid,bytea)|EXECUTE",
  "influx_auth|function|identity.pin_mfa_factor(uuid,uuid,bytea,bytea[])|EXECUTE",
  "influx_auth|function|identity.record_auth_failure(identity.throttle_scope,bytea,identity.throttle_window)|EXECUTE",
  "influx_auth|function|identity.reserve_auth_attempt(identity.throttle_scope,bytea,identity.throttle_window,integer)|EXECUTE",
  "influx_auth|schema|audit|USAGE",
  "influx_auth|schema|identity|USAGE",
  "influx_auth|schema|leads|USAGE",
  "influx_creator|column|identity.account_roles.account_id|SELECT",
  "influx_creator|column|identity.account_roles.created_at|SELECT",
  "influx_creator|column|identity.account_roles.granted_at|SELECT",
  "influx_creator|column|identity.account_roles.role|SELECT",
  "influx_creator|column|identity.accounts.adult_attested_at|SELECT",
  "influx_creator|column|identity.accounts.country_code|SELECT",
  "influx_creator|column|identity.accounts.created_at|SELECT",
  "influx_creator|column|identity.accounts.display_name|SELECT,UPDATE",
  "influx_creator|column|identity.accounts.email_verified_at|SELECT",
  "influx_creator|column|identity.accounts.email|SELECT",
  "influx_creator|column|identity.accounts.id|SELECT",
  "influx_creator|column|identity.accounts.is_adult_attested|SELECT",
  "influx_creator|column|identity.accounts.last_seen_at|SELECT",
  "influx_creator|column|identity.accounts.preferred_language|SELECT,UPDATE",
  "influx_creator|column|identity.accounts.status|SELECT",
  "influx_creator|column|identity.accounts.timezone|SELECT,UPDATE",
  "influx_creator|column|identity.accounts.updated_at|SELECT",
  "influx_creator|column|identity.consent_events.account_id|INSERT",
  "influx_creator|column|identity.consent_events.evidence|INSERT",
  "influx_creator|column|identity.consent_events.granted|INSERT",
  "influx_creator|column|identity.consent_events.purpose|INSERT",
  "influx_creator|column|identity.consent_events.source|INSERT",
  "influx_creator|column|identity.sessions.aal|SELECT",
  "influx_creator|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_creator|column|identity.sessions.account_id|SELECT",
  "influx_creator|column|identity.sessions.country_code|SELECT",
  "influx_creator|column|identity.sessions.created_at|SELECT",
  "influx_creator|column|identity.sessions.idle_expires_at|SELECT",
  "influx_creator|column|identity.sessions.id|SELECT",
  "influx_creator|column|identity.sessions.last_activity_at|SELECT",
  "influx_creator|column|identity.sessions.revocation_reason|SELECT",
  "influx_creator|column|identity.sessions.revoked_at|SELECT",
  "influx_creator|column|identity.sessions.surface|SELECT",
  "influx_creator|column|identity.sessions.updated_at|SELECT",
  "influx_creator|column|identity.sessions.user_agent_summary|SELECT",
  "influx_creator|column|identity.terms_acceptances.account_id|INSERT",
  "influx_creator|column|identity.terms_acceptances.channel|INSERT",
  "influx_creator|column|identity.terms_acceptances.ip_address|INSERT",
  "influx_creator|column|identity.terms_acceptances.locale|INSERT",
  "influx_creator|column|identity.terms_acceptances.nature|INSERT",
  "influx_creator|column|identity.terms_acceptances.terms_version_id|INSERT",
  "influx_creator|column|identity.terms_acceptances.user_agent|INSERT",
  "influx_creator|function|identity.revoke_own_session(uuid,identity.session_revocation_reason)|EXECUTE",
  "influx_creator|function|identity.touch_session(uuid)|EXECUTE",
  "influx_creator|function|influx.current_aal()|EXECUTE",
  "influx_creator|function|influx.current_account_id()|EXECUTE",
  "influx_creator|function|influx.current_account_role()|EXECUTE",
  "influx_creator|function|influx.has_aal2()|EXECUTE",
  "influx_creator|schema|identity|USAGE",
  "influx_creator|schema|influx|USAGE",
  "influx_creator|schema|reference|USAGE",
  "influx_creator|table|identity.consent_events|SELECT",
  "influx_creator|table|identity.terms_acceptances|SELECT",
  "influx_creator|table|identity.terms_versions|SELECT",
  "influx_creator|table|reference.countries|SELECT",
  "influx_creator|table|reference.currencies|SELECT",
  "influx_creator|table|reference.languages|SELECT",
  "influx_identity_definer|column|identity.account_roles.account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.account_roles.granted_by_account_id|INSERT",
  "influx_identity_definer|column|identity.account_roles.role|INSERT,SELECT",
  "influx_identity_definer|column|identity.accounts.id|SELECT",
  "influx_identity_definer|column|identity.accounts.status|SELECT",
  "influx_identity_definer|column|identity.agent_profiles.account_id|SELECT",
  "influx_identity_definer|column|identity.agent_profiles.is_active|SELECT",
  "influx_identity_definer|column|identity.agent_profiles.mfa_enrolled_at|UPDATE",
  "influx_identity_definer|column|identity.agent_profiles.mfa_factor_id|SELECT,UPDATE",
  "influx_identity_definer|column|identity.auth_request_throttle.denied_count|SELECT,UPDATE",
  "influx_identity_definer|column|identity.auth_request_throttle.expires_at|UPDATE",
  "influx_identity_definer|column|identity.auth_request_throttle.failure_count|SELECT,UPDATE",
  "influx_identity_definer|column|identity.auth_request_throttle.last_request_at|UPDATE",
  "influx_identity_definer|column|identity.auth_request_throttle.request_count|SELECT,UPDATE",
  "influx_identity_definer|column|identity.auth_request_throttle.scope_key_hash|INSERT,SELECT",
  "influx_identity_definer|column|identity.auth_request_throttle.scope|INSERT,SELECT",
  "influx_identity_definer|column|identity.auth_request_throttle.window_code|INSERT,SELECT",
  "influx_identity_definer|column|identity.auth_request_throttle.window_started_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.account_id|SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.consumed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.expires_at|SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.id|SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.token_hash|SELECT",
  "influx_identity_definer|column|identity.mfa_recovery_codes.account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.mfa_recovery_codes.batch_id|INSERT",
  "influx_identity_definer|column|identity.mfa_recovery_codes.code_hash|INSERT,SELECT",
  "influx_identity_definer|column|identity.mfa_recovery_codes.consumed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.mfa_recovery_codes.id|SELECT",
  "influx_identity_definer|column|identity.mfa_recovery_codes.revoked_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_identity_definer|column|identity.sessions.account_id|SELECT",
  "influx_identity_definer|column|identity.sessions.idle_expires_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.sessions.id|SELECT",
  "influx_identity_definer|column|identity.sessions.last_activity_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.sessions.revocation_reason|UPDATE",
  "influx_identity_definer|column|identity.sessions.revoked_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.sessions.surface|SELECT",
  "influx_identity_definer|column|identity.totp_replay_guards.account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.totp_replay_guards.code_hmac|INSERT,SELECT",
  "influx_identity_definer|column|identity.totp_replay_guards.created_at|SELECT",
  "influx_identity_definer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_identity_definer|function|identity.accept_totp_code(uuid,bytea)|EXECUTE",
  "influx_identity_definer|function|identity.auth_failure_count(identity.throttle_scope,bytea,identity.throttle_window)|EXECUTE",
  "influx_identity_definer|function|identity.consume_recovery_code(uuid,bytea)|EXECUTE",
  "influx_identity_definer|function|identity.enrollment_token_is_valid(uuid,bytea)|EXECUTE",
  "influx_identity_definer|function|identity.grant_role(uuid,identity.account_role,text)|EXECUTE",
  "influx_identity_definer|function|identity.pin_mfa_factor(uuid,uuid,bytea,bytea[])|EXECUTE",
  "influx_identity_definer|function|identity.record_auth_failure(identity.throttle_scope,bytea,identity.throttle_window)|EXECUTE",
  "influx_identity_definer|function|identity.reserve_auth_attempt(identity.throttle_scope,bytea,identity.throttle_window,integer)|EXECUTE",
  "influx_identity_definer|function|identity.revoke_own_session(uuid,identity.session_revocation_reason)|EXECUTE",
  "influx_identity_definer|function|identity.touch_session(uuid)|EXECUTE",
  "influx_identity_definer|function|influx.current_aal()|EXECUTE",
  "influx_identity_definer|function|influx.current_account_id()|EXECUTE",
  "influx_identity_definer|function|influx.current_account_role()|EXECUTE",
  "influx_identity_definer|function|influx.has_aal2()|EXECUTE",
  "influx_identity_definer|schema|audit|USAGE",
  "influx_identity_definer|schema|identity|USAGE",
  "influx_identity_definer|schema|influx|USAGE",
  "influx_identity_definer|table|identity.totp_replay_guards|DELETE",
  // 0016 (J4, D60, E-6): influx_ops writes the ops schema, reads two columns of error_groups.
  "influx_ops|column|ops.error_groups.error_type|INSERT",
  "influx_ops|column|ops.error_groups.fingerprint|INSERT,SELECT",
  "influx_ops|column|ops.error_groups.first_version|INSERT",
  "influx_ops|column|ops.error_groups.last_version|INSERT,UPDATE",
  "influx_ops|column|ops.error_groups.message|INSERT",
  "influx_ops|column|ops.error_groups.occurrence_count|SELECT,UPDATE",
  "influx_ops|column|ops.error_groups.route|INSERT",
  "influx_ops|column|ops.error_groups.service|INSERT",
  "influx_ops|column|ops.error_groups.source|INSERT",
  "influx_ops|column|ops.error_occurrences.account_id|INSERT",
  "influx_ops|column|ops.error_occurrences.group_fingerprint|INSERT",
  "influx_ops|column|ops.error_occurrences.message|INSERT",
  "influx_ops|column|ops.error_occurrences.request_id|INSERT",
  "influx_ops|column|ops.error_occurrences.route|INSERT",
  "influx_ops|column|ops.error_occurrences.service|INSERT",
  "influx_ops|column|ops.error_occurrences.stack|INSERT",
  "influx_ops|column|ops.error_occurrences.user_agent_summary|INSERT",
  "influx_ops|column|ops.error_occurrences.version|INSERT",
  "influx_ops|schema|ops|USAGE",
  "influx_ops|table|ops.process_metrics|INSERT",
  "influx_ops|table|ops.request_metrics|INSERT",
  "influx_session_resolver|column|identity.account_roles.account_id|SELECT",
  "influx_session_resolver|column|identity.account_roles.role|SELECT",
  "influx_session_resolver|column|identity.accounts.id|SELECT",
  "influx_session_resolver|column|identity.accounts.status|SELECT",
  "influx_session_resolver|column|identity.agent_profiles.account_id|SELECT",
  "influx_session_resolver|column|identity.agent_profiles.is_active|SELECT",
  "influx_session_resolver|column|identity.sessions.aal|SELECT",
  "influx_session_resolver|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_session_resolver|column|identity.sessions.account_id|SELECT",
  "influx_session_resolver|column|identity.sessions.idle_expires_at|SELECT",
  "influx_session_resolver|column|identity.sessions.id|SELECT",
  "influx_session_resolver|column|identity.sessions.revoked_at|SELECT",
  "influx_session_resolver|column|identity.sessions.surface|SELECT",
  "influx_session_resolver|column|identity.sessions.token_hash|SELECT",
  "influx_session_resolver|function|identity.resolve_session(bytea)|EXECUTE",
  "influx_session_resolver|schema|identity|USAGE",
];

/** T4.2, T4.3: the closed list of 03 P7 (twelve roles at J2, fourteen from J4), memberships. */
export const EXPECTED_ROLES: Readonly<
  Record<string, { login: boolean; memberOf: readonly string[] }>
> = {
  influx_app: {
    login: true,
    memberOf: [
      "influx_admin",
      "influx_advertiser",
      "influx_agent",
      "influx_creator",
    ],
  },
  influx_auth_login: { login: true, memberOf: ["influx_auth"] },
  influx_worker_login: { login: true, memberOf: ["influx_worker"] },
  influx_ops_login: { login: true, memberOf: ["influx_ops"] },
  influx_advertiser: { login: false, memberOf: [] },
  influx_creator: { login: false, memberOf: [] },
  influx_agent: { login: false, memberOf: [] },
  influx_admin: { login: false, memberOf: [] },
  influx_auth: { login: false, memberOf: [] },
  influx_worker: { login: false, memberOf: [] },
  influx_ops: { login: false, memberOf: [] },
  influx_audit_writer: { login: false, memberOf: [] },
  influx_session_resolver: { login: false, memberOf: [] },
  influx_identity_definer: { login: false, memberOf: [] },
};

/** Owners of SECURITY DEFINER functions: no login, NO member (only C-9 tolerance). */
export const FUNCTION_OWNER_ROLES = [
  "influx_audit_writer",
  "influx_session_resolver",
  "influx_identity_definer",
] as const;

/** Execution roles (T4.4: own nothing). */
export const EXECUTION_ROLES = [
  "influx_app",
  "influx_auth_login",
  "influx_worker_login",
  "influx_ops_login",
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_auth",
  "influx_worker",
  "influx_ops",
] as const;

/** T4.4: every SECURITY DEFINER function of our schemas, with its owner. */
export const SECURITY_DEFINER_FUNCTIONS: Readonly<Record<string, string>> = {
  "audit.append(text,text,uuid,jsonb)": "influx_audit_writer",
  "identity.resolve_session(bytea)": "influx_session_resolver",
  "identity.grant_role(uuid,identity.account_role,text)":
    "influx_identity_definer",
  // 0011 (EC-36, EC-44)
  "audit.append_elevated(text,uuid)": "influx_audit_writer",
  "audit.append_auth_event(text,uuid)": "influx_audit_writer",
  // 0012 (EC-29)
  "identity.touch_session(uuid)": "influx_identity_definer",
  "identity.revoke_own_session(uuid,identity.session_revocation_reason)":
    "influx_identity_definer",
  // 0013 (EC-17, EC-39, G-1)
  "identity.enrollment_token_is_valid(uuid,bytea)": "influx_identity_definer",
  "identity.pin_mfa_factor(uuid,uuid,bytea,bytea[])": "influx_identity_definer",
  "identity.consume_recovery_code(uuid,bytea)": "influx_identity_definer",
  "identity.accept_totp_code(uuid,bytea)": "influx_identity_definer",
  // 0014 (EC-3, EC-47)
  "identity.reserve_auth_attempt(identity.throttle_scope,bytea,identity.throttle_window,integer)":
    "influx_identity_definer",
  "identity.record_auth_failure(identity.throttle_scope,bytea,identity.throttle_window)":
    "influx_identity_definer",
  "identity.auth_failure_count(identity.throttle_scope,bytea,identity.throttle_window)":
    "influx_identity_definer",
};

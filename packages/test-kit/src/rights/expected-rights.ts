// THE table of expected rights of T2 (docs/mvp/18 T2, 21 J2 point 6), derived from the matrix of
// docs/mvp/03 §3 and the GRANTs of migrations 0001 to 0008 (reviewed by expert-cybersecurite on
// 2026-09-26, 21 J2 "Revue de sécurité des migrations").
//
// Rules (18 T2):
// 1. one column per POSTGRES role; the `service` column of 03 §3 is split between influx_auth and
//    influx_worker. influx_auth receives its table rights at J3 (0012 to 0015, column by column,
//    03 P7 E-1 / E-2); influx_worker has none, and keeps none from J6: E-3 goes through the four
//    functions of influx_leads_definer (0111). An elevated role has no business
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
    source:
      "0005 §5.1; influx_auth: no right, reads through identity.terms_in_force() (0108, EC-62)",
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
      "values ($1, (select v.id from identity.terms_versions v where v.document_kind = 'privacy_policy' " +
      "and v.locale = 'fr' and v.effective_to is null), 're_acceptance', 'fr')",
    // The French privacy policy in force: PROBE_TERMS_VERSION_ID on a fresh stack, the published
    // draft on a workstation (21 EC-62). Read under the caller's rights, like the trigger: without
    // context nothing is read, and the trigger refuses the null version with the same code.
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
    source:
      "0005 §5.3; 0119 (J7, RG73): a member changes his consent through " +
      "identity.set_marketing_consent() only, never by a direct INSERT (probed refused)",
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
    table: "leads.outbox_events",
    source: "0101 (04 §5.8, §6; D18)",
    // Not `id`: an identity column GENERATED ALWAYS refuses `set id = id` before any privilege.
    probeColumn: "status",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "0101, 04 §6 « L »: the queue read by the backoffice (05 RG97 to RG101); replay at J8",
      },
    }),
  },
  {
    table: "leads.contact_sync_states",
    source: "0101 (04 §5.8, §10.7)",
    probeColumn: "destination",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "0101, 04 §10.7: synchronisation state per contact, backoffice read; written by " +
          "leads.complete_outbox_attempt() (0111), never by a table right of influx_worker",
      },
    }),
  },
  {
    table: "leads.sync_settings",
    source:
      "0103 (EC-8): no right for any execution role; read by identity.provision_account() (0106), " +
      "by leads.begin_outbox_attempt() (0111), written by the admin function at J8",
    probeColumn: "key",
    expected: {},
  },
  {
    table: "identity.email_delivery_incidents",
    source: "0105 (04 §5.1, D37)",
    appendOnly: true,
    // Not `id`: an identity column GENERATED ALWAYS refuses `set id = id` before any privilege.
    probeColumn: "channel",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "03 §3.1 « Compte — lister et consulter (tous) » L·J; writer: the worker at J7",
      },
    }),
  },
  {
    table: "profiles.advertiser_profiles",
    source: "0106 (04 §5.2, minimal form)",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source: "04 §6 « S »: the advertiser reads their own profile",
          },
        },
      },
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "04 §6 « L »: agent and admin read every advertiser profile",
        },
      }),
    ),
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
  {
    table: "leads.brevo_inbound_events",
    source:
      "0116 (J7 decision 2, 16 RG147): no right for any execution role; written by " +
      "leads.record_brevo_event() (E-1, influx_auth) and leads.record_brevo_reconciliation_event() " +
      "(E-4, influx_worker), processed by leads.process_brevo_inbound_event() (E-3), purged by " +
      "ops.purge_brevo_inbound_events() (E-4). Guard tested in tm1-brevo-inbound.test.ts",
    probeColumn: "event",
    expected: {},
  },
  {
    table: "leads.brevo_inbound_outcomes",
    source:
      "0116 (J7 decision 2): no right for any execution role; written by " +
      "leads.process_brevo_inbound_event() only",
    probeColumn: "outcome",
    expected: {},
  },
  {
    table: "ops.periodic_runs",
    source:
      "0117 (J7 decision 3): no right for any execution role; written by ops.claim_periodic_run() " +
      "and ops.finish_periodic_run() (E-4, influx_worker) only",
    probeColumn: "task_code",
    expected: {},
  },
  {
    table: "identity.email_change_requests",
    source:
      "0118 (J7 decision 5, 05 RG58, 03 A-11): written by the identity functions only; never a " +
      "digest outside its owner",
    probeColumn: "id",
    ownerColumn: "account_id",
    expected: merge(
      forRoles(MEMBERS, {
        select: {
          form: "propre",
          source:
            '0118 §7.2: the member\'s own requests (the "address pending" screen)',
        },
      }),
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source:
            "0118 §7.3, 03 §3.1 L: every request in aal2, never the digests",
        },
      }),
    ),
  },
  {
    table: "backoffice.data_subject_requests",
    source:
      "0120 (J7 decision 6, EC-14): deposited by backoffice.submit_data_subject_request() only; " +
      "the admin write path comes with 0502 (Lot 5)",
    probeColumn: "id",
    ownerColumn: "requester_account_id",
    expected: merge(
      forRoles(MEMBERS, {
        select: {
          form: "propre",
          source:
            '0120 §5.2: the member\'s own requests (the "my data" screen)',
        },
      }),
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "0120 §5.3: both queues read in aal2, writes at Lot 5",
        },
      }),
    ),
  },
  {
    table: "backoffice.code_delivery_reports",
    source:
      "0120 (J7 decision 6, 05 RG65): written by backoffice.record_code_delivery_report() " +
      "(E-1, influx_auth) only, never read by it",
    probeColumn: "id",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source: "0120 §5.3: the rescue queue read in aal2, handled at Lot 5",
      },
    }),
  },
  {
    table: "backoffice.queues",
    source:
      "0129 (J8, 15 RG26, RG29): the closed catalogue of the queues, written by the migrations only",
    probeColumn: "code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "03 §3.5 « Tableau de bord, indicateurs agrégés » L; 15 RG28: the queue counters, aal2",
      },
    }),
  },
  {
    table: "backoffice.sla_policies",
    source:
      "0129 (J8, D39, 15 RG29, RG38): one delay per queue, written by the migrations only; " +
      "influx_identity_definer reads the delay of dual_control_pending (0130)",
    probeColumn: "queue_code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "03 §3.5 « Tableau de bord, indicateurs agrégés » L; 15 RG28, RG38: delays read in aal2",
      },
    }),
  },
  {
    table: "backoffice.alert_definitions",
    source:
      "0130 (J8, 15 §F RG63 to RG68): the catalogue of alerts of Lot 1, written by the migrations only",
    probeColumn: "code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "03 §3.5 « Tableau de bord, indicateurs agrégés » L; 15 RG63: thresholds read in aal2",
      },
    }),
  },
  {
    table: "backoffice.dual_control_requests",
    source:
      "0130 (J8, 03 PD4, 15 RG31): written by backoffice.request_dual_control(), " +
      "confirm_dual_control(), cancel_dual_control() and consumed by identity.grant_role() only",
    probeColumn: "id",
    expected: {
      influx_admin: {
        select: {
          form: "autorisé",
          source:
            "15 RG29 queue 15 dual_control_pending: « admin distinct du demandeur, ou le demandeur " +
            "en mode dégradé »; 03 §3.1 2V, aal2",
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
 * narrow audit functions, the identity definers), each line checked against its migration; on
 * 2026-10-05 with those of 0016 (J4: influx_ops on the ops schema); on 2026-10-08 with those
 * of 0101 to 0106 (J5, Lot 1), each line checked against its migration; and on 2026-10-09 with
 * those of 0111 (J6, E-3: influx_leads_definer column by column, influx_worker on its functions);
 * and on 2026-10-13 with those of 0116 and 0117 (J7 commit 2), then of 0118 to 0120 (J7 commit
 * 2bis), each line checked against its migration; and on 2026-10-15 with those of 0129 and 0130
 * (J8 commit 2), each line checked against its migration.
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
  "influx_admin|function|identity.grant_role(uuid,uuid,uuid,identity.account_role,text)|EXECUTE",
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
  "influx_advertiser|column|identity.accounts.preferred_language|SELECT",
  "influx_advertiser|column|identity.accounts.status|SELECT",
  "influx_advertiser|column|identity.accounts.timezone|SELECT,UPDATE",
  "influx_advertiser|column|identity.accounts.updated_at|SELECT",
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
  "influx_creator|column|identity.accounts.preferred_language|SELECT",
  "influx_creator|column|identity.accounts.status|SELECT",
  "influx_creator|column|identity.accounts.timezone|SELECT,UPDATE",
  "influx_creator|column|identity.accounts.updated_at|SELECT",
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
  "influx_identity_definer|function|identity.grant_role(uuid,uuid,uuid,identity.account_role,text)|EXECUTE",
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
  // 0101 to 0106 (J5, Lot 1): the queue and the states read by agent and admin, the advertiser
  // profile, set_declared_status() / correct_email() / provision_account() (EC-30, EXECUTE to
  // influx_auth only) and, column by column, what influx_identity_definer reads and writes.
  "influx_admin|function|identity.correct_email(uuid,text,text,text)|EXECUTE",
  "influx_admin|function|identity.set_declared_status(uuid,identity.declared_status,text,text)|EXECUTE",
  "influx_admin|schema|leads|USAGE",
  "influx_admin|schema|profiles|USAGE",
  "influx_admin|table|identity.email_delivery_incidents|SELECT",
  "influx_admin|table|leads.contact_sync_states|SELECT",
  "influx_admin|table|leads.outbox_events|SELECT",
  "influx_admin|table|profiles.advertiser_profiles|SELECT",
  "influx_advertiser|column|identity.accounts.declared_status|SELECT",
  "influx_advertiser|schema|profiles|USAGE",
  "influx_advertiser|table|profiles.advertiser_profiles|SELECT",
  "influx_agent|function|identity.set_declared_status(uuid,identity.declared_status,text,text)|EXECUTE",
  "influx_agent|schema|leads|USAGE",
  "influx_agent|schema|profiles|USAGE",
  "influx_agent|table|identity.email_delivery_incidents|SELECT",
  "influx_agent|table|leads.contact_sync_states|SELECT",
  "influx_agent|table|leads.outbox_events|SELECT",
  "influx_agent|table|profiles.advertiser_profiles|SELECT",
  "influx_auth|function|identity.provision_account(uuid,text,identity.account_role,text,text,identity.declared_status,boolean,text,uuid,boolean,text,text,text,text,text,text,text,identity.heard_from)|EXECUTE",
  "influx_creator|column|identity.accounts.declared_status|SELECT",
  "influx_creator|function|identity.set_declared_status(uuid,identity.declared_status,text,text)|EXECUTE",
  "influx_identity_definer|column|identity.accounts.adult_attested_at|INSERT",
  "influx_identity_definer|column|identity.accounts.auth_user_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.accounts.country_code|INSERT,SELECT,UPDATE",
  "influx_identity_definer|column|identity.accounts.declared_status|INSERT,SELECT,UPDATE",
  "influx_identity_definer|column|identity.accounts.email_status|SELECT,UPDATE",
  "influx_identity_definer|column|identity.accounts.email_undeliverable_at|UPDATE",
  "influx_identity_definer|column|identity.accounts.email_verified_at|INSERT,UPDATE",
  "influx_identity_definer|column|identity.accounts.email|INSERT,SELECT,UPDATE",
  "influx_identity_definer|column|identity.accounts.is_adult_attested|INSERT",
  "influx_identity_definer|column|identity.accounts.preferred_language|INSERT,SELECT,UPDATE",
  "influx_identity_definer|column|identity.accounts.signup_heard_from|INSERT",
  "influx_identity_definer|column|identity.accounts.signup_referrer_domain|INSERT",
  "influx_identity_definer|column|identity.accounts.signup_utm_campaign|INSERT",
  "influx_identity_definer|column|identity.accounts.signup_utm_medium|INSERT",
  "influx_identity_definer|column|identity.accounts.signup_utm_source|INSERT",
  "influx_identity_definer|column|identity.consent_events.account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.consent_events.evidence|INSERT",
  "influx_identity_definer|column|identity.consent_events.granted|INSERT,SELECT",
  "influx_identity_definer|column|identity.consent_events.purpose|INSERT,SELECT",
  "influx_identity_definer|column|identity.consent_events.source|INSERT",
  "influx_identity_definer|column|identity.terms_acceptances.account_id|INSERT",
  "influx_identity_definer|column|identity.terms_acceptances.channel|INSERT",
  "influx_identity_definer|column|identity.terms_acceptances.locale|INSERT",
  "influx_identity_definer|column|identity.terms_acceptances.nature|INSERT",
  "influx_identity_definer|column|identity.terms_acceptances.terms_version_id|INSERT",
  "influx_identity_definer|column|identity.terms_versions.content_hash|SELECT",
  "influx_identity_definer|column|identity.terms_versions.document_kind|SELECT",
  "influx_identity_definer|column|identity.terms_versions.effective_from|SELECT",
  "influx_identity_definer|column|identity.terms_versions.effective_to|SELECT",
  "influx_identity_definer|column|identity.terms_versions.id|SELECT",
  "influx_identity_definer|column|identity.terms_versions.locale|SELECT",
  "influx_identity_definer|column|leads.outbox_events.destination|INSERT",
  "influx_identity_definer|column|leads.outbox_events.event_id|INSERT",
  "influx_identity_definer|column|leads.outbox_events.event_type|INSERT",
  "influx_identity_definer|column|leads.outbox_events.idempotency_key|INSERT",
  "influx_identity_definer|column|leads.outbox_events.payload|INSERT",
  "influx_identity_definer|column|leads.outbox_events.priority|INSERT",
  "influx_identity_definer|column|leads.outbox_events.subject_key|INSERT",
  "influx_identity_definer|column|leads.sync_settings.key|SELECT",
  "influx_identity_definer|column|leads.sync_settings.value|SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.account_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.legal_name|INSERT,SELECT,UPDATE",
  "influx_identity_definer|function|identity.correct_email(uuid,text,text,text)|EXECUTE",
  "influx_identity_definer|function|identity.provision_account(uuid,text,identity.account_role,text,text,identity.declared_status,boolean,text,uuid,boolean,text,text,text,text,text,text,text,identity.heard_from)|EXECUTE",
  "influx_identity_definer|function|identity.set_declared_status(uuid,identity.declared_status,text,text)|EXECUTE",
  "influx_identity_definer|schema|leads|USAGE",
  "influx_identity_definer|schema|profiles|USAGE",
  // 0108 (J5, EC-62): the public documents, read by influx_auth through identity.terms_in_force()
  // only (no right on the table); the owner receives the three columns 0106 did not give it.
  "influx_auth|function|identity.terms_in_force(identity.document_kind,text)|EXECUTE",
  // 0109 (EC-62 amendment): the text it now returns
  "influx_identity_definer|column|identity.terms_versions.content|SELECT",
  "influx_identity_definer|column|identity.terms_versions.content_uri|SELECT",
  "influx_identity_definer|column|identity.terms_versions.requires_acceptance|SELECT",
  "influx_identity_definer|column|identity.terms_versions.version_label|SELECT",
  "influx_identity_definer|function|identity.terms_in_force(identity.document_kind,text)|EXECUTE",
  // 0111 (J6, E-3 leads.drain_outbox): influx_worker reaches the queue through four SECURITY
  // DEFINER functions only, and the register through audit.append_elevated() (EC-52 (3)); their
  // owner reads and writes, column by column, what the four functions read and write.
  "influx_leads_definer|column|identity.account_roles.account_id|SELECT",
  "influx_leads_definer|column|identity.account_roles.role|SELECT",
  "influx_leads_definer|column|identity.accounts.country_code|SELECT",
  "influx_leads_definer|column|identity.accounts.declared_status|SELECT",
  "influx_leads_definer|column|identity.accounts.email_verified_at|SELECT",
  "influx_leads_definer|column|identity.accounts.id|SELECT",
  "influx_leads_definer|column|identity.accounts.preferred_language|SELECT",
  "influx_leads_definer|column|identity.accounts.status|SELECT",
  "influx_leads_definer|column|identity.consent_events.account_id|INSERT,SELECT",
  "influx_leads_definer|column|identity.consent_events.granted|INSERT,SELECT",
  "influx_leads_definer|column|identity.consent_events.occurred_at|SELECT",
  "influx_leads_definer|column|identity.consent_events.purpose|INSERT,SELECT",
  "influx_leads_definer|column|leads.contact_sync_states.account_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.contact_sync_states.destination|INSERT,SELECT",
  "influx_leads_definer|column|leads.contact_sync_states.external_contact_id|INSERT,SELECT,UPDATE",
  "influx_leads_definer|column|leads.contact_sync_states.last_attempt_at|INSERT,UPDATE",
  "influx_leads_definer|column|leads.contact_sync_states.last_error_code|INSERT,UPDATE",
  "influx_leads_definer|column|leads.contact_sync_states.last_status|INSERT,UPDATE",
  "influx_leads_definer|column|leads.contact_sync_states.last_success_at|INSERT,SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.attempts|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.available_at|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.completed_at|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.destination|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.dry_run|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.event_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.event_type|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.id|SELECT",
  "influx_leads_definer|column|leads.outbox_events.idempotency_key|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.last_error_code|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.last_error_message|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.locked_at|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.locked_by|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.payload|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.priority|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.provider_contact_id|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.provider_message_id|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.skip_reason|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.status|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.subject_key|INSERT,SELECT",
  "influx_leads_definer|column|leads.sync_settings.key|SELECT",
  "influx_leads_definer|column|leads.sync_settings.value|SELECT",
  "influx_leads_definer|column|leads.transactional_sends.account_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.transactional_sends.email_code|INSERT,SELECT",
  "influx_leads_definer|column|leads.transactional_sends.locale|INSERT",
  "influx_leads_definer|column|leads.transactional_sends.outbox_event_id|INSERT",
  "influx_leads_definer|column|leads.transactional_sends.priority|INSERT",
  "influx_leads_definer|column|leads.transactional_sends.provider_message_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.transactional_sends.sent_at|INSERT",
  "influx_leads_definer|column|leads.transactional_sends.status|INSERT",
  "influx_leads_definer|column|leads.transactional_sends.template_ref|INSERT",
  "influx_leads_definer|column|leads.transactional_sends.template_version|INSERT",
  "influx_leads_definer|function|leads.begin_outbox_attempt(bigint,text)|EXECUTE",
  "influx_leads_definer|function|leads.claim_outbox_batch(text,integer)|EXECUTE",
  "influx_leads_definer|function|leads.complete_outbox_attempt(bigint,text,leads.outbox_status,boolean,text,text,text,integer,text,text,text,integer)|EXECUTE",
  "influx_leads_definer|function|leads.recover_stale_outbox_lines(integer)|EXECUTE",
  "influx_leads_definer|schema|identity|USAGE",
  "influx_leads_definer|schema|leads|USAGE",
  // 0112 (J6 commit 4, E-3): the Brevo connectors' own read, leads.read_brevo_subject(): the
  // address and the mapped fields (16 §M4, EC-11), the company name of an advertiser, the source of
  // the consent in force, and whether a welcome e-mail already left (16 RG90).
  "influx_leads_definer|column|identity.accounts.created_at|SELECT",
  "influx_leads_definer|column|identity.accounts.email|SELECT",
  "influx_leads_definer|column|identity.accounts.signup_heard_from|SELECT",
  "influx_leads_definer|column|identity.accounts.signup_referrer_domain|SELECT",
  "influx_leads_definer|column|identity.accounts.signup_utm_campaign|SELECT",
  "influx_leads_definer|column|identity.accounts.signup_utm_medium|SELECT",
  "influx_leads_definer|column|identity.accounts.signup_utm_source|SELECT",
  "influx_leads_definer|column|identity.consent_events.source|INSERT,SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.account_id|SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.legal_name|SELECT",
  "influx_leads_definer|function|leads.read_brevo_subject(bigint,text)|EXECUTE",
  // 0113 (J6 commit 5, E-3): the Apollo connector's own read, leads.read_apollo_subject(), on
  // columns already granted by 0111 and 0112.
  "influx_leads_definer|function|leads.read_apollo_subject(bigint,text)|EXECUTE",
  "influx_leads_definer|schema|profiles|USAGE",
  "influx_worker|function|leads.read_brevo_subject(bigint,text)|EXECUTE",
  "influx_worker|function|leads.read_apollo_subject(bigint,text)|EXECUTE",
  "influx_worker|function|audit.append_elevated(text,uuid)|EXECUTE",
  "influx_worker|function|leads.begin_outbox_attempt(bigint,text)|EXECUTE",
  "influx_worker|function|leads.claim_outbox_batch(text,integer)|EXECUTE",
  "influx_worker|function|leads.complete_outbox_attempt(bigint,text,leads.outbox_status,boolean,text,text,text,integer,text,text,text,integer)|EXECUTE",
  "influx_worker|function|leads.recover_stale_outbox_lines(integer)|EXECUTE",
  "influx_worker|schema|audit|USAGE",
  "influx_worker|schema|leads|USAGE",
  // 0116 (J7 decision 2): E-1 receive (influx_auth), E-3 processing (influx_worker), the raw table
  // and its outcome written by influx_leads_definer only; the "withdraws a right" writes (consent
  // event brevo_webhook, consent.revoked P0, contact state) and the transactional hard bounce
  // (identity definer, reached from the leads definer only).
  "influx_auth|function|leads.record_brevo_event(text,timestamp with time zone,text,text,bigint,bigint,text)|EXECUTE",
  "influx_worker|function|leads.process_brevo_inbound_event()|EXECUTE",
  "influx_worker|function|leads.record_brevo_reconciliation_event(text,timestamp with time zone,text,text,uuid,bigint,bigint,text)|EXECUTE",
  "influx_identity_definer|column|identity.email_delivery_incidents.account_id|INSERT",
  "influx_identity_definer|column|identity.email_delivery_incidents.channel|INSERT",
  "influx_identity_definer|column|identity.email_delivery_incidents.email_address|INSERT",
  "influx_identity_definer|column|identity.email_delivery_incidents.incident_type|INSERT",
  "influx_identity_definer|column|identity.email_delivery_incidents.occurred_at|INSERT",
  "influx_identity_definer|column|identity.email_delivery_incidents.payload|INSERT",
  "influx_identity_definer|column|identity.email_delivery_incidents.provider_event_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.email_delivery_incidents.provider|INSERT",
  "influx_identity_definer|function|identity.record_transactional_hard_bounce(uuid,text,text,timestamp with time zone,text)|EXECUTE",
  "influx_leads_definer|function|identity.record_transactional_hard_bounce(uuid,text,text,timestamp with time zone,text)|EXECUTE",
  "influx_leads_definer|column|identity.consent_events.evidence|INSERT",
  "influx_leads_definer|column|leads.brevo_inbound_events.account_ref|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.campaign_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.dedup_key|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.email|INSERT,SELECT,UPDATE",
  "influx_leads_definer|column|leads.brevo_inbound_events.event|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.id|SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.occurred_at|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.origin|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.provider_message_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.reason|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.received_at|SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_events.template_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_outcomes.account_id|INSERT",
  "influx_leads_definer|column|leads.brevo_inbound_outcomes.event_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.brevo_inbound_outcomes.outcome|INSERT",
  "influx_leads_definer|column|leads.contact_sync_states.suppressed_reason|INSERT,SELECT,UPDATE",
  "influx_leads_definer|column|leads.contact_sync_states.unsubscribed_at|INSERT,SELECT,UPDATE",
  "influx_leads_definer|function|leads.insert_brevo_inbound_event(leads.brevo_inbound_origin,text,timestamp with time zone,text,text,bigint,bigint,text,uuid)|EXECUTE",
  "influx_leads_definer|function|leads.process_brevo_inbound_event()|EXECUTE",
  "influx_leads_definer|function|leads.record_brevo_event(text,timestamp with time zone,text,text,bigint,bigint,text)|EXECUTE",
  "influx_leads_definer|function|leads.record_brevo_reconciliation_event(text,timestamp with time zone,text,text,uuid,bigint,bigint,text)|EXECUTE",
  // 0117 (J7 decision 3): E-4 through influx_maintenance_definer only; influx_worker executes the
  // five ops functions and has USAGE on ops, never a table right.
  "influx_maintenance_definer|column|identity.accounts.auth_user_id|SELECT",
  "influx_maintenance_definer|column|leads.brevo_inbound_events.id|SELECT",
  "influx_maintenance_definer|column|leads.brevo_inbound_outcomes.event_id|SELECT",
  "influx_maintenance_definer|column|leads.brevo_inbound_outcomes.processed_at|SELECT",
  "influx_maintenance_definer|column|ops.periodic_runs.attempt|SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.periodic_runs.counts|UPDATE",
  "influx_maintenance_definer|column|ops.periodic_runs.finished_at|SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.periodic_runs.id|SELECT",
  "influx_maintenance_definer|column|ops.periodic_runs.outcome|UPDATE",
  "influx_maintenance_definer|column|ops.periodic_runs.period_key|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.periodic_runs.started_at|SELECT",
  "influx_maintenance_definer|column|ops.periodic_runs.task_code|INSERT,SELECT",
  "influx_maintenance_definer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_maintenance_definer|function|ops.claim_periodic_run(ops.periodic_task,text)|EXECUTE",
  "influx_maintenance_definer|function|ops.filter_auth_orphans(uuid,smallint,uuid[])|EXECUTE",
  "influx_maintenance_definer|function|ops.finish_periodic_run(uuid,smallint,ops.periodic_run_outcome,jsonb)|EXECUTE",
  "influx_maintenance_definer|function|ops.purge_brevo_inbound_events(uuid,smallint,integer)|EXECUTE",
  "influx_maintenance_definer|function|ops.record_retention_purge(uuid,smallint,text,integer)|EXECUTE",
  "influx_maintenance_definer|schema|audit|USAGE",
  "influx_maintenance_definer|schema|identity|USAGE",
  "influx_maintenance_definer|schema|leads|USAGE",
  "influx_maintenance_definer|schema|ops|USAGE",
  "influx_maintenance_definer|table|leads.brevo_inbound_events|DELETE",
  // 0125 (C5.b, J7 commit 7 review): the hourly GoTrue pass realigns the address of GoTrue users on
  // the accounts that changed address (address and state of the account, confirmation instants of
  // the requests; never their addresses nor their digests).
  "influx_maintenance_definer|column|identity.accounts.email|SELECT",
  "influx_maintenance_definer|column|identity.accounts.id|SELECT",
  "influx_maintenance_definer|column|identity.accounts.status|SELECT",
  "influx_maintenance_definer|column|identity.email_change_requests.account_id|SELECT",
  "influx_maintenance_definer|column|identity.email_change_requests.new_confirmed_at|SELECT",
  "influx_maintenance_definer|column|identity.email_change_requests.old_confirmed_at|SELECT",
  "influx_maintenance_definer|function|ops.gotrue_realignment_candidates(uuid,smallint,uuid)|EXECUTE",
  "influx_worker|function|ops.gotrue_realignment_candidates(uuid,smallint,uuid)|EXECUTE",
  "influx_worker|function|ops.claim_periodic_run(ops.periodic_task,text)|EXECUTE",
  "influx_worker|function|ops.filter_auth_orphans(uuid,smallint,uuid[])|EXECUTE",
  "influx_worker|function|ops.finish_periodic_run(uuid,smallint,ops.periodic_run_outcome,jsonb)|EXECUTE",
  "influx_worker|function|ops.purge_brevo_inbound_events(uuid,smallint,integer)|EXECUTE",
  "influx_worker|function|ops.record_retention_purge(uuid,smallint,text,integer)|EXECUTE",
  "influx_worker|schema|ops|USAGE",
  // 0118 (J7 decisions 4 and 5): the re-authentication marker (influx_auth, E-2), the address
  // change requests (members through the identity functions; own rows without the digests;
  // agent and admin in aal2, never the digests).
  "influx_auth|function|identity.mark_member_reauthenticated(uuid,identity.reauth_purpose)|EXECUTE",
  "influx_identity_definer|function|identity.mark_member_reauthenticated(uuid,identity.reauth_purpose)|EXECUTE",
  "influx_identity_definer|function|identity.consume_member_reauthentication(uuid,identity.reauth_purpose)|EXECUTE",
  "influx_identity_definer|column|identity.sessions.created_at|SELECT",
  "influx_identity_definer|column|identity.sessions.reauth_purpose|SELECT,UPDATE",
  "influx_identity_definer|column|identity.sessions.reauthenticated_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.email_change_requests.cancel_reason|UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.cancelled_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.completed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.expires_at|SELECT",
  "influx_identity_definer|column|identity.email_change_requests.id|INSERT,SELECT",
  "influx_identity_definer|column|identity.email_change_requests.new_attempts|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.new_code_hash|INSERT,SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.new_confirmed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.new_email|INSERT,SELECT",
  "influx_identity_definer|column|identity.email_change_requests.old_attempts|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.old_code_hash|INSERT,SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.old_confirmed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.email_change_requests.old_email|INSERT,SELECT",
  "influx_identity_definer|function|identity.request_email_change(uuid,uuid,text,bytea,bytea)|EXECUTE",
  "influx_identity_definer|function|identity.confirm_email_change(uuid,identity.email_change_side,bytea)|EXECUTE",
  "influx_identity_definer|function|identity.complete_email_change(uuid,uuid)|EXECUTE",
  "influx_identity_definer|function|identity.cancel_email_change(uuid)|EXECUTE",
  "influx_advertiser|function|identity.request_email_change(uuid,uuid,text,bytea,bytea)|EXECUTE",
  "influx_advertiser|function|identity.confirm_email_change(uuid,identity.email_change_side,bytea)|EXECUTE",
  "influx_advertiser|function|identity.complete_email_change(uuid,uuid)|EXECUTE",
  "influx_advertiser|function|identity.cancel_email_change(uuid)|EXECUTE",
  "influx_creator|function|identity.request_email_change(uuid,uuid,text,bytea,bytea)|EXECUTE",
  "influx_creator|function|identity.confirm_email_change(uuid,identity.email_change_side,bytea)|EXECUTE",
  "influx_creator|function|identity.complete_email_change(uuid,uuid)|EXECUTE",
  "influx_creator|function|identity.cancel_email_change(uuid)|EXECUTE",
  // 0123 (J7 commit 7): the request closed when GoTrue refuses the new address as taken.
  "influx_identity_definer|function|identity.refuse_email_change_address(uuid)|EXECUTE",
  "influx_advertiser|function|identity.refuse_email_change_address(uuid)|EXECUTE",
  "influx_creator|function|identity.refuse_email_change_address(uuid)|EXECUTE",
  // 0124 (J7 commit 7, architecte point 2): the request whose codes did not leave (not_sent).
  "influx_identity_definer|function|identity.close_unsent_email_change(uuid)|EXECUTE",
  "influx_advertiser|function|identity.close_unsent_email_change(uuid)|EXECUTE",
  "influx_creator|function|identity.close_unsent_email_change(uuid)|EXECUTE",
  "influx_advertiser|column|identity.email_change_requests.account_id|SELECT",
  "influx_advertiser|column|identity.email_change_requests.cancel_reason|SELECT",
  "influx_advertiser|column|identity.email_change_requests.cancelled_at|SELECT",
  "influx_advertiser|column|identity.email_change_requests.completed_at|SELECT",
  "influx_advertiser|column|identity.email_change_requests.created_at|SELECT",
  "influx_advertiser|column|identity.email_change_requests.expires_at|SELECT",
  "influx_advertiser|column|identity.email_change_requests.id|SELECT",
  "influx_advertiser|column|identity.email_change_requests.new_attempts|SELECT",
  "influx_advertiser|column|identity.email_change_requests.new_confirmed_at|SELECT",
  "influx_advertiser|column|identity.email_change_requests.new_email|SELECT",
  "influx_advertiser|column|identity.email_change_requests.old_attempts|SELECT",
  "influx_advertiser|column|identity.email_change_requests.old_confirmed_at|SELECT",
  "influx_creator|column|identity.email_change_requests.account_id|SELECT",
  "influx_creator|column|identity.email_change_requests.cancel_reason|SELECT",
  "influx_creator|column|identity.email_change_requests.cancelled_at|SELECT",
  "influx_creator|column|identity.email_change_requests.completed_at|SELECT",
  "influx_creator|column|identity.email_change_requests.created_at|SELECT",
  "influx_creator|column|identity.email_change_requests.expires_at|SELECT",
  "influx_creator|column|identity.email_change_requests.id|SELECT",
  "influx_creator|column|identity.email_change_requests.new_attempts|SELECT",
  "influx_creator|column|identity.email_change_requests.new_confirmed_at|SELECT",
  "influx_creator|column|identity.email_change_requests.new_email|SELECT",
  "influx_creator|column|identity.email_change_requests.old_attempts|SELECT",
  "influx_creator|column|identity.email_change_requests.old_confirmed_at|SELECT",
  "influx_agent|column|identity.email_change_requests.account_id|SELECT",
  "influx_agent|column|identity.email_change_requests.cancel_reason|SELECT",
  "influx_agent|column|identity.email_change_requests.cancelled_at|SELECT",
  "influx_agent|column|identity.email_change_requests.completed_at|SELECT",
  "influx_agent|column|identity.email_change_requests.created_at|SELECT",
  "influx_agent|column|identity.email_change_requests.expires_at|SELECT",
  "influx_agent|column|identity.email_change_requests.id|SELECT",
  "influx_agent|column|identity.email_change_requests.new_attempts|SELECT",
  "influx_agent|column|identity.email_change_requests.new_confirmed_at|SELECT",
  "influx_agent|column|identity.email_change_requests.new_email|SELECT",
  "influx_agent|column|identity.email_change_requests.old_attempts|SELECT",
  "influx_agent|column|identity.email_change_requests.old_confirmed_at|SELECT",
  "influx_agent|column|identity.email_change_requests.old_email|SELECT",
  "influx_agent|column|identity.email_change_requests.updated_at|SELECT",
  "influx_admin|column|identity.email_change_requests.account_id|SELECT",
  "influx_admin|column|identity.email_change_requests.cancel_reason|SELECT",
  "influx_admin|column|identity.email_change_requests.cancelled_at|SELECT",
  "influx_admin|column|identity.email_change_requests.completed_at|SELECT",
  "influx_admin|column|identity.email_change_requests.created_at|SELECT",
  "influx_admin|column|identity.email_change_requests.expires_at|SELECT",
  "influx_admin|column|identity.email_change_requests.id|SELECT",
  "influx_admin|column|identity.email_change_requests.new_attempts|SELECT",
  "influx_admin|column|identity.email_change_requests.new_confirmed_at|SELECT",
  "influx_admin|column|identity.email_change_requests.new_email|SELECT",
  "influx_admin|column|identity.email_change_requests.old_attempts|SELECT",
  "influx_admin|column|identity.email_change_requests.old_confirmed_at|SELECT",
  "influx_admin|column|identity.email_change_requests.old_email|SELECT",
  "influx_admin|column|identity.email_change_requests.updated_at|SELECT",
  // 0119 (J7, EC-10, RG73): the members' consent through identity.set_marketing_consent() only
  // (their direct INSERT on identity.consent_events is revoked); the owner reads the consent in force.
  "influx_advertiser|function|identity.set_marketing_consent(identity.consent_purpose,boolean,jsonb)|EXECUTE",
  "influx_creator|function|identity.set_marketing_consent(identity.consent_purpose,boolean,jsonb)|EXECUTE",
  "influx_identity_definer|function|identity.set_marketing_consent(identity.consent_purpose,boolean,jsonb)|EXECUTE",
  "influx_identity_definer|column|identity.consent_events.occurred_at|SELECT",
  // 0122 (J7 commit 6, RG15, RG28, RG73): the members' country, language and company name through
  // identity.update_own_account() only (their direct UPDATE of preferred_language is revoked; the
  // owner reads and writes those columns, the latter of its own account under RLS); the terms of
  // service to accept read by identity.own_terms_to_accept() (SECURITY INVOKER).
  "influx_advertiser|function|identity.update_own_account(text,text,identity.declared_status,text)|EXECUTE",
  "influx_creator|function|identity.update_own_account(text,text,identity.declared_status,text)|EXECUTE",
  "influx_identity_definer|function|identity.update_own_account(text,text,identity.declared_status,text)|EXECUTE",
  "influx_advertiser|function|identity.own_terms_to_accept()|EXECUTE",
  "influx_creator|function|identity.own_terms_to_accept()|EXECUTE",
  // 0120 (J7 decision 6, EC-14, RG65): data subject requests deposited by the members (own rows),
  // rescue reports written by influx_auth (E-1); both read by agent and admin in aal2.
  "influx_advertiser|schema|backoffice|USAGE",
  "influx_creator|schema|backoffice|USAGE",
  "influx_auth|schema|backoffice|USAGE",
  "influx_identity_definer|schema|backoffice|USAGE",
  "influx_advertiser|function|backoffice.submit_data_subject_request(uuid,backoffice.data_request_type)|EXECUTE",
  "influx_creator|function|backoffice.submit_data_subject_request(uuid,backoffice.data_request_type)|EXECUTE",
  "influx_identity_definer|function|backoffice.submit_data_subject_request(uuid,backoffice.data_request_type)|EXECUTE",
  "influx_auth|function|backoffice.record_code_delivery_report(text,text,text,text)|EXECUTE",
  "influx_identity_definer|function|backoffice.record_code_delivery_report(text,text,text,text)|EXECUTE",
  "influx_identity_definer|column|backoffice.data_subject_requests.id|SELECT",
  "influx_identity_definer|column|backoffice.data_subject_requests.request_type|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.data_subject_requests.requester_account_id|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.data_subject_requests.status|SELECT",
  "influx_identity_definer|column|backoffice.code_delivery_reports.contact_email|INSERT",
  "influx_identity_definer|column|backoffice.code_delivery_reports.id|SELECT",
  "influx_identity_definer|column|backoffice.code_delivery_reports.locale|INSERT",
  "influx_identity_definer|column|backoffice.code_delivery_reports.login_email|INSERT",
  "influx_identity_definer|column|backoffice.code_delivery_reports.message|INSERT",
  "influx_advertiser|column|backoffice.data_subject_requests.channel|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.completed_at|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.due_at|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.id|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.outcome_code|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.received_at|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.requester_account_id|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.request_type|SELECT",
  "influx_advertiser|column|backoffice.data_subject_requests.status|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.channel|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.completed_at|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.due_at|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.id|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.outcome_code|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.received_at|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.requester_account_id|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.request_type|SELECT",
  "influx_creator|column|backoffice.data_subject_requests.status|SELECT",
  "influx_agent|table|backoffice.code_delivery_reports|SELECT",
  "influx_agent|table|backoffice.data_subject_requests|SELECT",
  "influx_admin|table|backoffice.code_delivery_reports|SELECT",
  "influx_admin|table|backoffice.data_subject_requests|SELECT",
  // 0121 (J7 commit 4): the Brevo connector's read of the old address of a COMPLETED request
  // (email.changed, RG58); never the digests nor the new address.
  "influx_leads_definer|column|identity.email_change_requests.account_id|SELECT",
  "influx_leads_definer|column|identity.email_change_requests.completed_at|SELECT",
  "influx_leads_definer|column|identity.email_change_requests.id|SELECT",
  "influx_leads_definer|column|identity.email_change_requests.old_email|SELECT",
  // 0126 (J7 commit 8): the "new browser" signal (05 RG141, RG142), influx_auth only, and the
  // worker's read of the session named by an auth.new_device line (member sessions only; never the
  // token digest, the marker nor the country).
  "influx_auth|function|identity.signal_new_browser(uuid)|EXECUTE",
  "influx_identity_definer|function|identity.signal_new_browser(uuid)|EXECUTE",
  "influx_identity_definer|column|identity.sessions.user_agent_summary|SELECT",
  "influx_leads_definer|column|identity.sessions.account_id|SELECT",
  "influx_leads_definer|column|identity.sessions.created_at|SELECT",
  "influx_leads_definer|column|identity.sessions.id|SELECT",
  "influx_leads_definer|column|identity.sessions.surface|SELECT",
  "influx_leads_definer|column|identity.sessions.user_agent_summary|SELECT",
  // 0128 (J7 commit 8bis): the worker's read of the request named by a privacy.request_received
  // line (16 RG160; never the channel nor the closing) and of the account's time zone.
  "influx_leads_definer|schema|backoffice|USAGE",
  "influx_leads_definer|column|backoffice.data_subject_requests.due_at|SELECT",
  "influx_leads_definer|column|backoffice.data_subject_requests.id|SELECT",
  "influx_leads_definer|column|backoffice.data_subject_requests.received_at|SELECT",
  "influx_leads_definer|column|backoffice.data_subject_requests.request_type|SELECT",
  "influx_leads_definer|column|backoffice.data_subject_requests.requester_account_id|SELECT",
  "influx_leads_definer|column|backoffice.data_subject_requests.status|SELECT",
  "influx_leads_definer|column|identity.accounts.timezone|SELECT",
  // 0129 (J8 commit 2): the catalogue of the queues and their delays, read by agent and admin in
  // aal2; nobody writes them but the migrations.
  "influx_agent|table|backoffice.queues|SELECT",
  "influx_admin|table|backoffice.queues|SELECT",
  "influx_agent|table|backoffice.sla_policies|SELECT",
  "influx_admin|table|backoffice.sla_policies|SELECT",
  // 0130 (J8 commit 2): the catalogue of alerts (agent and admin), the dual control requests
  // (admin), the three 2V functions and grant_role() rewritten (influx_admin only); their owner
  // reads and writes the requests column by column, reads the delay of dual_control_pending, the
  // second-factor freshness of a session (R) and the break-glass flag (PD7), and owns the four
  // SECURITY INVOKER helpers.
  "influx_agent|table|backoffice.alert_definitions|SELECT",
  "influx_admin|table|backoffice.alert_definitions|SELECT",
  "influx_admin|table|backoffice.dual_control_requests|SELECT",
  "influx_admin|function|backoffice.request_dual_control(text,jsonb,text,text)|EXECUTE",
  "influx_admin|function|backoffice.confirm_dual_control(uuid,uuid,text)|EXECUTE",
  "influx_admin|function|backoffice.cancel_dual_control(uuid)|EXECUTE",
  "influx_identity_definer|function|backoffice.request_dual_control(text,jsonb,text,text)|EXECUTE",
  "influx_identity_definer|function|backoffice.confirm_dual_control(uuid,uuid,text)|EXECUTE",
  "influx_identity_definer|function|backoffice.cancel_dual_control(uuid)|EXECUTE",
  "influx_identity_definer|function|backoffice.consume_dual_control(uuid,text,jsonb,text)|EXECUTE",
  "influx_identity_definer|function|backoffice.has_peer_admin(uuid)|EXECUTE",
  "influx_identity_definer|function|identity.require_active_admin()|EXECUTE",
  "influx_identity_definer|function|identity.assert_fresh_second_factor(uuid)|EXECUTE",
  "influx_identity_definer|column|backoffice.dual_control_requests.action_code|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.cancelled_by_account_id|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.dual_control_requests.confirmed_by_account_id|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.dual_control_requests.consumed_at|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.dual_control_requests.degraded_justification|UPDATE",
  "influx_identity_definer|column|backoffice.dual_control_requests.expires_at|SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.id|SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.payload|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.reason_code|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.reason_note|INSERT",
  "influx_identity_definer|column|backoffice.dual_control_requests.requested_at|SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.requested_by_account_id|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.dual_control_requests.state|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.sla_policies.business_hours|SELECT",
  "influx_identity_definer|column|backoffice.sla_policies.is_active|SELECT",
  "influx_identity_definer|column|backoffice.sla_policies.queue_code|SELECT",
  "influx_identity_definer|column|backoffice.sla_policies.target_decision_minutes|SELECT",
  "influx_identity_definer|column|identity.agent_profiles.is_break_glass|SELECT",
  "influx_identity_definer|column|identity.sessions.mfa_method|SELECT",
  "influx_identity_definer|column|identity.sessions.mfa_verified_at|SELECT",
];

/**
 * T4.2, T4.3: the closed list of 03 P7 (twelve roles at J2, fourteen from J4, fifteen from J6 with
 * influx_leads_definer, 0111, sixteen from J7 with influx_maintenance_definer, 0117), memberships.
 */
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
  influx_leads_definer: { login: false, memberOf: [] },
  influx_maintenance_definer: { login: false, memberOf: [] },
};

/** Owners of SECURITY DEFINER functions: no login, NO member (only C-9 tolerance). */
export const FUNCTION_OWNER_ROLES = [
  "influx_audit_writer",
  "influx_session_resolver",
  "influx_identity_definer",
  "influx_leads_definer",
  "influx_maintenance_definer",
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
  // 0130 (J8): the 0004 signature dropped, 2V and R enforced in the function
  "identity.grant_role(uuid,uuid,uuid,identity.account_role,text)":
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
  // 0104, 0106 (J5: 04 §5.1, EC-30)
  "identity.set_declared_status(uuid,identity.declared_status,text,text)":
    "influx_identity_definer",
  "identity.correct_email(uuid,text,text,text)": "influx_identity_definer",
  "identity.provision_account(uuid,text,identity.account_role,text,text,identity.declared_status,boolean,text,uuid,boolean,text,text,text,text,text,text,text,identity.heard_from)":
    "influx_identity_definer",
  // 0108 (J5, EC-62)
  "identity.terms_in_force(identity.document_kind,text)":
    "influx_identity_definer",
  // 0111 (J6, E-3 leads.drain_outbox)
  "leads.claim_outbox_batch(text,integer)": "influx_leads_definer",
  "leads.begin_outbox_attempt(bigint,text)": "influx_leads_definer",
  "leads.complete_outbox_attempt(bigint,text,leads.outbox_status,boolean,text,text,text,integer,text,text,text,integer)":
    "influx_leads_definer",
  "leads.read_apollo_subject(bigint,text)": "influx_leads_definer",
  "leads.read_brevo_subject(bigint,text)": "influx_leads_definer",
  "leads.recover_stale_outbox_lines(integer)": "influx_leads_definer",
  // 0116 (J7 decision 2: E-1 receive, E-3 processing, transactional hard bounce).
  // leads.insert_brevo_inbound_event() is SECURITY INVOKER (helper of the two record functions).
  "leads.record_brevo_event(text,timestamp with time zone,text,text,bigint,bigint,text)":
    "influx_leads_definer",
  "leads.record_brevo_reconciliation_event(text,timestamp with time zone,text,text,uuid,bigint,bigint,text)":
    "influx_leads_definer",
  "leads.process_brevo_inbound_event()": "influx_leads_definer",
  "identity.record_transactional_hard_bounce(uuid,text,text,timestamp with time zone,text)":
    "influx_identity_definer",
  // 0117 (J7 decision 3: E-4 maintenance.run_periodic)
  "ops.claim_periodic_run(ops.periodic_task,text)":
    "influx_maintenance_definer",
  "ops.finish_periodic_run(uuid,smallint,ops.periodic_run_outcome,jsonb)":
    "influx_maintenance_definer",
  "ops.filter_auth_orphans(uuid,smallint,uuid[])": "influx_maintenance_definer",
  // 0125
  "ops.gotrue_realignment_candidates(uuid,smallint,uuid)":
    "influx_maintenance_definer",
  "ops.record_retention_purge(uuid,smallint,text,integer)":
    "influx_maintenance_definer",
  "ops.purge_brevo_inbound_events(uuid,smallint,integer)":
    "influx_maintenance_definer",
  // 0118 (J7 decisions 4 and 5). identity.consume_member_reauthentication() is SECURITY INVOKER
  // (called by the identity functions only).
  "identity.mark_member_reauthenticated(uuid,identity.reauth_purpose)":
    "influx_identity_definer",
  "identity.request_email_change(uuid,uuid,text,bytea,bytea)":
    "influx_identity_definer",
  "identity.confirm_email_change(uuid,identity.email_change_side,bytea)":
    "influx_identity_definer",
  "identity.complete_email_change(uuid,uuid)": "influx_identity_definer",
  "identity.cancel_email_change(uuid)": "influx_identity_definer",
  // 0123 (J7 commit 7)
  "identity.refuse_email_change_address(uuid)": "influx_identity_definer",
  // 0124
  "identity.close_unsent_email_change(uuid)": "influx_identity_definer",
  // 0119 (J7, EC-10)
  "identity.set_marketing_consent(identity.consent_purpose,boolean,jsonb)":
    "influx_identity_definer",
  // 0122 (J7 commit 6)
  "identity.update_own_account(text,text,identity.declared_status,text)":
    "influx_identity_definer",
  // 0120 (J7 decision 6)
  "backoffice.submit_data_subject_request(uuid,backoffice.data_request_type)":
    "influx_identity_definer",
  "backoffice.record_code_delivery_report(text,text,text,text)":
    "influx_identity_definer",
  // 0126 (J7 commit 8)
  "identity.signal_new_browser(uuid)": "influx_identity_definer",
  // 0130 (J8 commit 2: the dual control, 03 PD1 to PD7). The four helpers
  // identity.require_active_admin(), identity.assert_fresh_second_factor(),
  // backoffice.has_peer_admin() and backoffice.consume_dual_control() are SECURITY INVOKER.
  "backoffice.request_dual_control(text,jsonb,text,text)":
    "influx_identity_definer",
  "backoffice.confirm_dual_control(uuid,uuid,text)": "influx_identity_definer",
  "backoffice.cancel_dual_control(uuid)": "influx_identity_definer",
};

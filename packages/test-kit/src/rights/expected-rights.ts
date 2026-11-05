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
//    least one row in it, except billing.commission_rates which stays EMPTY (T16.3) and
//    reference.price_bands, EMPTY at L2A (0201, D78);
// 4. append-only tables carry `appendOnly` (T3.1, T3.2 apply to them);
// 5. a table of our schemas absent from this file fails the build (T2.2), and an entry whose table
//    no longer exists fails it too (T2.3).
//
// ANY CHANGE TO THIS FILE IS A CHANGE OF RIGHTS: the commit carries `security-reviewed: <date>`
// (03 I-4, 18 C-8), checked by the CI like a migration.

/**
 * Postgres roles taken at execution time (18 T2.1): J2, plus influx_ops at J4 (0016), plus
 * influx_privacy at J8 (0136: E-5, no table right at all, every cell refus_droit).
 */
export const PROBED_ROLES = [
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_auth",
  "influx_worker",
  "influx_ops",
  "influx_privacy",
] as const;
export type ProbedRole = (typeof PROBED_ROLES)[number];

export const OPERATIONS = ["select", "insert", "update", "delete"] as const;
export type Operation = (typeof OPERATIONS)[number];

/**
 * Forms of 18 T2. `filtré` is not written here: it is what `propre` and `autorisé` become when
 * the role is taken without context, or in aal1 for agent and admin (T2.5), and is derived.
 * `vide` (added at J2, 21 §3 EC-35): the right exists but the table is empty BY DESIGN
 * (billing.commission_rates read by the administrator; reference.price_bands at L2A, 0201), so
 * no row can be seen.
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

/**
 * The Lot 2 reference lists loaded by 0201 (04 §4.2), price_bands apart: it is EMPTY at L2A (D78).
 * Same rights as 0003: SELECT to the four business roles, with a context (aal2 for agent, admin).
 */
export const LOT2_REFERENCE_TABLES = [
  "reference.topics",
  "reference.networks",
  "reference.formats",
  "reference.sectors",
  "reference.usage_rights",
  "reference.audience_bands",
  "reference.engagement_bands",
  "reference.age_bands",
  "reference.audience_genders",
  "reference.editorial_tones",
  "reference.publication_frequencies",
  "reference.comment_bands",
  "reference.regions",
] as const;

const LOT2_REFERENCE_READ: Expectation = {
  form: "autorisé",
  source:
    "03 §3 (reference lists read by every role with a context); 0201 GRANT SELECT, as 0003",
};

/**
 * The eight list tables of the brand profile (0202, L2B), each with the insert of its probe: a
 * code of account A that the data set does not hold, within the cap of the list (`slot`).
 */
export const BRAND_PROFILE_LISTS: readonly {
  table: string;
  insertTemplate: string;
}[] = [
  {
    table: "profiles.advertiser_secondary_sectors",
    insertTemplate:
      "insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code) " +
      "values ($1, 2, 'home_garden')",
  },
  {
    table: "profiles.advertiser_target_markets",
    insertTemplate:
      "insert into profiles.advertiser_target_markets (account_id, slot, country_code) " +
      "values ($1, 5, 'DE')",
  },
  {
    table: "profiles.advertiser_working_languages",
    insertTemplate:
      "insert into profiles.advertiser_working_languages (account_id, language_code) " +
      "values ($1, 'en')",
  },
  {
    table: "profiles.advertiser_topics",
    insertTemplate:
      "insert into profiles.advertiser_topics (account_id, slot, topic_code) " +
      "values ($1, 3, 'travel')",
  },
  {
    table: "profiles.advertiser_networks",
    insertTemplate:
      "insert into profiles.advertiser_networks (account_id, network_code) " +
      "values ($1, 'youtube')",
  },
  {
    table: "profiles.advertiser_formats",
    insertTemplate:
      "insert into profiles.advertiser_formats (account_id, format_code) " +
      "values ($1, 'youtube_short')",
  },
  {
    table: "profiles.advertiser_audience_countries",
    insertTemplate:
      "insert into profiles.advertiser_audience_countries (account_id, slot, country_code) " +
      "values ($1, 5, 'DE')",
  },
  {
    table: "profiles.advertiser_usage_rights",
    insertTemplate:
      "insert into profiles.advertiser_usage_rights (account_id, usage_right_code) " +
      "values ($1, 'paid_whitelisting')",
  },
];

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
  ...LOT2_REFERENCE_TABLES.map((table): TableRights => ({
    table,
    source: "0201 (rights of 0003, 04 §4.2)",
    probeColumn: "code",
    expected: forRoles(BUSINESS, { select: LOT2_REFERENCE_READ }),
  })),
  {
    table: "reference.price_bands",
    source: "0201 (rights of 0003; 04 §4.2 REVOKE)",
    probeColumn: "code",
    expected: forRoles(BUSINESS, {
      select: {
        form: "vide",
        source:
          "0201: read like every reference list, EMPTY at L2A by design (D78, L2A founder answer 2)",
      },
    }),
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
    source: "0106 (04 §5.2, minimal form); 0202 (L2B, the full profile)",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    // A column of blocks 1 to 3 the owner may update (0202); status and legal_name are not his.
    updateSet: "presentation = presentation",
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source: "04 §6 « S »: the advertiser reads their own profile",
          },
          update: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — modifier » S; 0202: the columns of blocks 1 to 3, " +
              "never status (0203) nor legal_name (0122)",
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
  ...BRAND_PROFILE_LISTS.map(({ table, insertTemplate }): TableRights => ({
    table,
    source: "0202 (06 RG15, RG27; L2B): a list of the brand profile",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    insertTemplate,
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — lire » S: the owner's own choices",
          },
          insert: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — modifier » S: a choice added to his own list",
          },
          delete: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — modifier » S: a list is replaced, never updated",
          },
        },
      },
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source: "03 §3.2 « Profil marque — lire » L·J: agent and admin, aal2",
        },
      }),
    ),
  })),
  {
    table: "profiles.advertiser_contact_details",
    source:
      "0202 (06 RG35, RG37; D40, D46): the contact person; NOTHING for influx_creator " +
      "(03 C(9): the first name at Lot 4 only, never the coordinates)",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    updateSet: "contact_phone = contact_phone",
    // The data set gives A a row: the probe of A goes through the update path of the upsert.
    insertTemplate:
      "insert into profiles.advertiser_contact_details (account_id, contact_first_name) " +
      "values ($1, 'T2 probe') on conflict (account_id) " +
      "do update set contact_first_name = excluded.contact_first_name",
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — lire les coordonnées directes » S",
          },
          insert: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — modifier » S: his contact person",
          },
          update: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — modifier » S: his contact person",
          },
        },
      },
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source:
            "03 §3.2 « Profil marque — lire les coordonnées directes » L·J; 06 RG37: aal2",
        },
      }),
    ),
  },
  {
    table: "profiles.brand_logo_objects",
    source:
      "0204 (04 §5.11 rule 3; jalons/l2b/stockage.md §3, §5; D80): one row per object of the " +
      "bucket brand-logo; written by the member doors of 0204 only (influx_identity_definer)",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source:
              "03 §3.2 « Profil marque — lire » S: the owner's logo rows; no write (the doors)",
          },
        },
      },
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source:
            "03 §3.2 « Profil marque — lire » L·J: agent and admin, aal2 (EC-L2B-08-4)",
        },
      }),
    ),
  },
  {
    table: "profiles.storage_quotas",
    source:
      "0204 (03 P10.7, 18 T9.8; stockage.md §6): no right for any execution role; read by the " +
      "member doors of 0204 (influx_identity_definer)",
    probeColumn: "bucket_id",
    expected: {},
  },
  {
    table: "profiles.storage_daily_usage",
    source:
      "0204 (03 P10.7, 18 T9.8; stockage.md §6): no right for any execution role; counted by " +
      "the member doors of 0204, deleted by the erasure (influx_privacy_definer)",
    probeColumn: "account_id",
    expected: {},
  },
  {
    table: "profiles.moderated_fields",
    source:
      "0207 (L2C, 04 §5.2, 06 RG9, jalons/l2c/file.md A4): the closed list of the re-validated " +
      "fields, written by the migrations only",
    probeColumn: "code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "15 RG26: the fields of a revision named on the decision screen, aal2",
      },
    }),
  },
  {
    table: "profiles.advertiser_rejection_reasons",
    source:
      "0207 (L2C, 04 §3.1, 06 RG66, file.md A6): the closed list of the refusal reasons of " +
      "queue 1, written by the migrations only",
    probeColumn: "code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "06 RG65, RG66: the reasons offered to the agent who decides, aal2",
      },
    }),
  },
  {
    table: "profiles.advertiser_review_entries",
    source:
      "0207 (L2C, file.md A1, D81): the entries of queue 1, opened by the member doors " +
      "(influx_identity_definer), decided by the functions of 07 only",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source:
              "file.md A1: the brand reads its own entries, never the lock, an agent, the " +
              "deadlines nor the internal comment (column grants)",
          },
        },
      },
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source:
            "15 RG26, RG36 C(3): agent and admin read the queue in aal2, never their own account",
        },
      }),
    ),
  },
  {
    table: "profiles.profile_field_revisions",
    source:
      "0207 (L2C, 04 §5.2, file.md A1): the submitted values of moderated fields, written by the " +
      "member door of 06 only, deleted by the erasure (influx_privacy_definer)",
    probeColumn: "account_id",
    ownerColumn: "account_id",
    expected: merge(
      {
        influx_advertiser: {
          select: {
            form: "propre",
            source: "06 RG9: the brand reads its own submitted values",
          },
        },
      },
      forRoles(INTERNAL, {
        select: {
          form: "autorisé",
          source:
            "15 RG26, RG36 C(3): agent and admin read the revisions in aal2, never their own account",
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
    table: "backoffice.operational_settings",
    source:
      "0206 (L2C, 04 §5.10, EC-L2C-2): the closed key/value list of the operating caps and " +
      "delays (claim_expiry_minutes), written by the migrations only until the admin function of Lot 5",
    probeColumn: "key",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "15 RG27 C3, RG38: the claim expiry read in aal2 by the roles that handle the queues",
      },
    }),
  },
  {
    table: "backoffice.claim_release_reasons",
    source:
      "0210 (L2C, 15 RG27 C4, file.md A8): the closed list of the reasons of a forced release, " +
      "written by the migrations only",
    probeColumn: "code",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "15 C4: the reason of a forced release named to the admin and to the dispossessed holder, aal2",
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
  {
    table: "identity.internal_invitations",
    source:
      "0131 (J8, 15 RG99, 03 MFA-1, B-8): written by identity.create_internal_invitation(), " +
      "approve_admin_invitation(), revoke_internal_invitation() and accept_internal_invitation() only",
    probeColumn: "id",
    expected: {
      influx_admin: {
        select: {
          form: "autorisé",
          source:
            "03 §3.1 « Compte agent/admin — créer par invitation » admin; 17b §3.13, aal2; never the " +
            "token digest",
        },
      },
    },
  },
  {
    table: "privacy.request_executions",
    source:
      "0137 (J8 commit 8, 03 P7 E-5, 15 RG75 step 6): written by " +
      "backoffice.approve_data_request_execution() (admin, 2V + R), " +
      "identity.submit_member_erasure() (0150, D72: the member, fresh code) and the E-5 functions only",
    probeColumn: "request_id",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "15 §D (account sheet), RG85: the executions read in aal2; never the held address nor " +
          "the messageId (column grants)",
      },
    }),
  },
  {
    table: "privacy.data_exports",
    source:
      "0137 (runbook §4, expert-cybersecurite 2026-10-14): written by privacy.execute_request() " +
      "(E-5), downloaded through privacy.download_own_export(), purged by ops.purge_data_exports(); " +
      "no right for any member role",
    probeColumn: "id",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source:
          "15 §D, RG85: publication, expiry, downloads read in aal2; never the content nor the digest",
      },
    }),
  },
  {
    table: "backoffice.member_invitations",
    source:
      "0131 (J8, 05 RG116 to RG119, D54): written by backoffice.create_member_invitation(), " +
      "revoke_member_invitation() and redeem_member_invitation() only",
    probeColumn: "id",
    ownerColumn: "created_by_account_id",
    expected: {
      // 0142 (J8S-5): the agent reads the invitations it created only (EC-J8-31 in the base)
      influx_agent: {
        select: {
          form: "propre",
          source:
            "05 RG116, RG123; 0142 J8S-5: the agent's own invitations, in aal2; never the code digest",
        },
      },
      influx_admin: {
        select: {
          form: "autorisé",
          source:
            "05 RG116, RG123; 0142 J8S-5: every invitation for the admin, in aal2; never the code digest",
        },
      },
    },
  },
  // 0147 (J9 commit 8, D60 active monitoring): written and read through the functions of ops only
  // (influx_worker E-4, influx_ops E-6), owner influx_maintenance_definer; the signals by influx_ops.
  {
    table: "ops.worker_heartbeats",
    source:
      "0147 (02 §11.3): no right for any execution role; written by ops.record_worker_heartbeat() " +
      "(E-4), read by ops.worker_liveness() (E-6), purged by ops.run_ops_retention()",
    probeColumn: "worker_id",
    expected: {},
  },
  {
    table: "ops.probe_results",
    source:
      "0147 (02 §20.5): no right for any execution role; written by ops.record_probe_results() (E-4)",
    probeColumn: "target",
    expected: {},
  },
  {
    table: "ops.database_samples",
    source:
      "0147 (02 §20.5, AL58): no right for any execution role; written by ops.record_database_sample() (E-4)",
    probeColumn: "minute",
    expected: {},
  },
  {
    table: "ops.signal_counts",
    source: "0147 (15 RG165, AL61, AL62; E-6)",
    probeColumn: "instance",
    insertTemplate:
      "insert into ops.signal_counts (minute, service, instance, signal, count) values " +
      "(date_trunc('minute', now(), 'UTC') - interval '1 minute', 'api', " +
      "left(replace($1::text, '-', ''), 32), 'webhook_brevo_authenticated', 1)",
    expected: {
      influx_ops: {
        insert: {
          form: "autorisé",
          source:
            "0147, E-6: one line per ended minute and signal, never read back",
        },
      },
    },
  },
  {
    table: "ops.alert_states",
    source:
      "0147 (15 RG165): no right for any execution role; read and written by ops.begin_alert_round() " +
      "and ops.save_alert_states() (worker E-4, api E-6), each for its own scope",
    probeColumn: "code",
    expected: {},
  },
  {
    table: "ops.request_metrics_hourly",
    source:
      "0147 (02 §20.5): no right for any execution role; written by ops.run_ops_retention() (E-4)",
    probeColumn: "hour",
    expected: {},
  },
  {
    table: "ops.process_metrics_hourly",
    source:
      "0147 (02 §20.5): no right for any execution role; written by ops.run_ops_retention() (E-4)",
    probeColumn: "hour",
    expected: {},
  },
  {
    table: "ops.probe_results_hourly",
    source:
      "0147 (02 §20.5): no right for any execution role; written by ops.run_ops_retention() (E-4)",
    probeColumn: "hour",
    expected: {},
  },
  {
    table: "identity.code_failure_tallies",
    source:
      "0147 (AL59, J3S-8): no right for any execution role; written by identity.record_code_failure() " +
      "(E-2, influx_auth), read by ops.technical_alert_snapshot() and purged after 48 hours (E-4)",
    probeColumn: "hour",
    expected: {},
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
  "privacy",
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
 * (J8 commit 2), then of 0131 and 0132 (J8 commit 3), then of 0133 and 0134 (J8 commits 5 and 6),
 * then of 0135 (J8 commit 7), then on 2026-10-16 of 0136 and 0137 (J8 commit 8, E-5), each line
 * checked against its migration; and on 2026-10-22 with those of 0147 (J9 commit 8, D60 active
 * monitoring), each line checked against its sections 19 and 20; and on 2026-11-01 with those of
 * 0201 (L2A commit 09, the Lot 2 reference lists), checked against 0003 lines 265-308; and on
 * 2026-11-02 with those of 0202 (L2B commit 05, the full brand profile), each line checked against
 * its sections 4 and 5; then with those of 0203 (L2B commit 06, the submission), each line checked
 * against its sections 3 and 4; then with those of 0204 (L2B commit 08, the brand logo), each line
 * checked against its sections 5 and 6; then with those of 0205 (L2B commit 09, the task
 * storage_purge), each line checked against its sections 2 and 3.
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
  "influx_identity_definer|column|identity.agent_profiles.account_id|INSERT,SELECT",
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
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.consumed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.expires_at|INSERT,SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.id|SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.token_hash|INSERT,SELECT",
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
  "influx_admin|function|identity.correct_email(uuid,uuid,text,text,text)|EXECUTE",
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
  "influx_identity_definer|column|leads.sync_settings.value|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.advertiser_profiles.account_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.legal_name|INSERT,SELECT,UPDATE",
  "influx_identity_definer|function|identity.correct_email(uuid,uuid,text,text,text)|EXECUTE",
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
  // 0146 (J9 D67-b): the start of the latest attempt, kept after its outcome (05 RG161)
  "influx_leads_definer|column|leads.outbox_events.attempt_started_at|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.attempts|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.available_at|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.completed_at|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.destination|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.dry_run|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.event_id|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.event_type|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.id|SELECT",
  "influx_leads_definer|column|leads.outbox_events.idempotency_key|INSERT,SELECT",
  // 0146: the catch-up of 05 RG161 reads the code of a failed line
  "influx_leads_definer|column|leads.outbox_events.last_error_code|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.last_error_message|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.locked_at|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.locked_by|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.payload|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.priority|INSERT,SELECT",
  "influx_leads_definer|column|leads.outbox_events.provider_contact_id|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.provider_message_id|UPDATE",
  "influx_leads_definer|column|leads.outbox_events.skip_reason|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.status|SELECT,UPDATE",
  "influx_leads_definer|column|leads.outbox_events.subject_key|INSERT,SELECT",
  "influx_leads_definer|column|leads.sync_settings.key|SELECT",
  // 0139 (D68), 0140 (D69): the Brevo list ids of the worker's environment, the value and its author only
  "influx_leads_definer|column|leads.sync_settings.value|SELECT,UPDATE",
  "influx_leads_definer|column|leads.sync_settings.updated_by_account_id|UPDATE",
  // 0146: the date of modification of a key (0145), compared by the catch-up of 05 RG161
  "influx_leads_definer|column|leads.sync_settings.updated_at|SELECT",
  "influx_leads_definer|function|leads.apply_brevo_ids_from_environment(jsonb)|EXECUTE",
  "influx_worker|function|leads.apply_brevo_ids_from_environment(jsonb)|EXECUTE",
  // 0145 (J9 D67-a): the journal trigger of leads.sync_settings, owner's EXECUTE only, no grant
  "influx_leads_definer|function|leads.journal_sync_setting_change()|EXECUTE",
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
  "influx_maintenance_definer|column|ops.periodic_runs.counts|SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.periodic_runs.finished_at|SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.periodic_runs.id|SELECT",
  "influx_maintenance_definer|column|ops.periodic_runs.outcome|SELECT,UPDATE",
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
  "influx_identity_definer|column|backoffice.data_subject_requests.status|SELECT,UPDATE",
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
  // 0135 (J8 commit 7): whether the account came through a member invitation (SIGNUP_SOURCE,
  // 05 RG122); never the invitation itself.
  "influx_leads_definer|column|identity.accounts.signup_invitation_id|SELECT",
  // 0129 (J8 commit 2): the catalogue of the queues and their delays, read by agent and admin in
  // aal2; nobody writes them but the migrations.
  "influx_agent|table|backoffice.queues|SELECT",
  "influx_admin|table|backoffice.queues|SELECT",
  "influx_agent|table|backoffice.sla_policies|SELECT",
  "influx_admin|table|backoffice.sla_policies|SELECT",
  // 0206 (L2C commit 04): the operating settings, read by agent and admin in aal2, written by the
  // migrations only; backoffice.business_deadline() is executed by nobody yet (0207 grants it).
  "influx_agent|table|backoffice.operational_settings|SELECT",
  "influx_admin|table|backoffice.operational_settings|SELECT",
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
  // 0131 and 0132 (J8 commit 3): the two invitations (EC-J8-2), their functions (internal:
  // influx_admin and influx_auth; member: agent and admin, redemption by influx_auth), the
  // corrections RG108, the member role change (2V + R), correct_email() with R, the replay
  // (influx_leads_definer, agent and admin) and the history read EC-31 (influx_identity_definer
  // reads the register column by column). Each line checked against its migration.
  "influx_admin|column|backoffice.member_invitations.account_id|SELECT",
  "influx_admin|column|backoffice.member_invitations.created_at|SELECT",
  "influx_admin|column|backoffice.member_invitations.created_by_account_id|SELECT",
  "influx_admin|column|backoffice.member_invitations.email|SELECT",
  "influx_admin|column|backoffice.member_invitations.expires_at|SELECT",
  "influx_admin|column|backoffice.member_invitations.id|SELECT",
  "influx_admin|column|backoffice.member_invitations.preferred_language|SELECT",
  "influx_admin|column|backoffice.member_invitations.proposed_role|SELECT",
  "influx_admin|column|backoffice.member_invitations.redeemed_at|SELECT",
  "influx_admin|column|backoffice.member_invitations.revoke_reason_code|SELECT",
  "influx_admin|column|backoffice.member_invitations.revoked_at|SELECT",
  "influx_admin|column|backoffice.member_invitations.revoked_by_account_id|SELECT",
  "influx_admin|column|backoffice.member_invitations.updated_at|SELECT",
  "influx_admin|column|identity.internal_invitations.accepted_at|SELECT",
  "influx_admin|column|identity.internal_invitations.account_id|SELECT",
  "influx_admin|column|identity.internal_invitations.confirmed_at|SELECT",
  "influx_admin|column|identity.internal_invitations.created_at|SELECT",
  "influx_admin|column|identity.internal_invitations.created_by_account_id|SELECT",
  "influx_admin|column|identity.internal_invitations.dual_control_request_id|SELECT",
  "influx_admin|column|identity.internal_invitations.email|SELECT",
  "influx_admin|column|identity.internal_invitations.expires_at|SELECT",
  "influx_admin|column|identity.internal_invitations.id|SELECT",
  "influx_admin|column|identity.internal_invitations.proposed_role|SELECT",
  "influx_admin|column|identity.internal_invitations.reason_code|SELECT",
  "influx_admin|column|identity.internal_invitations.requires_dual_control|SELECT",
  "influx_admin|column|identity.internal_invitations.revoke_reason_code|SELECT",
  "influx_admin|column|identity.internal_invitations.revoked_at|SELECT",
  "influx_admin|column|identity.internal_invitations.revoked_by_account_id|SELECT",
  "influx_admin|column|identity.internal_invitations.updated_at|SELECT",
  "influx_admin|function|backoffice.create_member_invitation(text,identity.account_role,text,bytea)|EXECUTE",
  "influx_admin|function|backoffice.read_subject_history(text,uuid,integer,bigint)|EXECUTE",
  "influx_admin|function|backoffice.reserve_account_search(integer)|EXECUTE",
  "influx_admin|function|backoffice.revoke_member_invitation(uuid,text)|EXECUTE",
  "influx_admin|function|identity.approve_admin_invitation(uuid,uuid,uuid,text)|EXECUTE",
  "influx_admin|function|identity.change_member_role(uuid,uuid,uuid,identity.account_role,text,text)|EXECUTE",
  "influx_admin|function|identity.correct_member_account(uuid,text,identity.declared_status,text,text,text)|EXECUTE",
  "influx_admin|function|identity.create_internal_invitation(uuid,text,identity.account_role,bytea,text)|EXECUTE",
  "influx_admin|function|identity.revoke_internal_invitation(uuid,text)|EXECUTE",
  "influx_admin|function|leads.replay_outbox_lines(bigint[],text)|EXECUTE",
  "influx_agent|column|backoffice.member_invitations.account_id|SELECT",
  "influx_agent|column|backoffice.member_invitations.created_at|SELECT",
  "influx_agent|column|backoffice.member_invitations.created_by_account_id|SELECT",
  "influx_agent|column|backoffice.member_invitations.email|SELECT",
  "influx_agent|column|backoffice.member_invitations.expires_at|SELECT",
  "influx_agent|column|backoffice.member_invitations.id|SELECT",
  "influx_agent|column|backoffice.member_invitations.preferred_language|SELECT",
  "influx_agent|column|backoffice.member_invitations.proposed_role|SELECT",
  "influx_agent|column|backoffice.member_invitations.redeemed_at|SELECT",
  "influx_agent|column|backoffice.member_invitations.revoke_reason_code|SELECT",
  "influx_agent|column|backoffice.member_invitations.revoked_at|SELECT",
  "influx_agent|column|backoffice.member_invitations.revoked_by_account_id|SELECT",
  "influx_agent|column|backoffice.member_invitations.updated_at|SELECT",
  "influx_agent|function|backoffice.create_member_invitation(text,identity.account_role,text,bytea)|EXECUTE",
  "influx_agent|function|backoffice.read_subject_history(text,uuid,integer,bigint)|EXECUTE",
  "influx_agent|function|backoffice.reserve_account_search(integer)|EXECUTE",
  "influx_agent|function|backoffice.revoke_member_invitation(uuid,text)|EXECUTE",
  "influx_agent|function|identity.correct_member_account(uuid,text,identity.declared_status,text,text,text)|EXECUTE",
  "influx_agent|function|leads.replay_outbox_lines(bigint[],text)|EXECUTE",
  "influx_auth|function|backoffice.redeem_member_invitation(uuid,bytea)|EXECUTE",
  "influx_auth|function|identity.accept_internal_invitation(bytea,uuid,text,text,text,text)|EXECUTE",
  "influx_auth|function|identity.internal_invitation_is_valid(bytea,text)|EXECUTE",
  "influx_identity_definer|column|audit.audit_events.actor_account_id|SELECT",
  "influx_identity_definer|column|audit.audit_events.actor_type|SELECT",
  "influx_identity_definer|column|audit.audit_events.event_type|SELECT",
  "influx_identity_definer|column|audit.audit_events.occurred_at|SELECT",
  "influx_identity_definer|column|audit.audit_events.payload|SELECT",
  "influx_identity_definer|column|audit.audit_events.seq|SELECT",
  "influx_identity_definer|column|audit.audit_events.subject_id|SELECT",
  "influx_identity_definer|column|audit.audit_events.subject_type|SELECT",
  "influx_identity_definer|column|backoffice.member_invitations.account_id|UPDATE",
  "influx_identity_definer|column|backoffice.member_invitations.code_hash|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.member_invitations.created_by_account_id|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.member_invitations.email|INSERT,SELECT",
  "influx_identity_definer|column|backoffice.member_invitations.expires_at|SELECT",
  "influx_identity_definer|column|backoffice.member_invitations.id|SELECT",
  "influx_identity_definer|column|backoffice.member_invitations.preferred_language|INSERT",
  "influx_identity_definer|column|backoffice.member_invitations.proposed_role|INSERT",
  "influx_identity_definer|column|backoffice.member_invitations.redeemed_at|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.member_invitations.revoke_reason_code|UPDATE",
  "influx_identity_definer|column|backoffice.member_invitations.revoked_at|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.member_invitations.revoked_by_account_id|UPDATE",
  "influx_identity_definer|column|backoffice.ownership_assignments.account_id|INSERT",
  "influx_identity_definer|column|backoffice.ownership_assignments.agent_account_id|INSERT",
  "influx_identity_definer|column|backoffice.ownership_assignments.reason_code|INSERT",
  "influx_identity_definer|column|identity.accounts.created_at|SELECT",
  "influx_identity_definer|column|identity.accounts.display_name|INSERT",
  "influx_identity_definer|column|identity.accounts.owner_agent_id|SELECT,UPDATE",
  "influx_identity_definer|column|identity.accounts.signup_invitation_id|SELECT,UPDATE",
  "influx_identity_definer|column|identity.agent_profiles.first_name|INSERT,SELECT",
  "influx_identity_definer|column|identity.agent_profiles.invited_at|INSERT",
  "influx_identity_definer|column|identity.agent_profiles.invited_by_account_id|INSERT",
  "influx_identity_definer|column|identity.internal_invitations.accepted_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.account_id|UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.confirmed_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.created_by_account_id|INSERT,SELECT",
  "influx_identity_definer|column|identity.internal_invitations.dual_control_request_id|SELECT,UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.email|INSERT,SELECT",
  "influx_identity_definer|column|identity.internal_invitations.expires_at|SELECT",
  "influx_identity_definer|column|identity.internal_invitations.id|SELECT",
  "influx_identity_definer|column|identity.internal_invitations.proposed_role|INSERT,SELECT",
  "influx_identity_definer|column|identity.internal_invitations.reason_code|INSERT",
  "influx_identity_definer|column|identity.internal_invitations.requires_dual_control|SELECT",
  "influx_identity_definer|column|identity.internal_invitations.revoke_reason_code|UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.revoked_at|SELECT,UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.revoked_by_account_id|UPDATE",
  "influx_identity_definer|column|identity.internal_invitations.token_hash|INSERT,SELECT",
  "influx_identity_definer|column|identity.mfa_enrollment_tokens.created_by_account_id|INSERT",
  "influx_identity_definer|function|backoffice.canonical_dual_control_payload(text,jsonb,uuid)|EXECUTE",
  "influx_identity_definer|function|backoffice.create_member_invitation(text,identity.account_role,text,bytea)|EXECUTE",
  "influx_identity_definer|function|backoffice.read_subject_history(text,uuid,integer,bigint)|EXECUTE",
  "influx_identity_definer|function|backoffice.reserve_account_search(integer)|EXECUTE",
  "influx_identity_definer|function|backoffice.redeem_member_invitation(uuid,bytea)|EXECUTE",
  "influx_identity_definer|function|backoffice.revoke_member_invitation(uuid,text)|EXECUTE",
  "influx_identity_definer|function|identity.accept_internal_invitation(bytea,uuid,text,text,text,text)|EXECUTE",
  "influx_identity_definer|function|identity.approve_admin_invitation(uuid,uuid,uuid,text)|EXECUTE",
  "influx_identity_definer|function|identity.change_member_role(uuid,uuid,uuid,identity.account_role,text,text)|EXECUTE",
  "influx_identity_definer|function|identity.correct_member_account(uuid,text,identity.declared_status,text,text,text)|EXECUTE",
  "influx_identity_definer|function|identity.create_internal_invitation(uuid,text,identity.account_role,bytea,text)|EXECUTE",
  "influx_identity_definer|function|identity.internal_invitation_is_valid(bytea,text)|EXECUTE",
  "influx_identity_definer|function|identity.revoke_internal_invitation(uuid,text)|EXECUTE",
  "influx_identity_definer|table|identity.account_roles|DELETE",
  "influx_leads_definer|column|identity.agent_profiles.account_id|SELECT",
  "influx_leads_definer|column|identity.agent_profiles.is_active|SELECT",
  "influx_leads_definer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_leads_definer|function|influx.current_aal()|EXECUTE",
  "influx_leads_definer|function|influx.current_account_id()|EXECUTE",
  "influx_leads_definer|function|influx.current_account_role()|EXECUTE",
  "influx_leads_definer|function|influx.has_aal2()|EXECUTE",
  "influx_leads_definer|function|leads.replay_outbox_lines(bigint[],text)|EXECUTE",
  "influx_leads_definer|schema|audit|USAGE",
  "influx_leads_definer|schema|influx|USAGE",
  // 0134 (J8 commit 6): the Apollo keys under 2V + R (RG81), the suppression lift (RG93), the
  // trace of a refused attempt (CA63), the last reconciliation (AL27); each line checked against
  // its migration.
  "influx_admin|function|backoffice.change_apollo_setting(uuid,uuid,text,jsonb,text)|EXECUTE",
  "influx_admin|function|backoffice.last_brevo_reconciliation()|EXECUTE",
  "influx_admin|function|backoffice.lift_brevo_suppression(uuid,uuid,text,text)|EXECUTE",
  "influx_admin|function|backoffice.read_apollo_settings()|EXECUTE",
  "influx_agent|function|backoffice.record_refused_action(text)|EXECUTE",
  "influx_identity_definer|column|leads.contact_sync_states.account_id|SELECT",
  "influx_identity_definer|column|leads.contact_sync_states.destination|SELECT",
  "influx_identity_definer|column|leads.contact_sync_states.last_error_code|SELECT",
  "influx_identity_definer|column|leads.contact_sync_states.last_status|SELECT",
  "influx_identity_definer|column|leads.contact_sync_states.suppressed_reason|SELECT,UPDATE",
  "influx_identity_definer|column|leads.contact_sync_states.unsubscribed_at|SELECT",
  "influx_identity_definer|column|leads.sync_settings.updated_at|SELECT",
  "influx_identity_definer|column|leads.sync_settings.updated_by_account_id|SELECT,UPDATE",
  "influx_identity_definer|column|reference.countries.code|SELECT",
  "influx_identity_definer|function|backoffice.change_apollo_setting(uuid,uuid,text,jsonb,text)|EXECUTE",
  "influx_identity_definer|function|backoffice.lift_brevo_suppression(uuid,uuid,text,text)|EXECUTE",
  "influx_identity_definer|function|backoffice.read_apollo_settings()|EXECUTE",
  "influx_identity_definer|function|backoffice.record_refused_action(text)|EXECUTE",
  "influx_identity_definer|schema|reference|USAGE",
  "influx_maintenance_definer|function|backoffice.last_brevo_reconciliation()|EXECUTE",
  // 0148 (J9 commit 9): the "Santé technique" screen, read only, influx_admin only; the owner
  // reads the columns added above for these functions.
  "influx_admin|function|backoffice.ops_error_group(uuid)|EXECUTE",
  "influx_admin|function|backoffice.ops_error_groups(text,text,integer)|EXECUTE",
  "influx_admin|function|backoffice.ops_health_status()|EXECUTE",
  "influx_admin|function|backoffice.ops_processes()|EXECUTE",
  "influx_admin|function|backoffice.ops_traffic(text)|EXECUTE",
  "influx_maintenance_definer|function|backoffice.ops_error_group(uuid)|EXECUTE",
  "influx_maintenance_definer|function|backoffice.ops_error_groups(text,text,integer)|EXECUTE",
  "influx_maintenance_definer|function|backoffice.ops_health_status()|EXECUTE",
  "influx_maintenance_definer|function|backoffice.ops_processes()|EXECUTE",
  "influx_maintenance_definer|function|backoffice.ops_traffic(text)|EXECUTE",
  // 0136 and 0137 (J8 commit 8, E-5 minimal, 03 P7): influx_privacy executes its four functions and
  // writes its register line through audit.append_elevated() only, no table right; its owner
  // influx_privacy_definer reads what the export restitutes and writes the anonymisation of 04 §9.2,
  // column by column (EC-J8-36); influx_identity_definer approves (2V + R; the request in_progress)
  // and serves the member's own export (content of the session's account only, a download counted);
  // the leads owner reads the expiry of an announced export, the maintenance owner purges the
  // content; agent and admin read the two tables in aal2 (never the held address, the messageId, the
  // content nor the digest); the members execute their two functions. Each line checked against
  // its migration.
  "influx_admin|column|privacy.data_exports.account_id|SELECT",
  "influx_admin|column|privacy.data_exports.downloads_count|SELECT",
  "influx_admin|column|privacy.data_exports.expires_at|SELECT",
  "influx_admin|column|privacy.data_exports.id|SELECT",
  "influx_admin|column|privacy.data_exports.published_at|SELECT",
  "influx_admin|column|privacy.data_exports.purged_at|SELECT",
  "influx_admin|column|privacy.data_exports.request_id|SELECT",
  "influx_admin|column|privacy.request_executions.account_id|SELECT",
  "influx_admin|column|privacy.request_executions.approved_at|SELECT",
  "influx_admin|column|privacy.request_executions.approved_by_account_id|SELECT",
  "influx_admin|column|privacy.request_executions.auth_user_deleted_at|SELECT",
  "influx_admin|column|privacy.request_executions.completed_at|SELECT",
  "influx_admin|column|privacy.request_executions.executed_at|SELECT",
  "influx_admin|column|privacy.request_executions.request_id|SELECT",
  "influx_admin|column|privacy.request_executions.request_type|SELECT",
  "influx_admin|function|backoffice.approve_data_request_execution(uuid,uuid,uuid,backoffice.data_request_type,text)|EXECUTE",
  "influx_admin|schema|privacy|USAGE",
  "influx_advertiser|function|privacy.download_own_export(uuid,uuid)|EXECUTE",
  "influx_advertiser|function|privacy.read_own_export()|EXECUTE",
  "influx_advertiser|schema|privacy|USAGE",
  "influx_agent|column|privacy.data_exports.account_id|SELECT",
  "influx_agent|column|privacy.data_exports.downloads_count|SELECT",
  "influx_agent|column|privacy.data_exports.expires_at|SELECT",
  "influx_agent|column|privacy.data_exports.id|SELECT",
  "influx_agent|column|privacy.data_exports.published_at|SELECT",
  "influx_agent|column|privacy.data_exports.purged_at|SELECT",
  "influx_agent|column|privacy.data_exports.request_id|SELECT",
  "influx_agent|column|privacy.request_executions.account_id|SELECT",
  "influx_agent|column|privacy.request_executions.approved_at|SELECT",
  "influx_agent|column|privacy.request_executions.approved_by_account_id|SELECT",
  "influx_agent|column|privacy.request_executions.auth_user_deleted_at|SELECT",
  "influx_agent|column|privacy.request_executions.completed_at|SELECT",
  "influx_agent|column|privacy.request_executions.executed_at|SELECT",
  "influx_agent|column|privacy.request_executions.request_id|SELECT",
  "influx_agent|column|privacy.request_executions.request_type|SELECT",
  "influx_agent|schema|privacy|USAGE",
  "influx_creator|function|privacy.download_own_export(uuid,uuid)|EXECUTE",
  "influx_creator|function|privacy.read_own_export()|EXECUTE",
  "influx_creator|schema|privacy|USAGE",
  "influx_identity_definer|column|backoffice.data_subject_requests.channel|SELECT",
  "influx_identity_definer|column|privacy.data_exports.account_id|SELECT",
  "influx_identity_definer|column|privacy.data_exports.content|SELECT",
  "influx_identity_definer|column|privacy.data_exports.downloads_count|SELECT,UPDATE",
  "influx_identity_definer|column|privacy.data_exports.expires_at|SELECT",
  "influx_identity_definer|column|privacy.data_exports.id|SELECT",
  "influx_identity_definer|column|privacy.data_exports.published_at|SELECT",
  "influx_identity_definer|column|privacy.data_exports.purged_at|SELECT",
  "influx_identity_definer|column|privacy.data_exports.request_id|SELECT",
  "influx_identity_definer|column|privacy.data_exports.sha256|SELECT",
  "influx_identity_definer|column|privacy.data_exports.size_bytes|SELECT",
  "influx_identity_definer|column|privacy.request_executions.account_id|INSERT",
  "influx_identity_definer|column|privacy.request_executions.approved_by_account_id|INSERT",
  "influx_identity_definer|column|privacy.request_executions.dual_control_request_id|INSERT",
  "influx_identity_definer|column|privacy.request_executions.request_id|INSERT,SELECT",
  "influx_identity_definer|column|privacy.request_executions.request_type|INSERT",
  "influx_identity_definer|function|backoffice.approve_data_request_execution(uuid,uuid,uuid,backoffice.data_request_type,text)|EXECUTE",
  "influx_identity_definer|function|privacy.download_own_export(uuid,uuid)|EXECUTE",
  "influx_identity_definer|function|privacy.read_own_export()|EXECUTE",
  "influx_identity_definer|schema|privacy|USAGE",
  "influx_leads_definer|column|privacy.data_exports.account_id|SELECT",
  "influx_leads_definer|column|privacy.data_exports.expires_at|SELECT",
  "influx_leads_definer|column|privacy.data_exports.id|SELECT",
  "influx_leads_definer|schema|privacy|USAGE",
  "influx_maintenance_definer|column|privacy.data_exports.content|UPDATE",
  "influx_maintenance_definer|column|privacy.data_exports.downloads_count|SELECT",
  "influx_maintenance_definer|column|privacy.data_exports.expires_at|SELECT",
  "influx_maintenance_definer|column|privacy.data_exports.id|SELECT",
  "influx_maintenance_definer|column|privacy.data_exports.purged_at|SELECT",
  "influx_maintenance_definer|function|ops.purge_data_exports(uuid,smallint,integer)|EXECUTE",
  "influx_maintenance_definer|schema|privacy|USAGE",
  "influx_privacy_definer|column|audit.audit_events.actor_account_id|SELECT",
  "influx_privacy_definer|column|audit.audit_events.actor_type|SELECT",
  "influx_privacy_definer|column|audit.audit_events.event_type|SELECT",
  "influx_privacy_definer|column|audit.audit_events.occurred_at|SELECT",
  "influx_privacy_definer|column|audit.audit_events.seq|SELECT",
  "influx_privacy_definer|column|audit.audit_events.subject_id|SELECT",
  "influx_privacy_definer|column|audit.audit_events.subject_type|SELECT",
  "influx_privacy_definer|column|backoffice.code_delivery_reports.contact_email|SELECT,UPDATE",
  "influx_privacy_definer|column|backoffice.code_delivery_reports.id|SELECT",
  "influx_privacy_definer|column|backoffice.code_delivery_reports.login_email|SELECT,UPDATE",
  "influx_privacy_definer|column|backoffice.code_delivery_reports.message|SELECT,UPDATE",
  "influx_privacy_definer|column|backoffice.code_delivery_reports.received_at|SELECT",
  "influx_privacy_definer|column|backoffice.code_delivery_reports.status|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.channel|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.completed_at|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.due_at|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.id|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.outcome_code|SELECT,UPDATE",
  "influx_privacy_definer|column|backoffice.data_subject_requests.received_at|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.request_type|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.requester_account_id|SELECT",
  "influx_privacy_definer|column|backoffice.data_subject_requests.status|SELECT,UPDATE",
  "influx_privacy_definer|column|backoffice.member_invitations.account_id|SELECT",
  "influx_privacy_definer|column|backoffice.member_invitations.email|SELECT,UPDATE",
  "influx_privacy_definer|column|backoffice.member_invitations.id|SELECT",
  "influx_privacy_definer|column|identity.account_roles.account_id|SELECT",
  "influx_privacy_definer|column|identity.account_roles.granted_at|SELECT",
  "influx_privacy_definer|column|identity.account_roles.role|SELECT",
  "influx_privacy_definer|column|identity.accounts.adult_attested_at|SELECT",
  "influx_privacy_definer|column|identity.accounts.anonymized_at|UPDATE",
  "influx_privacy_definer|column|identity.accounts.auth_user_id|SELECT",
  "influx_privacy_definer|column|identity.accounts.country_code|SELECT",
  "influx_privacy_definer|column|identity.accounts.created_at|SELECT",
  "influx_privacy_definer|column|identity.accounts.declared_status|SELECT",
  "influx_privacy_definer|column|identity.accounts.deleted_at|UPDATE",
  "influx_privacy_definer|column|identity.accounts.display_name|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.accounts.email_status|SELECT",
  "influx_privacy_definer|column|identity.accounts.email_undeliverable_at|SELECT",
  "influx_privacy_definer|column|identity.accounts.email_verified_at|SELECT",
  "influx_privacy_definer|column|identity.accounts.email|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.accounts.id|SELECT",
  "influx_privacy_definer|column|identity.accounts.is_adult_attested|SELECT",
  "influx_privacy_definer|column|identity.accounts.last_seen_at|SELECT",
  "influx_privacy_definer|column|identity.accounts.owner_agent_id|SELECT",
  "influx_privacy_definer|column|identity.accounts.preferred_language|SELECT",
  "influx_privacy_definer|column|identity.accounts.signup_heard_from|SELECT",
  "influx_privacy_definer|column|identity.accounts.signup_invitation_id|SELECT",
  "influx_privacy_definer|column|identity.accounts.signup_referrer_domain|SELECT",
  "influx_privacy_definer|column|identity.accounts.signup_utm_campaign|SELECT",
  "influx_privacy_definer|column|identity.accounts.signup_utm_medium|SELECT",
  "influx_privacy_definer|column|identity.accounts.signup_utm_source|SELECT",
  "influx_privacy_definer|column|identity.accounts.status|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.accounts.timezone|SELECT",
  "influx_privacy_definer|column|identity.agent_profiles.account_id|SELECT",
  "influx_privacy_definer|column|identity.agent_profiles.first_name|SELECT",
  "influx_privacy_definer|column|identity.consent_events.account_id|SELECT",
  "influx_privacy_definer|column|identity.consent_events.evidence|SELECT",
  "influx_privacy_definer|column|identity.consent_events.granted|SELECT",
  "influx_privacy_definer|column|identity.consent_events.id|SELECT",
  "influx_privacy_definer|column|identity.consent_events.occurred_at|SELECT",
  "influx_privacy_definer|column|identity.consent_events.purpose|SELECT",
  "influx_privacy_definer|column|identity.consent_events.source|SELECT",
  "influx_privacy_definer|column|identity.email_change_requests.account_id|SELECT",
  "influx_privacy_definer|column|identity.email_change_requests.cancel_reason|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.email_change_requests.cancelled_at|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.email_change_requests.completed_at|SELECT",
  "influx_privacy_definer|column|identity.email_change_requests.created_at|SELECT",
  "influx_privacy_definer|column|identity.email_change_requests.id|SELECT",
  "influx_privacy_definer|column|identity.email_change_requests.new_code_hash|UPDATE",
  "influx_privacy_definer|column|identity.email_change_requests.new_email|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.email_change_requests.old_code_hash|UPDATE",
  "influx_privacy_definer|column|identity.email_change_requests.old_email|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.email_delivery_incidents.account_id|SELECT",
  "influx_privacy_definer|column|identity.email_delivery_incidents.channel|SELECT",
  "influx_privacy_definer|column|identity.email_delivery_incidents.email_address|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.email_delivery_incidents.id|SELECT",
  "influx_privacy_definer|column|identity.email_delivery_incidents.incident_type|SELECT",
  "influx_privacy_definer|column|identity.email_delivery_incidents.occurred_at|SELECT",
  "influx_privacy_definer|column|identity.email_delivery_incidents.payload|SELECT,UPDATE",
  "influx_privacy_definer|column|identity.sessions.account_id|SELECT",
  "influx_privacy_definer|column|identity.sessions.country_code|SELECT",
  "influx_privacy_definer|column|identity.sessions.created_at|SELECT",
  "influx_privacy_definer|column|identity.sessions.id|SELECT",
  "influx_privacy_definer|column|identity.sessions.last_activity_at|SELECT",
  "influx_privacy_definer|column|identity.sessions.revocation_reason|SELECT",
  "influx_privacy_definer|column|identity.sessions.revoked_at|SELECT",
  "influx_privacy_definer|column|identity.sessions.surface|SELECT",
  "influx_privacy_definer|column|identity.sessions.user_agent_summary|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.accepted_at|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.account_id|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.channel|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.id|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.ip_address|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.locale|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.nature|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.terms_version_id|SELECT",
  "influx_privacy_definer|column|identity.terms_acceptances.user_agent|SELECT",
  "influx_privacy_definer|column|identity.terms_versions.document_kind|SELECT",
  "influx_privacy_definer|column|identity.terms_versions.id|SELECT",
  "influx_privacy_definer|column|identity.terms_versions.locale|SELECT",
  "influx_privacy_definer|column|identity.terms_versions.version_label|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_events.account_ref|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_events.email|SELECT,UPDATE",
  "influx_privacy_definer|column|leads.brevo_inbound_events.event|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_events.id|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_events.occurred_at|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_outcomes.account_id|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_outcomes.event_id|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_outcomes.outcome|SELECT",
  "influx_privacy_definer|column|leads.brevo_inbound_outcomes.processed_at|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.account_id|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.destination|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.external_contact_id|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.last_attempt_at|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.last_status|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.last_success_at|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.suppressed_reason|SELECT",
  "influx_privacy_definer|column|leads.contact_sync_states.unsubscribed_at|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.created_at|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.destination|INSERT,SELECT",
  "influx_privacy_definer|column|leads.outbox_events.dry_run|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.event_id|INSERT",
  "influx_privacy_definer|column|leads.outbox_events.event_type|INSERT,SELECT",
  "influx_privacy_definer|column|leads.outbox_events.idempotency_key|INSERT",
  "influx_privacy_definer|column|leads.outbox_events.id|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.locked_by|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.payload|INSERT,SELECT",
  "influx_privacy_definer|column|leads.outbox_events.priority|INSERT",
  "influx_privacy_definer|column|leads.outbox_events.provider_message_id|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.skip_reason|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.status|SELECT",
  "influx_privacy_definer|column|leads.outbox_events.subject_key|INSERT,SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.account_id|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.created_at|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.delivered_at|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.email_code|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.failed_at|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.id|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.locale|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.priority|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.recipient_email|SELECT,UPDATE",
  "influx_privacy_definer|column|leads.transactional_sends.sent_at|SELECT",
  "influx_privacy_definer|column|leads.transactional_sends.status|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.account_id|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.id|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.message|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.occurred_at|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.route|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.service|SELECT",
  "influx_privacy_definer|column|ops.error_occurrences.user_agent_summary|SELECT",
  "influx_privacy_definer|column|privacy.data_exports.account_id|INSERT,SELECT",
  "influx_privacy_definer|column|privacy.data_exports.categories|INSERT",
  "influx_privacy_definer|column|privacy.data_exports.content|INSERT,UPDATE",
  "influx_privacy_definer|column|privacy.data_exports.expires_at|SELECT",
  "influx_privacy_definer|column|privacy.data_exports.id|SELECT",
  "influx_privacy_definer|column|privacy.data_exports.purged_at|SELECT",
  "influx_privacy_definer|column|privacy.data_exports.request_id|INSERT,SELECT",
  "influx_privacy_definer|column|privacy.data_exports.sha256|INSERT",
  "influx_privacy_definer|column|privacy.data_exports.size_bytes|INSERT",
  "influx_privacy_definer|column|privacy.request_executions.account_id|SELECT",
  "influx_privacy_definer|column|privacy.request_executions.approved_at|SELECT",
  "influx_privacy_definer|column|privacy.request_executions.approved_by_account_id|SELECT",
  "influx_privacy_definer|column|privacy.request_executions.auth_user_deleted_at|SELECT,UPDATE",
  "influx_privacy_definer|column|privacy.request_executions.completed_at|SELECT,UPDATE",
  "influx_privacy_definer|column|privacy.request_executions.dual_control_request_id|SELECT",
  "influx_privacy_definer|column|privacy.request_executions.executed_at|SELECT,UPDATE",
  "influx_privacy_definer|column|privacy.request_executions.notification_message_id|SELECT,UPDATE",
  "influx_privacy_definer|column|privacy.request_executions.propagation_email|SELECT,UPDATE",
  "influx_privacy_definer|column|privacy.request_executions.request_id|SELECT",
  "influx_privacy_definer|column|privacy.request_executions.request_type|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_profiles.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_profiles.created_at|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_profiles.legal_name|SELECT,UPDATE",
  "influx_privacy_definer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_privacy_definer|function|leads.read_brevo_erasure_subject(bigint,text)|EXECUTE",
  "influx_privacy_definer|function|privacy.account_addresses(uuid)|EXECUTE",
  "influx_privacy_definer|function|privacy.complete_request(uuid)|EXECUTE",
  "influx_privacy_definer|function|privacy.execute_request(uuid,jsonb)|EXECUTE",
  "influx_privacy_definer|function|privacy.export_categories()|EXECUTE",
  "influx_privacy_definer|function|privacy.export_document(uuid,text[],jsonb)|EXECUTE",
  "influx_privacy_definer|function|privacy.iso_utc(timestamp with time zone)|EXECUTE",
  "influx_privacy_definer|function|privacy.pending_work(integer)|EXECUTE",
  "influx_privacy_definer|function|privacy.record_auth_user_deleted(uuid)|EXECUTE",
  "influx_privacy_definer|schema|audit|USAGE",
  "influx_privacy_definer|schema|backoffice|USAGE",
  "influx_privacy_definer|schema|identity|USAGE",
  "influx_privacy_definer|schema|leads|USAGE",
  "influx_privacy_definer|schema|ops|USAGE",
  "influx_privacy_definer|schema|privacy|USAGE",
  "influx_privacy_definer|schema|profiles|USAGE",
  "influx_privacy_definer|table|identity.sessions|DELETE",
  "influx_privacy|function|audit.append_elevated(text,uuid)|EXECUTE",
  "influx_privacy|function|privacy.complete_request(uuid)|EXECUTE",
  "influx_privacy|function|privacy.execute_request(uuid,jsonb)|EXECUTE",
  "influx_privacy|function|privacy.pending_work(integer)|EXECUTE",
  "influx_privacy|function|privacy.record_auth_user_deleted(uuid)|EXECUTE",
  "influx_privacy|schema|audit|USAGE",
  "influx_privacy|schema|privacy|USAGE",
  "influx_worker|function|leads.read_brevo_erasure_subject(bigint,text)|EXECUTE",
  "influx_worker|function|ops.purge_data_exports(uuid,smallint,integer)|EXECUTE",
  // 0138 (J8 commit 9: the reads of the backoffice screens): the factor of the caller's own
  // session (J3S-6), the "new browser" signal of a backoffice sign-in (B-7, influx_auth only) and
  // its list for the admins; the first name of the agent profiles for that list.
  "influx_agent|function|identity.backoffice_session_state(uuid)|EXECUTE",
  "influx_admin|function|identity.backoffice_session_state(uuid)|EXECUTE",
  "influx_identity_definer|function|identity.backoffice_session_state(uuid)|EXECUTE",
  "influx_auth|function|identity.signal_new_backoffice_browser(uuid)|EXECUTE",
  "influx_identity_definer|function|identity.signal_new_backoffice_browser(uuid)|EXECUTE",
  "influx_admin|function|backoffice.new_browser_sign_ins(integer)|EXECUTE",
  "influx_identity_definer|function|backoffice.new_browser_sign_ins(integer)|EXECUTE",
  // 0142 (J9 commit 1): the session of the request read by R (J8S-3), for the owner of R only;
  // the admin role grants of the last days for the admins (J8S-4).
  "influx_identity_definer|function|influx.current_session_id()|EXECUTE",
  "influx_admin|function|backoffice.admin_role_grants(integer)|EXECUTE",
  "influx_identity_definer|function|backoffice.admin_role_grants(integer)|EXECUTE",
  // 0144 (J9 commit 3, C5.c): may the GoTrue user holding the new address be deleted.
  "influx_identity_definer|function|identity.email_change_holder_is_orphan(uuid,uuid)|EXECUTE",
  "influx_advertiser|function|identity.email_change_holder_is_orphan(uuid,uuid)|EXECUTE",
  "influx_creator|function|identity.email_change_holder_is_orphan(uuid,uuid)|EXECUTE",
  // 0147 (J9 commit 8, D60 active monitoring): the worker executes its E-4 functions of ops, the api
  // (influx_ops, E-6) its two-scope round functions, worker_liveness() and INSERT on the signals; the
  // owner influx_maintenance_definer reads and purges the ops tables (never a message, a stack nor the
  // account of an occurrence), the catalogue of alerts, the admin recipients, the member sessions and
  // login codes of AL48, the open executions of AL63; influx_identity_definer writes the AL59 tallies,
  // influx_auth executes identity.record_code_failure().
  "influx_auth|function|identity.record_code_failure(bytea)|EXECUTE",
  "influx_identity_definer|column|identity.code_failure_tallies.failure_count|SELECT,UPDATE",
  "influx_identity_definer|column|identity.code_failure_tallies.hour|INSERT,SELECT",
  "influx_identity_definer|column|identity.code_failure_tallies.key_hash|INSERT,SELECT",
  "influx_identity_definer|function|identity.record_code_failure(bytea)|EXECUTE",
  "influx_maintenance_definer|column|backoffice.alert_definitions.code|SELECT",
  "influx_maintenance_definer|column|backoffice.alert_definitions.is_active|SELECT",
  "influx_maintenance_definer|column|backoffice.alert_definitions.nature|SELECT",
  "influx_maintenance_definer|column|backoffice.alert_definitions.recipient_roles|SELECT",
  "influx_maintenance_definer|column|backoffice.alert_definitions.threshold_value|SELECT",
  "influx_maintenance_definer|column|identity.account_roles.account_id|SELECT",
  "influx_maintenance_definer|column|identity.account_roles.role|SELECT",
  "influx_maintenance_definer|column|identity.agent_profiles.account_id|SELECT",
  "influx_maintenance_definer|column|identity.agent_profiles.is_active|SELECT",
  "influx_maintenance_definer|column|identity.agent_profiles.is_break_glass|SELECT",
  "influx_maintenance_definer|column|identity.code_failure_tallies.failure_count|SELECT",
  "influx_maintenance_definer|column|identity.code_failure_tallies.hour|SELECT",
  "influx_maintenance_definer|column|identity.code_failure_tallies.key_hash|SELECT",
  "influx_maintenance_definer|column|identity.sessions.account_id|SELECT",
  "influx_maintenance_definer|column|identity.sessions.created_at|SELECT",
  "influx_maintenance_definer|column|identity.sessions.surface|SELECT",
  "influx_maintenance_definer|column|leads.transactional_sends.account_id|SELECT",
  "influx_maintenance_definer|column|leads.transactional_sends.created_at|SELECT",
  "influx_maintenance_definer|column|leads.transactional_sends.delivered_at|SELECT",
  "influx_maintenance_definer|column|leads.transactional_sends.email_code|SELECT",
  "influx_maintenance_definer|column|leads.transactional_sends.priority|SELECT",
  "influx_maintenance_definer|column|leads.transactional_sends.status|SELECT",
  "influx_maintenance_definer|column|ops.alert_states.code|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.alert_states.last_notified_at|INSERT,SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.alert_states.last_value|INSERT,SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.alert_states.notified_count|INSERT,SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.alert_states.opened_at|INSERT,SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.alert_states.resolved_at|INSERT,SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.alert_states.scope|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.alert_states.state|INSERT,SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.alert_states.subject_key|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.database_samples.connections|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.database_samples.max_connections|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.database_samples.minute|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.error_groups.error_type|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.fingerprint|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.first_seen_at|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.first_version|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.id|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.last_regressed_at|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.last_seen_at|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.last_version|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.message|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.occurrence_count|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.regression_count|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.route|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.service|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.source|SELECT",
  "influx_maintenance_definer|column|ops.error_groups.status|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.account_id|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.group_fingerprint|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.id|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.message|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.occurred_at|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.request_id|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.route|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.service|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.stack|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.user_agent_summary|SELECT",
  "influx_maintenance_definer|column|ops.error_occurrences.version|SELECT",
  "influx_maintenance_definer|column|ops.probe_results.checked_at|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results.duration_ms|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results.failure_code|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results.instance|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results.outcome|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results.status_code|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results.target|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results_hourly.checks|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results_hourly.duration_buckets|INSERT",
  "influx_maintenance_definer|column|ops.probe_results_hourly.failures|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results_hourly.hour|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.probe_results_hourly.target|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.cpu_percent|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.event_loop_delay_max_ms|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.event_loop_delay_p99_ms|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.heap_used_bytes|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.instance|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.minute|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.rss_bytes|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics.service|SELECT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.cpu_avg_percent|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.cpu_max_percent|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.event_loop_delay_max_ms|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.event_loop_delay_p99_avg_ms|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.heap_used_avg_bytes|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.hour|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.instance|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.minutes|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.rss_avg_bytes|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.rss_max_bytes|INSERT",
  "influx_maintenance_definer|column|ops.process_metrics_hourly.service|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.duration_buckets|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.instance|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.method|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.minute|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.request_count|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.route|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.server_error_count|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.service|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics.throttled_count|SELECT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.duration_buckets|INSERT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.hour|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.method|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.request_count|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.route|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.server_error_count|INSERT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.service|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.request_metrics_hourly.throttled_count|INSERT",
  "influx_maintenance_definer|column|ops.signal_counts.count|SELECT",
  "influx_maintenance_definer|column|ops.signal_counts.instance|SELECT",
  "influx_maintenance_definer|column|ops.signal_counts.minute|SELECT",
  "influx_maintenance_definer|column|ops.signal_counts.service|SELECT",
  "influx_maintenance_definer|column|ops.signal_counts.signal|SELECT",
  "influx_maintenance_definer|column|ops.worker_heartbeats.beat_at|SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.worker_heartbeats.instance|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.worker_heartbeats.loop_turn_at|SELECT,UPDATE",
  "influx_maintenance_definer|column|ops.worker_heartbeats.started_at|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.worker_heartbeats.version|INSERT,SELECT",
  "influx_maintenance_definer|column|ops.worker_heartbeats.worker_id|INSERT,SELECT",
  "influx_maintenance_definer|column|privacy.request_executions.completed_at|SELECT",
  "influx_maintenance_definer|column|privacy.request_executions.executed_at|SELECT",
  "influx_maintenance_definer|column|privacy.request_executions.request_id|SELECT",
  "influx_maintenance_definer|function|ops.admin_alert_recipients()|EXECUTE",
  "influx_maintenance_definer|function|ops.begin_alert_round(text)|EXECUTE",
  "influx_maintenance_definer|function|ops.iso_utc(timestamp with time zone)|EXECUTE",
  "influx_maintenance_definer|function|ops.record_database_sample()|EXECUTE",
  "influx_maintenance_definer|function|ops.record_probe_results(text,jsonb)|EXECUTE",
  "influx_maintenance_definer|function|ops.record_worker_heartbeat(text,text,text,timestamp with time zone,boolean)|EXECUTE",
  "influx_maintenance_definer|function|ops.run_ops_retention(uuid,smallint)|EXECUTE",
  "influx_maintenance_definer|function|ops.save_alert_states(text,jsonb)|EXECUTE",
  "influx_maintenance_definer|function|ops.technical_alert_snapshot(timestamp with time zone)|EXECUTE",
  "influx_maintenance_definer|function|ops.threshold_int(jsonb,text,integer,integer,integer)|EXECUTE",
  "influx_maintenance_definer|function|ops.worker_liveness()|EXECUTE",
  "influx_maintenance_definer|schema|backoffice|USAGE",
  "influx_maintenance_definer|table|identity.code_failure_tallies|DELETE",
  "influx_maintenance_definer|table|ops.alert_states|DELETE",
  "influx_maintenance_definer|table|ops.database_samples|DELETE",
  "influx_maintenance_definer|table|ops.error_groups|DELETE",
  "influx_maintenance_definer|table|ops.error_occurrences|DELETE",
  "influx_maintenance_definer|table|ops.probe_results_hourly|DELETE",
  "influx_maintenance_definer|table|ops.probe_results|DELETE",
  "influx_maintenance_definer|table|ops.process_metrics_hourly|DELETE",
  "influx_maintenance_definer|table|ops.process_metrics|DELETE",
  "influx_maintenance_definer|table|ops.request_metrics_hourly|DELETE",
  "influx_maintenance_definer|table|ops.request_metrics|DELETE",
  "influx_maintenance_definer|table|ops.signal_counts|DELETE",
  "influx_maintenance_definer|table|ops.worker_heartbeats|DELETE",
  "influx_ops|function|ops.begin_alert_round(text)|EXECUTE",
  "influx_ops|function|ops.save_alert_states(text,jsonb)|EXECUTE",
  "influx_ops|function|ops.worker_liveness()|EXECUTE",
  "influx_ops|table|ops.signal_counts|INSERT",
  "influx_worker|function|ops.admin_alert_recipients()|EXECUTE",
  "influx_worker|function|ops.begin_alert_round(text)|EXECUTE",
  "influx_worker|function|ops.record_database_sample()|EXECUTE",
  "influx_worker|function|ops.record_probe_results(text,jsonb)|EXECUTE",
  "influx_worker|function|ops.record_worker_heartbeat(text,text,text,timestamp with time zone,boolean)|EXECUTE",
  "influx_worker|function|ops.run_ops_retention(uuid,smallint)|EXECUTE",
  "influx_worker|function|ops.save_alert_states(text,jsonb)|EXECUTE",
  "influx_worker|function|ops.technical_alert_snapshot(timestamp with time zone)|EXECUTE",
  // 0150 (D72, D72 §2.4): the member authorises the erasure of his own account
  // through identity.submit_member_erasure() only (no right on the table for any member role); its
  // owner inserts the execution with authorised_by (never UPDATE nor DELETE); agent and admin read
  // who authorised it (account sheet, §2.5); influx_privacy reads the held address of the e-mail
  // privacy.erasure_completed through its own function (DZ-3), never the column.
  "influx_admin|column|privacy.request_executions.authorised_by|SELECT",
  "influx_agent|column|privacy.request_executions.authorised_by|SELECT",
  "influx_identity_definer|column|privacy.request_executions.authorised_by|INSERT",
  "influx_identity_definer|function|identity.submit_member_erasure()|EXECUTE",
  "influx_advertiser|function|identity.submit_member_erasure()|EXECUTE",
  "influx_creator|function|identity.submit_member_erasure()|EXECUTE",
  "influx_privacy_definer|function|privacy.read_erasure_notification_subject(uuid)|EXECUTE",
  "influx_privacy|function|privacy.read_erasure_notification_subject(uuid)|EXECUTE",
  // 0201 (L2A commit 09, 04 §4.2): the fourteen Lot 2 reference lists, SELECT to the four
  // business roles as 0003, nothing else (price_bands included, empty at L2A, D78)
  "influx_admin|table|reference.age_bands|SELECT",
  "influx_admin|table|reference.audience_bands|SELECT",
  "influx_admin|table|reference.audience_genders|SELECT",
  "influx_admin|table|reference.comment_bands|SELECT",
  "influx_admin|table|reference.editorial_tones|SELECT",
  "influx_admin|table|reference.engagement_bands|SELECT",
  "influx_admin|table|reference.formats|SELECT",
  "influx_admin|table|reference.networks|SELECT",
  "influx_admin|table|reference.price_bands|SELECT",
  "influx_admin|table|reference.publication_frequencies|SELECT",
  "influx_admin|table|reference.regions|SELECT",
  "influx_admin|table|reference.sectors|SELECT",
  "influx_admin|table|reference.topics|SELECT",
  "influx_admin|table|reference.usage_rights|SELECT",
  "influx_advertiser|table|reference.age_bands|SELECT",
  "influx_advertiser|table|reference.audience_bands|SELECT",
  "influx_advertiser|table|reference.audience_genders|SELECT",
  "influx_advertiser|table|reference.comment_bands|SELECT",
  "influx_advertiser|table|reference.editorial_tones|SELECT",
  "influx_advertiser|table|reference.engagement_bands|SELECT",
  "influx_advertiser|table|reference.formats|SELECT",
  "influx_advertiser|table|reference.networks|SELECT",
  "influx_advertiser|table|reference.price_bands|SELECT",
  "influx_advertiser|table|reference.publication_frequencies|SELECT",
  "influx_advertiser|table|reference.regions|SELECT",
  "influx_advertiser|table|reference.sectors|SELECT",
  "influx_advertiser|table|reference.topics|SELECT",
  "influx_advertiser|table|reference.usage_rights|SELECT",
  "influx_agent|table|reference.age_bands|SELECT",
  "influx_agent|table|reference.audience_bands|SELECT",
  "influx_agent|table|reference.audience_genders|SELECT",
  "influx_agent|table|reference.comment_bands|SELECT",
  "influx_agent|table|reference.editorial_tones|SELECT",
  "influx_agent|table|reference.engagement_bands|SELECT",
  "influx_agent|table|reference.formats|SELECT",
  "influx_agent|table|reference.networks|SELECT",
  "influx_agent|table|reference.price_bands|SELECT",
  "influx_agent|table|reference.publication_frequencies|SELECT",
  "influx_agent|table|reference.regions|SELECT",
  "influx_agent|table|reference.sectors|SELECT",
  "influx_agent|table|reference.topics|SELECT",
  "influx_agent|table|reference.usage_rights|SELECT",
  "influx_creator|table|reference.age_bands|SELECT",
  "influx_creator|table|reference.audience_bands|SELECT",
  "influx_creator|table|reference.audience_genders|SELECT",
  "influx_creator|table|reference.comment_bands|SELECT",
  "influx_creator|table|reference.editorial_tones|SELECT",
  "influx_creator|table|reference.engagement_bands|SELECT",
  "influx_creator|table|reference.formats|SELECT",
  "influx_creator|table|reference.networks|SELECT",
  "influx_creator|table|reference.price_bands|SELECT",
  "influx_creator|table|reference.publication_frequencies|SELECT",
  "influx_creator|table|reference.regions|SELECT",
  "influx_creator|table|reference.sectors|SELECT",
  "influx_creator|table|reference.topics|SELECT",
  "influx_creator|table|reference.usage_rights|SELECT",
  // 0202 (L2B commit 05, 06 blocks 1 to 3): the owner updates the profile columns of blocks 1 to 3
  // (never status nor legal_name), adds and removes the rows of his eight lists, reads and writes
  // his contact person; agent and admin read the nine new tables (aal2 by policy); influx_creator
  // NOTHING (D40, D46). influx_privacy_definer reads what the export carries and empties or deletes
  // what the erasure clears (04 §9.2, EC-L2B-05-6).
  "influx_admin|table|profiles.advertiser_audience_countries|SELECT",
  "influx_admin|table|profiles.advertiser_contact_details|SELECT",
  "influx_admin|table|profiles.advertiser_formats|SELECT",
  "influx_admin|table|profiles.advertiser_networks|SELECT",
  "influx_admin|table|profiles.advertiser_secondary_sectors|SELECT",
  "influx_admin|table|profiles.advertiser_target_markets|SELECT",
  "influx_admin|table|profiles.advertiser_topics|SELECT",
  "influx_admin|table|profiles.advertiser_usage_rights|SELECT",
  "influx_admin|table|profiles.advertiser_working_languages|SELECT",
  "influx_advertiser|column|profiles.advertiser_audience_countries.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_audience_countries.country_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_audience_countries.slot|INSERT",
  "influx_advertiser|column|profiles.advertiser_contact_details.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_contact_details.contact_email|INSERT,UPDATE",
  "influx_advertiser|column|profiles.advertiser_contact_details.contact_first_name|INSERT,UPDATE",
  "influx_advertiser|column|profiles.advertiser_contact_details.contact_phone|INSERT,UPDATE",
  "influx_advertiser|column|profiles.advertiser_contact_details.contact_url|INSERT,UPDATE",
  "influx_advertiser|column|profiles.advertiser_formats.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_formats.format_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_networks.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_networks.network_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_profiles.collaboration_rhythm|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.company_size_band|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.completeness_percent|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.contact_role|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.exclusivity_band|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.offers_non_monetary|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.presentation|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.primary_sector_code|UPDATE",
  "influx_advertiser|column|profiles.advertiser_profiles.website_domain|UPDATE",
  "influx_advertiser|column|profiles.advertiser_secondary_sectors.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_secondary_sectors.sector_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_secondary_sectors.slot|INSERT",
  "influx_advertiser|column|profiles.advertiser_target_markets.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_target_markets.country_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_target_markets.slot|INSERT",
  "influx_advertiser|column|profiles.advertiser_topics.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_topics.slot|INSERT",
  "influx_advertiser|column|profiles.advertiser_topics.topic_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_usage_rights.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_usage_rights.usage_right_code|INSERT",
  "influx_advertiser|column|profiles.advertiser_working_languages.account_id|INSERT",
  "influx_advertiser|column|profiles.advertiser_working_languages.language_code|INSERT",
  "influx_advertiser|table|profiles.advertiser_audience_countries|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_contact_details|SELECT",
  "influx_advertiser|table|profiles.advertiser_formats|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_networks|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_secondary_sectors|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_target_markets|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_topics|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_usage_rights|DELETE,SELECT",
  "influx_advertiser|table|profiles.advertiser_working_languages|DELETE,SELECT",
  "influx_agent|table|profiles.advertiser_audience_countries|SELECT",
  "influx_agent|table|profiles.advertiser_contact_details|SELECT",
  "influx_agent|table|profiles.advertiser_formats|SELECT",
  "influx_agent|table|profiles.advertiser_networks|SELECT",
  "influx_agent|table|profiles.advertiser_secondary_sectors|SELECT",
  "influx_agent|table|profiles.advertiser_target_markets|SELECT",
  "influx_agent|table|profiles.advertiser_topics|SELECT",
  "influx_agent|table|profiles.advertiser_usage_rights|SELECT",
  "influx_agent|table|profiles.advertiser_working_languages|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_audience_countries.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_audience_countries.country_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_audience_countries.slot|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_contact_details.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_contact_details.contact_email|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_contact_details.contact_first_name|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_contact_details.contact_phone|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_contact_details.contact_url|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_contact_details.updated_at|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_formats.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_formats.format_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_networks.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_networks.network_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_profiles.collaboration_rhythm|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.company_size_band|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.completeness_percent|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.contact_role|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.exclusivity_band|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.offers_non_monetary|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.presentation|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.primary_sector_code|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_profiles.status|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_profiles.updated_at|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_profiles.website_domain|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_secondary_sectors.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_secondary_sectors.sector_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_secondary_sectors.slot|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_target_markets.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_target_markets.country_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_target_markets.slot|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_topics.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_topics.slot|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_topics.topic_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_usage_rights.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_usage_rights.usage_right_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_working_languages.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_working_languages.language_code|SELECT",
  "influx_privacy_definer|table|profiles.advertiser_audience_countries|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_formats|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_networks|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_secondary_sectors|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_target_markets|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_topics|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_usage_rights|DELETE",
  "influx_privacy_definer|table|profiles.advertiser_working_languages|DELETE",
  // 0203 (L2B commit 06, 06 RG5): the brand submits through profiles.submit_own_advertiser_profile()
  // only (EXECUTE for influx_advertiser); its owner influx_identity_definer reads the required
  // fields of the caller's profile and lists, writes status and submitted_at (RLS: own row), and
  // owns the pure helper profiles.advertiser_missing_required_fields() (no grant).
  "influx_advertiser|function|profiles.submit_own_advertiser_profile()|EXECUTE",
  "influx_identity_definer|column|profiles.advertiser_audience_countries.account_id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_audience_countries.country_code|SELECT",
  "influx_identity_definer|column|profiles.advertiser_formats.account_id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_formats.format_code|SELECT",
  "influx_identity_definer|column|profiles.advertiser_networks.account_id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_networks.network_code|SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.company_size_band|SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.contact_role|SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.presentation|SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.primary_sector_code|SELECT",
  "influx_identity_definer|column|profiles.advertiser_profiles.status|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.advertiser_profiles.submitted_at|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.advertiser_target_markets.account_id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_target_markets.country_code|SELECT",
  "influx_identity_definer|column|profiles.advertiser_topics.account_id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_topics.topic_code|SELECT",
  "influx_identity_definer|column|profiles.advertiser_working_languages.account_id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_working_languages.language_code|SELECT",
  "influx_identity_definer|function|profiles.advertiser_missing_required_fields(jsonb)|EXECUTE",
  "influx_identity_definer|function|profiles.submit_own_advertiser_profile()|EXECUTE",
  // 0204 (L2B commit 08, stockage.md §3 to §7): the owner reads his logo rows, agent and admin in
  // aal2; nobody writes them but the five doors (EXECUTE for influx_advertiser), owned by
  // influx_identity_definer, which reads and writes the caller's rows and usage and reads the
  // quotas; influx_privacy_definer reads what the export carries, moves the rows of an erased
  // account to purging and deletes its usage.
  "influx_admin|table|profiles.brand_logo_objects|SELECT",
  "influx_advertiser|function|profiles.activate_brand_logo(uuid,integer,integer,integer)|EXECUTE",
  "influx_advertiser|function|profiles.begin_brand_logo_upload(integer)|EXECUTE",
  "influx_advertiser|function|profiles.discard_brand_logo_upload(uuid)|EXECUTE",
  "influx_advertiser|function|profiles.fail_brand_logo_upload(uuid)|EXECUTE",
  "influx_advertiser|function|profiles.remove_own_brand_logo()|EXECUTE",
  "influx_advertiser|table|profiles.brand_logo_objects|SELECT",
  "influx_agent|table|profiles.brand_logo_objects|SELECT",
  "influx_identity_definer|column|profiles.brand_logo_objects.account_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.brand_logo_objects.activated_at|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.brand_logo_objects.byte_size|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.brand_logo_objects.height|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.brand_logo_objects.id|SELECT",
  "influx_identity_definer|column|profiles.brand_logo_objects.object_key|SELECT",
  "influx_identity_definer|column|profiles.brand_logo_objects.purge_requested_at|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.brand_logo_objects.received_bytes|INSERT,SELECT",
  "influx_identity_definer|column|profiles.brand_logo_objects.state|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.brand_logo_objects.width|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.storage_daily_usage.account_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.storage_daily_usage.bucket_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.storage_daily_usage.received_bytes|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.storage_daily_usage.upload_count|SELECT,UPDATE",
  "influx_identity_definer|column|profiles.storage_daily_usage.usage_day|INSERT,SELECT",
  "influx_identity_definer|column|profiles.storage_quotas.bucket_id|SELECT",
  "influx_identity_definer|column|profiles.storage_quotas.max_bytes_per_day|SELECT",
  "influx_identity_definer|column|profiles.storage_quotas.max_uploads_per_day|SELECT",
  "influx_identity_definer|function|profiles.activate_brand_logo(uuid,integer,integer,integer)|EXECUTE",
  "influx_identity_definer|function|profiles.begin_brand_logo_upload(integer)|EXECUTE",
  "influx_identity_definer|function|profiles.discard_brand_logo_upload(uuid)|EXECUTE",
  "influx_identity_definer|function|profiles.fail_brand_logo_upload(uuid)|EXECUTE",
  "influx_identity_definer|function|profiles.remove_own_brand_logo()|EXECUTE",
  "influx_identity_definer|table|profiles.brand_logo_objects|DELETE",
  "influx_privacy_definer|column|profiles.brand_logo_objects.account_id|SELECT",
  "influx_privacy_definer|column|profiles.brand_logo_objects.activated_at|SELECT",
  "influx_privacy_definer|column|profiles.brand_logo_objects.byte_size|SELECT",
  "influx_privacy_definer|column|profiles.brand_logo_objects.created_at|SELECT",
  "influx_privacy_definer|column|profiles.brand_logo_objects.height|SELECT",
  "influx_privacy_definer|column|profiles.brand_logo_objects.id|SELECT",
  "influx_privacy_definer|column|profiles.brand_logo_objects.purge_requested_at|UPDATE",
  "influx_privacy_definer|column|profiles.brand_logo_objects.state|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.brand_logo_objects.width|SELECT",
  "influx_privacy_definer|column|profiles.storage_daily_usage.account_id|SELECT",
  "influx_privacy_definer|table|profiles.storage_daily_usage|DELETE",
  // 0205 (L2B commit 09, stockage.md §7): the hourly task storage_purge of E-4, owned by
  // influx_maintenance_definer, executed by influx_worker: the rows to purge (never an account, a
  // size nor an active row), the usage after 7 days.
  "influx_maintenance_definer|column|profiles.brand_logo_objects.created_at|SELECT",
  "influx_maintenance_definer|column|profiles.brand_logo_objects.id|SELECT",
  "influx_maintenance_definer|column|profiles.brand_logo_objects.last_purge_attempt_at|SELECT,UPDATE",
  "influx_maintenance_definer|column|profiles.brand_logo_objects.object_key|SELECT",
  "influx_maintenance_definer|column|profiles.brand_logo_objects.purge_attempts|SELECT,UPDATE",
  "influx_maintenance_definer|column|profiles.brand_logo_objects.purge_requested_at|SELECT,UPDATE",
  "influx_maintenance_definer|column|profiles.brand_logo_objects.state|SELECT,UPDATE",
  "influx_maintenance_definer|column|profiles.storage_daily_usage.usage_day|SELECT",
  "influx_maintenance_definer|function|ops.claim_storage_purges(uuid,smallint,integer)|EXECUTE",
  "influx_maintenance_definer|function|ops.complete_storage_purges(uuid,smallint,uuid[])|EXECUTE",
  "influx_maintenance_definer|function|ops.purge_storage_usage(uuid,smallint)|EXECUTE",
  "influx_maintenance_definer|schema|profiles|USAGE",
  "influx_maintenance_definer|table|profiles.brand_logo_objects|DELETE",
  "influx_maintenance_definer|table|profiles.storage_daily_usage|DELETE",
  "influx_worker|function|ops.claim_storage_purges(uuid,smallint,integer)|EXECUTE",
  "influx_worker|function|ops.complete_storage_purges(uuid,smallint,uuid[])|EXECUTE",
  "influx_worker|function|ops.purge_storage_usage(uuid,smallint)|EXECUTE",
  // 0207 (L2C commit 05, file.md A1, A4, A6): the two catalogues and the entries of queue 1 read
  // by agent and admin in aal2; the brand reads its own entries without the lock, the agents, the
  // deadlines nor the internal comment, and its own revisions; nobody writes them directly. The
  // owner of the member doors opens an entry (account, kind) of the caller's row, reads the delay
  // of queue 1 and executes business_deadline() through the trigger of the entries;
  // influx_privacy_definer reads what the export carries, deletes the revisions and empties the
  // entries of an erased account.
  "influx_admin|table|profiles.advertiser_rejection_reasons|SELECT",
  "influx_admin|table|profiles.advertiser_review_entries|SELECT",
  "influx_admin|table|profiles.moderated_fields|SELECT",
  "influx_admin|table|profiles.profile_field_revisions|SELECT",
  "influx_agent|table|profiles.advertiser_rejection_reasons|SELECT",
  "influx_agent|table|profiles.advertiser_review_entries|SELECT",
  "influx_agent|table|profiles.moderated_fields|SELECT",
  "influx_agent|table|profiles.profile_field_revisions|SELECT",
  "influx_advertiser|table|profiles.profile_field_revisions|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.account_id|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.closed_at|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.created_at|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.decided_at|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.id|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.kind|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.member_message|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.rejection_reason_code|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.state|SELECT",
  "influx_advertiser|column|profiles.advertiser_review_entries.updated_at|SELECT",
  "influx_identity_definer|column|profiles.advertiser_review_entries.account_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.advertiser_review_entries.id|SELECT",
  "influx_identity_definer|column|profiles.advertiser_review_entries.kind|INSERT,SELECT",
  "influx_identity_definer|column|profiles.advertiser_review_entries.state|SELECT,UPDATE",
  "influx_identity_definer|column|backoffice.sla_policies.escalate_after_minutes|SELECT",
  "influx_identity_definer|function|backoffice.business_deadline(text,timestamp with time zone,integer)|EXECUTE",
  // 0209 (L2C commit 06, file.md A3, A4): the member door of RG9 reads the catalogue, deposits and
  // replaces the revisions of the caller and withdraws his open entry (the policies refuse any
  // decision, RG6); the brand asks the guard's question and calls the door, never the catalogue.
  "influx_identity_definer|column|profiles.advertiser_profiles.website_domain|SELECT",
  "influx_identity_definer|column|profiles.advertiser_review_entries.closed_at|UPDATE",
  "influx_identity_definer|column|profiles.moderated_fields.code|SELECT",
  "influx_identity_definer|column|profiles.moderated_fields.is_active|SELECT",
  "influx_identity_definer|column|profiles.moderated_fields.profile_kind|SELECT",
  "influx_identity_definer|column|profiles.profile_field_revisions.account_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.profile_field_revisions.advertiser_review_entry_id|INSERT,SELECT",
  "influx_identity_definer|column|profiles.profile_field_revisions.closed_at|UPDATE",
  "influx_identity_definer|column|profiles.profile_field_revisions.field_code|INSERT,SELECT",
  "influx_identity_definer|column|profiles.profile_field_revisions.id|SELECT",
  "influx_identity_definer|column|profiles.profile_field_revisions.proposed_value|INSERT,SELECT",
  "influx_identity_definer|column|profiles.profile_field_revisions.status|SELECT,UPDATE",
  "influx_advertiser|function|profiles.moderated_field_is_active(text)|EXECUTE",
  "influx_advertiser|function|profiles.record_own_advertiser_profile_change()|EXECUTE",
  "influx_advertiser|function|profiles.submit_own_advertiser_revision(text,jsonb)|EXECUTE",
  "influx_identity_definer|function|profiles.moderated_field_is_active(text)|EXECUTE",
  "influx_identity_definer|function|profiles.record_own_advertiser_profile_change()|EXECUTE",
  "influx_identity_definer|function|profiles.submit_own_advertiser_revision(text,jsonb)|EXECUTE",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.account_id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.closed_at|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.created_at|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.decided_at|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.id|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.internal_comment|UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.kind|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.member_message|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.rejection_reason_code|SELECT",
  "influx_privacy_definer|column|profiles.advertiser_review_entries.state|SELECT,UPDATE",
  "influx_privacy_definer|column|profiles.profile_field_revisions.account_id|SELECT",
  "influx_privacy_definer|column|profiles.profile_field_revisions.closed_at|SELECT",
  "influx_privacy_definer|column|profiles.profile_field_revisions.field_code|SELECT",
  "influx_privacy_definer|column|profiles.profile_field_revisions.proposed_value|SELECT",
  "influx_privacy_definer|column|profiles.profile_field_revisions.row_key|SELECT",
  "influx_privacy_definer|column|profiles.profile_field_revisions.status|SELECT",
  "influx_privacy_definer|column|profiles.profile_field_revisions.submitted_at|SELECT",
  "influx_privacy_definer|table|profiles.profile_field_revisions|DELETE",
  // 0210 (L2C commit 07, file.md A5, A7, A8): influx_moderation_definer owns the six decisions of
  // queue 1 (EXECUTE to agent and admin): it reads what the version token hashes and the caller's
  // internal account, claims, releases and decides the entries, applies or refuses the revisions,
  // activates or purges a logo, writes the state and the moderated columns of the profile, queues
  // profile.decision, profile.completed or lead.updated, and writes the register; never the caller's
  // own account (its policies). Agent and admin read the forced release reasons and execute the two
  // duplicate helpers of RG25, RG70 (invoker).
  "influx_admin|function|profiles.advertiser_duplicate_candidates(uuid,text,text)|EXECUTE",
  "influx_admin|function|profiles.extend_advertiser_review_claim(uuid)|EXECUTE",
  "influx_admin|function|profiles.force_release_advertiser_review_claim(uuid,text)|EXECUTE",
  "influx_admin|function|profiles.normalized_brand_name(text)|EXECUTE",
  "influx_admin|function|profiles.open_advertiser_review_entry(uuid)|EXECUTE",
  "influx_admin|function|profiles.publish_advertiser_review_entry(uuid,text,text)|EXECUTE",
  "influx_admin|function|profiles.reject_advertiser_review_entry(uuid,text,text,text,text)|EXECUTE",
  "influx_admin|function|profiles.release_advertiser_review_entry(uuid)|EXECUTE",
  "influx_admin|table|backoffice.claim_release_reasons|SELECT",
  "influx_agent|function|profiles.advertiser_duplicate_candidates(uuid,text,text)|EXECUTE",
  "influx_agent|function|profiles.extend_advertiser_review_claim(uuid)|EXECUTE",
  "influx_agent|function|profiles.force_release_advertiser_review_claim(uuid,text)|EXECUTE",
  "influx_agent|function|profiles.normalized_brand_name(text)|EXECUTE",
  "influx_agent|function|profiles.open_advertiser_review_entry(uuid)|EXECUTE",
  "influx_agent|function|profiles.publish_advertiser_review_entry(uuid,text,text)|EXECUTE",
  "influx_agent|function|profiles.reject_advertiser_review_entry(uuid,text,text,text,text)|EXECUTE",
  "influx_agent|function|profiles.release_advertiser_review_entry(uuid)|EXECUTE",
  "influx_agent|table|backoffice.claim_release_reasons|SELECT",
  "influx_moderation_definer|column|backoffice.claim_release_reasons.code|SELECT",
  "influx_moderation_definer|column|backoffice.claim_release_reasons.is_active|SELECT",
  "influx_moderation_definer|column|backoffice.operational_settings.key|SELECT",
  "influx_moderation_definer|column|backoffice.operational_settings.value|SELECT",
  "influx_moderation_definer|column|identity.account_roles.account_id|SELECT",
  "influx_moderation_definer|column|identity.account_roles.role|SELECT",
  "influx_moderation_definer|column|identity.accounts.country_code|SELECT",
  "influx_moderation_definer|column|identity.accounts.id|SELECT",
  // 0215 (L2C fix-2, L2CS-2): the responsible agent, read to refuse an account the caller holds
  "influx_moderation_definer|column|identity.accounts.owner_agent_id|SELECT",
  "influx_moderation_definer|column|identity.accounts.status|SELECT",
  "influx_moderation_definer|column|identity.agent_profiles.account_id|SELECT",
  "influx_moderation_definer|column|identity.agent_profiles.is_active|SELECT",
  "influx_moderation_definer|column|leads.outbox_events.destination|INSERT",
  "influx_moderation_definer|column|leads.outbox_events.event_id|INSERT",
  "influx_moderation_definer|column|leads.outbox_events.event_type|INSERT",
  "influx_moderation_definer|column|leads.outbox_events.idempotency_key|INSERT",
  "influx_moderation_definer|column|leads.outbox_events.payload|INSERT",
  "influx_moderation_definer|column|leads.outbox_events.priority|INSERT",
  "influx_moderation_definer|column|leads.outbox_events.subject_key|INSERT",
  "influx_moderation_definer|column|profiles.advertiser_audience_countries.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_audience_countries.country_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_audience_countries.slot|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_contact_details.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_contact_details.contact_email|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_contact_details.contact_first_name|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_contact_details.contact_phone|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_contact_details.contact_url|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_formats.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_formats.format_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_networks.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_networks.network_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_profiles.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_profiles.collaboration_rhythm|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_profiles.company_size_band|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_profiles.contact_role|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_profiles.exclusivity_band|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_profiles.first_published_at|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_profiles.legal_name|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_profiles.offers_non_monetary|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_profiles.presentation|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_profiles.primary_sector_code|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_profiles.status|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_profiles.website_domain|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_rejection_reasons.code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_rejection_reasons.is_active|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_rejection_reasons.requires_member_message|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.claim_expires_at|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.claimed_at|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.claimed_by_account_id|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.closed_at|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.decided_at|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.decided_by_account_id|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.forced_release_at|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.forced_release_by_account_id|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.forced_release_holder_account_id|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.forced_release_reason_code|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.internal_comment|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.kind|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.member_message|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.rejection_reason_code|UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.sla_breached|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_review_entries.state|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.advertiser_secondary_sectors.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_secondary_sectors.sector_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_secondary_sectors.slot|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_target_markets.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_target_markets.country_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_target_markets.slot|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_topics.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_topics.slot|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_topics.topic_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_usage_rights.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_usage_rights.usage_right_code|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_working_languages.account_id|SELECT",
  "influx_moderation_definer|column|profiles.advertiser_working_languages.language_code|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.account_id|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.activated_at|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.brand_logo_objects.id|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.purge_requested_at|UPDATE",
  "influx_moderation_definer|column|profiles.brand_logo_objects.state|SELECT,UPDATE",
  "influx_moderation_definer|column|profiles.profile_field_revisions.account_id|SELECT",
  "influx_moderation_definer|column|profiles.profile_field_revisions.advertiser_review_entry_id|SELECT",
  "influx_moderation_definer|column|profiles.profile_field_revisions.closed_at|UPDATE",
  "influx_moderation_definer|column|profiles.profile_field_revisions.field_code|SELECT",
  "influx_moderation_definer|column|profiles.profile_field_revisions.id|SELECT",
  "influx_moderation_definer|column|profiles.profile_field_revisions.proposed_value|SELECT",
  "influx_moderation_definer|column|profiles.profile_field_revisions.row_key|SELECT",
  "influx_moderation_definer|column|profiles.profile_field_revisions.status|SELECT,UPDATE",
  "influx_moderation_definer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_moderation_definer|function|influx.current_aal()|EXECUTE",
  "influx_moderation_definer|function|influx.current_account_id()|EXECUTE",
  "influx_moderation_definer|function|influx.current_account_role()|EXECUTE",
  "influx_moderation_definer|function|influx.has_aal2()|EXECUTE",
  "influx_moderation_definer|function|profiles.advertiser_missing_required_fields(jsonb)|EXECUTE",
  "influx_moderation_definer|function|profiles.advertiser_review_token(uuid)|EXECUTE",
  "influx_moderation_definer|function|profiles.extend_advertiser_review_claim(uuid)|EXECUTE",
  "influx_moderation_definer|function|profiles.force_release_advertiser_review_claim(uuid,text)|EXECUTE",
  "influx_moderation_definer|function|profiles.open_advertiser_review_entry(uuid)|EXECUTE",
  "influx_moderation_definer|function|profiles.publish_advertiser_review_entry(uuid,text,text)|EXECUTE",
  "influx_moderation_definer|function|profiles.reject_advertiser_review_entry(uuid,text,text,text,text)|EXECUTE",
  "influx_moderation_definer|function|profiles.release_advertiser_review_entry(uuid)|EXECUTE",
  "influx_moderation_definer|function|profiles.require_review_agent(boolean)|EXECUTE",
  "influx_moderation_definer|schema|audit|USAGE",
  "influx_moderation_definer|schema|backoffice|USAGE",
  "influx_moderation_definer|schema|identity|USAGE",
  "influx_moderation_definer|schema|influx|USAGE",
  "influx_moderation_definer|schema|leads|USAGE",
  "influx_moderation_definer|schema|profiles|USAGE",
  // 0211 (L2C commit 09a): the worker's read of the brand decision e-mail,
  // leads.read_brevo_profile_decision() (E-3): the decision, its reason and the agent's message of
  // a decided entry, never the internal comment, the agent nor the claim.
  "influx_leads_definer|column|profiles.advertiser_review_entries.account_id|SELECT",
  "influx_leads_definer|column|profiles.advertiser_review_entries.id|SELECT",
  "influx_leads_definer|column|profiles.advertiser_review_entries.member_message|SELECT",
  "influx_leads_definer|column|profiles.advertiser_review_entries.rejection_reason_code|SELECT",
  "influx_leads_definer|column|profiles.advertiser_review_entries.state|SELECT",
  "influx_leads_definer|function|leads.read_brevo_profile_decision(bigint,text)|EXECUTE",
  "influx_worker|function|leads.read_brevo_profile_decision(bigint,text)|EXECUTE",
  // 0212 (L2C commit 10): the worker's read of the brand attributes of a Brevo or Apollo contact,
  // leads.read_brand_profile_attributes() (E-3): the state, completeness, sector, size band, domain,
  // first topic and target markets of the live row; never the legal name, the presentation nor the
  // contact person.
  "influx_leads_definer|column|profiles.advertiser_profiles.company_size_band|SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.completeness_percent|SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.first_published_at|SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.primary_sector_code|SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.status|SELECT",
  "influx_leads_definer|column|profiles.advertiser_profiles.website_domain|SELECT",
  "influx_leads_definer|column|profiles.advertiser_target_markets.account_id|SELECT",
  "influx_leads_definer|column|profiles.advertiser_target_markets.country_code|SELECT",
  "influx_leads_definer|column|profiles.advertiser_target_markets.slot|SELECT",
  "influx_leads_definer|column|profiles.advertiser_topics.account_id|SELECT",
  "influx_leads_definer|column|profiles.advertiser_topics.slot|SELECT",
  "influx_leads_definer|column|profiles.advertiser_topics.topic_code|SELECT",
  "influx_leads_definer|function|leads.read_brand_profile_attributes(bigint,text)|EXECUTE",
  "influx_worker|function|leads.read_brand_profile_attributes(bigint,text)|EXECUTE",
  // 0213 (L2C commit 18a): the journaled read of a brand logo by an internal reader of queue 1,
  // profiles.read_advertiser_review_logo(): the object key and the metadata of a logo; no right on
  // Storage for any role (apps/api relays the object).
  "influx_admin|function|profiles.read_advertiser_review_logo(uuid,uuid)|EXECUTE",
  "influx_agent|function|profiles.read_advertiser_review_logo(uuid,uuid)|EXECUTE",
  "influx_moderation_definer|column|profiles.brand_logo_objects.byte_size|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.created_at|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.height|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.object_key|SELECT",
  "influx_moderation_definer|column|profiles.brand_logo_objects.width|SELECT",
  "influx_moderation_definer|function|profiles.read_advertiser_review_logo(uuid,uuid)|EXECUTE",
];

/**
 * T4.2, T4.3: the closed list of 03 P7 (twelve roles at J2, fourteen from J4, fifteen from J6 with
 * influx_leads_definer, 0111, sixteen from J7 with influx_maintenance_definer, 0117, nineteen from
 * J8 with influx_privacy, influx_privacy_login and influx_privacy_definer, 0136, twenty from L2C with
 * influx_moderation_definer, 0210), memberships.
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
  // 0136 (03 P7 E-5): influx_privacy ONLY, never influx_worker (and never the reverse)
  influx_privacy_login: { login: true, memberOf: ["influx_privacy"] },
  influx_advertiser: { login: false, memberOf: [] },
  influx_creator: { login: false, memberOf: [] },
  influx_agent: { login: false, memberOf: [] },
  influx_admin: { login: false, memberOf: [] },
  influx_auth: { login: false, memberOf: [] },
  influx_worker: { login: false, memberOf: [] },
  influx_ops: { login: false, memberOf: [] },
  influx_privacy: { login: false, memberOf: [] },
  influx_audit_writer: { login: false, memberOf: [] },
  influx_session_resolver: { login: false, memberOf: [] },
  influx_identity_definer: { login: false, memberOf: [] },
  influx_leads_definer: { login: false, memberOf: [] },
  influx_maintenance_definer: { login: false, memberOf: [] },
  influx_privacy_definer: { login: false, memberOf: [] },
  // 0210 (L2C, file.md A5): the owner of the decisions of queue 1
  influx_moderation_definer: { login: false, memberOf: [] },
};

/** Owners of SECURITY DEFINER functions: no login, NO member (only C-9 tolerance). */
export const FUNCTION_OWNER_ROLES = [
  "influx_audit_writer",
  "influx_session_resolver",
  "influx_identity_definer",
  "influx_leads_definer",
  "influx_maintenance_definer",
  "influx_privacy_definer",
  "influx_moderation_definer",
] as const;

/** Execution roles (T4.4: own nothing). */
export const EXECUTION_ROLES = [
  "influx_app",
  "influx_auth_login",
  "influx_worker_login",
  "influx_ops_login",
  "influx_privacy_login",
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_auth",
  "influx_worker",
  "influx_ops",
  "influx_privacy",
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
  // 0132 (J8 commit 3): R enforced in the function, the 0104 signature dropped
  "identity.correct_email(uuid,uuid,text,text,text)": "influx_identity_definer",
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
  // 0139 (D68), 0140 (D69): the Brevo list ids of the worker's environment
  "leads.apply_brevo_ids_from_environment(jsonb)": "influx_leads_definer",
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
  // 0131 (J8 commit 3: the two invitations, EC-J8-2). The helper
  // backoffice.canonical_dual_control_payload() is SECURITY INVOKER.
  "identity.create_internal_invitation(uuid,text,identity.account_role,bytea,text)":
    "influx_identity_definer",
  "identity.approve_admin_invitation(uuid,uuid,uuid,text)":
    "influx_identity_definer",
  "identity.revoke_internal_invitation(uuid,text)": "influx_identity_definer",
  "identity.internal_invitation_is_valid(bytea,text)":
    "influx_identity_definer",
  "identity.accept_internal_invitation(bytea,uuid,text,text,text,text)":
    "influx_identity_definer",
  "backoffice.create_member_invitation(text,identity.account_role,text,bytea)":
    "influx_identity_definer",
  "backoffice.revoke_member_invitation(uuid,text)": "influx_identity_definer",
  "backoffice.redeem_member_invitation(uuid,bytea)": "influx_identity_definer",
  // 0132 (J8 commit 3: corrections RG108, member role change, replay, history read EC-31)
  "identity.correct_member_account(uuid,text,identity.declared_status,text,text,text)":
    "influx_identity_definer",
  "identity.change_member_role(uuid,uuid,uuid,identity.account_role,text,text)":
    "influx_identity_definer",
  "backoffice.read_subject_history(text,uuid,integer,bigint)":
    "influx_identity_definer",
  "leads.replay_outbox_lines(bigint[],text)": "influx_leads_definer",
  // 0133 (J8 commit 5: partial search of member accounts, RG98)
  "backoffice.reserve_account_search(integer)": "influx_identity_definer",
  // 0134 (J8 commit 6: Apollo keys, suppression lift, refused attempts, last reconciliation)
  "backoffice.change_apollo_setting(uuid,uuid,text,jsonb,text)":
    "influx_identity_definer",
  "backoffice.read_apollo_settings()": "influx_identity_definer",
  "backoffice.lift_brevo_suppression(uuid,uuid,text,text)":
    "influx_identity_definer",
  "backoffice.record_refused_action(text)": "influx_identity_definer",
  "backoffice.last_brevo_reconciliation()": "influx_maintenance_definer",
  "backoffice.ops_error_group(uuid)": "influx_maintenance_definer",
  "backoffice.ops_error_groups(text,text,integer)":
    "influx_maintenance_definer",
  "backoffice.ops_health_status()": "influx_maintenance_definer",
  "backoffice.ops_processes()": "influx_maintenance_definer",
  "backoffice.ops_traffic(text)": "influx_maintenance_definer",
  // 0137 (J8 commit 8, E-5 minimal). The helpers privacy.iso_utc(), privacy.export_categories(),
  // privacy.account_addresses() and privacy.export_document() are SECURITY INVOKER.
  "privacy.pending_work(integer)": "influx_privacy_definer",
  "privacy.execute_request(uuid,jsonb)": "influx_privacy_definer",
  "privacy.record_auth_user_deleted(uuid)": "influx_privacy_definer",
  "privacy.complete_request(uuid)": "influx_privacy_definer",
  "leads.read_brevo_erasure_subject(bigint,text)": "influx_privacy_definer",
  "ops.purge_data_exports(uuid,smallint,integer)": "influx_maintenance_definer",
  "backoffice.approve_data_request_execution(uuid,uuid,uuid,backoffice.data_request_type,text)":
    "influx_identity_definer",
  "privacy.read_own_export()": "influx_identity_definer",
  "privacy.download_own_export(uuid,uuid)": "influx_identity_definer",
  // 0138 (J8 commit 9: the reads of the backoffice screens, B-7, J3S-6)
  "identity.backoffice_session_state(uuid)": "influx_identity_definer",
  "identity.signal_new_backoffice_browser(uuid)": "influx_identity_definer",
  "backoffice.new_browser_sign_ins(integer)": "influx_identity_definer",
  // 0142 (J9 commit 1, J8S-4). influx.current_session_id() and the rewritten
  // identity.assert_fresh_second_factor() are SECURITY INVOKER.
  "backoffice.admin_role_grants(integer)": "influx_identity_definer",
  // 0144 (J9 commit 3, C5.c). The restated identity.consume_member_reauthentication() stays
  // SECURITY INVOKER; ops.filter_auth_orphans() keeps its 0117 line.
  "identity.email_change_holder_is_orphan(uuid,uuid)":
    "influx_identity_definer",
  // 0145 (J9 D67-a, 05 RG163): the journal trigger of leads.sync_settings, the only writer of
  // settings.changed for it; leads.guard_sync_setting_write() is SECURITY INVOKER (migration role).
  "leads.journal_sync_setting_change()": "influx_leads_definer",
  // 0147 (J9 commit 8, D60). ops.iso_utc() and ops.threshold_int() are SECURITY INVOKER helpers
  // of the same owner; ops.guard_worker_heartbeat_update() is a trigger of the migration role.
  "ops.record_worker_heartbeat(text,text,text,timestamp with time zone,boolean)":
    "influx_maintenance_definer",
  "ops.record_probe_results(text,jsonb)": "influx_maintenance_definer",
  "ops.record_database_sample()": "influx_maintenance_definer",
  "ops.begin_alert_round(text)": "influx_maintenance_definer",
  "ops.save_alert_states(text,jsonb)": "influx_maintenance_definer",
  "ops.worker_liveness()": "influx_maintenance_definer",
  "ops.technical_alert_snapshot(timestamp with time zone)":
    "influx_maintenance_definer",
  "ops.admin_alert_recipients()": "influx_maintenance_definer",
  "ops.run_ops_retention(uuid,smallint)": "influx_maintenance_definer",
  "identity.record_code_failure(bytea)": "influx_identity_definer",
  // 0150 (D72): the member authorisation of an erasure; the read of the address of its e-mail
  "identity.submit_member_erasure()": "influx_identity_definer",
  "privacy.read_erasure_notification_subject(uuid)": "influx_privacy_definer",
  // 0203 (L2B commit 06): the brand's submission (EC-L2B-06-1); the helper
  // profiles.advertiser_missing_required_fields() is SECURITY INVOKER, same owner.
  "profiles.submit_own_advertiser_profile()": "influx_identity_definer",
  // 0204 (L2B commit 08): the five doors of the brand logo (stockage.md §3)
  "profiles.begin_brand_logo_upload(integer)": "influx_identity_definer",
  "profiles.discard_brand_logo_upload(uuid)": "influx_identity_definer",
  "profiles.fail_brand_logo_upload(uuid)": "influx_identity_definer",
  "profiles.activate_brand_logo(uuid,integer,integer,integer)":
    "influx_identity_definer",
  "profiles.remove_own_brand_logo()": "influx_identity_definer",
  // 0209 (L2C commit 06, file.md A4): the member door of RG9, the lead.updated of an immediate
  // change, and what the guard asks; the guard itself is SECURITY INVOKER.
  "profiles.moderated_field_is_active(text)": "influx_identity_definer",
  "profiles.submit_own_advertiser_revision(text,jsonb)":
    "influx_identity_definer",
  "profiles.record_own_advertiser_profile_change()": "influx_identity_definer",
  // 0205 (L2B commit 09): the task storage_purge (stockage.md §7); ops.claim_periodic_run() keeps
  // its 0117 line.
  "ops.claim_storage_purges(uuid,smallint,integer)":
    "influx_maintenance_definer",
  "ops.complete_storage_purges(uuid,smallint,uuid[])":
    "influx_maintenance_definer",
  "ops.purge_storage_usage(uuid,smallint)": "influx_maintenance_definer",
  // 0210 (L2C commit 07, file.md A5): the six decisions of queue 1.
  // profiles.require_review_agent() is SECURITY INVOKER, same owner.
  "profiles.open_advertiser_review_entry(uuid)": "influx_moderation_definer",
  "profiles.release_advertiser_review_entry(uuid)": "influx_moderation_definer",
  "profiles.extend_advertiser_review_claim(uuid)": "influx_moderation_definer",
  "profiles.force_release_advertiser_review_claim(uuid,text)":
    "influx_moderation_definer",
  "profiles.publish_advertiser_review_entry(uuid,text,text)":
    "influx_moderation_definer",
  "profiles.reject_advertiser_review_entry(uuid,text,text,text,text)":
    "influx_moderation_definer",
  // 0211 (L2C commit 09a): the worker's read of the brand decision e-mail.
  "leads.read_brevo_profile_decision(bigint,text)": "influx_leads_definer",
  // 0212 (L2C commit 10): the worker's read of the brand attributes of a contact.
  "leads.read_brand_profile_attributes(bigint,text)": "influx_leads_definer",
  // 0213 (L2C commit 18a): the journaled read of a brand logo by an internal reader of queue 1.
  "profiles.read_advertiser_review_logo(uuid,uuid)":
    "influx_moderation_definer",
};

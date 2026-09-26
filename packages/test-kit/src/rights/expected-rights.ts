// THE table of expected rights of T2 (docs/mvp/18 T2, 21 J2 point 6), derived from the matrix of
// docs/mvp/03 §3 and the GRANTs of migrations 0001 to 0008 (reviewed by expert-cybersecurite on
// 2026-09-26, 21 J2 "Revue de sécurité des migrations").
//
// Rules (18 T2):
// 1. one column per POSTGRES role; the `service` column of 03 §3 is split between influx_auth and
//    influx_worker, which have NO table right at J2 (their rights arrive with 0108, J3);
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

/** Postgres roles taken at execution time at J2 (18 T2.1). */
export const PROBED_ROLES = [
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_auth",
  "influx_worker",
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
    ),
  },
  {
    table: "identity.agent_profiles",
    source: "0004 §6.3",
    probeColumn: "account_id",
    expected: forRoles(INTERNAL, {
      select: {
        form: "autorisé",
        source: "0004 §6.3 (internal information, never for a member)",
      },
    }),
  },
  {
    table: "identity.sessions",
    source: "0004 §6.4",
    probeColumn: "id",
    ownerColumn: "account_id",
    expected: forRoles(BUSINESS, {
      select: {
        form: "propre",
        source: "03 §3.1 « Sessions — lister les siennes » S",
      },
    }),
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
];

/** Schemas of ours (0001): T2.2 enumerates their tables. */
export const OUR_SCHEMAS = [
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
 * after 0001-0008 and reviewed line by line against 03 §3 and P7 on 2026-09-26.
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
  "influx_admin|column|identity.sessions.id|SELECT",
  "influx_admin|column|identity.sessions.idle_expires_at|SELECT",
  "influx_admin|column|identity.sessions.last_activity_at|SELECT",
  "influx_admin|column|identity.sessions.revocation_reason|SELECT",
  "influx_admin|column|identity.sessions.revoked_at|SELECT",
  "influx_admin|column|identity.sessions.surface|SELECT",
  "influx_admin|column|identity.sessions.updated_at|SELECT",
  "influx_admin|column|identity.sessions.user_agent_summary|SELECT",
  "influx_admin|function|identity.grant_role(uuid,identity.account_role,text)|EXECUTE",
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
  "influx_advertiser|column|identity.accounts.email|SELECT",
  "influx_advertiser|column|identity.accounts.email_verified_at|SELECT",
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
  "influx_advertiser|column|identity.sessions.id|SELECT",
  "influx_advertiser|column|identity.sessions.idle_expires_at|SELECT",
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
  "influx_agent|column|identity.sessions.id|SELECT",
  "influx_agent|column|identity.sessions.idle_expires_at|SELECT",
  "influx_agent|column|identity.sessions.last_activity_at|SELECT",
  "influx_agent|column|identity.sessions.revocation_reason|SELECT",
  "influx_agent|column|identity.sessions.revoked_at|SELECT",
  "influx_agent|column|identity.sessions.surface|SELECT",
  "influx_agent|column|identity.sessions.updated_at|SELECT",
  "influx_agent|column|identity.sessions.user_agent_summary|SELECT",
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
  "influx_audit_writer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_audit_writer|function|audit.payload_hash(text,bigint,timestamp with time zone,timestamp with time zone,text,audit.actor_type,uuid,text,uuid,jsonb,text)|EXECUTE",
  "influx_audit_writer|schema|audit|USAGE",
  "influx_audit_writer|table|audit.audit_events|INSERT,SELECT",
  "influx_creator|column|identity.account_roles.account_id|SELECT",
  "influx_creator|column|identity.account_roles.created_at|SELECT",
  "influx_creator|column|identity.account_roles.granted_at|SELECT",
  "influx_creator|column|identity.account_roles.role|SELECT",
  "influx_creator|column|identity.accounts.adult_attested_at|SELECT",
  "influx_creator|column|identity.accounts.country_code|SELECT",
  "influx_creator|column|identity.accounts.created_at|SELECT",
  "influx_creator|column|identity.accounts.display_name|SELECT,UPDATE",
  "influx_creator|column|identity.accounts.email|SELECT",
  "influx_creator|column|identity.accounts.email_verified_at|SELECT",
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
  "influx_creator|column|identity.sessions.id|SELECT",
  "influx_creator|column|identity.sessions.idle_expires_at|SELECT",
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
  "influx_identity_definer|function|audit.append(text,text,uuid,jsonb)|EXECUTE",
  "influx_identity_definer|function|identity.grant_role(uuid,identity.account_role,text)|EXECUTE",
  "influx_identity_definer|function|influx.current_aal()|EXECUTE",
  "influx_identity_definer|function|influx.current_account_id()|EXECUTE",
  "influx_identity_definer|function|influx.current_account_role()|EXECUTE",
  "influx_identity_definer|function|influx.has_aal2()|EXECUTE",
  "influx_identity_definer|schema|audit|USAGE",
  "influx_identity_definer|schema|identity|USAGE",
  "influx_identity_definer|schema|influx|USAGE",
  "influx_session_resolver|column|identity.account_roles.account_id|SELECT",
  "influx_session_resolver|column|identity.account_roles.role|SELECT",
  "influx_session_resolver|column|identity.accounts.id|SELECT",
  "influx_session_resolver|column|identity.accounts.status|SELECT",
  "influx_session_resolver|column|identity.agent_profiles.account_id|SELECT",
  "influx_session_resolver|column|identity.agent_profiles.is_active|SELECT",
  "influx_session_resolver|column|identity.sessions.aal|SELECT",
  "influx_session_resolver|column|identity.sessions.absolute_expires_at|SELECT",
  "influx_session_resolver|column|identity.sessions.account_id|SELECT",
  "influx_session_resolver|column|identity.sessions.id|SELECT",
  "influx_session_resolver|column|identity.sessions.idle_expires_at|SELECT",
  "influx_session_resolver|column|identity.sessions.revoked_at|SELECT",
  "influx_session_resolver|column|identity.sessions.surface|SELECT",
  "influx_session_resolver|column|identity.sessions.token_hash|SELECT",
  "influx_session_resolver|function|identity.resolve_session(bytea)|EXECUTE",
  "influx_session_resolver|schema|identity|USAGE",
];

/** T4.2, T4.3: the closed list of 03 P7 at J2 (twelve roles), memberships of each. */
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
  influx_advertiser: { login: false, memberOf: [] },
  influx_creator: { login: false, memberOf: [] },
  influx_agent: { login: false, memberOf: [] },
  influx_admin: { login: false, memberOf: [] },
  influx_auth: { login: false, memberOf: [] },
  influx_worker: { login: false, memberOf: [] },
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
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_auth",
  "influx_worker",
] as const;

/** T4.4: every SECURITY DEFINER function of our schemas, with its owner. */
export const SECURITY_DEFINER_FUNCTIONS: Readonly<Record<string, string>> = {
  "audit.append(text,text,uuid,jsonb)": "influx_audit_writer",
  "identity.resolve_session(bytea)": "influx_session_resolver",
  "identity.grant_role(uuid,identity.account_role,text)":
    "influx_identity_definer",
};

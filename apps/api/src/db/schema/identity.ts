// Schema `identity`, migrations 0002 (account_role), 0004 and 0005. The SQL is the source of
// truth: this file is aligned by hand and checked against the catalogue by
// db-tests/drizzle-schema.test.ts. Declaring a column here grants nothing: every read and write
// stays subject to the GRANTs and policies of the role taken (03 P2).
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  inet,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea } from "./column-types.ts";

export const identity = pgSchema("identity");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const accountRole = identity.enum("account_role", [
  "advertiser",
  "creator",
  "agent",
  "admin",
]);
export const accountStatus = identity.enum("account_status", [
  "active",
  "suspended",
  "deleted",
]);
export const sessionSurface = identity.enum("session_surface", [
  "member",
  "backoffice",
]);
export const sessionAal = identity.enum("session_aal", ["aal1", "aal2"]);
export const sessionRevocationReason = identity.enum(
  "session_revocation_reason",
  [
    "logout",
    "revoked_by_holder",
    "revoked_by_admin",
    "account_suspended",
    "role_changed",
    "account_deleted",
    "mfa_reset",
  ],
);
export const documentKind = identity.enum("document_kind", [
  "terms_of_service",
  "privacy_policy",
  "cookie_policy",
  "supervision_notice",
]);
export const acceptanceNature = identity.enum("acceptance_nature", [
  "acceptance",
  "acknowledgement",
]);
export const acceptanceChannel = identity.enum("acceptance_channel", [
  "signup",
  "re_acceptance",
  "introduction_screen",
  "supervision_notice_screen",
]);
export const consentPurpose = identity.enum("consent_purpose", [
  "marketing_email",
  "commercial_prospection",
]);
export const consentSource = identity.enum("consent_source", [
  "signup_form",
  "account_settings",
  "brevo_webhook",
  "apollo_optout",
  "backoffice",
  "data_request",
]);

export const accounts = identity.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull(),
  email: text("email").notNull(),
  emailVerifiedAt: timestamptz("email_verified_at"),
  countryCode: char("country_code", { length: 2 }).notNull(),
  preferredLanguage: char("preferred_language", { length: 2 }).notNull(),
  preferredLanguageIsUi: boolean("preferred_language_is_ui")
    .notNull()
    .generatedAlwaysAs(sql`true`),
  timezone: text("timezone").notNull().default("UTC"),
  displayName: text("display_name"),
  status: accountStatus("status").notNull().default("active"),
  ownerAgentId: uuid("owner_agent_id"),
  ownerIsInternal: boolean("owner_is_internal")
    .notNull()
    .generatedAlwaysAs(sql`true`),
  isAdultAttested: boolean("is_adult_attested").notNull().default(false),
  adultAttestedAt: timestamptz("adult_attested_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  suspendedAt: timestamptz("suspended_at"),
  deletedAt: timestamptz("deleted_at"),
  anonymizedAt: timestamptz("anonymized_at"),
  lastSeenAt: timestamptz("last_seen_at"),
});

export const accountRoles = identity.table(
  "account_roles",
  {
    accountId: uuid("account_id").notNull(),
    role: accountRole("role").notNull(),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
    grantedByAccountId: uuid("granted_by_account_id"),
    isInternal: boolean("is_internal")
      .notNull()
      .generatedAlwaysAs(sql`role in ('agent', 'admin')`),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.role] })],
);

export const agentProfiles = identity.table("agent_profiles", {
  accountId: uuid("account_id").primaryKey(),
  isInternal: boolean("is_internal")
    .notNull()
    .generatedAlwaysAs(sql`true`),
  firstName: text("first_name"),
  jobTitle: text("job_title"),
  invitedByAccountId: uuid("invited_by_account_id"),
  invitedAt: timestamptz("invited_at"),
  activatedAt: timestamptz("activated_at"),
  mfaEnrolledAt: timestamptz("mfa_enrolled_at"),
  requiresReassignment: boolean("requires_reassignment")
    .notNull()
    .default(false),
  isActive: boolean("is_active").notNull().default(true),
  deactivatedAt: timestamptz("deactivated_at"),
  deactivatedByAccountId: uuid("deactivated_by_account_id"),
  isBreakGlass: boolean("is_break_glass").notNull().default(false),
  absenceFrom: date("absence_from"),
  absenceTo: date("absence_to"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const sessions = identity.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenHash: bytea("token_hash").notNull(),
  accountId: uuid("account_id").notNull(),
  surface: sessionSurface("surface").notNull(),
  aal: sessionAal("aal").notNull().default("aal1"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  lastActivityAt: timestamptz("last_activity_at").notNull().defaultNow(),
  idleExpiresAt: timestamptz("idle_expires_at").notNull(),
  absoluteExpiresAt: timestamptz("absolute_expires_at").notNull(),
  revokedAt: timestamptz("revoked_at"),
  revocationReason: sessionRevocationReason("revocation_reason"),
  userAgentSummary: text("user_agent_summary"),
  countryCode: char("country_code", { length: 2 }),
});

export const termsVersions = identity.table("terms_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentKind: documentKind("document_kind").notNull(),
  locale: char("locale", { length: 2 }).notNull(),
  versionLabel: text("version_label").notNull(),
  contentUri: text("content_uri").notNull(),
  contentHash: bytea("content_hash").notNull(),
  requiresAcceptance: boolean("requires_acceptance").notNull(),
  publishedAt: timestamptz("published_at").notNull(),
  effectiveFrom: timestamptz("effective_from").notNull(),
  effectiveTo: timestamptz("effective_to"),
  /** Exact text, served by identity.terms_in_force() (0109, 21 EC-62); NULL on inherited rows. */
  content: text("content"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const termsAcceptances = identity.table("terms_acceptances", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  termsVersionId: uuid("terms_version_id").notNull(),
  contentHash: bytea("content_hash").notNull(),
  acceptedAt: timestamptz("accepted_at").notNull().defaultNow(),
  nature: acceptanceNature("nature").notNull().default("acceptance"),
  channel: acceptanceChannel("channel").notNull(),
  introductionId: uuid("introduction_id"),
  locale: char("locale", { length: 2 }).notNull(),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const consentEvents = identity.table("consent_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  purpose: consentPurpose("purpose").notNull(),
  granted: boolean("granted").notNull(),
  source: consentSource("source").notNull(),
  occurredAt: timestamptz("occurred_at").notNull().defaultNow(),
  evidence: jsonb("evidence").notNull().default({}),
  recordedByAccountId: uuid("recorded_by_account_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

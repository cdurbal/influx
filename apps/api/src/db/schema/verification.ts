// Schema `verification`, migrations 0221 and 0222 (L2E commits 05 and 06, jalons/l2e/modele.md
// §3), then 0230 to 0234 (L2F). The SQL is the source of truth: this file is aligned by hand, never generated. Declaring a
// column grants nothing: influx_advertiser holds no right on this schema, USAGE included (fiche
// invariant 1, EC-L2E-18, 04 §7.5); nobody writes these tables directly, only the functions of
// 0222 to 0224.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  integer,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea } from "./column-types.ts";
import { profiles } from "./profiles.ts";

export const verification = pgSchema("verification");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const badgeLevel = verification.enum("badge_level", [
  "account_verified",
  "audience_verified",
  "brand_verified",
]);

export const requestStatus = verification.enum("request_status", [
  "draft",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "expired",
  "closed",
]);

export const badgeState = verification.enum("badge_state", [
  "active",
  "to_refresh",
  "to_reconfirm",
  "expired",
  "revoked",
  "replaced",
]);

export const evidenceState = verification.enum("evidence_state", [
  "pending",
  "active",
  "purging",
  "purged",
]);

/** 08 RG57 (creator) and EC-L2E-11 (brand): two closed lists, key (population, code). */
export const rejectionReasons = verification.table(
  "rejection_reasons",
  {
    population: text("population").notNull(),
    code: text("code").notNull(),
    labelKey: text("label_key").notNull(),
    messageKey: text("message_key").notNull(),
    requiresMemberMessage: boolean("requires_member_message")
      .notNull()
      .default(false),
    escalatesToAdmin: boolean("escalates_to_admin").notNull().default(false),
    purgesEvidence: boolean("purges_evidence").notNull().default(false),
    position: smallint("position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.population, table.code] })],
);

/**
 * 08 RG73 (creator, five) and 06 RG55 (brand) since 0231: the reasons of a withdrawal, each with
 * the levels it may withdraw (04 l. 1627, l2f/textes.md).
 */
export const revocationReasons = verification.table("revocation_reasons", {
  code: text("code").primaryKey(),
  labelKey: text("label_key").notNull(),
  messageKey: text("message_key").notNull(),
  // 0231: renamed from requires_comment (terms_breach requires a message to the member)
  requiresMemberMessage: boolean("requires_member_message")
    .notNull()
    .default(false),
  notifiesMember: boolean("notifies_member").notNull().default(true),
  escalatesToAdmin: boolean("escalates_to_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  levels: badgeLevel("levels").array().notNull(),
  position: smallint("position").notNull().unique(),
});

/** 06 RG52, D79 (12), l2e/registres.md: the free public registers, one active per
 * (country, subdivision) since 0229. */
export const registrySources = verification.table("registry_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryCode: char("country_code", { length: 2 }),
  // 0229 (L2E-US): a subdivision of reference.regions of the same country, or NULL (the whole country)
  subdivisionCode: text("subdivision_code"),
  sourceType: text("source_type").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  checkedOn: date("checked_on").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  updatedByAccountId: uuid("updated_by_account_id"),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** 0234 (D83 (5); l2f/textes.md « Ouverture »): why an agent opens the verification of a member. */
export const openingReasons = verification.table("opening_reasons", {
  code: text("code").primaryKey(),
  labelKey: text("label_key").notNull(),
  requiresComment: boolean("requires_comment").notNull().default(false),
  position: smallint("position").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

/** 0234 (D83 A-bis): the consumer mailboxes, which never prove the domain of a brand. */
export const consumerEmailDomains = verification.table(
  "consumer_email_domains",
  {
    domain: text("domain").primaryKey(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
);

/** Queue 4 (D81): one request per (account, network line, level). */
export const verificationRequests = verification.table(
  "verification_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull(),
    socialAccountId: uuid("social_account_id"),
    networkCode: text("network_code"),
    level: badgeLevel("level").notNull(),
    population: text("population")
      .notNull()
      .generatedAlwaysAs(
        sql`case when level = 'brand_verified' then 'brand' else 'creator' end`,
      ),
    status: requestStatus("status").notNull().default("draft"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    submittedAt: timestamptz("submitted_at"),
    slaDueAt: timestamptz("sla_due_at"),
    escalateAt: timestamptz("escalate_at"),
    claimedByAccountId: uuid("claimed_by_account_id"),
    claimedAt: timestamptz("claimed_at"),
    claimExpiresAt: timestamptz("claim_expires_at"),
    forcedReleaseAt: timestamptz("forced_release_at"),
    forcedReleaseByAccountId: uuid("forced_release_by_account_id"),
    forcedReleaseHolderAccountId: uuid("forced_release_holder_account_id"),
    forcedReleaseReasonCode: text("forced_release_reason_code"),
    decidedByAccountId: uuid("decided_by_account_id"),
    decidedAt: timestamptz("decided_at"),
    rejectionReasonCode: text("rejection_reason_code"),
    memberMessage: text("member_message"),
    internalComment: text("internal_comment"),
    reexamineReasonCode: text("reexamine_reason_code"),
    reexaminedAt: timestamptz("reexamined_at"),
    escalatedAt: timestamptz("escalated_at"),
    cancelledAt: timestamptz("cancelled_at"),
    closedAt: timestamptz("closed_at"),
    slaBreached: boolean("sla_breached")
      .notNull()
      .generatedAlwaysAs(
        sql`decided_at is not null and decided_at > sla_due_at`,
      ),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    // 0234 (D83 A): the origin, written at the creation; author, reason and comment frozen once written
    openedBy: text("opened_by").notNull().default("member"),
    openedByAccountId: uuid("opened_by_account_id"),
    openingReasonCode: text("opening_reason_code"),
    openingComment: text("opening_comment"),
  },
);

/** 08 RG21 to RG25: the code of a request and what the agent read on line. */
export const ownershipCodes = verification.table("ownership_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull(),
  accountId: uuid("account_id").notNull(),
  kind: text("kind").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  expiresAt: timestamptz("expires_at").notNull(),
  revokedAt: timestamptz("revoked_at"),
  observedByAccountId: uuid("observed_by_account_id"),
  observedAt: timestamptz("observed_at"),
  observedHandle: text("observed_handle"),
  observedPlatformAccountRef: text("observed_platform_account_ref"),
  observedDomain: text("observed_domain"),
  observedChannel: text("observed_channel"),
});

/**
 * D82: the rows of the evidence, written before the object (the doors of 0223); the key is never
 * read directly; `purged` once the task storage_purge removed the object, the row kept (RG86).
 */
export const evidenceFiles = verification.table("evidence_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull(),
  accountId: uuid("account_id").notNull(),
  objectKey: text("object_key")
    .notNull()
    .generatedAlwaysAs(
      sql`account_id::text || '/' || request_id::text || '/' || id::text || '.webp'`,
    ),
  state: evidenceState("state").notNull().default("pending"),
  receivedBytes: integer("received_bytes").notNull(),
  byteSize: integer("byte_size"),
  width: smallint("width"),
  height: smallint("height"),
  checksum: bytea("checksum"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  activatedAt: timestamptz("activated_at"),
  retentionDueAt: timestamptz("retention_due_at").notNull(),
  purgeRequestedAt: timestamptz("purge_requested_at"),
  purgeAttempts: smallint("purge_attempts").notNull().default(0),
  lastPurgeAttemptAt: timestamptz("last_purge_attempt_at"),
  deletedAt: timestamptz("deleted_at"),
});

/** 04 l. 1586, l. 6391: a fact, its source, a named person, a date, by network. */
export const badges = verification.table("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  socialAccountId: uuid("social_account_id"),
  networkCode: text("network_code"),
  requestId: uuid("request_id").notNull(),
  level: badgeLevel("level").notNull(),
  grantedByAccountId: uuid("granted_by_account_id").notNull(),
  grantedAt: timestamptz("granted_at").notNull(),
  evidenceSource: text("evidence_source").notNull(),
  registrySourceId: uuid("registry_source_id"),
  observedFollowers: bigint("observed_followers", { mode: "number" }),
  observedPostsLast30Days: integer("observed_posts_last_30_days"),
  observedAvgComments: bigint("observed_avg_comments", { mode: "number" }),
  observedEngagementBp: integer("observed_engagement_bp"),
  observedPeriodStart: date("observed_period_start"),
  observedPeriodEnd: date("observed_period_end"),
  declaredFollowersAtDecision: bigint("declared_followers_at_decision", {
    mode: "number",
  }),
  declaredPostsAtDecision: integer("declared_posts_at_decision"),
  declaredCommentsAtDecision: bigint("declared_comments_at_decision", {
    mode: "number",
  }),
  declaredEngagementBpAtDecision: integer("declared_engagement_bp_at_decision"),
  observedHandleAtDecision: text("observed_handle_at_decision"),
  observedPlatformAccountRef: text("observed_platform_account_ref"),
  expiresAt: timestamptz("expires_at"),
  state: badgeState("state").notNull().default("active"),
  revokedAt: timestamptz("revoked_at"),
  revocationReasonCode: text("revocation_reason_code"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  // 0230 (L2F commit 05): the reminder sent once, the end (trigger stamp_badge_end), the findings
  // erased after the retention (08 RG100)
  reminderSentAt: timestamptz("reminder_sent_at"),
  endedAt: timestamptz("ended_at"),
  findingsErasedAt: timestamptz("findings_erased_at"),
  // 0231 (L2F commit 06): the withdrawal under 2V that revoked it (NULL for the erasure of 0226)
  revocationRequestId: uuid("revocation_request_id"),
  // 0232 (L2F commit 07): the contest whose overturn granted it (08 CA53)
  disputeId: uuid("dispute_id"),
});

/** 0232 (L2F commit 07, modele §2): the life of a contest of queue 5. */
export const disputeState = verification.enum("dispute_state", [
  "open",
  "upheld",
  "overturned",
  "withdrawn",
]);

/** 0232 (08 RG77, écart 4; l2f/textes.md « Contestation »): the creator's closed list. */
export const disputeReasons = verification.table("dispute_reasons", {
  code: text("code").primaryKey(),
  labelKey: text("label_key").notNull(),
  requiresText: boolean("requires_text").notNull().default(false),
  position: smallint("position").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

/** 0232 (l2f/textes.md « Issue »): the reason of an outcome, tied to its outcome. */
export const disputeOutcomeReasons = verification.table(
  "dispute_outcome_reasons",
  {
    code: text("code").primaryKey(),
    outcome: disputeState("outcome").notNull(),
    labelKey: text("label_key").notNull(),
    messageKey: text("message_key").notNull(),
    requiresMemberMessage: boolean("requires_member_message")
      .notNull()
      .default(false),
    position: smallint("position").notNull().unique(),
    isActive: boolean("is_active").notNull().default(true),
  },
);

/**
 * 0232 (L2F commit 07; 08 RG77, CA52, CA53; file.md A1): queue 5, the contest of a refusal
 * (requestId) or of a withdrawal (badgeId), once per decision; the deciders frozen at the
 * submission, the lock, the deadlines, the outcome. Written by the creator door and the functions
 * of influx_verification_definer only.
 */
export const disputes = verification.table("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  requestId: uuid("request_id").unique(),
  badgeId: uuid("badge_id").unique(),
  level: badgeLevel("level").notNull(),
  networkCode: text("network_code").notNull(),
  reasonCode: text("reason_code").notNull(),
  text: text("text"),
  submittedAt: timestamptz("submitted_at").notNull().defaultNow(),
  slaDueAt: timestamptz("sla_due_at").notNull(),
  escalateAt: timestamptz("escalate_at").notNull(),
  state: disputeState("state").notNull().default("open"),
  originalDeciderIds: uuid("original_decider_ids").array().notNull(),
  claimedByAccountId: uuid("claimed_by_account_id"),
  claimedAt: timestamptz("claimed_at"),
  claimExpiresAt: timestamptz("claim_expires_at"),
  forcedReleaseAt: timestamptz("forced_release_at"),
  forcedReleaseByAccountId: uuid("forced_release_by_account_id"),
  forcedReleaseHolderAccountId: uuid("forced_release_holder_account_id"),
  forcedReleaseReasonCode: text("forced_release_reason_code"),
  decidedByAccountId: uuid("decided_by_account_id"),
  decidedAt: timestamptz("decided_at"),
  outcomeReasonCode: text("outcome_reason_code"),
  memberMessage: text("member_message"),
  internalComment: text("internal_comment"),
  reviewMode: text("review_mode"),
  withdrawnCause: text("withdrawn_cause"),
  closedAt: timestamptz("closed_at"),
  slaBreached: boolean("sla_breached")
    .notNull()
    .generatedAlwaysAs(sql`decided_at is not null and decided_at > sla_due_at`),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  textsErasedAt: timestamptz("texts_erased_at"),
});

/** 0233 (L2F commit 08, modele §2): the life of an entry of queue 6. */
export const identifierReviewState = verification.enum(
  "identifier_review_state",
  ["open", "confirmed", "proof_required", "withdrawn"],
);

/**
 * 0233 (L2F commit 08; 08 RG78, CA54; file.md A1): queue 6, a handle changed on a line holding an
 * active « Compte vérifié »; one open entry per line, updated at each change. The handles are
 * internal, never public. Written by the triggers of the line and the functions of
 * influx_verification_definer only; no right for any member.
 */
export const identifierChangeReviews = verification.table(
  "identifier_change_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull(),
    // no foreign key: the line may be deleted, the entry stays
    socialAccountId: uuid("social_account_id").notNull(),
    networkCode: text("network_code").notNull(),
    badgeId: uuid("badge_id").notNull(),
    previousHandle: text("previous_handle"),
    newHandle: text("new_handle"),
    changeCount: integer("change_count").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastChangedAt: timestamptz("last_changed_at").notNull().defaultNow(),
    slaDueAt: timestamptz("sla_due_at").notNull(),
    escalateAt: timestamptz("escalate_at").notNull(),
    state: identifierReviewState("state").notNull().default("open"),
    claimedByAccountId: uuid("claimed_by_account_id"),
    claimedAt: timestamptz("claimed_at"),
    claimExpiresAt: timestamptz("claim_expires_at"),
    forcedReleaseAt: timestamptz("forced_release_at"),
    forcedReleaseByAccountId: uuid("forced_release_by_account_id"),
    forcedReleaseHolderAccountId: uuid("forced_release_holder_account_id"),
    forcedReleaseReasonCode: text("forced_release_reason_code"),
    decidedByAccountId: uuid("decided_by_account_id"),
    decidedAt: timestamptz("decided_at"),
    observedHandle: text("observed_handle"),
    internalComment: text("internal_comment"),
    withdrawnCause: text("withdrawn_cause"),
    closedAt: timestamptz("closed_at"),
    slaBreached: boolean("sla_breached")
      .notNull()
      .generatedAlwaysAs(
        sql`decided_at is not null and decided_at > sla_due_at`,
      ),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    textsErasedAt: timestamptz("texts_erased_at"),
  },
);

/**
 * 0231 (L2F commit 06, 08 RG75, 03 §3.2 2V): the request of a withdrawal, keyed by its request of
 * dual control (payload {account_id, badge_id, reason_code}); the message to the member lives here,
 * never in the payload nor the register. Written by the functions of influx_verification_definer
 * only; nothing for a member.
 */
export const badgeRevocationRequests = verification.table(
  "badge_revocation_requests",
  {
    dualControlRequestId: uuid("dual_control_request_id").primaryKey(),
    badgeId: uuid("badge_id").notNull(),
    accountId: uuid("account_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    memberMessage: text("member_message"),
    requestedByAccountId: uuid("requested_by_account_id").notNull(),
    requestedAt: timestamptz("requested_at").notNull().defaultNow(),
    executedByAccountId: uuid("executed_by_account_id"),
    executedAt: timestamptz("executed_at"),
    textsErasedAt: timestamptz("texts_erased_at"),
  },
);

/**
 * 0222 (L2E commit 06, 06 RG46 to RG48): the internal block of a brand, in the schema `profiles`
 * but declared here, with the verification it serves (TM11 keeps its fields in this module). Never
 * read by a creator, Brevo, Apollo nor influx_leads_definer; written by the brand door only.
 */
export const advertiserInternalDetails = profiles.table(
  "advertiser_internal_details",
  {
    accountId: uuid("account_id").primaryKey(),
    legalName: text("legal_name").notNull(),
    registrationCountryCode: char("registration_country_code", {
      length: 2,
    }).notNull(),
    registrationNumber: text("registration_number").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
);

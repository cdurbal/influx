// Contract of the action API of the backoffice v0 (docs/mvp/05 §K RG81, RG93, RG101 to RG104,
// RG108, CA58 to CA63; 15 §F; 03 §1.3 PD1 to PD7; 17b §3.11, §3.13.c; 21 §J8 commit 6). Shared by
// apps/api and apps/backoffice.
// - Replay (RG101 to RG103): a selection of (account, destination) pairs, never an internal line id
//   (0101 "never exposed"). At most REPLAY_BATCH_CAP pairs and lines per operation; the surplus is
//   refused and said (CA59). A pair skipped for want of consent is never replayed (RG103, CA60).
// - Corrections (RG108): status, country, language, by an agent or an admin, with a typed reason.
//   The role is changed by an admin only, under a dual control (identity.change_member_role).
// - Dual control: the request, the view (who may do what now), the confirmation (with the action,
//   in one transaction, under a fresh second factor) and the cancellation. Admin only.
// - Apollo settings (RG81, RG83, RG84): admin only, each change under a dual control.
// - Brevo suppression (RG93): lifted by an admin, with a fresh second factor and a typed reason.
// - Alerts (RG104, CA62; 15 §F): state alerts, derived at each read; codes for the screen to word.
// Every reason is a closed list (backoffice-ops rule 10); the free comment is a complement only.
import * as z from "zod";
import { syncDestinationSchema } from "./backoffice-accounts.ts";
import { INTERNAL_INVITATION_REASONS } from "./backoffice-invitations.ts";
import { uiLocaleSchema } from "./auth.ts";
import { countryCodeSchema, declaredStatusSchema } from "./signup.ts";
import { USER_AGENT_SUMMARY_KEY_PATTERN } from "./user-agent.ts";

const commentSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^\p{Cc}]*$/u);

export const accountActionParamsSchema = z.strictObject({ id: z.uuid() });
export type AccountActionParams = z.infer<typeof accountActionParamsSchema>;

// ---------------------------------------------------------------------------------------------
// Replay (05 RG101 to RG103, CA58 to CA61; 15 RG29, RG30)
// ---------------------------------------------------------------------------------------------

/** 05 RG101: the cap of one replay, in pairs and in queue lines. */
export const REPLAY_BATCH_CAP = 200;
/** The largest selection a request may carry: beyond the cap, the surplus is refused (CA59). */
export const REPLAY_SELECTION_MAX = 500;

/** The reasons of a replay (0132 leads.replay_outbox_lines). */
export const REPLAY_REASONS = [
  "provider_recovered",
  "configuration_fixed",
  "data_corrected",
  "quota_restored",
  "transient_failure",
] as const;

export const replayRequestSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        accountId: z.uuid(),
        destination: syncDestinationSchema,
      }),
    )
    .min(1)
    .max(REPLAY_SELECTION_MAX),
  reasonCode: z.enum(REPLAY_REASONS),
});
export type ReplayRequest = z.infer<typeof replayRequestSchema>;

/**
 * The outcome of one pair. requeued: its failed lines are back in the queue, same idempotency key
 * (RG102). Ignored: already_in_progress (CA61 "déjà en cours de traitement"), already_synced.
 * Refused: no_consent (RG103, CA60: not an error, a new consent produces the synchronisation),
 * normal_case (RG100), nothing_to_replay (no failed line), over_cap (CA59).
 */
export const REPLAY_OUTCOMES = [
  "requeued",
  "already_in_progress",
  "already_synced",
  "no_consent",
  "normal_case",
  "nothing_to_replay",
  "over_cap",
] as const;
export type ReplayOutcome = (typeof REPLAY_OUTCOMES)[number];

export const replayResponseSchema = z.strictObject({
  /** The journaled operation (leads.replay_requested); null when no line was submitted. */
  replayId: z.uuid().nullable(),
  /** RG101: the numbered report. */
  requested: z.number().int().nonnegative(),
  requeued: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
  refused: z.number().int().nonnegative(),
  items: z.array(
    z.strictObject({
      accountId: z.uuid(),
      destination: syncDestinationSchema,
      outcome: z.enum(REPLAY_OUTCOMES),
      /** Queue lines put back for this pair. */
      lines: z.number().int().nonnegative(),
    }),
  ),
});
export type ReplayResponse = z.infer<typeof replayResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Corrections (05 RG108; 15 RG44)
// ---------------------------------------------------------------------------------------------

export const CORRECTION_REASONS = [
  "member_request",
  "signup_error",
  "document_check",
  "data_quality",
] as const;

export const correctionRequestSchema = z
  .strictObject({
    reasonCode: z.enum(CORRECTION_REASONS),
    declaredStatus: declaredStatusSchema.optional(),
    countryCode: countryCodeSchema.optional(),
    preferredLanguage: uiLocaleSchema.optional(),
    comment: commentSchema.optional(),
  })
  .refine(
    (body) =>
      body.declaredStatus !== undefined ||
      body.countryCode !== undefined ||
      body.preferredLanguage !== undefined,
    { message: "nothing_to_correct" },
  );
export type CorrectionRequest = z.infer<typeof correctionRequestSchema>;

export const correctionResponseSchema = z.strictObject({
  /** False when every value was already the one asked: nothing written, nothing journaled. */
  changed: z.boolean(),
});
export type CorrectionResponse = z.infer<typeof correctionResponseSchema>;

// ---------------------------------------------------------------------------------------------
// Apollo settings (05 RG81, RG83, RG84)
// ---------------------------------------------------------------------------------------------

export const APOLLO_SCOPES = [
  "annonceurs_seuls",
  "annonceurs_et_createurs_pro",
  "tous_les_inscrits",
] as const;
export const APOLLO_LEGAL_BASES = [
  "consentement_requis",
  "interet_legitime_avec_opposition",
] as const;

const legalBasisSchema = z.enum(APOLLO_LEGAL_BASES);

/**
 * One Apollo key and its value (0103). The legal basis by country is a list here, a JSON object in
 * the database ({"default", "by_country": {code: basis}}): a response never carries a record whose
 * keys the data chooses (21 J1-J N2); apps/api converts.
 */
export const apolloSettingSchema = z.discriminatedUnion("key", [
  z.strictObject({
    key: z.literal("apollo_scope"),
    value: z.enum(APOLLO_SCOPES),
  }),
  z.strictObject({
    key: z.literal("apollo_prospecting_countries"),
    /** RG84: an EMPTY list is an abstention, never a send by default. */
    value: z.array(countryCodeSchema).max(300),
  }),
  z.strictObject({
    key: z.literal("apollo_legal_basis"),
    value: z.strictObject({
      default: legalBasisSchema,
      byCountry: z
        .array(
          z.strictObject({
            countryCode: countryCodeSchema,
            basis: legalBasisSchema,
          }),
        )
        .max(300)
        .refine(
          (entries) =>
            new Set(entries.map((entry) => entry.countryCode)).size ===
            entries.length,
          { message: "country_twice" },
        ),
    }),
  }),
]);
export type ApolloSetting = z.infer<typeof apolloSettingSchema>;

/** The reasons of a change of an Apollo key (0134 backoffice.change_apollo_setting). */
export const APOLLO_SETTING_REASONS = [
  "founder_decision",
  "legal_validation",
  "legal_restriction",
  "configuration_error",
] as const;

export const apolloSettingsResponseSchema = z.strictObject({
  settings: z.array(
    z.strictObject({
      setting: apolloSettingSchema,
      updatedAt: z.iso.datetime(),
      /** Null for a value loaded by a migration. */
      updatedBy: z.uuid().nullable(),
    }),
  ),
});
export type ApolloSettingsResponse = z.infer<
  typeof apolloSettingsResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// Dual control (03 §1.3 PD1 to PD7; 15 RG9, RG31; 17b §3.13.c)
// ---------------------------------------------------------------------------------------------

/** 05 RG108, EC-J8-17: the role change, creator to advertiser only (0132, 0134). */
export const ROLE_CHANGE_REASONS = ["member_request", "signup_error"] as const;

const legalNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[^\p{Cc}]*$/u);

/** 15 RG75 step 6 (J8 commit 8): the execution of an instructed "mes données" request. */
export const DATA_REQUEST_EXECUTION_REASONS = ["request_instructed"] as const;

/** The two types of request the minimal execution of J8 covers (21 §J8 point 6). */
export const EXECUTABLE_DATA_REQUEST_TYPES = ["access", "erasure"] as const;

/**
 * The actions a route may request: the role change, an Apollo key, again the 2V of an admin
 * invitation (J8 commit 7: requested by its creation; again here once an earlier request expired),
 * and the execution of a "mes données" request (J8 commit 8: an admin, from the account sheet).
 */
export const dualControlRequestSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("identity.change_member_role"),
    accountId: z.uuid(),
    /** EC-J8-23: the name of the new brand, confirmed by the second pair of eyes. */
    legalName: legalNameSchema,
    reasonCode: z.enum(ROLE_CHANGE_REASONS),
    reasonNote: commentSchema.optional(),
  }),
  z.strictObject({
    code: z.literal("leads.change_apollo_setting"),
    setting: apolloSettingSchema,
    reasonCode: z.enum(APOLLO_SETTING_REASONS),
    reasonNote: commentSchema.optional(),
  }),
  z.strictObject({
    code: z.literal("identity.invite_admin"),
    invitationId: z.uuid(),
    reasonCode: z.enum(INTERNAL_INVITATION_REASONS),
    reasonNote: commentSchema.optional(),
  }),
  z.strictObject({
    code: z.literal("privacy.approve_data_request"),
    requestId: z.uuid(),
    /** Checked against the stored request by the database: the recap (PD1) depends on it. */
    requestType: z.enum(EXECUTABLE_DATA_REQUEST_TYPES),
    reasonCode: z.enum(DATA_REQUEST_EXECUTION_REASONS),
    reasonNote: commentSchema.optional(),
  }),
]);
export type DualControlRequestBody = z.infer<typeof dualControlRequestSchema>;

export const dualControlParamsSchema = z.strictObject({ id: z.uuid() });
export type DualControlParams = z.infer<typeof dualControlParamsSchema>;

/** The action of a request, as stored (every action of the closed list may be shown). */
export const dualControlActionSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("identity.grant_role"),
    accountId: z.uuid(),
    role: z.enum(["advertiser", "creator", "agent", "admin"]),
  }),
  z.strictObject({
    code: z.literal("identity.change_member_role"),
    accountId: z.uuid(),
    role: z.literal("advertiser"),
    legalName: z.string(),
  }),
  z.strictObject({
    code: z.literal("identity.invite_admin"),
    invitationId: z.uuid(),
  }),
  z.strictObject({
    code: z.literal("leads.change_apollo_setting"),
    setting: apolloSettingSchema,
  }),
  z.strictObject({
    code: z.literal("privacy.approve_data_request"),
    requestId: z.uuid(),
    requestType: z.enum(EXECUTABLE_DATA_REQUEST_TYPES),
  }),
]);

export const DUAL_CONTROL_STATES = [
  "pending",
  "confirmed",
  "degraded",
  "cancelled",
  "expired",
] as const;
export const DUAL_CONTROL_MODES = ["peer", "degraded_single_operator"] as const;

export const dualControlViewSchema = z.strictObject({
  id: z.uuid(),
  action: dualControlActionSchema,
  /** PD1: scope, consequences (codes), reversibility, said before the first gesture. */
  recap: z.strictObject({
    scope: z.strictObject({
      kind: z.enum([
        "account",
        "internal_invitation",
        "setting",
        "data_request",
      ]),
      count: z.number().int().positive(),
    }),
    consequences: z.array(z.string()),
    reversible: z.boolean(),
  }),
  reasonCode: z.string(),
  reasonNote: z.string().nullable(),
  requestedBy: z.uuid(),
  requestedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  state: z.enum(DUAL_CONTROL_STATES),
  confirmation: z
    .strictObject({
      mode: z.enum(DUAL_CONTROL_MODES),
      by: z.uuid(),
      at: z.iso.datetime(),
    })
    .nullable(),
  executed: z.boolean(),
  /** PD7: what THIS admin may do now (17b §3.13.c, two screens). */
  next: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("confirm_as_peer") }),
    z.strictObject({
      kind: z.literal("confirm_degraded"),
      confirmableAt: z.iso.datetime(),
      secondsLeft: z.number().int().nonnegative(),
    }),
    z.strictObject({ kind: z.literal("await_peer") }),
    z.strictObject({ kind: z.literal("none") }),
  ]),
});
export type DualControlViewBody = z.infer<typeof dualControlViewSchema>;

/** 03 PD4, 0130: the written justification of a confirmation made alone. */
export const DEGRADED_JUSTIFICATION_MIN = 20;
export const DEGRADED_JUSTIFICATION_MAX = 1_000;

/** GET /v1/bo/dual-control: the pending requests, newest first, at most this many. */
export const DUAL_CONTROL_LIST_CAP = 50;

export const dualControlListResponseSchema = z.strictObject({
  requests: z.array(dualControlViewSchema).max(DUAL_CONTROL_LIST_CAP),
});
export type DualControlListResponse = z.infer<
  typeof dualControlListResponseSchema
>;

export const dualControlConfirmSchema = z.strictObject({
  /** Required in the degraded mode only (PD2 to PD5); the database decides which mode applies. */
  degradedJustification: z
    .string()
    .trim()
    .min(DEGRADED_JUSTIFICATION_MIN)
    .max(DEGRADED_JUSTIFICATION_MAX)
    .regex(/^[^\p{Cc}]*$/u)
    .nullable()
    .default(null),
});
export type DualControlConfirm = z.infer<typeof dualControlConfirmSchema>;

export const dualControlConfirmResponseSchema = z.strictObject({
  mode: z.enum(DUAL_CONTROL_MODES),
  /** leads.change_apollo_setting: the accounts re-evaluated (RG81); null for the other actions. */
  reevaluated: z.number().int().nonnegative().nullable(),
});
export type DualControlConfirmResponse = z.infer<
  typeof dualControlConfirmResponseSchema
>;

export const dualControlCancelResponseSchema = z.strictObject({
  cancelled: z.literal(true),
});

// ---------------------------------------------------------------------------------------------
// Brevo suppression (05 RG93, CA55)
// ---------------------------------------------------------------------------------------------

export const SUPPRESSION_LIFT_REASONS = [
  "member_request",
  "complaint_misattributed",
  "provider_error",
] as const;

export const suppressionLiftRequestSchema = z.strictObject({
  reasonCode: z.enum(SUPPRESSION_LIFT_REASONS),
  comment: commentSchema.optional(),
});
export type SuppressionLiftRequest = z.infer<
  typeof suppressionLiftRequestSchema
>;

export const suppressionLiftResponseSchema = z.strictObject({
  /**
   * EC-J8-27: true when a consent given after the unsubscription is sent again to Brevo; false
   * when the contact waits for the member's next consent (the lift never resubscribes alone).
   */
  resyncQueued: z.boolean(),
});
export type SuppressionLiftResponse = z.infer<
  typeof suppressionLiftResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// Alerts (05 RG104, CA62; 15 §F RG63 to RG66)
// ---------------------------------------------------------------------------------------------

/** The alerts of RG104 evaluated at J8 (0130 catalogue): all state alerts, derived at each read. */
export const ALERT_CODES = ["AL24", "AL25", "AL26", "AL27"] as const;

/** Why the alert is up, a code for the screen to word (RG66: never the colour alone). */
export const ALERT_CAUSES = [
  // AL24
  "failures_past_delay",
  // AL25
  "access_key_refused",
  "quota_exceeded",
  "destination_down",
  // AL26
  "queue_late",
  // AL27
  "unsubscribe_gap",
  "reconciliation_failed",
] as const;

export const alertSchema = z.strictObject({
  code: z.enum(ALERT_CODES),
  cause: z.enum(ALERT_CAUSES),
  /** The destination concerned; null for AL27 (Brevo reconciliation, said by its code). */
  destination: syncDestinationSchema.nullable(),
  /**
   * CA62 "le nombre de lignes en attente": AL25 the lines waiting for the destination, AL24 the
   * failures past the delay, AL26 the lines late, AL27 the gap of the last reconciliation.
   */
  count: z.number().int().nonnegative(),
  /** The oldest fact behind the alert (first failure waiting, oldest late line, run end). */
  since: z.iso.datetime().nullable(),
});
export type Alert = z.infer<typeof alertSchema>;

/** B-7 (05 RG145): how many days back the admins see the "new browser" sign-ins. */
export const NEW_BROWSER_ALERT_DAYS = 7;

/**
 * B-7 (05 RG141, RG144, RG145; 17b §3.14.e): a backoffice sign-in from a browser not used on the
 * account in the last 30 days. An event, not a state: listed for NEW_BROWSER_ALERT_DAYS days. The
 * browser is a summary key ("firefox.windows"), worded by the screen; never a country (EC-43).
 */
export const newBrowserSignInSchema = z.strictObject({
  accountId: z.uuid(),
  firstName: z.string().nullable(),
  signedInAt: z.iso.datetime(),
  browser: z.string().regex(USER_AGENT_SUMMARY_KEY_PATTERN),
});
export type NewBrowserSignIn = z.infer<typeof newBrowserSignInSchema>;

export const alertsResponseSchema = z.strictObject({
  evaluatedAt: z.iso.datetime(),
  alerts: z.array(alertSchema),
  /** Admins only (RG145); always empty for an agent. 50 at most, newest first. */
  newBrowserSignIns: z.array(newBrowserSignInSchema).max(50),
});
export type AlertsResponse = z.infer<typeof alertsResponseSchema>;

// Contract of the read API of the backoffice v0 on member accounts (docs/mvp/05 §K RG97 to RG100,
// RG105, RG107; 15 RG34, RG40, RG49, RG50; 03 §3.1 "compte — lister et consulter" L · J, §3.5 C(33);
// 17b §1.5, §3.11; 21 §J8 commit 5). Shared by apps/api and apps/backoffice.
// - Only member accounts (advertiser, creator): an internal account is never listed, and its id
//   answers exactly like an unknown one (15 RG39: the internal record is another record; 18 T14.3).
// - The list carries NO address and NO name (RG97 lists none): the list is not the directory
//   (03 C(17)). The address is on the record, whose opening is journaled (RG40).
// - Pagination by cursor, capped by the server; no "everything" page (15 RG34, 02 §9.2).
// - The synchronisation state is a closed code per destination, translated by the screen (RG99,
//   D36 open): never the provider's message, never a raw error code, never an Apollo datum (RG107).
// Nothing here carries an amount, a rate or a commission (05 RG9).
import * as z from "zod";
import { signupDoorSchema, uiLocaleSchema, MAX_EMAIL_LENGTH } from "./auth.ts";
import {
  consentSourceSchema,
  DATA_REQUEST_OUTCOMES,
  DATA_REQUEST_STATUSES,
  dataRequestTypeSchema,
} from "./account.ts";
import {
  countryCodeSchema,
  declaredStatusSchema,
  heardFromSchema,
} from "./signup.ts";

/** 15 RG34: the server's cap on a page; the screen shows 20 lines (17b §3.x tables). */
export const ACCOUNTS_PAGE_SIZE_DEFAULT = 20;
export const ACCOUNTS_PAGE_SIZE_MAX = 50;

/** 05 RG98: below three characters, a partial search is a sweep, not a search. */
export const PARTIAL_SEARCH_MIN_LENGTH = 3;

/** 05 RG98, EC-J8-25: the partial searches allowed per internal account (0133, constant there). */
export const PARTIAL_SEARCH_LIMIT = 20;
export const PARTIAL_SEARCH_WINDOW_SECONDS = 900;

/** EC-31: the history page of an account record (0132 read_subject_history accepts 1 to 200). */
export const ACCOUNT_HISTORY_PAGE_SIZE = 50;

/** 05 RG105: the main countries of the day shown by name, the others summed. */
export const COUNTERS_TOP_COUNTRIES = 5;

export const ACCOUNT_STATUSES = ["active", "suspended", "deleted"] as const;
export const accountStatusSchema = z.enum(ACCOUNT_STATUSES);
export type AccountStatus = z.infer<typeof accountStatusSchema>;

export const EMAIL_STATUSES = [
  "unknown",
  "deliverable",
  "undeliverable",
] as const;
export const emailStatusSchema = z.enum(EMAIL_STATUSES);

/** The two contact destinations of a lead (05 RG75): Brevo and Apollo. */
export const SYNC_DESTINATIONS = ["brevo", "apollo"] as const;
export const syncDestinationSchema = z.enum(SYNC_DESTINATIONS);
export type SyncDestination = z.infer<typeof syncDestinationSchema>;

/**
 * The state of a contact at one destination: synced; pending (a line waits, `retryAt` when a new
 * attempt is scheduled); not_attempted (no attempt recorded, e.g. a dry run of staging); skipped
 * (a normal case, RG100); failed (to handle, RG101).
 */
export const SYNC_STATES = [
  "synced",
  "pending",
  "not_attempted",
  "skipped",
  "failed",
] as const;
export const syncStateSchema = z.enum(SYNC_STATES);
export type SyncState = z.infer<typeof syncStateSchema>;

/** 05 RG99 "Nature", RG100: a normal case is never counted, nor shown, as a failure. */
export const SYNC_NATURES = [
  "success",
  "in_progress",
  "normal_case",
  "failure",
  "incident",
] as const;
export const syncNatureSchema = z.enum(SYNC_NATURES);
export type SyncNature = z.infer<typeof syncNatureSchema>;

/**
 * 05 RG99: the cause shown in clear, a closed list translated by the screen. The raw codes of the
 * worker map onto it in apps/api (domains/backoffice/sync-causes.ts); an unknown code becomes
 * other_normal_case or other_failure, never itself.
 */
export const SYNC_CAUSES = [
  // success, in progress
  "synced",
  "waiting",
  "retry_scheduled",
  "not_attempted",
  // normal cases (skipped)
  "no_consent",
  "out_of_apollo_scope_individual",
  "out_of_apollo_scope",
  "country_excluded",
  "country_not_validated",
  "prospection_opposed",
  "email_not_verified",
  "company_not_identified",
  "account_not_active",
  "non_production",
  "configuration_missing",
  "other_normal_case",
  // failures
  "address_refused",
  "quota_exceeded",
  "service_unavailable",
  "data_refused_by_check",
  "provider_response_invalid",
  "other_failure",
  // incident
  "access_key_refused",
] as const;
export const syncCauseSchema = z.enum(SYNC_CAUSES);
export type SyncCause = z.infer<typeof syncCauseSchema>;

export const syncStatusSchema = z.strictObject({
  state: syncStateSchema,
  nature: syncNatureSchema,
  cause: syncCauseSchema,
  /** RG99 "nouvelle tentative prévue à HH:MM": set for a pending line that already failed once. */
  retryAt: z.iso.datetime().nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
});
export type SyncStatus = z.infer<typeof syncStatusSchema>;

/** 05 RG97 "consentement (valeur, date, source)": the latest marketing e-mail consent. */
export const accountConsentSchema = z.strictObject({
  granted: z.boolean(),
  occurredAt: z.iso.datetime(),
  source: consentSourceSchema,
});
export type AccountConsent = z.infer<typeof accountConsentSchema>;

/** 05 RG97, RG120, D55: the acquisition source, written once at sign-up. */
export const signupSourceSchema = z.strictObject({
  viaInvitation: z.boolean(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  referrerDomain: z.string().nullable(),
  heardFrom: heardFromSchema.nullable(),
});
export type SignupSource = z.infer<typeof signupSourceSchema>;

/** The responsible salesperson (D54): an internal account and its display name (first name). */
export const accountOwnerSchema = z.strictObject({
  accountId: z.uuid(),
  displayName: z.string().nullable(),
});

/** One line of the list (05 RG97). No address, no name. */
export const accountRowSchema = z.strictObject({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  role: signupDoorSchema,
  status: accountStatusSchema,
  countryCode: countryCodeSchema,
  preferredLanguage: uiLocaleSchema,
  declaredStatus: declaredStatusSchema,
  source: signupSourceSchema,
  consent: accountConsentSchema.nullable(),
  sync: z.strictObject({
    brevo: syncStatusSchema,
    apollo: syncStatusSchema,
  }),
  owner: accountOwnerSchema.nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
});
export type AccountRow = z.infer<typeof accountRowSchema>;

/** An opaque cursor of the list, issued by the server only. */
export const accountsCursorSchema = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/);

export const CONSENT_FILTERS = ["granted", "withdrawn"] as const;

/** The filters of RG97 (15 RG33), shared by the list and the search. Codes and instants only. */
const accountFilterShape = {
  role: signupDoorSchema.optional(),
  country: countryCodeSchema.optional(),
  language: uiLocaleSchema.optional(),
  declaredStatus: declaredStatusSchema.optional(),
  syncDestination: syncDestinationSchema.optional(),
  syncState: syncStateSchema.optional(),
  consent: z.enum(CONSENT_FILTERS).optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  cursor: accountsCursorSchema.optional(),
};

type FilterRefinable = {
  from?: string | undefined;
  to?: string | undefined;
  syncDestination?: string | undefined;
  syncState?: string | undefined;
};

const periodInOrder = (query: FilterRefinable): boolean =>
  query.from === undefined ||
  query.to === undefined ||
  Date.parse(query.from) <= Date.parse(query.to);

/** A `syncState` without `syncDestination` matches either destination; never the reverse. */
const destinationWithState = (query: FilterRefinable): boolean =>
  query.syncDestination === undefined || query.syncState !== undefined;

const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(ACCOUNTS_PAGE_SIZE_MAX)
  .default(ACCOUNTS_PAGE_SIZE_DEFAULT);

/**
 * GET /v1/bo/accounts (05 RG97): the list and its filters, NO search term. J8S-7 (EC-J8-58): an
 * address or a fragment of one never travels in a URL, where the access logs, the history and the
 * proxies keep it; the search is POST /v1/bo/accounts/search, the term in the body. A term in the
 * query string is refused (400), never ignored.
 */
export const accountsQuerySchema = z
  .strictObject({
    ...accountFilterShape,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(ACCOUNTS_PAGE_SIZE_MAX)
      .default(ACCOUNTS_PAGE_SIZE_DEFAULT),
  })
  .refine(periodInOrder, { message: "period_order" })
  .refine(destinationWithState, { message: "destination_without_state" });
export type AccountsQuery = z.infer<typeof accountsQuerySchema>;

/**
 * POST /v1/bo/accounts/search (05 RG97, RG98; J8S-7): the filters of the list and AT MOST one term,
 * all in the body. `email` is the exact address (free); `q` a fragment of it (rate-limited and
 * journaled by its length, never its text): never both. The answer is the list's. The screen lists
 * through this route: an instant of the period (`:`, `.`) is no plain character of the relay's
 * query string (EC-62), and a body carries the filters, the term and the cursor alike.
 */
export const accountsSearchSchema = z
  .strictObject({
    ...accountFilterShape,
    limit: pageSizeSchema,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(MAX_EMAIL_LENGTH)
      .pipe(z.email())
      .optional(),
    q: z
      .string()
      .trim()
      .toLowerCase()
      .min(PARTIAL_SEARCH_MIN_LENGTH)
      .max(MAX_EMAIL_LENGTH)
      .regex(/^[^\p{Cc}\s]*$/u)
      .optional(),
  })
  .refine((body) => body.email === undefined || body.q === undefined, {
    message: "exact_or_partial",
  })
  .refine(periodInOrder, { message: "period_order" })
  .refine(destinationWithState, { message: "destination_without_state" });
export type AccountsSearch = z.infer<typeof accountsSearchSchema>;
/** What a caller sends (the page size may be left to its default). */
export type AccountsSearchBody = z.input<typeof accountsSearchSchema>;

export const SEARCH_KINDS = ["none", "exact", "partial"] as const;

export const accountsResponseSchema = z.strictObject({
  items: z.array(accountRowSchema),
  /** Absent at the last page. */
  nextCursor: accountsCursorSchema.nullable(),
  /** The screen says when a search was journaled (17b §1.5). */
  search: z.enum(SEARCH_KINDS),
});
export type AccountsResponse = z.infer<typeof accountsResponseSchema>;

export const accountParamsSchema = z.strictObject({
  id: z.uuid(),
});
export type AccountParams = z.infer<typeof accountParamsSchema>;

export const accountQuerySchema = z.strictObject({
  /** EC-31: the next page of the history, before this register sequence. */
  historyBefore: z.coerce.number().int().min(1).optional(),
});
export type AccountQuery = z.infer<typeof accountQuerySchema>;

export const ACTOR_TYPES = [
  "member",
  "agent",
  "admin",
  "system",
  "service",
] as const;

/**
 * One line of the history of the account (EC-31, 15 RG41 block 10): the register holds codes and
 * identifiers only (05 RG107). Its payload is flattened to key / value pairs, a nested value
 * written as JSON: the response has no free-form object (21 J1-J N2).
 */
export const historyEventSchema = z.strictObject({
  seq: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
  eventType: z.string(),
  actorType: z.enum(ACTOR_TYPES),
  actorAccountId: z.uuid().nullable(),
  details: z.array(
    z.strictObject({ key: z.string(), value: z.string().nullable() }),
  ),
});
export type HistoryEvent = z.infer<typeof historyEventSchema>;

/** 15 RG49: every responsible salesperson, never overwritten. */
export const ownershipEntrySchema = z.strictObject({
  agentAccountId: z.uuid(),
  agentDisplayName: z.string().nullable(),
  assignedAt: z.iso.datetime(),
  unassignedAt: z.iso.datetime().nullable(),
  reasonCode: z.string(),
});

/**
 * A "mes données" request of the member (15 §G, J8 commit 8): what the admin executes from the
 * record, under 2V + R. `execution` is null until an admin approved it; `executed` once the worker
 * ran it (E-5); the closing waits for Brevo (15 RG79). `export` is the access export, never its
 * content (only the member downloads it).
 */
export const accountDataRequestSchema = z.strictObject({
  id: z.uuid(),
  type: dataRequestTypeSchema,
  receivedAt: z.iso.datetime(),
  dueAt: z.iso.datetime(),
  status: z.enum(DATA_REQUEST_STATUSES),
  completedAt: z.iso.datetime().nullable(),
  outcome: z.enum(DATA_REQUEST_OUTCOMES).nullable(),
  execution: z
    .strictObject({
      approvedAt: z.iso.datetime(),
      approvedBy: z.uuid(),
      executedAt: z.iso.datetime().nullable(),
      /** Erasure: the Supabase Auth user deleted (null for an access request). */
      authUserDeletedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  export: z
    .strictObject({
      publishedAt: z.iso.datetime(),
      expiresAt: z.iso.datetime(),
      downloads: z.number().int().nonnegative(),
      purgedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
});
export type AccountDataRequest = z.infer<typeof accountDataRequestSchema>;

/**
 * GET /v1/bo/accounts/:id: the record of a member account (15 RG41 / RG42, blocks of the Lot 1).
 * Its opening is journaled (RG40) by the history read itself (EC-J8-24). Never a sign-in code, a
 * password, an e-mail content nor an Apollo datum (05 RG107, 15 RG43).
 */
export const accountDetailResponseSchema = z.strictObject({
  account: accountRowSchema.extend({
    email: z.string(),
    emailStatus: emailStatusSchema,
    companyName: z.string().nullable(),
    suspendedAt: z.iso.datetime().nullable(),
    deletedAt: z.iso.datetime().nullable(),
  }),
  ownership: z.array(ownershipEntrySchema),
  /** The most recent first (15 §G, J8 commit 8). */
  dataRequests: z.array(accountDataRequestSchema),
  history: z.strictObject({
    events: z.array(historyEventSchema),
    /** The `historyBefore` of the next page, null at the last one. */
    nextBefore: z.number().int().positive().nullable(),
  }),
});
export type AccountDetailResponse = z.infer<typeof accountDetailResponseSchema>;

const shareSchema = z.strictObject({
  synced: z.number().int().nonnegative(),
  eligible: z.number().int().nonnegative(),
});

/**
 * GET /v1/bo/accounts/counters (05 RG105): the head banner, for the current UTC day. The shares
 * are given as counts (`synced` out of `eligible`: sign-ups of the day whose line was not a normal
 * case, RG100), the screen computes the percentage. `unhandledFailures` counts every failed
 * contact line still to handle, whatever its day (target: zero).
 */
export const accountCountersResponseSchema = z.strictObject({
  day: z.iso.date(),
  signups: z.strictObject({
    total: z.number().int().nonnegative(),
    advertiser: z.number().int().nonnegative(),
    creator: z.number().int().nonnegative(),
  }),
  topCountries: z.array(
    z.strictObject({
      countryCode: countryCodeSchema,
      count: z.number().int().positive(),
    }),
  ),
  otherCountries: z.number().int().nonnegative(),
  brevoWithinHour: shareSchema,
  apolloWithin24Hours: shareSchema,
  unhandledFailures: z.strictObject({
    brevo: z.number().int().nonnegative(),
    apollo: z.number().int().nonnegative(),
  }),
});
export type AccountCountersResponse = z.infer<
  typeof accountCountersResponseSchema
>;

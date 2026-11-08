// What the screens of the verification of a creator's account show, decided outside the components
// (docs/mvp/08 RG1 to RG7, RG10, RG13, RG24, RG56, RG57, RG60, RG93, RG96, RG97; 17 §5.3;
// jalons/l2e, commit 18). Pure functions, unit-tested (tests/verification-view.test.ts): the state of
// a network line (a row per level, never a global badge, RG13), the step of the journey, the key of
// the written label of a badge, the text and the next step of a refusal, the delay left, the dates.
// The API and the database decide who is verified and when; nothing here grants, computes a period
// or reads an identifier of a network (a badge names the network, never the account, RG90).
//
// The front does not import @influx/domain (apps/api/tests/domain-guards.test.ts): the labels of a
// badge below repeat packages/domain/src/verification/badge-display.ts for the creator's own view,
// and the translation files hold the sentences, mot pour mot RG10 and RG93 (hypothesis D34, read by a
// lawyer before `production`). No amount, rate, net or price anywhere (CLAUDE.md §2, D48, D78).
import {
  CREATOR_REJECTION_REASON_CODES,
  VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES,
  VERIFICATION_EVIDENCE_REJECTIONS,
  type CreatorRejectionReasonCode,
  type CreatorVerificationLevel,
  type CreatorVerificationLine,
  type OwnBadge,
  type OwnEvidence,
  type OwnRefusal,
  type OwnRequest,
  type VerificationEvidenceRejection,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";

// --- The state of a level on a line ----------------------------------------------------------

/**
 * The request of a level as the row shows it. `started`: a draft, the code not yet confirmed;
 * `requested`: sent, waiting for an agent (08 RG51); `refused`: decided with a reason (a closure for
 * an unavailable account reads the same way); `expired`: the code ran out before the request was sent.
 */
export type RowRequest =
  | { kind: "started"; request: OwnRequest; since: string }
  | { kind: "requested"; request: OwnRequest; since: string }
  | { kind: "refused"; request: OwnRequest; refusal: OwnRefusal }
  | { kind: "expired"; request: OwnRequest };

/** One level of one network line: the badge it holds (displayed states only) and its request. */
export type LevelRow = {
  level: CreatorVerificationLevel;
  badge: OwnBadge | null;
  request: RowRequest | null;
};

function rowRequestOf(request: OwnRequest): RowRequest | null {
  switch (request.status) {
    case "draft":
      return { kind: "started", request, since: request.createdAt };
    case "pending":
      return {
        kind: "requested",
        request,
        since: request.submittedAt ?? request.createdAt,
      };
    case "rejected":
    case "closed":
      return request.refusal === null
        ? null
        : { kind: "refused", request, refusal: request.refusal };
    case "expired":
      return { kind: "expired", request };
    case "approved":
    case "cancelled":
      return null;
  }
}

/** The line of a network in the answer of the API, or null (a network the creator has no line on). */
export function lineOfNetwork(
  lines: readonly CreatorVerificationLine[],
  networkCode: string,
): CreatorVerificationLine | null {
  return lines.find((line) => line.networkCode === networkCode) ?? null;
}

/** The badge and the request of one level of a line (08 RG13: a row per level, per network). */
export function levelRowOf(
  line: CreatorVerificationLine,
  level: CreatorVerificationLevel,
): LevelRow {
  const badge = line.badges.find((candidate) => candidate.level === level);
  const request = line.requests.find((candidate) => candidate.level === level);
  return {
    level,
    badge: badge ?? null,
    request: request === undefined ? null : rowRequestOf(request),
  };
}

/** Whether the ownership of the account is established on a line: the prerequisite of the audience (08 RG12). */
export function isOwnershipEstablished(line: CreatorVerificationLine): boolean {
  return line.badges.some(
    (badge) =>
      badge.level === "account_verified" &&
      (badge.state === "active" || badge.state === "to_refresh"),
  );
}

// --- The written label of a badge ------------------------------------------------------------

/** The key, in `verification`, of the written label of a badge, and of its short explanation (RG7, RG97). */
export type BadgeKeys = {
  label:
    | "verif.badge.accountVerified.label"
    | "verif.badge.audienceVerified.label"
    | "verif.badge.toRefresh"
    | "verif.badge.toReconfirm";
  help:
    | "verif.badge.accountVerified.help"
    | "verif.badge.audienceVerified.help"
    | null;
  /** Written « à rafraîchir » or « à reconfirmer »: not a plain, current badge. */
  needsAction: boolean;
};

/**
 * The keys of a badge as its OWNER reads it, or null when none is shown (the three levels of a
 * creator, RG11; the brand's badge is its own screen's). « Compte vérifié » is not touched by the
 * expiry of the audience (RG71): only the audience is « à rafraîchir » and only the account
 * « à reconfirmer » (RG78).
 */
export function badgeKeysOf(badge: OwnBadge): BadgeKeys | null {
  if (badge.level === "account_verified") {
    if (badge.state === "active") {
      return {
        label: "verif.badge.accountVerified.label",
        help: "verif.badge.accountVerified.help",
        needsAction: false,
      };
    }
    return badge.state === "to_reconfirm"
      ? { label: "verif.badge.toReconfirm", help: null, needsAction: true }
      : null;
  }
  if (badge.level === "audience_verified") {
    if (badge.state === "active") {
      return {
        label: "verif.badge.audienceVerified.label",
        help: "verif.badge.audienceVerified.help",
        needsAction: false,
      };
    }
    return badge.state === "to_refresh"
      ? {
          label: "verif.badge.toRefresh",
          help: "verif.badge.audienceVerified.help",
          needsAction: true,
        }
      : null;
  }
  return null;
}

// --- A refusal: its text and what the creator can do next ------------------------------------

/** What the creator can do after a refusal (08 RG57, last column); the texts are `refusal.next.*`. */
export type NextStep =
  | "redeposit"
  | "restartOwnership"
  | "makePublic"
  | "askOwnershipFirst"
  | "contact"
  | "none";

const NEXT_STEP: Readonly<Record<CreatorRejectionReasonCode, NextStep>> = {
  missing_evidence: "redeposit",
  evidence_too_old: "redeposit",
  evidence_unreadable: "redeposit",
  evidence_wrong_source: "redeposit",
  evidence_too_wide: "redeposit",
  ownership_not_proven: "restartOwnership",
  account_not_public: "makePublic",
  ownership_prerequisite: "askOwnershipFirst",
  evidence_inconsistent: "contact",
  evidence_suspected_forgery: "contact",
  shared_account: "contact",
  agency_managed: "none",
  terms_breach: "contact",
  minor: "none",
  account_unavailable: "contact",
  other: "contact",
};

/** The reasons whose text ends with, or is followed by, the agent's own words (`requires_member_message`, 0221). */
const OWN_WORDS_REASONS: ReadonlySet<CreatorRejectionReasonCode> = new Set([
  "other",
  "terms_breach",
]);

function isCreatorReason(code: string): code is CreatorRejectionReasonCode {
  return (CREATOR_REJECTION_REASON_CODES as readonly string[]).includes(code);
}

/** What a refusal says: the typed reason (a creator's list; any other code reads as `other`), the next step, the agent's words. */
export type RefusalView = {
  reason: CreatorRejectionReasonCode;
  next: NextStep;
  /** The agent's own message, only for the reasons that carry one and only when he wrote it (RG56). */
  agentMessage: string | null;
};

export function refusalViewOf(refusal: OwnRefusal): RefusalView {
  const reason = isCreatorReason(refusal.reasonCode)
    ? refusal.reasonCode
    : "other";
  const message = refusal.message.trim();
  return {
    reason,
    next: NEXT_STEP[reason],
    agentMessage:
      OWN_WORDS_REASONS.has(reason) && message !== "" ? refusal.message : null,
  };
}

/**
 * Whether a refusal leaves the ownership journey open again (a new code, a new request): the reasons
 * that point at the evidence of an audience, at the prerequisite, at the team or at no further
 * request do not. The delay of RG60 and the cap are said by the API when the request is asked.
 */
export function canRestartOwnership(view: RefusalView): boolean {
  return view.next === "restartOwnership" || view.next === "makePublic";
}

// --- The steps of the ownership journey ------------------------------------------------------

/** The three screens of the journey, plus the end of it once the badge is granted (08 §C; 17 §5.3). */
export type OwnershipStep = "affirm" | "code" | "confirm" | "done";

export type OwnershipJourney = {
  step: OwnershipStep;
  /** The draft (`code`) or the pending request (`confirm`); null on the first screen and at the end. */
  request: OwnRequest | null;
  /** The draft holds no live code: it ran out, a new one is generated (RG22). */
  codeExpired: boolean;
  /** The first screen, after a refusal or an expiry: what happened to the last request. */
  previous: RowRequest | null;
  /** The badge, whatever its state, for the screen that says it (« à reconfirmer » asks for the first screen again). */
  badge: OwnBadge | null;
};

/**
 * Where the creator is in the journey, from what the API says of the line, never from what the screen
 * remembers: a request left half-way is taken back at its own screen (a draft shows its code, a
 * request sent shows the confirmation), a badge granted ends it.
 */
export function ownershipJourneyOf(
  line: CreatorVerificationLine,
): OwnershipJourney {
  const row = levelRowOf(line, "account_verified");
  const base = { badge: row.badge, previous: null, codeExpired: false };
  if (row.request?.kind === "started") {
    return {
      ...base,
      step: "code",
      request: row.request.request,
      codeExpired: row.request.request.code === null,
    };
  }
  if (row.request?.kind === "requested") {
    return { ...base, step: "confirm", request: row.request.request };
  }
  if (row.badge?.state === "active") {
    return { ...base, step: "done", request: null };
  }
  return { ...base, step: "affirm", request: null, previous: row.request };
}

/** The position of a step among the three screens, for "Étape 2 sur 3" (the end counts as the third). */
export function stepNumberOf(step: OwnershipStep): number {
  return step === "affirm" ? 1 : step === "code" ? 2 : 3;
}

export const OWNERSHIP_STEP_COUNT = 3;

/** The line a request can still be cancelled on: before any decision (08 RG50). */
export function isCancellable(request: OwnRequest): boolean {
  return request.status === "draft" || request.status === "pending";
}

// --- What the row of a network line offers ---------------------------------------------------

/** The label of the one action a level of a line offers, or null when there is none (`line.cta.*`). */
export type RowAction = "start" | "resume" | "restart" | "renew" | "reconfirm";

/**
 * The action of the ownership row (the audience's is commit 19's): nothing while a request waits for
 * an agent or once the badge stands; the badge to reconfirm asks for a new request (RG78).
 */
export function ownershipActionOf(row: LevelRow): RowAction | null {
  if (row.request?.kind === "requested") {
    return null;
  }
  if (row.request?.kind === "started") {
    return row.request.request.code === null ? "renew" : "resume";
  }
  if (row.badge?.state === "to_reconfirm") {
    return "reconfirm";
  }
  if (row.badge !== null) {
    return null;
  }
  if (row.request?.kind === "expired") {
    return "renew";
  }
  if (row.request?.kind === "refused") {
    return canRestartOwnership(refusalViewOf(row.request.refusal))
      ? "restart"
      : null;
  }
  return "start";
}

/**
 * The line of a network that carries its state when a creator holds several lines of one network
 * (07 RG42): the API answers per network, from the main line, else the oldest one (EC-L2E-12-1), so
 * the main line speaks for it and, failing one, the first listed.
 */
export function hostLineIdsOf(
  lines: readonly { id: string; networkCode: string; isPrimary: boolean }[],
): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const networkCode of new Set(lines.map((line) => line.networkCode))) {
    const ofNetwork = lines.filter((line) => line.networkCode === networkCode);
    const host = ofNetwork.find((line) => line.isPrimary) ?? ofNetwork[0];
    if (host !== undefined) {
      hosts.add(host.id);
    }
  }
  return hosts;
}

// --- The steps of the audience journey ---------------------------------------------------------

/**
 * Where the audience journey of a line stands (08 RG12, RG31 to RG36, RG87, RG95, RG96): `locked`, the
 * ownership of the account is not established on the network (written before any button, RG12);
 * `affirm`, what the badge states and what a brand will read, before anything is deposited (RG96);
 * `deposit`, a draft that holds the pieces; `sent`, the request waits for an agent; `done`, the badge
 * stands.
 */
export type AudienceStage = "locked" | "affirm" | "deposit" | "sent" | "done";

export type AudienceJourney = {
  stage: AudienceStage;
  /** The draft (`deposit`) or the pending request (`sent`); null elsewhere. */
  request: OwnRequest | null;
  /** The pieces the API holds on the request, those an agent will read (the `active` ones, EC-L2E-7). */
  pieces: readonly OwnEvidence[];
  /** The badge, whatever its displayed state. */
  badge: OwnBadge | null;
  /** The badge is « à rafraîchir »: the journey is a renewal. */
  refresh: boolean;
  /** The first screen, after a refusal or an expiry: what happened to the last request. */
  previous: RowRequest | null;
};

/** The pieces of a request that an agent will read: deposited and attached, never a row still being written (modele §3). */
export function activePiecesOf(request: OwnRequest): readonly OwnEvidence[] {
  return request.evidence.filter((piece) => piece.state === "active");
}

/**
 * Where the creator is on the audience of a line, from what the API says and never from what the screen
 * remembers: a draft is taken back at its deposit with its pieces, a request sent shows the follow-up,
 * a badge ends it.
 */
export function audienceJourneyOf(
  line: CreatorVerificationLine,
): AudienceJourney {
  const row = levelRowOf(line, "audience_verified");
  const base = {
    badge: row.badge,
    refresh: row.badge?.state === "to_refresh",
    previous: null,
    pieces: [],
  };
  if (row.request?.kind === "started") {
    return {
      ...base,
      stage: "deposit",
      request: row.request.request,
      pieces: activePiecesOf(row.request.request),
    };
  }
  if (row.request?.kind === "requested") {
    return {
      ...base,
      stage: "sent",
      request: row.request.request,
      pieces: activePiecesOf(row.request.request),
    };
  }
  if (!isOwnershipEstablished(line)) {
    return { ...base, stage: "locked", request: null };
  }
  if (row.badge?.state === "active") {
    return { ...base, stage: "done", request: null };
  }
  return { ...base, stage: "affirm", request: null, previous: row.request };
}

/** The position of a stage among the three screens (the follow-up, sent or done, is the third); `locked` has none. */
export function audienceStepNumberOf(stage: AudienceStage): number | null {
  switch (stage) {
    case "locked":
      return null;
    case "affirm":
      return 1;
    case "deposit":
      return 2;
    case "sent":
    case "done":
      return 3;
  }
}

export const AUDIENCE_STEP_COUNT = 3;

/**
 * The button the audience row of a line offers (never before the ownership is established, RG12):
 * nothing while a request waits for an agent or once the badge stands; the badge to refresh asks for a
 * new request; a refusal that points at the evidence offers a new deposit (08 RG57).
 */
export type AudienceAction = "start" | "resume" | "restart" | "refresh";

export function audienceActionOf(
  row: LevelRow,
  ownershipEstablished: boolean,
): AudienceAction | null {
  if (row.request?.kind === "requested") {
    return null;
  }
  if (row.request?.kind === "started") {
    return "resume";
  }
  if (!ownershipEstablished) {
    return null;
  }
  if (row.badge?.state === "to_refresh") {
    return "refresh";
  }
  if (row.badge !== null) {
    return null;
  }
  if (row.request?.kind === "expired") {
    return "restart";
  }
  if (row.request?.kind === "refused") {
    return refusalViewOf(row.request.refusal).next === "redeposit"
      ? "restart"
      : null;
  }
  return "start";
}

/** The key, in `verification`, of the label of each action of the audience row. */
export const AUDIENCE_CTA_KEYS = {
  start: "line.cta.audienceStart",
  resume: "line.cta.audienceResume",
  restart: "line.cta.audienceRestart",
  refresh: "line.cta.audienceRefresh",
} as const satisfies Record<AudienceAction, string>;

/**
 * The piece an audience request expects, network by network (08 RG32): the three networks the
 * reference list names, and the equivalent native tool of any other (`audience.expected.<key>`).
 */
export type ExpectedPieceKey = "instagram" | "tiktok" | "youtube" | "other";

export function expectedPieceKeyOf(networkCode: string): ExpectedPieceKey {
  return networkCode === "instagram" ||
    networkCode === "tiktok" ||
    networkCode === "youtube"
    ? networkCode
    : "other";
}

// --- The deposit of a piece --------------------------------------------------------------------

/**
 * Why a deposit did not give a piece, as the key of its message (`audience.errors.<key>`): the six
 * typed reasons of the API (an image only: a PDF is `unsupported_type`, 08 RG34), a file the browser
 * saw too big before sending it, the quota of the day, the request already full, no more a draft, an
 * unknown request, or the service (network, Storage) that did not answer.
 */
export type EvidenceFailureKey =
  | VerificationEvidenceRejection
  | "tooLarge"
  | "quota"
  | "cap"
  | "notDraft"
  | "gone"
  | "unavailable";

export type EvidenceFailure = {
  key: EvidenceFailureKey;
  /** The delay left for `quota` (the `Retry-After` of the answer, until the next UTC midnight). */
  retryAfterSeconds: number | null;
  /** The same file is worth sending again: only an unavailable service leaves it so (08 edge case 5, CA67). */
  retryable: boolean;
  /** No other file of the queue can succeed after this one (a full request, no more draft, the quota). */
  stopsQueue: boolean;
  /** The request is not as the screen drew it: the lines are read again. */
  reload: boolean;
};

const EVIDENCE_FAILURE_BASE = {
  retryAfterSeconds: null,
  retryable: false,
  stopsQueue: false,
  reload: false,
} as const;

/** Only a file the relay would refuse is stopped here (nothing to read, over the cap); the rest is the API's. */
export function evidenceFileProblem(
  sizeInBytes: number,
): EvidenceFailure | null {
  if (sizeInBytes === 0) {
    return { ...EVIDENCE_FAILURE_BASE, key: "empty" };
  }
  return sizeInBytes > VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES
    ? { ...EVIDENCE_FAILURE_BASE, key: "tooLarge" }
    : null;
}

function isEvidenceRejection(
  issue: string | undefined,
): issue is VerificationEvidenceRejection {
  return (VERIFICATION_EVIDENCE_REJECTIONS as readonly string[]).includes(
    issue ?? "",
  );
}

/** What a refused deposit means for the screen, from the code and the issues of the error envelope (apps/api evidence.ts). */
export function evidenceFailureOf(result: Failed): EvidenceFailure {
  const issues = result.issues ?? [];
  switch (result.code) {
    case "image_rejected": {
      const reason = issues[0];
      return {
        ...EVIDENCE_FAILURE_BASE,
        key: isEvidenceRejection(reason) ? reason : "undecodable",
      };
    }
    case "payload_too_large":
      return { ...EVIDENCE_FAILURE_BASE, key: "tooLarge" };
    case "upload_quota_exceeded":
      return {
        ...EVIDENCE_FAILURE_BASE,
        key: "quota",
        retryAfterSeconds: result.retryAfterSeconds ?? null,
        stopsQueue: true,
      };
    case "not_found":
      return {
        ...EVIDENCE_FAILURE_BASE,
        key: "gone",
        stopsQueue: true,
        reload: true,
      };
    case "conflict":
      if (issues.includes("evidence_cap")) {
        return {
          ...EVIDENCE_FAILURE_BASE,
          key: "cap",
          stopsQueue: true,
          reload: true,
        };
      }
      if (issues.includes("request_not_draft")) {
        return {
          ...EVIDENCE_FAILURE_BASE,
          key: "notDraft",
          stopsQueue: true,
          reload: true,
        };
      }
      return { ...EVIDENCE_FAILURE_BASE, key: "unavailable", retryable: true };
    default:
      return { ...EVIDENCE_FAILURE_BASE, key: "unavailable", retryable: true };
  }
}

/** The largest image, in whole mebibytes, as the screen says it (the bound is the contract's, never typed twice). */
export const EVIDENCE_MAX_MEBIBYTES =
  VERIFICATION_EVIDENCE_MAX_UPLOAD_BYTES / (1024 * 1024);

/** The size of a stored piece, written for the language: kilobytes under a megabyte, megabytes above (decimal, one digit at most). */
export function formatByteSize(bytes: number, locale: string): string {
  const mega = 1_000_000;
  const unit = bytes < mega ? "kilobyte" : "megabyte";
  const value =
    bytes < mega ? Math.max(1, Math.round(bytes / 1000)) : bytes / mega;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: unit === "megabyte" ? 1 : 0,
  }).format(value);
}

// --- The failure of a call --------------------------------------------------------------------

/** The message of `failure.*` a refused call leads to (the issues of 08 RG14, RG22, RG60, CA12, CA37, CA38). */
export type FailureKey =
  | "retryLater"
  | "cap"
  | "alreadyVerified"
  | "notDraft"
  | "gone"
  | "accountUnavailable"
  | "unavailable"
  | "expired"
  | "duplicate"
  | "ownershipPrerequisite"
  | "missingEvidence"
  | "evidenceCap";

export type Failure = {
  key: FailureKey;
  /** The delay left, for `retryLater` (the `Retry-After` of the answer). */
  retryAfterSeconds: number | null;
  /** Whether the screen must read the lines again: the request is not in the state it was drawn in. */
  reload: boolean;
};

type Failed = Extract<RelayResult<unknown>, { kind: "failed" }>;

/** What a refused call means for the screen, from the code, the issues and the delay of the answer. */
export function failureOf(result: Failed): Failure {
  const issues = result.issues ?? [];
  const has = (issue: string) => issues.includes(issue);
  if (result.code === "not_found") {
    return { key: "gone", retryAfterSeconds: null, reload: true };
  }
  if (result.code === "conflict") {
    if (has("retry_after")) {
      return {
        key: "retryLater",
        retryAfterSeconds: result.retryAfterSeconds ?? null,
        reload: false,
      };
    }
    if (has("rejection_cap")) {
      return { key: "cap", retryAfterSeconds: null, reload: false };
    }
    if (has("code_expired")) {
      return { key: "expired", retryAfterSeconds: null, reload: true };
    }
    if (has("already_verified")) {
      return { key: "alreadyVerified", retryAfterSeconds: null, reload: true };
    }
    if (has("account_unavailable")) {
      return {
        key: "accountUnavailable",
        retryAfterSeconds: null,
        reload: true,
      };
    }
    if (has("duplicate_request")) {
      return { key: "duplicate", retryAfterSeconds: null, reload: true };
    }
    if (has("ownership_prerequisite")) {
      return {
        key: "ownershipPrerequisite",
        retryAfterSeconds: null,
        reload: true,
      };
    }
    if (has("missing_evidence")) {
      return { key: "missingEvidence", retryAfterSeconds: null, reload: true };
    }
    if (has("evidence_cap")) {
      return { key: "evidenceCap", retryAfterSeconds: null, reload: true };
    }
    if (has("request_not_draft") || has("stale_token") || has("entry_closed")) {
      return { key: "notDraft", retryAfterSeconds: null, reload: true };
    }
  }
  return { key: "unavailable", retryAfterSeconds: null, reload: false };
}

// --- Dates and delays --------------------------------------------------------------------------

/** The date of a decision or of a request, complete, in the language of the page (08 RG4, RG10, EC-L2E-9). */
export function formatVerificationDate(
  instant: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(instant),
  );
}

/** A calendar day of the period of a constat ("2026-02-01"): read as the UTC day it names, never shifted by a time zone. */
export function formatCalendarDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

const SECONDS_IN_A_MINUTE = 60;
const SECONDS_IN_AN_HOUR = 3_600;
const SECONDS_IN_A_DAY = 86_400;

/**
 * The delay left, written in the language of the page and rounded UP to the unit (never promising
 * earlier than the API does): minutes under an hour, hours under two days, days beyond (08 RG60).
 */
export function formatDelay(seconds: number, locale: string): string {
  let unit: "minute" | "hour" | "day";
  let value: number;
  if (seconds < SECONDS_IN_AN_HOUR) {
    unit = "minute";
    value = Math.max(1, Math.ceil(seconds / SECONDS_IN_A_MINUTE));
  } else if (seconds < 2 * SECONDS_IN_A_DAY) {
    unit = "hour";
    value = Math.ceil(seconds / SECONDS_IN_AN_HOUR);
  } else {
    unit = "day";
    value = Math.ceil(seconds / SECONDS_IN_A_DAY);
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "long",
  }).format(value);
}

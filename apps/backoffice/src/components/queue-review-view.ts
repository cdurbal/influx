// What the decision screen of queue 1 decides to show and to send, computed from the answers of apps/api
// (docs/mvp/06 RG6, RG19, RG65, RG66; 15 RG27 C1 to C8, RG114 to RG117; 17b §2.4 to §2.6, §4.3, §4.11;
// jalons/l2c/file.md A3, A6, A8, A9; L2C-17). Pure functions, outside the components: the mode of the
// screen, its banners, the delay of the claim, the draft of a refusal and its checks, what a refused
// call means, the keys. No rule is decided here: the database says who holds the entry, which version a
// decision binds, which reasons exist and whether a message is acceptable; this module words and
// gathers. Durations are computed from the instant of the database (`asOf`), never from the clock of
// the browser alone: the offset between the two is taken when the entry is read.
import {
  INTERNAL_COMMENT_MAX_LENGTH,
  MEMBER_MESSAGE_MAX_LENGTH,
  MEMBER_MESSAGE_MIN_LENGTH,
  type OpenEntryResponse,
  type PublishEntryRequest,
  type RejectEntryRequest,
  type RejectionReasonCode,
  type ReviewReason,
} from "@influx/contracts/backoffice-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { messages } from "@/messages/fr";
import {
  durationWords,
  minutesBetween,
  type KeyFacts,
} from "./queue-view-model";
import { failureOf, formatDateTime, formatTime } from "./view-model";

const t = messages.queueReview;

/** The three ways the screen can be: it decides, it reads, or the entry is closed. */
export type ReviewMode = "deciding" | "readOnly" | "closed";

export function modeOf(view: OpenEntryResponse): ReviewMode {
  if (view.entry.state !== "open" || view.outcome === "closed") {
    return "closed";
  }
  return view.outcome === "read_only" || view.reviewToken === null
    ? "readOnly"
    : "deciding";
}

/** A banner: information is not an error (17b §2.4), an alert is a delay. Always a written sentence. */
export type Banner = { tone: "info" | "alert"; lines: readonly string[] };

/** The claim: mine, a colleague's, or nothing to say (a closed entry has its own lines). */
export function claimBanner(view: OpenEntryResponse): Banner | null {
  const mode = modeOf(view);
  if (mode === "closed") {
    return null;
  }
  const { claim } = view.entry;
  if (mode === "deciding") {
    return {
      tone: "info",
      lines: [t.banner.byMe(formatTime(claim.claimedAt ?? view.asOf))],
    };
  }
  const name = claim.holder?.displayName ?? null;
  return {
    tone: "info",
    lines: [
      name === null || claim.claimedAt === null
        ? t.banner.byOtherUnknown
        : t.banner.byOther(name, formatTime(claim.claimedAt)),
      t.banner.readOnly,
    ],
  };
}

/** The deadline passed (15 C8): written, a decision stays possible for whoever holds the entry. */
export function overdueBanner(view: OpenEntryResponse): Banner | null {
  if (view.entry.state !== "open" || !view.entry.overdue) {
    return null;
  }
  const since = durationWords(minutesBetween(view.entry.slaDueAt, view.asOf));
  return {
    tone: "alert",
    lines: [
      modeOf(view) === "deciding"
        ? t.banner.overdue(since)
        : t.banner.overdueRead(since),
    ],
  };
}

/** The notice of a claim an administrator lifted (15 C4, A8): told at the next opening. */
export function forcedReleaseNotice(view: OpenEntryResponse): string | null {
  const lifted = view.entry.lastForcedRelease;
  if (lifted === null || !lifted.holderIsCaller || modeOf(view) === "closed") {
    return null;
  }
  const reasons = messages.queueReview.force.reasons as Readonly<
    Record<string, string>
  >;
  return t.banner.forcedRelease(
    lifted.releasedBy?.displayName ?? t.banner.forcedReleaseUnknown,
    formatTime(lifted.releasedAt),
    (reasons[lifted.reasonCode] ?? lifted.reasonCode).toLowerCase(),
  );
}

/** The line under the title (4.8): the logged opening, by name. */
export function loggedLine(
  view: OpenEntryResponse,
  fallbackName: string,
): string {
  const holder = view.entry.claim.heldByCaller
    ? view.entry.claim.holder?.displayName
    : null;
  return t.loggedLine(holder ?? fallbackName, formatDateTime(view.asOf));
}

// --- The delay of the claim (15 C3, file.md A9) ---------------------------------------------

/** 17b §2.4: a discreet reminder three minutes before the claim falls. */
export const REMIND_BEFORE_MS = 3 * 60_000;

/** The browser clock corrected to the database's: add it to `Date.now()` for the instant of the database. */
export function clockOffset(asOf: string, nowMs: number): number {
  return Date.parse(asOf) - nowMs;
}

export type Expiry =
  | { kind: "none" }
  | { kind: "ok" }
  | { kind: "soon"; minutes: number }
  | { kind: "expired" };

export function expiryOf(
  view: OpenEntryResponse,
  nowMs: number,
  offsetMs: number,
): Expiry {
  const { claimExpiresAt } = view.entry.claim;
  if (modeOf(view) !== "deciding" || claimExpiresAt === null) {
    return { kind: "none" };
  }
  const left = Date.parse(claimExpiresAt) - (nowMs + offsetMs);
  if (left <= 0) {
    return { kind: "expired" };
  }
  return left <= REMIND_BEFORE_MS
    ? { kind: "soon", minutes: Math.max(1, Math.ceil(left / 60_000)) }
    : { kind: "ok" };
}

// --- A closed entry (06 RG65, 15 C8) -------------------------------------------------------

/** What a closed entry says: how it ended, by whom, the reason and the message the brand received. */
export function closedLines(view: OpenEntryResponse): string[] {
  const { entry } = view;
  const c = t.closed;
  const lines: string[] = [
    entry.state === "published"
      ? c.published
      : entry.state === "rejected"
        ? c.rejected
        : entry.state === "withdrawn"
          ? c.withdrawn
          : c.open,
  ];
  const { decision } = entry;
  if (decision !== null) {
    lines.push(
      decision.decidedBy === null
        ? c.decidedAt(formatDateTime(decision.decidedAt))
        : c.decidedBy(
            decision.decidedBy.displayName ?? t.banner.forcedReleaseUnknown,
            formatDateTime(decision.decidedAt),
          ),
    );
    if (decision.late) {
      lines.push(c.late);
    }
    if (decision.rejectionReasonCode !== null) {
      lines.push(
        c.reason(t.decision.reasonLabels[decision.rejectionReasonCode]),
      );
    }
  }
  return lines;
}

// --- The refusal: a typed reason, its message, a comment (06 RG65, RG66; 15 C6, RG116) -------

/** What the agent has typed; kept across every error, reload of the entry and closed panel (RG116). */
export type Draft = {
  reasonCode: RejectionReasonCode | null;
  memberMessage: string;
  internalComment: string;
};

export const EMPTY_DRAFT: Draft = {
  reasonCode: null,
  memberMessage: "",
  internalComment: "",
};

export type FieldProblem = "reason" | "memberMessage" | "internalComment";

export type Checked<Body> =
  { ok: true; body: Body } | { ok: false; field: FieldProblem; error: string };

/** The comment is facultative: sent only when it holds something, and within the bound (A6). */
function commentOf(draft: Draft): Checked<string | null> {
  const comment = draft.internalComment.trim();
  if (comment.length > INTERNAL_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      field: "internalComment",
      error: t.decision.commentTooLong,
    };
  }
  return { ok: true, body: comment === "" ? null : comment };
}

export function publishCheck(
  draft: Draft,
  reviewToken: string,
): Checked<PublishEntryRequest> {
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body:
      comment.body === null
        ? { reviewToken }
        : { reviewToken, internalComment: comment.body },
  };
}

/**
 * The refusal as the API takes it. The reason must be of the closed list the opening returned; the
 * message to the brand is for the reasons that ask for it, and only theirs (the database refuses the
 * others); the checks of length are the contract's, the contact detector is the server's (RG19).
 */
export function rejectCheck(
  draft: Draft,
  reasons: readonly ReviewReason[],
  reviewToken: string,
): Checked<RejectEntryRequest> {
  const reason = reasons.find(
    (candidate) => candidate.code === draft.reasonCode,
  );
  if (reason === undefined) {
    return { ok: false, field: "reason", error: t.decision.reasonRequired };
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  const body: RejectEntryRequest = {
    reviewToken,
    reasonCode: reason.code,
    ...(comment.body === null ? {} : { internalComment: comment.body }),
  };
  if (!reason.requiresMemberMessage) {
    return { ok: true, body };
  }
  const message = draft.memberMessage.trim();
  if (message.length < MEMBER_MESSAGE_MIN_LENGTH) {
    return {
      ok: false,
      field: "memberMessage",
      error: t.decision.otherTooShort,
    };
  }
  if (message.length > MEMBER_MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      field: "memberMessage",
      error: t.decision.otherTooLong,
    };
  }
  return { ok: true, body: { ...body, memberMessage: message } };
}

/**
 * What the brand will read for the reason picked (15 RG7, 17b §2.5 invariant 4): the sentence of the
 * reason, the agent's own text for the reason that has one, then what the brand can do. The sentences
 * come from apps/api, from the files of the e-mail itself.
 */
export function messagePreview(
  reason: ReviewReason,
  draft: Draft,
): { paragraphs: string[]; nextStep: string } {
  const paragraphs = [reason.message];
  if (reason.requiresMemberMessage) {
    const own = draft.memberMessage.trim();
    if (own !== "") {
      paragraphs.push(own);
    }
  }
  return { paragraphs, nextStep: reason.nextStep };
}

// --- What a refused call means ---------------------------------------------------------------

/** Why the entry is read again after a refusal: the screen shows its new state and keeps the draft. */
export type ReopenWhy =
  "heldByOther" | "lifted" | "notHeld" | "stale" | "closed" | "profileState";

export type Refusal =
  | { kind: "signedOut" }
  | { kind: "reopen"; why: ReopenWhy }
  | { kind: "text"; text: string; field: FieldProblem | null };

const REOPEN_BY_ISSUE: Readonly<Record<string, ReopenWhy>> = {
  held_by_other: "heldByOther",
  claim_lifted: "lifted",
  claim_not_held: "notHeld",
  stale_token: "stale",
  entry_closed: "closed",
  profile_state: "profileState",
};

/**
 * Apps/api's answer to a decision, an extension or a release, in what the screen does about it
 * (jalons/l2c/l2c-fiche; routes of commit 12). Lost claim, stale version, closed entry: read the
 * entry again (POST …/open) and say why; the typed text is never lost. The name of the holder does
 * not cross the relay as an issue, the opening that follows gives it.
 */
export function refusalOf(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
): Refusal {
  if (result.kind === "unauthenticated") {
    return { kind: "signedOut" };
  }
  const issues = result.issues ?? [];
  switch (result.code) {
    case "conflict": {
      for (const [issue, why] of Object.entries(REOPEN_BY_ISSUE)) {
        if (issues.includes(issue)) {
          return { kind: "reopen", why };
        }
      }
      if (issues.includes("required_field_missing")) {
        return { kind: "text", text: t.decision.requiredMissing, field: null };
      }
      break;
    }
    case "forbidden":
      return {
        kind: "text",
        text: issues.includes("conflict_of_interest")
          ? t.errors.conflictOfInterest
          : messages.failure.forbidden,
        field: null,
      };
    case "validation_failed":
      if (issues.includes("direct_contact")) {
        return {
          kind: "text",
          text: t.decision.otherDirectContact,
          field: "memberMessage",
        };
      }
      if (issues.includes("invalid_reason")) {
        return {
          kind: "text",
          text: t.decision.invalidReason,
          field: "reason",
        };
      }
      if (issues.includes("invalid_member_message")) {
        return {
          kind: "text",
          text: t.decision.invalidMessage,
          field: "memberMessage",
        };
      }
      if (issues.includes("invalid_internal_comment")) {
        return {
          kind: "text",
          text: t.decision.invalidComment,
          field: "internalComment",
        };
      }
      break;
    default:
      break;
  }
  const generic = failureOf(result);
  return {
    kind: "text",
    text:
      generic === "reauth" || generic === "signedOut"
        ? messages.failure.unavailable
        : generic,
    field: null,
  };
}

/** The sentence of an entry that cannot be opened (a 403, a 404, a failure); no retry for the first two. */
export function openFailure(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
): { text: string; retry: boolean } | "signedOut" {
  if (result.kind === "unauthenticated") {
    return "signedOut";
  }
  if (result.code === "forbidden") {
    return {
      text: (result.issues ?? []).includes("conflict_of_interest")
        ? t.errors.conflictOfInterest
        : t.errors.forbidden,
      retry: false,
    };
  }
  if (result.code === "not_found") {
    return { text: t.errors.notFound, retry: false };
  }
  return { text: t.errors.unavailable, retry: true };
}

/** The sentence under the title after a refusal that reread the entry (RG116: nothing was lost). */
export function reopenNotice(why: ReopenWhy): string {
  switch (why) {
    case "heldByOther":
      return t.notices.heldByOther;
    case "lifted":
      return t.notices.lifted;
    case "notHeld":
      return t.notices.notHeld;
    case "stale":
      return t.notices.stale;
    case "closed":
      return t.notices.closed;
    case "profileState":
      return t.notices.profileState;
  }
}

// --- The keyboard (15 RG114, RG115; 17b §4.11) -----------------------------------------------

export type ReviewShortcut =
  "publish" | "reject" | "release" | "help" | "escape";

const FIELD_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/**
 * ‹v›, ‹r›, ‹l› and ‹?› are never taken from someone typing, nor from a modified key; ‹Échap› is the
 * one key that works inside a field, since it closes a panel without losing what was typed (RG116).
 * None of them decides: ‹v› and ‹r› open the recap and the picker (RG114, RG115).
 */
export function reviewShortcutOf(event: KeyFacts): ReviewShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (event.key === "Escape") {
    return "escape";
  }
  if (
    event.target !== null &&
    (FIELD_TAGS.has(event.target.tagName) || event.target.isContentEditable)
  ) {
    return null;
  }
  switch (event.key) {
    case "v":
      return "publish";
    case "r":
      return "reject";
    case "l":
      return "release";
    case "?":
      return "help";
    default:
      return null;
  }
}

// --- The exit (17b §2.6) ---------------------------------------------------------------------

/** The confirmation that stays above the next entry: what was decided, in a sentence. */
export function decisionNotice(
  decision: "published" | "rejected",
  brand: string,
  reasonCode: RejectionReasonCode | null,
  late: boolean,
): string[] {
  const lines =
    decision === "published" || reasonCode === null
      ? [t.decision.publishedNotice(brand)]
      : [
          t.decision.rejectedNotice(
            brand,
            t.decision.reasonLabels[reasonCode].toLowerCase(),
          ),
        ];
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

/** A notice for the next entry, kept across the navigation of the chain and lost on reload. */
export type ChainNotice = {
  /** The entry the notice is shown over. */
  forEntry: string;
  /** The entry that was decided, for "Voir l'entrée". */
  decidedEntry: string;
  lines: readonly string[];
};

let pending: ChainNotice | null = null;

export function stashChainNotice(notice: ChainNotice | null): void {
  pending = notice;
}

export function chainNoticeFor(entryId: string): ChainNotice | null {
  return pending !== null && pending.forEntry === entryId ? pending : null;
}

/** The same view with the new expiry of the caller's claim (after an extension, A9). */
export function withClaimExpiry(
  view: OpenEntryResponse,
  claimExpiresAt: string,
): OpenEntryResponse {
  return {
    ...view,
    entry: { ...view.entry, claim: { ...view.entry.claim, claimExpiresAt } },
  };
}

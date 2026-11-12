// What the decision screens of queues 5 and 6 share (docs/mvp/08 RG77, RG78; 15 RG27 C1 to C8; 17b §2.4 to
// §2.6; jalons/l2f/modele.md §5; L2F-19), computed from the answers of apps/api: the mode of the screen, its
// banners, the delay of the claim, what a refused call means. Pure functions, outside the components. No
// rule is decided here: the database says who holds the entry, which version a decision binds, who may
// judge a contest and what is refused; this module words and gathers. Durations are computed from the
// instant of the database (`asOf`), never from the clock of the browser alone.
import type {
  EntryClaim,
  OpenOutcome,
} from "@influx/contracts/backoffice-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { messages } from "@/messages/fr";
import { durationWords, minutesBetween } from "./queue-view-model";
import { REMIND_BEFORE_MS, type Banner } from "./queue-review-view";
import {
  refusalOf,
  type Refusal,
  type ReopenWhy,
} from "./verification-decision-view";
import { formatDateTime, formatTime } from "./view-model";

const t = messages.claimedReview;
const banner = messages.queueReview.banner;

/** What a decision screen of queue 5 or 6 reads of an opening: the claim, the version, the state of the entry. */
export type ClaimedView = {
  asOf: string;
  outcome: OpenOutcome;
  reviewToken: string | null;
  entry: {
    id: string;
    /** `open` while the entry waits in its queue; any other state is a decision or a withdrawal. */
    state: string;
    slaDueAt: string;
    escalateAt: string | null;
    overdue: boolean;
    claim: EntryClaim;
    lastForcedRelease: {
      releasedAt: string;
      releasedBy: { displayName: string | null } | null;
      holderIsCaller: boolean;
      reasonCode: string;
    } | null;
  };
};

/** The three ways the screen can be: it decides, it reads, or the entry left the queue. */
export type ClaimedMode = "deciding" | "readOnly" | "closed";

export function claimedModeOf(view: ClaimedView): ClaimedMode {
  if (view.entry.state !== "open" || view.outcome === "closed") {
    return "closed";
  }
  return view.outcome === "read_only" || view.reviewToken === null
    ? "readOnly"
    : "deciding";
}

/**
 * Who reads and why: a colleague holds the entry (« En cours — … »), or nobody does and the caller is
 * the decider of the decision contested (08 RG77, I14: the screen says it cannot, rather than simulate).
 */
export function claimedBanner(view: ClaimedView): Banner | null {
  const mode = claimedModeOf(view);
  if (mode === "closed") {
    return null;
  }
  const { claim } = view.entry;
  if (mode === "deciding") {
    return {
      tone: "info",
      lines: [banner.byMe(formatTime(claim.claimedAt ?? view.asOf))],
    };
  }
  if (claim.holder === null) {
    return { tone: "info", lines: [t.decider] };
  }
  const name = claim.holder.displayName;
  return {
    tone: "info",
    lines: [
      name === null || claim.claimedAt === null
        ? banner.byOtherUnknown
        : banner.byOther(name, formatTime(claim.claimedAt)),
      banner.readOnly,
    ],
  };
}

export function claimedOverdueBanner(view: ClaimedView): Banner | null {
  if (view.entry.state !== "open" || !view.entry.overdue) {
    return null;
  }
  const since = durationWords(minutesBetween(view.entry.slaDueAt, view.asOf));
  return {
    tone: "alert",
    lines: [
      claimedModeOf(view) === "deciding"
        ? banner.overdue(since)
        : banner.overdueRead(since),
    ],
  };
}

/** The notice of a claim an administrator lifted (15 C4): told at the next opening. */
export function claimedForcedNotice(view: ClaimedView): string | null {
  const lifted = view.entry.lastForcedRelease;
  if (
    lifted === null ||
    !lifted.holderIsCaller ||
    claimedModeOf(view) === "closed"
  ) {
    return null;
  }
  const reasons = messages.queueReview.force.reasons as Readonly<
    Record<string, string>
  >;
  return banner.forcedRelease(
    lifted.releasedBy?.displayName ?? banner.forcedReleaseUnknown,
    formatTime(lifted.releasedAt),
    (reasons[lifted.reasonCode] ?? lifted.reasonCode).toLowerCase(),
  );
}

export function claimedLoggedLine(
  view: ClaimedView,
  fallbackName: string,
): string {
  const holder = view.entry.claim.heldByCaller
    ? view.entry.claim.holder?.displayName
    : null;
  return messages.queueReview.loggedLine(
    holder ?? fallbackName,
    formatDateTime(view.asOf),
  );
}

export type ClaimedExpiry =
  | { kind: "none" }
  | { kind: "ok" }
  | { kind: "soon"; minutes: number }
  | { kind: "expired" };

export function claimedExpiryOf(
  view: ClaimedView,
  nowMs: number,
  offsetMs: number,
): ClaimedExpiry {
  const { claimExpiresAt } = view.entry.claim;
  if (claimedModeOf(view) !== "deciding" || claimExpiresAt === null) {
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

/** The same view with the new expiry of the caller's claim (after an extension). */
export function withClaimedExpiry<View extends ClaimedView>(
  view: View,
  claimExpiresAt: string,
): View {
  return {
    ...view,
    entry: { ...view.entry, claim: { ...view.entry.claim, claimExpiresAt } },
  };
}

/** The sentence of an entry that cannot be opened (a 403, a 404, a failure); no retry for the first two. */
export function claimedOpenFailure(
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

export function claimedReopenNotice(why: ReopenWhy): string {
  return t.notices[why];
}

/** The refusals the database states in its own words (modele §3 « 0232, 0233 »), by the issue the API names. */
const ISSUE_TEXT: Readonly<Record<string, string>> = {
  reviewer_is_decider: t.refusals.reviewerIsDecider,
  reflection_delay: t.refusals.reflectionDelay,
  restore_expired: t.refusals.restoreExpired,
  line_deleted: t.refusals.lineDeleted,
  handle_already_verified: t.refusals.handleAlreadyVerified,
  badge_not_holding: t.refusals.badgeNotHolding,
  ownership_prerequisite: t.refusals.ownershipPrerequisite,
  missing_evidence: t.refusals.missingEvidence,
  account_unavailable: t.refusals.accountUnavailable,
  // queue 2 (0244): a profile no longer in a state the entry can decide, a required field missing at the
  // publication, the handle of a line under an active badge (queue 6 holds it)
  profile_state: t.refusals.profileState,
  required_field_missing: t.refusals.requiredFieldMissing,
  verified_handle: t.refusals.verifiedHandle,
  not_replaceable: t.refusals.notReplaceable,
};

/**
 * The queues that share the screens: 5 (contests of a decision), 6 (identifier changed) and, since L2G-15,
 * 2 (the creator profiles to validate: a publication, or a refusal with a typed reason).
 */
export type ClaimedQueue = "dispute" | "identifier" | "creator";

/**
 * What a refused call of these queues means: a lost claim, a stale version or a closed entry read the
 * dossier again (as queue 4); the refusals of 0232 and 0233 are a sentence; a handle that does not match
 * the declared one is told on its own field, whichever of its two issues the API names (`0228`), and by
 * the queue: a proof is demanded in queue 6 only, queue 5 confirms the decision with its own option.
 */
export function claimedRefusalOf(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
  queue: ClaimedQueue,
): Refusal {
  if (result.kind === "failed") {
    const issues = result.issues ?? [];
    if (result.code === "conflict") {
      const reopen = refusalOf(result);
      if (reopen.kind === "reopen") {
        return reopen;
      }
      for (const [issue, text] of Object.entries(ISSUE_TEXT)) {
        if (issues.includes(issue)) {
          return { kind: "text", text, field: null };
        }
      }
    }
    if (
      result.code === "validation_failed" &&
      issues.includes("invalid_observed_handle_mismatch")
    ) {
      return {
        kind: "text",
        text:
          queue === "dispute"
            ? t.refusals.handleMismatchDispute
            : t.refusals.handleMismatch,
        field: "handle",
      };
    }
  }
  return refusalOf(result);
}

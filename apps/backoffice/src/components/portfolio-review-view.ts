// What the decision screen of queue 3 shows and sends (docs/mvp/07 RG77 to RG85, RG93, RG95 to RG97; 15 RG27 C1
// to C8; 17b §2.4 to §2.6; jalons/l2g/modele.md §1 points 2, 10, 12, §3 « 0244 »; L2G-16), computed from the
// answers of apps/api. Pure functions, outside the components: the view in the shape of the claimed screens, the
// facts of the visual, the grid of RG79 as written, the reasons of the refusal, the alerts in words, how a closed
// entry ended, the checks of a decision and the notices of the chain. No rule is decided here: the database says
// who holds the entry, which version a decision binds, which reasons exist; this module words and gathers. The
// shared parts (the mode, the banners, the claim, the refused calls) are `claimed-entry-view.ts`.
import { INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/backoffice-queues";
import type {
  ApprovePortfolioItemRequest,
  CreatorReviewAlert,
  OpenPortfolioItemResponse,
  PortfolioReviewReason,
  RejectPortfolioItemRequest,
} from "@influx/contracts/creator-queues";
import { messages } from "@/messages/fr";
import { kindWords } from "./portfolio-queue-view";
import {
  type Checked,
  type Draft,
  type Problem,
} from "./verification-decision-view";
import { countryName, formatDate, formatDateTime } from "./view-model";

const t = messages.portfolioReview;
const shared = messages.creatorReview.decision;

/** The answer of the opening, given the `entry` the claimed frame reads (the entry IS the visual). */
export type PortfolioReviewView = OpenPortfolioItemResponse & {
  entry: {
    id: string;
    /** `open` while the visual waits (`pending`); any other state is a decision or a withdrawal. */
    state: string;
    slaDueAt: string;
    escalateAt: string | null;
    overdue: boolean;
    claim: OpenPortfolioItemResponse["item"]["claim"];
    lastForcedRelease: OpenPortfolioItemResponse["item"]["lastForcedRelease"];
  };
};

export function portfolioViewOf(
  response: OpenPortfolioItemResponse,
): PortfolioReviewView {
  const { item } = response;
  return {
    ...response,
    entry: {
      id: item.id,
      state: item.state === "pending" ? "open" : item.state,
      slaDueAt: item.slaDueAt,
      escalateAt: item.escalateAt,
      overdue: item.overdue,
      claim: item.claim,
      lastForcedRelease: item.lastForcedRelease,
    },
  };
}

// --- The title ----------------------------------------------------------------------------------

export function entryTitle(view: Pick<PortfolioReviewView, "account">): string {
  return t.title(view.account.alias);
}

export function entrySubtitle(view: Pick<PortfolioReviewView, "item">): string {
  return t.subtitle(
    kindWords(view.item.kind),
    formatDateTime(view.item.createdAt),
  );
}

// --- The visual and its profile -----------------------------------------------------------------

function languageName(code: string): string {
  const known = messages.languages as Readonly<Record<string, string>>;
  return known[code] ?? code;
}

export type PortfolioFact = {
  key: keyof typeof t.facts;
  label: string;
  value: string;
};

function fact(key: keyof typeof t.facts, value: string): PortfolioFact {
  return { key, label: t.facts[key], value };
}

/** What the agent reads about the visual and its profile: no handle, no figure, no text but the caption. */
export function portfolioFacts(
  view: Pick<PortfolioReviewView, "item" | "account">,
): PortfolioFact[] {
  const { item, account } = view;
  const facts = [
    fact("alias", account.alias),
    fact("country", countryName(account.countryCode)),
    fact("language", languageName(account.preferredLanguage)),
    fact(
      "owner",
      account.owner?.displayName ?? messages.queueList.ownerOptions.none,
    ),
    fact("kind", kindWords(item.kind)),
    fact("deposited", formatDate(item.createdAt)),
    fact(
      "size",
      `${messages.creatorReview.visuals.dimensions(item.width, item.height)} · ${messages.creatorReview.visuals.kilobytes(Math.max(1, Math.round(item.byteSize / 1024)))}`,
    ),
  ];
  const { replaces } = item;
  if (replaces !== null) {
    const order =
      replaces.displayOrder === null
        ? t.replacesUnordered
        : messages.creatorReview.visuals
            .order(replaces.displayOrder)
            .toLowerCase();
    facts.push(
      fact(
        "replaces",
        t.replaces(
          order,
          replaces.caption === null ? "" : replaces.caption.trim(),
        ),
      ),
    );
  }
  return facts;
}

/** The caption deposited, and whether the creator declared the right to name a brand in it (07 RG82, RG83). */
export function captionWords(view: Pick<PortfolioReviewView, "item">): {
  caption: string;
  declaration: string;
} {
  const { item } = view;
  const caption = item.caption === null ? "" : item.caption.trim();
  return {
    caption: caption === "" ? t.caption.none : caption,
    declaration: item.brandDeclared
      ? t.caption.declared
      : t.caption.notDeclared,
  };
}

// --- The grid of RG79, as written ---------------------------------------------------------------

export type GridRow = {
  number: number;
  label: string;
  /** « 4 · Texte citant le compte… »: the number of the control, then its words. */
  numbered: string;
  /** The reason a refusal carries for this control; none for the face rule and the metadata rule. */
  code: string | null;
  rule: string;
};

/**
 * The nine controls of 07 RG79 in their order, the two that never refuse included (6: a face is admitted,
 * 8: the metadata were removed at the deposit): the grid is shown whole, never reduced to the reasons.
 */
export function gridRows(): GridRow[] {
  return t.grid.rows.map((row) => ({
    number: row.number,
    label: row.label,
    numbered: t.decision.reasonNumber(row.number, row.label),
    code: row.code,
    rule: row.code === null ? t.grid.noRefusal : t.grid.refusedIf,
  }));
}

// --- The reasons of the refusal (07 RG79, RG82, RG83, RG97) -------------------------------------

export type ReasonChoice = {
  code: PortfolioReviewReason["code"];
  /** « 4 · Texte citant le compte… », or the caption reason alone. */
  label: string;
  /** The sentence of the e-mail the creator receives for this reason: what the agent reads is what is sent. */
  message: string;
};

/** The reasons the database accepts, in its order, each with the control of the grid it belongs to. */
export function reasonChoices(
  reasons: readonly PortfolioReviewReason[],
): ReasonChoice[] {
  return [...reasons]
    .sort((left, right) => left.position - right.position)
    .map((reason) => {
      const label = t.decision.reasonLabels[reason.code] ?? reason.code;
      return {
        code: reason.code,
        label:
          reason.gridControl === null
            ? label
            : t.decision.reasonNumber(reason.gridControl, label),
        message: reason.message,
      };
    });
}

// --- The alerts (07 RG93; EC-L2G-12): informative, never a refusal ------------------------------

const SIGNALS = messages.creatorReview.alerts.signals;

export function alertLine(alert: CreatorReviewAlert): string {
  const signals = alert.signals
    .map((signal) => SIGNALS[signal] ?? signal)
    .join(", ");
  return t.alerts.direct_contact(t.alerts.captionField, signals);
}

// --- A closed entry (07 RG78, 15 C8) ------------------------------------------------------------

/** What a closed entry says: how it ended, by whom, the reason of the grid. */
export function closedLines(view: Pick<PortfolioReviewView, "item">): string[] {
  const { item } = view;
  const c = t.closed;
  const lines: string[] = [
    item.state === "approved"
      ? c.approved
      : item.state === "rejected"
        ? c.rejected
        : item.state === "withdrawn" ||
            item.state === "purging" ||
            item.state === "purged"
          ? c.withdrawn
          : c.open,
  ];
  const { decision } = item;
  if (decision !== null) {
    lines.push(
      decision.decidedBy === null
        ? c.decidedAt(formatDateTime(decision.decidedAt))
        : c.decidedBy(
            decision.decidedBy.displayName ??
              messages.queueReview.banner.forcedReleaseUnknown,
            formatDateTime(decision.decidedAt),
          ),
    );
    if (decision.late) {
      lines.push(c.late);
    }
    if (decision.rejectionReasonCode !== null) {
      lines.push(
        c.reason(
          t.decision.reasonLabels[decision.rejectionReasonCode] ??
            decision.rejectionReasonCode,
        ),
      );
    }
  }
  return lines;
}

// --- The decision: an approval, or a refusal with a reason of the grid (07 RG78, RG95, RG97) -----

function problem(
  field: Problem["field"],
  text: string,
): { ok: false; problem: Problem } {
  return { ok: false, problem: { field, text } };
}

/** The comment is facultative: sent only when it holds something, and within the bound. */
function commentOf(draft: Draft): Checked<string | null> {
  const comment = draft.internalComment.trim();
  if (comment.length > INTERNAL_COMMENT_MAX_LENGTH) {
    return problem("internalComment", shared.commentTooLong);
  }
  return { ok: true, body: comment === "" ? null : comment };
}

export function approveCheck(
  draft: Draft,
  reviewToken: string,
): Checked<ApprovePortfolioItemRequest> {
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
 * The refusal as the API takes it: a reason of the grid the opening returned, never another, never a message
 * of the agent to the creator (07 RG97). The comment stays internal.
 */
export function rejectCheck(
  draft: Draft,
  reasonCode: PortfolioReviewReason["code"] | null,
  reasons: readonly PortfolioReviewReason[],
  reviewToken: string,
): Checked<RejectPortfolioItemRequest> {
  const reason = reasons.find((candidate) => candidate.code === reasonCode);
  if (reason === undefined) {
    return problem("reason", t.decision.reasonRequired);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      reviewToken,
      reasonCode: reason.code,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

// --- The exit (17b §2.6) ------------------------------------------------------------------------

/** The confirmation that stays above the next entry: what was decided, in a sentence. */
export function approvedLines(
  view: Pick<PortfolioReviewView, "account">,
  late: boolean,
): string[] {
  const lines = [t.decision.approvedNotice(view.account.alias)];
  if (late) {
    lines.push(shared.lateMark);
  }
  return lines;
}

export function rejectedLines(
  view: Pick<PortfolioReviewView, "account">,
  reasonCode: PortfolioReviewReason["code"],
  late: boolean,
): string[] {
  const lines = [
    t.decision.rejectedNotice(
      view.account.alias,
      (t.decision.reasonLabels[reasonCode] ?? reasonCode).toLowerCase(),
    ),
  ];
  if (late) {
    lines.push(shared.lateMark);
  }
  return lines;
}

// Queue 9, « sélection par l'équipe INFLUX », in words (docs/mvp/10 RG61, RG84; 15 RG26 to RG28, C1 to C3, AL23;
// 17b §2, I13; jalons/l3g/modele.md §5, §8; l3g-fiche invariants 11, 12, 13; L3G-13). Pure functions, outside the
// components. No rule is decided here (apps/api says what is overdue, who holds what, which requests the caller may
// see, and the database refuses what is not allowed): this module words the list, adapts the opening to the frame
// the claimed queues share, checks the closure before it is sent and writes what the chain says after it. The
// message of the brand is shown as plain text only: the server neutralizes the bidirectional controls (L3FS-7) and
// this module does it again before the text reaches the screen, so that a text of any origin reads left to right
// as typed. No amount, no tariff, no creator anywhere (D48, D78).
import {
  TEAM_SELECTION_NOTE_MAX_LENGTH,
  TEAM_SELECTION_NOTE_MIN_LENGTH,
  type CloseTeamSelectionRequest,
  type OpenTeamSelectionResponse,
  type TeamSelectionCloseReason,
  type TeamSelectionEntryRow,
  type TeamSelectionRequest,
} from "@influx/contracts/backoffice-queues";
import { messages } from "@/messages/fr";
import type { ClaimedView } from "./claimed-entry-view";
import {
  criteriaOf,
  languageWords,
  type Filters,
} from "./identified-search-view";
import type { Checked } from "./verification-decision-view";
import { formatDate, formatDateTime } from "./view-model";

const t = messages.teamSelectionQueue;
const r = messages.teamSelectionReview;

/** The address of the screen of the queue, and of one of its entries (`${LIST}/${id}`). */
export const TEAM_SELECTION_LIST = "/files/selections-equipe";

// --- Plain text (L3FS-7) ---------------------------------------------------------------------------------

/**
 * The bidirectional controls (U+202A to U+202E, U+2066 to U+2069, the two marks and the Arabic letter mark) and
 * every control character but the line break and the tab: a text of a brand cannot reorder what is around it.
 */
const HIDDEN_CONTROLS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F؜‎‏‪-‮⁦-⁩]/g;

export function plainText(text: string): string {
  return text.replace(HIDDEN_CONTROLS, "");
}

// --- The list ------------------------------------------------------------------------------------------------

/** A row of the list as the template reads it: the queue has no stage of escalation of its own (15 RG37). */
export type TeamSelectionListRow = TeamSelectionEntryRow & {
  escalateAt: null;
};

export function listRowOf(row: TeamSelectionEntryRow): TeamSelectionListRow {
  return { ...row, escalateAt: null };
}

export function selectionBrandWords(
  row: Pick<TeamSelectionEntryRow, "brandName">,
): string {
  return row.brandName === null || row.brandName.trim() === ""
    ? t.unknownBrand
    : plainText(row.brandName);
}

export function selectionCampaignWords(
  row: Pick<TeamSelectionEntryRow, "campaignTitle" | "campaignId">,
): string {
  if (row.campaignId === null) {
    return t.noCampaign;
  }
  return row.campaignTitle === null || row.campaignTitle.trim() === ""
    ? t.untitledCampaign
    : plainText(row.campaignTitle);
}

// --- The opening, as the frame of the claimed queues reads it ---------------------------------------------

/** What the decision screen reads of an opening: the frame's view, plus the request itself. */
export type TeamSelectionView = ClaimedView & {
  request: TeamSelectionRequest;
};

/**
 * The opening of queue 9 in the shape the claimed queues share. The queue has no version of a dossier to bind a
 * decision to: the database checks the live claim at the closure (55P03). `reviewToken` is therefore only the mark
 * of the holder (present when the claim is the caller's, which is what makes the screen decide), never sent.
 */
export function teamSelectionViewOf(
  data: OpenTeamSelectionResponse,
): TeamSelectionView {
  const { request } = data;
  return {
    asOf: data.asOf,
    outcome: data.outcome,
    reviewToken:
      data.outcome === "claimed" || data.outcome === "held" ? request.id : null,
    entry: {
      id: request.id,
      state: request.state,
      slaDueAt: request.slaDueAt,
      escalateAt: null,
      overdue: request.overdue,
      claim: {
        holder: data.holder,
        claimedAt: data.claimedAt,
        claimExpiresAt: data.claimExpiresAt,
        heldByCaller: data.outcome === "claimed" || data.outcome === "held",
      },
      lastForcedRelease: null,
    },
    request,
  };
}

export function entryTitle(view: TeamSelectionView): string {
  const { brandName } = view.request;
  return r.title(
    brandName === null || brandName.trim() === "" ? null : plainText(brandName),
  );
}

export function entrySubtitle(view: TeamSelectionView): string {
  const { request } = view;
  return r.subtitle(
    request.campaign === null
      ? null
      : request.campaign.title === null
        ? t.untitledCampaign
        : plainText(request.campaign.title),
    languageWords(request.language),
    formatDate(request.createdAt),
  );
}

/** The criteria the brand entered, one text each (the chips of the search, never a count nor a band). */
export function criteriaTexts(
  request: Pick<TeamSelectionRequest, "filters">,
): string[] {
  return criteriaOf(request.filters as Filters).map(
    (criterion) => criterion.text,
  );
}

// --- The closure ---------------------------------------------------------------------------------------------

/** The closure as the agent typed it, checked before the call: a reason, and a note for `other` alone (17b I13). */
export function closeCheck(
  reasonCode: TeamSelectionCloseReason | null,
  note: string,
): Checked<CloseTeamSelectionRequest> {
  const d = r.decision;
  if (reasonCode === null) {
    return { ok: false, problem: { field: "reason", text: d.reasonRequired } };
  }
  if (reasonCode !== "other") {
    return { ok: true, body: { reasonCode } };
  }
  const trimmed = plainText(note).trim();
  if (
    trimmed.length < TEAM_SELECTION_NOTE_MIN_LENGTH ||
    trimmed.length > TEAM_SELECTION_NOTE_MAX_LENGTH
  ) {
    return {
      ok: false,
      problem: {
        field: "note",
        text: d.noteRequired(
          TEAM_SELECTION_NOTE_MIN_LENGTH,
          TEAM_SELECTION_NOTE_MAX_LENGTH,
        ),
      },
    };
  }
  return { ok: true, body: { reasonCode, note: trimmed } };
}

/** The confirmation that stays above the next request (17b §2.6): what was closed, and why. */
export function closedLines(
  view: TeamSelectionView,
  reasonCode: TeamSelectionCloseReason,
): string[] {
  const { brandName } = view.request;
  return [
    r.decision.closedNotice(
      brandName === null || brandName.trim() === ""
        ? t.unknownBrand
        : plainText(brandName),
      (r.decision.reasons[reasonCode] ?? reasonCode).toLowerCase(),
    ),
  ];
}

/** The closure of a request already closed, in a sentence: who, when, why (the note only for `other`). */
export function closureWords(
  closure: NonNullable<TeamSelectionRequest["closure"]>,
): { line: string; note: string | null } {
  return {
    line: r.closed.line(
      formatDateTime(closure.closedAt),
      closure.closedBy?.displayName ?? null,
      r.decision.reasons[closure.reasonCode] ?? closure.reasonCode,
    ),
    note: closure.note === null ? null : plainText(closure.note),
  };
}

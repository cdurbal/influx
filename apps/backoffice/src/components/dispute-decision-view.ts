// What the decision screen of a contest decides to show and to send, computed from the answers of apps/api
// (docs/mvp/08 RG77, CA52, CA53; 15 RG27 C6; jalons/l2f/modele.md §1 points 9 and 10, §3 « 0232 »; L2F-19).
// Pure functions, outside the components: what an overturn types (by what was contested), the checks of the
// two bodies, the motives offered, the notices over the next entry. The agent TYPES what he reads, nothing is
// pre-filled (CA25): the figures of the dossier are never served (the contract has none). No rule is decided
// here: the database says who may judge, whether the badge can be given back and whether the handle matches.
import {
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  type DisputeOpenResponse,
  type DisputeOutcomeReasonRow,
  type OverturnDisputeRequest,
  type UpholdDisputeRequest,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  accountGrantCheck,
  audienceGrantCheck,
  commentOf,
  handleOf,
  type Checked,
  type Draft,
} from "./verification-decision-view";
import { networkWords } from "./verification-queue-view";
import { formatDateTime } from "./view-model";

const t = messages.disputeReview;

export type DisputePanel = "uphold" | "overturn";

/** What an overturn types, by what was contested (modele §3): a refused account, a refused audience, a withdrawal. */
export type OverturnTarget = OverturnDisputeRequest["target"];

/** Null until the dossier is served: only the holder of the live claim reads what was contested. */
export function overturnTargetOf(
  view: DisputeOpenResponse,
): OverturnTarget | null {
  if (view.dossier === null) {
    return null;
  }
  if (view.dossier.kind === "revocation") {
    return "revocation";
  }
  return view.entry.level === "audience_verified"
    ? "refusal_audience"
    : "refusal_account";
}

/** The motives of an upheld contest, in the order the database serves them (`position`). */
export function upholdReasonsOf(
  view: DisputeOpenResponse,
): readonly DisputeOutcomeReasonRow[] {
  return view.outcomeReasons.filter((reason) => reason.outcome === "upheld");
}

/** The sentence the creator receives when the decision is overturned: said before the gesture (RG66's spirit). */
export function overturnedMessageOf(view: DisputeOpenResponse): string | null {
  return (
    view.outcomeReasons.find((reason) => reason.outcome === "overturned")
      ?.message ?? null
  );
}

/** The lead of the overturn panel: what the agent reads and types, then what the badge becomes. */
export function overturnLead(target: OverturnTarget): string {
  switch (target) {
    case "refusal_account":
      return t.decision.overturnLeadRefusalAccount;
    case "refusal_audience":
      return t.decision.overturnLeadRefusalAudience;
    case "revocation":
      return t.decision.overturnLeadRevocation;
  }
}

/**
 * `uphold`: a motive of the upheld ones; the team's own text only for the motive that requires it (20 to 500
 * characters; a contact in it is refused by apps/api, RG19), never for the others (the API refuses it).
 */
export function upholdCheck(
  draft: Draft,
  outcomeCode: string | null,
  reasons: readonly DisputeOutcomeReasonRow[],
  reviewToken: string,
): Checked<UpholdDisputeRequest> {
  const reason = reasons.find((candidate) => candidate.code === outcomeCode);
  if (reason === undefined) {
    return {
      ok: false,
      problem: { field: "reason", text: t.decision.upholdRequired },
    };
  }
  let memberMessage: string | undefined;
  if (reason.requiresMemberMessage) {
    const text = draft.memberMessage.trim();
    if (text.length < VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH) {
      return {
        ok: false,
        problem: { field: "memberMessage", text: t.decision.messageTooShort },
      };
    }
    if (text.length > VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH) {
      return {
        ok: false,
        problem: { field: "memberMessage", text: t.decision.messageTooLong },
      };
    }
    memberMessage = text;
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      reviewToken,
      outcomeReasonCode:
        reason.code as UpholdDisputeRequest["outcomeReasonCode"],
      ...(memberMessage === undefined ? {} : { memberMessage }),
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

/** `overturn`: the bodies of the grants of queue 4, by what was contested, with the identifier typed again (0228). */
export function overturnCheck(
  target: OverturnTarget,
  draft: Draft,
  reviewToken: string,
): Checked<OverturnDisputeRequest> {
  if (target === "refusal_account") {
    const checked = accountGrantCheck(draft, reviewToken);
    return checked.ok
      ? { ok: true, body: { target, ...checked.body } }
      : checked;
  }
  if (target === "refusal_audience") {
    const checked = audienceGrantCheck(draft, reviewToken);
    return checked.ok
      ? { ok: true, body: { target, ...checked.body } }
      : checked;
  }
  const handle = handleOf(draft);
  if (!handle.ok) {
    return handle;
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      target,
      reviewToken,
      observedHandle: handle.body,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

/** The line over the next entry after an upheld contest (17b §2.6). */
export function upheldNotice(
  view: DisputeOpenResponse,
  late: boolean,
): string[] {
  const lines: string[] = [
    t.notices.upheld(
      messages.disputeQueue.kinds[view.entry.kind],
      networkWords(view.entry.networkCode),
    ),
  ];
  if (late) {
    lines.push(messages.claimedReview.late);
  }
  return lines;
}

export function overturnedNotice(
  view: DisputeOpenResponse,
  late: boolean,
): string[] {
  const network = networkWords(view.entry.networkCode);
  const lines: string[] = [
    view.entry.kind === "refusal"
      ? t.notices.overturnedRefusal(network)
      : t.notices.overturnedRevocation(network),
  ];
  if (late) {
    lines.push(messages.claimedReview.late);
  }
  return lines;
}

/** The moment from which a decider alone may judge, said in the dossier (`delayed` mode); null when not applicable. */
export function reflectionLine(
  view: DisputeOpenResponse,
  asOf: string,
): string | null {
  const dossier = view.dossier;
  if (dossier === null) {
    return null;
  }
  if (dossier.reviewMode === "independent") {
    return t.mode.independent;
  }
  if (
    dossier.reflectionUntil === null ||
    Date.parse(dossier.reflectionUntil) <= Date.parse(asOf)
  ) {
    return t.mode.delayedElapsed;
  }
  return t.mode.delayed(formatDateTime(dossier.reflectionUntil));
}

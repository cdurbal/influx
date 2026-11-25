// What the decision screen of an identifier change decides to show and to send (docs/mvp/08 RG78, CA54; 15
// RG29; jalons/l2f/modele.md §1 points 12 and 13, §3 « 0233 »; L2F-19). Pure functions, outside the
// components: the checks of the two bodies and the notices over the next entry. The agent TYPES the handle
// he reads on the public profile (nothing is pre-filled, CA25); the database compares it with the one the
// creator declares (0228) and says so. No rule is decided here.
import type {
  ConfirmIdentifierChangeRequest,
  IdentifierChangeOpenResponse,
  RequireIdentifierProofRequest,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  commentOf,
  handleOf,
  type Checked,
  type Draft,
} from "./verification-decision-view";
import { networkWords } from "./verification-queue-view";

const t = messages.identifierReview;

export type IdentifierPanel = "confirm" | "proof";

/** `confirm` (« même compte »): the handle typed, and an optional internal comment; the badge is never rewritten. */
export function confirmCheck(
  draft: Draft,
  reviewToken: string,
): Checked<ConfirmIdentifierChangeRequest> {
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
      reviewToken,
      observedHandle: handle.body,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

/** `require-proof`: no free text and no handle; only an optional internal comment. */
export function proofCheck(
  draft: Draft,
  reviewToken: string,
): Checked<RequireIdentifierProofRequest> {
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      reviewToken,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

export function confirmedNotice(
  view: IdentifierChangeOpenResponse,
  late: boolean,
): string[] {
  const lines = [t.notices.confirmed(networkWords(view.entry.networkCode))];
  if (late) {
    lines.push(messages.claimedReview.late);
  }
  return lines;
}

export function proofNotice(
  view: IdentifierChangeOpenResponse,
  late: boolean,
): string[] {
  const lines = [t.notices.proof(networkWords(view.entry.networkCode))];
  if (late) {
    lines.push(messages.claimedReview.late);
  }
  return lines;
}

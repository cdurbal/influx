// What the page of a creator says of the publication of the profile (docs/mvp/17 §5.2; 07 RG4, RG5,
// RG8, RG10, RG90, RG96; jalons/l2g, commit 13): which state calls for which part of the card, which
// refusal and which revisions are told, where the first missing field is. Pure functions,
// unit-tested (tests/creator-publication-view.test.ts); the components only display. The status, the
// missing fields and the refusal are the API's answers: nothing of the rules of publication is
// decided here (an agent publishes or refuses, RG5; the list is the base's, RG90). No amount, rate,
// net or price (D48, D78).
import type {
  CreatorPendingRevision,
  CreatorProfileResponse,
  CreatorRejectionReasonCode,
} from "@influx/contracts/creator-profile";
import {
  sectionAnchorOf,
  sectionOfRequired,
  type RequiredCode,
} from "./creator-profile-view";

/**
 * What the card offers for a state: `submit` the button « Publier mon profil » (a draft, a refused
 * profile resubmitted at once, RG10); `waiting` the answer within one business day; `published` the
 * published profile, whose later changes are reviewed on their own (RG9); `suspended` nothing to do.
 */
export type PublicationMode = "submit" | "waiting" | "published" | "suspended";

export function publicationModeOf(
  status: CreatorProfileResponse["status"],
): PublicationMode {
  switch (status) {
    case "draft":
    case "rejected":
      return "submit";
    case "pending_review":
      return "waiting";
    case "published":
      return "published";
    case "suspended":
      return "suspended";
  }
}

/** The refusal told to the creator: its reason, the step that follows and, for `other` alone, the message of the agent. */
export type RefusalView = {
  /** `revision`: a change of a published profile was refused, the profile stays as it was (CA48). */
  kind: "submission" | "revision";
  reasonKey: `rejection.${CreatorRejectionReasonCode}`;
  nextStep: "fix" | "contact";
  memberMessage: string | null;
};

/**
 * The refusal to show, if any. A refused submission is told while the profile is refused (RG10); the
 * refusal of a revision while the profile is published (the previous version stays); a refusal that
 * the profile has left (submitted again, or published since) is told no more.
 */
export function refusalViewOf(
  profile: Pick<CreatorProfileResponse, "status" | "refusal">,
): RefusalView | null {
  const refusal = profile.refusal;
  if (refusal === null) {
    return null;
  }
  const shown =
    refusal.kind === "submission"
      ? profile.status === "rejected"
      : profile.status === "published";
  if (!shown) {
    return null;
  }
  return {
    kind: refusal.kind,
    reasonKey: `rejection.${refusal.reasonCode}`,
    nextStep: refusal.nextStep,
    memberMessage: refusal.memberMessage,
  };
}

/** The moderated fields whose change waits for a decision, each once, in the order the API names them. */
export function pendingFieldsOf(
  revisions: readonly CreatorPendingRevision[],
): CreatorPendingRevision["field"][] {
  const fields: CreatorPendingRevision["field"][] = [];
  for (const { field } of revisions) {
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

/** The id of the section of the first field that is missing: where the button leads (the list is in the order of the form). */
export function firstMissingAnchorOf(
  missing: readonly RequiredCode[],
): string | null {
  const first = missing[0];
  return first === undefined ? null : sectionAnchorOf(sectionOfRequired(first));
}

/** Whether the creator holds an active « Compte vérifié »: the API lists it as missing until then (08 RG16). */
export function accountVerifiedOf(missing: readonly RequiredCode[]): boolean {
  return !missing.includes("accountVerified");
}

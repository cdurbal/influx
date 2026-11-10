// The origin of a verification request, in words (docs/mvp/06 RG51; jalons/l2f/modele.md §6; D83 A and
// A-bis; L2F-20): who opened it, why, and whether the verified login address proves the domain of a brand.
// Pure functions of the dossier of queue 4, outside the components. Agents only: the comment is internal and
// never echoed to the member; the login address itself is never shown (the base says yes or no).
import type {
  VerificationOpenResponse,
  VerificationOpening,
  VerificationQueueEntryRow,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import { reasonWords } from "./account-opening-view";

const t = messages.verificationReview.opening;
const q = messages.verificationQueue;

export type OpeningLines = {
  origin: string;
  reason: string | null;
  comment: string | null;
};

/** What the dossier says of the opening: the origin always; the reason and the comment of an agent's only. */
export function openingLines(opening: VerificationOpening): OpeningLines {
  const agent = opening.openedBy === "agent";
  return {
    origin: agent ? t.agent : t.member,
    reason:
      agent && opening.reasonCode !== null
        ? t.reason(reasonWords(opening.reasonCode))
        : null,
    comment: agent ? opening.comment : null,
  };
}

/** The column « Ouverte par » of the list. */
export function openedByWords(
  row: Pick<VerificationQueueEntryRow, "openedBy">,
): string {
  return q.openedBy[row.openedBy];
}

/** Whether the grant on the login address is offered: a brand whose login address the base accepts. */
export function loginProofOffered(view: VerificationOpenResponse): boolean {
  return (
    view.entry.level === "brand_verified" &&
    view.dossier?.opening.loginAddressEligible === true
  );
}

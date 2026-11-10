// Server side of the contest page (docs/mvp/08 RG77; jalons/l2f/modele.md §5, EC-L2F-15, commit 17): the
// decision arrives as the `request` (a refusal) or the `badge` (a withdrawal) of the query, never as a
// segment of the path, and is read here, once, as one identifier of the right shape or a 404. The screen
// then asks the API what the creator may contest: a decision that is not his own is "no such decision"
// there too (T14).
import { notFound } from "next/navigation";
import {
  APPEAL_BADGE_PARAMETER,
  APPEAL_REQUEST_PARAMETER,
  type AppealTarget,
} from "@/lib/member-paths";

const IDENTIFIER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The decision of the contest, from the query of the page; none, both, or an identifier of another shape is a 404. */
export function appealTargetOf(
  searchParams: Record<string, string | string[] | undefined>,
): AppealTarget {
  const request = searchParams[APPEAL_REQUEST_PARAMETER];
  const badge = searchParams[APPEAL_BADGE_PARAMETER];
  if (typeof request === "string" && badge === undefined) {
    if (IDENTIFIER.test(request)) {
      return { kind: "refusal", requestId: request };
    }
  } else if (typeof badge === "string" && request === undefined) {
    if (IDENTIFIER.test(badge)) {
      return { kind: "revocation", badgeId: badge };
    }
  }
  notFound();
}

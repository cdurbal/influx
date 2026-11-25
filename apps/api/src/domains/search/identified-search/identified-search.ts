// The identified creator search of the INFLUX agents, from the answer of the doors of the base to the
// strict contract (docs/mvp/10 RG71 to RG73, RG78; CA56, CA58; D45, D46, D48, D78; jalons/l3g/modele.md
// §1, §4, §8; fiche invariants 2, 4, 5, 12). Nothing is read here but what a door returned, and its
// answer is checked WHOLE and strict before it leaves:
// - a row holds the keys of modele §1 and no other: no e-mail, no phone, no address (D46), no rate nor
//   budget (D78), no rank, no score; the reasons are codes and bands (RG77);
// - the prefill holds codes of the six facets it may propose, never a band of the budget (D78).
// A door's answer of another shape fails here (a 500), rather than reach the screen.
import {
  campaignPrefillResponseSchema,
  identifiedCreatorSearchResponseSchema,
  type CampaignPrefillResponse,
  type IdentifiedCreatorSearchBody,
  type IdentifiedCreatorSearchResponse,
} from "@influx/contracts/identified-creator-search";
import * as z from "zod";
import type { Transaction } from "../../../db/index.ts";
import {
  callCampaignPrefillDoor,
  callIdentifiedSearchDoor,
} from "./repository.ts";

/** The refusal the base committed with its line: answered after the COMMIT (RG76). */
export type IdentifiedSearchPageCap = { state: "page_cap" };

const doorAnswerSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("page_cap") }),
  identifiedCreatorSearchResponseSchema,
]);

/** POST /v1/bo/creator-search: the page of rows, or the cap the base journaled. */
export async function searchCreatorsIdentified(
  tx: Transaction,
  body: IdentifiedCreatorSearchBody,
): Promise<IdentifiedCreatorSearchResponse | IdentifiedSearchPageCap> {
  const answer = doorAnswerSchema.parse(
    await callIdentifiedSearchDoor(
      tx,
      body.filters,
      body.sort,
      body.page,
      body.campaignId?.toLowerCase() ?? null,
      body.prefillId?.toLowerCase() ?? null,
    ),
  );
  return answer;
}

/** Whether an answer is the cap of pages rather than what the route serves. */
export function isIdentifiedSearchPageCap(
  value: IdentifiedCreatorSearchResponse | IdentifiedSearchPageCap,
): value is IdentifiedSearchPageCap {
  return value.state === "page_cap";
}

/** POST /v1/bo/campaigns/:id/creator-prefill: the filters drawn from the brief, journaled. */
export async function prefillCampaignFilters(
  tx: Transaction,
  campaignId: string,
): Promise<CampaignPrefillResponse> {
  return campaignPrefillResponseSchema.parse(
    await callCampaignPrefillDoor(tx, campaignId.toLowerCase()),
  );
}

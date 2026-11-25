// The brand's anonymous creator search, from the answer of the door of the base to the strict contract
// (docs/mvp/10 RG41, RG42, RG57 to RG59, RG63, RG65; CA1, CA3, CA35, CA65; D48, D78; jalons/l3e/
// modele.md §2, §4, §5, §7; fiche invariants 2, 3, 8, 13). Nothing is read here but what the door
// returned, and its answer is checked WHOLE and strict before anything is chosen from it:
// - the states without a list carry nothing else (CA35: the same answer for 0 and 4);
// - a card's creator is profiles.creator_layer_a() as the door serves it (no status, no key of a
//   line), shaped by THE public projection (profiles/creator/public-projection.ts), never here;
// - its reasons are codes and bands, the exact keys of search.explanation_reasons (0316), and its
//   note one code or null; the rank, the cold quota and the account of the creator never come out
//   of the base (modele §2, §6).
// A door's answer of another shape fails here (a 500), rather than reach a brand.
import { resultCountBandSchema } from "@influx/contracts/search-settings";
import {
  creatorSearchReasonSchema,
  creatorSearchResponseSchema,
  creatorSearchVigilanceSchema,
  type CreatorSearchBody,
  type CreatorSearchResponse,
} from "@influx/contracts/creator-search";
import * as z from "zod";
import type { Transaction } from "../../../db/index.ts";
import { searchCardProjectionOf } from "../../profiles/creator/public-projection.ts";
import { callCreatorSearchDoor } from "./repository.ts";

/** A refusal the base committed with its line: answered after the COMMIT (modele §4, §5, §8). */
export type CreatorSearchRefusal =
  { state: "rate_limited"; retryAfterSeconds: number } | { state: "page_cap" };

/** One card of the door (0320 §2.2): the layer A of its one source, its reasons, its note. */
const doorCardSchema = z.strictObject({
  creator: z.unknown(),
  reasons: z.array(creatorSearchReasonSchema).min(2).max(4),
  vigilance: creatorSearchVigilanceSchema.nullable(),
});

const doorAnswerSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("closed") }),
  z.strictObject({ state: z.literal("brand_not_published") }),
  z.strictObject({ state: z.literal("too_narrow") }),
  z.strictObject({
    state: z.literal("rate_limited"),
    retryAfterSeconds: z.number().int().min(1),
  }),
  z.strictObject({ state: z.literal("page_cap") }),
  z.strictObject({
    state: z.literal("results"),
    countBand: resultCountBandSchema,
    page: z.number().int().min(1),
    nextPage: z.number().int().min(2).nullable(),
    capReached: z.boolean(),
    cards: z.array(doorCardSchema),
  }),
]);

/** POST /v1/creator-search: a state, the results, or the refusal the base journaled. */
export async function searchCreators(
  tx: Transaction,
  body: CreatorSearchBody,
): Promise<CreatorSearchResponse | CreatorSearchRefusal> {
  const answer = doorAnswerSchema.parse(
    await callCreatorSearchDoor(
      tx,
      body.filters,
      body.sort,
      body.page,
      body.campaignId?.toLowerCase() ?? null,
    ),
  );
  switch (answer.state) {
    case "rate_limited":
    case "page_cap":
      return answer;
    case "results":
      return creatorSearchResponseSchema.parse({
        state: "results",
        countBand: answer.countBand,
        page: answer.page,
        nextPage: answer.nextPage,
        capReached: answer.capReached,
        cards: answer.cards.map((card) => ({
          creator: searchCardProjectionOf(card.creator),
          reasons: card.reasons,
          vigilance: card.vigilance,
        })),
      });
    default:
      return creatorSearchResponseSchema.parse({ state: answer.state });
  }
}

/** Whether an answer is a refusal of the base rather than what the route serves. */
export function isCreatorSearchRefusal(
  value: CreatorSearchResponse | CreatorSearchRefusal,
): value is CreatorSearchRefusal {
  return value.state === "rate_limited" || value.state === "page_cap";
}

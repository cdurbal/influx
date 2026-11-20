// Contract of the brand's request for a selection by the INFLUX team (docs/mvp/10 RG1, RG17, RG61,
// RG63; CA39, CA64; D45, D46, D48, D78; jalons/l3f/modele.md §6, §8, which prevails for every name).
// Shared by apps/api and apps/web. One route, for a brand alone: POST /v1/me/selection-requests, the
// door search.request_team_selection() of 0325.
// - The entry is CLOSED: the filters of the search (the same closed entry, F12 suspended while D78
//   holds), the campaign of origin (one of the brand's own, admitted) and a free message of 1 to 1 000
//   characters; no other key (400), no price, rate, currency nor budget (D48, D78).
// - The button is permanent (RG61): the switch closed (D38) and a search below k do not refuse it. The
//   answer is a state: `brand_not_published` (RG1) or `requested` with the deadline of the team's answer.
//   The bucket of the brand full is 429 `rate_limited` with Retry-After (nothing written).
// - A campaign not admitted or of another brand: the answer of a route that does not exist (404); a
//   filter the base refuses or a message out of bounds: 400 `validation_failed`.
// The request creates no introduction, no conversation, no lead and writes nothing to a creator (D45,
// CA64): the message is read by the agents alone (D46).
import { z } from "./zod.ts";
import { creatorSearchFiltersSchema } from "./creator-search.ts";

/** The issue of `message` the base refused (22023 DETAIL message). */
export const SELECTION_MESSAGE_ISSUE = "invalid_message";

/**
 * POST /v1/me/selection-requests: every criterion entered (`filters`, the entry of the search, possibly
 * empty), the campaign of origin if any, the brand's message if any. The base trims the message and
 * holds 1 to 1 000 characters; the bound here only keeps a body small.
 */
export const selectionRequestBodySchema = z.strictObject({
  filters: creatorSearchFiltersSchema,
  campaignId: z.uuid().nullable().default(null),
  message: z.string().min(1).max(4000).nullable().default(null),
});
export type SelectionRequestBody = z.infer<typeof selectionRequestBodySchema>;

/** POST /v1/me/selection-requests, 200: a state alone, or the deadline of the team's answer (RG61). */
export const selectionRequestResponseSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("brand_not_published") }),
  z.strictObject({
    state: z.literal("requested"),
    /** The deadline of queue 9, frozen at the deposit (04 §5.6); never a promise of a number of creators. */
    answerBy: z.iso.datetime(),
  }),
]);
export type SelectionRequestResponse = z.infer<
  typeof selectionRequestResponseSchema
>;

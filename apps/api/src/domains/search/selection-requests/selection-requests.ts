// The brand's request for a selection by the INFLUX team, from the answer of the door of the base to the
// strict contract (docs/mvp/10 RG61, CA39, CA64; D45, D46; jalons/l3f/modele.md §6, §8; fiche
// invariants 6, 10). The door's answer is checked WHOLE and strict before anything is chosen from it:
// `requested` carries the deadline of the team's answer and nothing else (no identifier of the request,
// no filter, no message echoed); the bucket of the brand full is a refusal of the base, answered as
// 429 by the route. A door's answer of another shape fails here (a 500), rather than reach a brand.
import {
  selectionRequestResponseSchema,
  type SelectionRequestBody,
  type SelectionRequestResponse,
} from "@influx/contracts/selection-requests";
import * as z from "zod";
import type { Transaction } from "../../../db/index.ts";
import { callRequestTeamSelection } from "./repository.ts";

/** The bucket of the brand full: nothing was written, answered as 429 with its delay (modele §6). */
export type SelectionRequestRefusal = {
  state: "rate_limited";
  retryAfterSeconds: number;
};

const doorAnswerSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("brand_not_published") }),
  z.strictObject({
    state: z.literal("rate_limited"),
    retryAfterSeconds: z.number().int().min(1),
  }),
  z.strictObject({ state: z.literal("requested"), answerBy: z.string() }),
]);

/** POST /v1/me/selection-requests: a state, the deadline of the answer, or the refusal of the bucket. */
export async function requestTeamSelection(
  tx: Transaction,
  body: SelectionRequestBody,
): Promise<SelectionRequestResponse | SelectionRequestRefusal> {
  const answer = doorAnswerSchema.parse(
    await callRequestTeamSelection(
      tx,
      body.filters,
      body.campaignId?.toLowerCase() ?? null,
      body.message,
    ),
  );
  if (answer.state === "rate_limited") {
    return answer;
  }
  return selectionRequestResponseSchema.parse(answer);
}

/** Whether an answer is a refusal of the base rather than what the route serves. */
export function isSelectionRequestRefusal(
  value: SelectionRequestResponse | SelectionRequestRefusal,
): value is SelectionRequestRefusal {
  return value.state === "rate_limited";
}

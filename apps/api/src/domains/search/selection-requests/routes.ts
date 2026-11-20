// Route of the brand's request for a selection by the INFLUX team (docs/mvp/10 RG1, RG61, RG63; CA39,
// CA64; 18 T14; D45, D46; jalons/l3f/modele.md §6, §8; fiche invariants 6, 10, 15). Web surface only,
// member session required, advertiser role only.
// - POST /v1/me/selection-requests  {filters, campaignId?, message?}  the deadline of the team's answer
// The write goes through the door search.request_team_selection() (0325), which checks the caller, the
// brand's profile (RG1) and the bucket of the account, then the filters, the campaign and the message,
// and writes the request with its line of the register. The switch (D38) and the threshold of k are
// ignored: the button is permanent (RG61, CA59). A refusal is answered as the model says:
// - the bucket of the brand full (`requestsPerDay`): 429 rate_limited with Retry-After, AFTER the
//   COMMIT of a transaction that wrote nothing;
// Refused by the door before anything is written, the transaction rolled back:
// - a filter the base refuses (a facet closed, F12 while D78 holds) or a message out of bounds: 400
//   validation_failed on `filters` or `message` (22023);
// - a campaign unknown, of another brand, draft, rejected or erased: 404 not_found, the same code and
//   body as an address that does not exist (P0002, T14.3, T14.4);
// - the caller refused by the door (an account no longer active): the state of RG1.
// Any role but advertiser gets the answer of a route that does not exist (T14.3), before the door is
// called. The rate per client address (10 a minute) is server.ts's (platform/member-rate.ts), before
// the session. Every answer is `no-store`. Nothing is sent to a creator, to the outbox, to Brevo nor to
// Apollo, and no introduction nor conversation is made (D45, CA64): the agents read it (D46).
import { CREATOR_SEARCH_FILTERS_ISSUE } from "@influx/contracts/creator-search";
import {
  SELECTION_MESSAGE_ISSUE,
  selectionRequestBodySchema,
  selectionRequestResponseSchema,
  type SelectionRequestBody,
  type SelectionRequestResponse,
} from "@influx/contracts/selection-requests";
import type { FastifyRequest } from "fastify";
import type { ApiDatabase } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RetryLaterError } from "../../../platform/errors.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import { asAdvertiser } from "../brand-session.ts";
import {
  isSelectionRequestRefusal,
  requestTeamSelection,
  type SelectionRequestRefusal,
} from "./selection-requests.ts";

export type SelectionRequestRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export const SELECTION_REQUESTS_ROUTE = "/v1/me/selection-requests";

/** The answer of the bucket full, which the base wrote nothing for; the line names no account (D60). */
function refuse(
  request: FastifyRequest,
  refusal: SelectionRequestRefusal,
): never {
  request.log.info(
    { outcome: refusal.state },
    "search.selection_request.refused",
  );
  throw new RetryLaterError("rate_limited", refusal.retryAfterSeconds);
}

/** A refusal the door raised before writing anything, as the answer of the API; else null. */
function doorRefusalOf(
  error: unknown,
): SelectionRequestResponse | Error | null {
  const state = sqlStateOf(error);
  const detail = sqlDetailOf(error);
  if (state === "55P03") {
    // lock_timeout on the account's lock (0327): a call waiting more than a second behind another
    // of the same account is asked to come back, never a fault
    return new RetryLaterError("rate_limited", 1);
  }
  if (state === "42501" && sqlMessageOf(error) === "forbidden") {
    // a missing GRANT is 42501 too, with another message: a fault, never this answer
    return selectionRequestResponseSchema.parse({
      state: "brand_not_published",
    });
  }
  if (state === "22023" && detail === "filters") {
    return new ApiError("validation_failed", [
      { path: "filters", issue: CREATOR_SEARCH_FILTERS_ISSUE },
    ]);
  }
  if (state === "22023" && detail === "message") {
    return new ApiError("validation_failed", [
      { path: "message", issue: SELECTION_MESSAGE_ISSUE },
    ]);
  }
  if (state === "P0002" && detail === "campaign") {
    // T14.3, T14.4: another brand's campaign answers as one that does not exist
    return new ApiError("not_found");
  }
  return null;
}

export function registerSelectionRequestRoutes(
  app: IdentityApp,
  dependencies: SelectionRequestRoutesDependencies,
): void {
  const { database, now } = dependencies;

  app.post(
    SELECTION_REQUESTS_ROUTE,
    {
      schema: {
        body: selectionRequestBodySchema,
        response: { 200: selectionRequestResponseSchema },
      },
    },
    async (request, reply): Promise<SelectionRequestResponse> => {
      void reply.header("cache-control", "no-store");
      const body = request.body as SelectionRequestBody;
      let answer: SelectionRequestResponse | SelectionRequestRefusal;
      try {
        answer = await asAdvertiser(database, now, request, reply, (tx) =>
          requestTeamSelection(tx, body),
        );
      } catch (error) {
        const refusal = doorRefusalOf(error);
        if (refusal === null) {
          throw error;
        }
        if (refusal instanceof Error) {
          throw refusal;
        }
        return refusal;
      }
      if (isSelectionRequestRefusal(answer)) {
        refuse(request, answer);
      }
      return answer;
    },
  );
}

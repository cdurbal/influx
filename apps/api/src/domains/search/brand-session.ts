// The member session of a brand, for the routes of the schema `search` that only a brand reaches (the
// shortlists, the request for a selection; jalons/l3f/modele.md §8; 18 T14.3). Any other role gets the
// answer of a route that does not exist, BEFORE any door is called, and before the terms gate, as the
// search and the campaign routes do (the terms of service are checked here, the session being exempt).
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../identity/member-session.ts";

/** Runs `work` in the transaction of the brand's session: another role is "no such route" (T14.3). */
export function asAdvertiser<T>(
  database: ApiDatabase,
  now: () => Date,
  request: FastifyRequest,
  reply: FastifyReply,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return withMemberSession(
    database,
    request,
    reply,
    now,
    async (tx, context: MemberContext) => {
      if (context.role !== "advertiser") {
        throw new ApiError("not_found");
      }
      if (context.termsToAccept !== null) {
        throw new ApiError("terms_acceptance_required");
      }
      return work(tx);
    },
    { terms: "exempt" },
  );
}

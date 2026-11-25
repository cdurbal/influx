// Routes of the anonymous profile a brand opens from its creator search, and of its visuals (docs/mvp/10
// RG1, RG2, RG4, RG15, RG47, RG48, RG50, RG63 to RG66; CA6, CA48 to CA50, CA59; 18 T14, T15.2 to T15.5;
// D82 (7), EC-L2G-16; jalons/l3f/modele.md §2, §3, §8; fiche invariants 1 to 3, 8 to 10, 15). Web
// surface only, member session required, advertiser role only.
// - GET /v1/creator-search/profiles/:alias                    a state, or the profile
// - GET /v1/creator-search/profiles/:alias/visuals/:visualId  an approved visual, relayed as JSON
// The profile goes through the door search.open_creator_profile() (0323), which checks the caller, the
// brand's profile, the switch, the bucket of the account and the alias against THE engine, and writes
// the opening in the transaction that serves; the line is COMMITTED with the answer, and a refusal is
// answered AFTER the COMMIT:
// - the bucket of the account full: 429 rate_limited with Retry-After (RG64, T15.2, T15.5);
// Refused by the door before anything is written, the transaction rolled back:
// - an alias unknown, excluded (E1 to E6) or malformed: 404 not_found, the same code and body as an
//   address that does not exist (P0002, CA49, T14.3, T14.4);
// - the caller refused by the door (an account no longer active): the answer of RG1.
// The visual goes through search.read_creator_visual() (0323): no row, the answer of a route that does
// not exist; its bytes are read by apps/api from Storage (503 when Storage fails, 404 when the object is
// gone), never an address, a host, a key nor a token in the answer (D82 (7)); neither journal nor
// bucket of the account (modele §3).
// Any role but advertiser gets the answer of a route that does not exist (T14.3), before any door is
// called, and before the terms gate, as the search does. The rate per client address is server.ts's
// (platform/member-rate.ts), before the session. Every answer is `no-store` and `nosniff`. Nothing is
// sent to the creator, to the outbox, to Brevo nor to Apollo (RG8, CA64).
import {
  creatorSearchProfileParamsSchema,
  creatorSearchProfileResponseSchema,
  creatorSearchVisualParamsSchema,
  creatorSearchVisualResponseSchema,
  type CreatorSearchProfileParams,
  type CreatorSearchProfileResponse,
  type CreatorSearchVisualParams,
  type CreatorSearchVisualResponse,
} from "@influx/contracts/creator-search-profile";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RetryLaterError } from "../../../platform/errors.ts";
import type { ObjectStore } from "../../../platform/storage.ts";
import {
  withMemberSession,
  type MemberContext,
} from "../../identity/member-session.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import { CREATOR_SEARCH_ROUTE } from "../creator-search/routes.ts";
import {
  isCreatorProfileRefusal,
  openCreatorProfile,
  readCreatorVisual,
  type CreatorProfileRefusal,
} from "./creator-search-profile.ts";

export type CreatorSearchProfileRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
  store: ObjectStore;
};

export const CREATOR_SEARCH_PROFILE_ROUTE = `${CREATOR_SEARCH_ROUTE}/profiles/:alias`;
export const CREATOR_SEARCH_VISUAL_ROUTE = `${CREATOR_SEARCH_PROFILE_ROUTE}/visuals/:visualId`;

/** A refusal the door raised before writing anything, as the answer of the API; else null. */
function doorRefusalOf(
  error: unknown,
): CreatorSearchProfileResponse | Error | null {
  const state = sqlStateOf(error);
  if (state === "42501" && sqlMessageOf(error) === "forbidden") {
    // a missing GRANT is 42501 too, with another message: a fault, never this answer
    return creatorSearchProfileResponseSchema.parse({
      state: "brand_not_published",
    });
  }
  if (state === "P0002" && sqlDetailOf(error) === "creator") {
    // CA49, T14.4: unknown, excluded and malformed answer as an address that does not exist
    return new ApiError("not_found");
  }
  return null;
}

export function registerCreatorSearchProfileRoutes(
  app: IdentityApp,
  dependencies: CreatorSearchProfileRoutesDependencies,
): void {
  const { database, now, store } = dependencies;

  /** The member session of a brand; any other role is "no such route" (T14.3). */
  function asAdvertiser<T>(
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

  /** What a brand reads of a creator's published data: never kept by a cache, never sniffed. */
  function guardHeaders(reply: FastifyReply): void {
    void reply.header("cache-control", "no-store");
    void reply.header("x-content-type-options", "nosniff");
  }

  app.get(
    CREATOR_SEARCH_PROFILE_ROUTE,
    {
      schema: {
        params: creatorSearchProfileParamsSchema,
        response: { 200: creatorSearchProfileResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorSearchProfileResponse> => {
      guardHeaders(reply);
      const { alias } = request.params as CreatorSearchProfileParams;
      let answer: CreatorSearchProfileResponse | CreatorProfileRefusal;
      try {
        answer = await asAdvertiser(request, reply, (tx) =>
          openCreatorProfile(tx, alias),
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
      if (isCreatorProfileRefusal(answer)) {
        // the line names no account nor alias (D60)
        request.log.info(
          { outcome: answer.state },
          "search.creator_profile.refused",
        );
        throw new RetryLaterError("rate_limited", answer.retryAfterSeconds);
      }
      return answer;
    },
  );

  app.get(
    CREATOR_SEARCH_VISUAL_ROUTE,
    {
      schema: {
        params: creatorSearchVisualParamsSchema,
        response: { 200: creatorSearchVisualResponseSchema },
      },
    },
    async (request, reply): Promise<CreatorSearchVisualResponse> => {
      guardHeaders(reply);
      const { alias, visualId } = request.params as CreatorSearchVisualParams;
      return readCreatorVisual(
        {
          inTransaction: (work) => asAdvertiser(request, reply, work),
          store,
          log: request.log,
        },
        alias,
        visualId.toLowerCase(),
      );
    },
  );
}

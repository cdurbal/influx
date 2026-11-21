// Routes of the brand's private shortlists (docs/mvp/10 RG1, RG4, RG8, RG51, RG63, RG65; CA49, CA52,
// CA59, CA64; 18 T14, TM12.3; D38, D45; jalons/l3f/modele.md §5, §8; fiche invariants 2, 6, 7, 10, 15).
// Web surface only, member session required, advertiser role only.
// - GET, POST /v1/me/shortlists                          the lists of the brand, a new one
// - GET, PUT, DELETE /v1/me/shortlists/:id               one list with its creators, renamed, deleted
// - PUT, DELETE /v1/me/shortlists/:id/items/:alias       a creator added to it, removed
// - PUT /v1/me/shortlists/:id/items/:alias/note          the brand's own note on a creator
// Every route goes through a door of 0324 (search.create_shortlist() and its seven siblings), which
// checks the caller, the brand's profile (RG1), the switch (D38), then the list, its inputs and its
// bounds, and writes nothing to a creator, the outbox nor matching (D45, CA52, CA64). A door that
// refuses before writing rolls its transaction back:
// - the switch closed, or the brand not published: 200 with the state alone, nothing written nor served;
// - a list of another brand or unknown, a campaign not admitted (of another brand, draft, rejected,
//   erased), a creator unknown, excluded by the engine, malformed or never served to the brand: 404
//   not_found, the same code and body as an address that does not exist (P0002, CA49, T14.3, T14.4);
// - a name or a note out of bounds: 400 validation_failed on `name` or `note` (22023);
// - a bound reached (listsPerAccount, itemsPerList): 409 conflict on `shortlist` (54000).
// Any role but advertiser gets the answer of a route that does not exist (T14.3), before any door is
// called. The reads are bound per client address (platform/member-rate.ts), before the session; they
// have no journal and no bucket of the account (modele §5). Every answer is `no-store`. There is NO
// export, NO « add them all » and NO size of page (TM12.3, RG63). Nothing is sent to the creator, to
// the outbox, to Brevo nor to Apollo.
import {
  SHORTLIST_FULL_ISSUE,
  SHORTLIST_LIMIT_ISSUE,
  SHORTLIST_NAME_ISSUE,
  SHORTLIST_NOTE_ISSUE,
  shortlistAddResponseSchema,
  shortlistCreateBodySchema,
  shortlistDeleteResponseSchema,
  shortlistItemParamsSchema,
  shortlistNoteBodySchema,
  shortlistNoteResponseSchema,
  shortlistParamsSchema,
  shortlistReadResponseSchema,
  shortlistRemoveResponseSchema,
  shortlistResponseSchema,
  shortlistsResponseSchema,
  shortlistUpdateBodySchema,
  type ShortlistAddResponse,
  type ShortlistCreateBody,
  type ShortlistDeleteResponse,
  type ShortlistItemParams,
  type ShortlistNoteBody,
  type ShortlistNoteResponse,
  type ShortlistParams,
  type ShortlistReadResponse,
  type ShortlistRemoveResponse,
  type ShortlistResponse,
  type ShortlistsResponse,
  type ShortlistUpdateBody,
} from "@influx/contracts/shortlists";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError } from "../../../platform/errors.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import { asAdvertiser } from "../brand-session.ts";
import {
  addToShortlist,
  createShortlist,
  deleteShortlist,
  listShortlists,
  readShortlist,
  removeFromShortlist,
  setShortlistNote,
  updateShortlist,
} from "./shortlists.ts";

export type ShortlistRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

export const SHORTLISTS_ROUTE = "/v1/me/shortlists";
export const SHORTLIST_ROUTE = `${SHORTLISTS_ROUTE}/:id`;
export const SHORTLIST_ITEM_ROUTE = `${SHORTLIST_ROUTE}/items/:alias`;
export const SHORTLIST_NOTE_ROUTE = `${SHORTLIST_ITEM_ROUTE}/note`;

/** The state of RG1, which every response schema of the shortlists holds. */
const NOT_PUBLISHED = { state: "brand_not_published" } as const;

/** What a refusal of a door before it wrote anything is, as the answer of the API (never a fault). */
function doorRefusalOf(error: unknown): Error | typeof NOT_PUBLISHED | null {
  const state = sqlStateOf(error);
  const detail = sqlDetailOf(error);
  // a lock_timeout on the account's lock (0327, 55P03) is no refusal of the door: classifyError answers
  // it as a 429 for every route (D85 (1))
  if (state === "42501" && sqlMessageOf(error) === "forbidden") {
    // a missing GRANT is 42501 too, with another message: a fault, never this answer
    return NOT_PUBLISHED;
  }
  if (
    state === "P0002" &&
    (detail === "shortlist" || detail === "campaign" || detail === "creator")
  ) {
    // CA49, T14.3, T14.4: another brand's list or campaign, an alias unknown, excluded or never served
    return new ApiError("not_found");
  }
  if (state === "22023" && detail === "name") {
    return new ApiError("validation_failed", [
      { path: "name", issue: SHORTLIST_NAME_ISSUE },
    ]);
  }
  if (state === "22023" && detail === "note") {
    return new ApiError("validation_failed", [
      { path: "note", issue: SHORTLIST_NOTE_ISSUE },
    ]);
  }
  if (state === "54000" && detail === SHORTLIST_LIMIT_ISSUE) {
    return new ApiError("conflict", [
      { path: "shortlist", issue: SHORTLIST_LIMIT_ISSUE },
    ]);
  }
  if (state === "54000" && detail === SHORTLIST_FULL_ISSUE) {
    return new ApiError("conflict", [
      { path: "shortlist", issue: SHORTLIST_FULL_ISSUE },
    ]);
  }
  return null;
}

export function registerShortlistRoutes(
  app: IdentityApp,
  dependencies: ShortlistRoutesDependencies,
): void {
  const { database, now } = dependencies;

  /**
   * What a brand reads and writes of its own lists: never kept by a cache. A refusal of a door before it
   * wrote anything is answered as the model says; any other error is a fault, passed on.
   */
  async function served<T extends { state: string }>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T | typeof NOT_PUBLISHED> {
    void reply.header("cache-control", "no-store");
    try {
      return await asAdvertiser(database, now, request, reply, work);
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
  }

  app.get(
    SHORTLISTS_ROUTE,
    { schema: { response: { 200: shortlistsResponseSchema } } },
    async (request, reply): Promise<ShortlistsResponse> =>
      served(request, reply, (tx) => listShortlists(tx)),
  );

  app.post(
    SHORTLISTS_ROUTE,
    {
      schema: {
        body: shortlistCreateBodySchema,
        response: { 200: shortlistResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistResponse> => {
      const body = request.body as ShortlistCreateBody;
      return served(request, reply, (tx) =>
        createShortlist(tx, body.name, body.campaignId),
      );
    },
  );

  app.get(
    SHORTLIST_ROUTE,
    {
      schema: {
        params: shortlistParamsSchema,
        response: { 200: shortlistReadResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistReadResponse> => {
      const { id } = request.params as ShortlistParams;
      return served(request, reply, (tx) => readShortlist(tx, id));
    },
  );

  app.put(
    SHORTLIST_ROUTE,
    {
      schema: {
        params: shortlistParamsSchema,
        body: shortlistUpdateBodySchema,
        response: { 200: shortlistResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistResponse> => {
      const { id } = request.params as ShortlistParams;
      const body = request.body as ShortlistUpdateBody;
      return served(request, reply, (tx) =>
        updateShortlist(tx, id, body.name, body.campaignId),
      );
    },
  );

  app.delete(
    SHORTLIST_ROUTE,
    {
      schema: {
        params: shortlistParamsSchema,
        response: { 200: shortlistDeleteResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistDeleteResponse> => {
      const { id } = request.params as ShortlistParams;
      return served(request, reply, (tx) => deleteShortlist(tx, id));
    },
  );

  app.put(
    SHORTLIST_ITEM_ROUTE,
    {
      schema: {
        params: shortlistItemParamsSchema,
        response: { 200: shortlistAddResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistAddResponse> => {
      const { id, alias } = request.params as ShortlistItemParams;
      return served(request, reply, (tx) => addToShortlist(tx, id, alias));
    },
  );

  app.delete(
    SHORTLIST_ITEM_ROUTE,
    {
      schema: {
        params: shortlistItemParamsSchema,
        response: { 200: shortlistRemoveResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistRemoveResponse> => {
      const { id, alias } = request.params as ShortlistItemParams;
      return served(request, reply, (tx) => removeFromShortlist(tx, id, alias));
    },
  );

  app.put(
    SHORTLIST_NOTE_ROUTE,
    {
      schema: {
        params: shortlistItemParamsSchema,
        body: shortlistNoteBodySchema,
        response: { 200: shortlistNoteResponseSchema },
      },
    },
    async (request, reply): Promise<ShortlistNoteResponse> => {
      const { id, alias } = request.params as ShortlistItemParams;
      const { note } = request.body as ShortlistNoteBody;
      return served(request, reply, (tx) =>
        setShortlistNote(tx, id, alias, note),
      );
    },
  );
}

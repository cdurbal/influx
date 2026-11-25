// Routes of queue 9 of the backoffice, « sélection par l'équipe INFLUX » (docs/mvp/10 RG61, RG84; 15 RG26 to
// RG28, RG33, RG34, RG36, C1 to C3, C5, AL23; 17b §2, I13; 18 T14; jalons/l3g/modele.md §5, §8; l3g-fiche
// invariants 8, 11, 12, 14). Backoffice surface; the aal2 guard of server.ts runs first, then each handler
// reads and writes through withBackofficeSession() (agent and admin alike); a member never reaches these
// routes (the web surface answers the 404 of a route that does not exist).
//   GET  /v1/bo/team-selection/entries         the list, oldest deadline first, the ones past their deadline
//        in front (C5), its filters (RG33), a page capped by the server (RG34), the counters of the queue
//        (RG28), the brand, the campaign of origin, the lock; no message, no criterion.
//   POST …/entries/search                      the same page, the filters, the period and the cursor in the
//        body (the relay refuses instants and a long cursor in a query); reads only.
//   POST …/entries/:id/open                    opening is claiming (C1): the request is taken, or read in
//        read-only mode with the name of its holder (C2); the request comes back with the criteria of the
//        brand and its message as plain text, bidirectional controls neutralized (L3FS-7).
//   POST …/entries/:id/release | extend        the holder gives the request back (C3), or takes the delay again.
//   POST …/entries/:id/close                   the closure by a reason of the closed list of 0330, the note for
//        `other` alone (17b I13); the answer carries the request to open next (17b §2.6).
// The rules are the database's (0330): the doors lock what they decide, check the live claim of the caller and
// write the register in ONE transaction. This file maps their refusals to codes (team-selection-queue/
// refusals.ts), never a trace. A request unknown, or open and of a brand the caller HOLDS (identity.accounts.
// owner_agent_id, 15 RG36), answers the 404 of an address that does not exist (T14.3, T14.4), and is absent from
// the list and the counters. Nothing is written to the outbox, to `matching.*` nor to a creator, and the brand
// is not told (D45, RG8: its e-mail comes with Lot 5). No money anywhere (D48, D78). Every answer is
// `Cache-Control: no-store`: it carries the words of a brand.
import {
  closeTeamSelectionRequestSchema,
  closeTeamSelectionResponseSchema,
  entryParamsSchema,
  extendEntryResponseSchema,
  openTeamSelectionResponseSchema,
  releaseEntryResponseSchema,
  TEAM_SELECTION_QUEUE,
  teamSelectionEntriesQuerySchema,
  teamSelectionEntriesResponseSchema,
  teamSelectionEntriesSearchSchema,
  type CloseTeamSelectionRequest,
  type CloseTeamSelectionResponse,
  type EntryParams,
  type ExtendEntryResponse,
  type OpenTeamSelectionResponse,
  type ReleaseEntryResponse,
  type TeamSelectionCounters,
  type TeamSelectionEntriesQuery,
  type TeamSelectionEntriesResponse,
  type TeamSelectionEntriesSearch,
  type TeamSelectionEntryRow,
} from "@influx/contracts/backoffice-queues";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  decodeCursor,
  encodeCursor,
} from "./creator-queues/lists/repository.ts";
import { displayNameOf } from "./queues/decisions/repository.ts";
import { plainTextOf } from "./team-selection-queue/plain-text.ts";
import { teamSelectionRefusalOf } from "./team-selection-queue/refusals.ts";
import {
  closeTeamSelectionRequest,
  extendTeamSelectionClaim,
  listTeamSelectionRequestsPage,
  nextTeamSelectionRequestId,
  openTeamSelectionRequest,
  readTeamSelectionCounters,
  readTeamSelectionRequest,
  releaseTeamSelectionRequest,
  teamSelectionTargetOf,
  type ListedTeamSelectionRequest,
  type ListFilters,
  type TeamSelectionCountersRow,
} from "./team-selection-queue/repository.ts";

export type TeamSelectionQueueDependencies = { database: ApiDatabase };

export const TEAM_SELECTION_ENTRIES = "/v1/bo/team-selection/entries";

type ListQuery = {
  overdue?: "true";
  holder?: string;
  from?: string;
  to?: string;
  cursor?: string;
};

function filtersOf(query: ListQuery): ListFilters {
  const filters: ListFilters = {};
  if (query.overdue !== undefined) filters.overdue = true;
  if (query.holder !== undefined) filters.holder = query.holder.toLowerCase();
  if (query.from !== undefined) filters.from = query.from;
  if (query.to !== undefined) filters.to = query.to;
  if (query.cursor !== undefined) {
    const after = decodeCursor(query.cursor);
    if (after === null) {
      throw new RequestValidationError([
        { path: "cursor", issue: "invalid_cursor" },
      ]);
    }
    filters.after = after;
  }
  return filters;
}

function countersOf(
  counters: TeamSelectionCountersRow | null,
): TeamSelectionCounters | null {
  return counters === null
    ? null
    : {
        queue: TEAM_SELECTION_QUEUE,
        pending: counters.pending,
        oldestCreatedAt: counters.oldestCreatedAt,
        overdue: counters.overdue,
        unclaimed: counters.unclaimed,
        lastDecidedAt: counters.lastDecidedAt,
        policy: {
          decisionMinutes: counters.decisionMinutes,
          claimTargetMinutes: counters.claimTargetMinutes,
          escalateAfterMinutes: counters.escalateAfterMinutes,
          businessHours: counters.businessHours,
        },
      };
}

function rowOf(
  entry: ListedTeamSelectionRequest,
  caller: string,
): TeamSelectionEntryRow {
  return {
    id: entry.id,
    advertiserAccountId: entry.advertiserAccountId,
    brandName: entry.brandName,
    campaignId: entry.campaignId,
    campaignTitle: entry.campaignTitle,
    language: entry.language,
    createdAt: entry.createdAt,
    slaDueAt: entry.slaDueAt,
    overdue: entry.overdue,
    owner: entry.owner,
    claim: {
      holder: entry.holder,
      claimedAt: entry.claimedAt,
      claimExpiresAt: entry.claimExpiresAt,
      heldByCaller: entry.holder?.accountId === caller,
    },
  };
}

export function registerTeamSelectionQueueRoutes(
  app: IdentityApp,
  dependencies: TeamSelectionQueueDependencies,
): void {
  const { database } = dependencies;

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  /**
   * One door of the database, in a savepoint of the request's transaction: its refusal leaves the transaction
   * readable (the name of the holder) and becomes the answer of the API.
   */
  async function act<T>(
    tx: Transaction,
    door: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await tx.transaction(door);
    } catch (error) {
      throw await teamSelectionRefusalOf(tx, error);
    }
  }

  function page(
    request: FastifyRequest,
    reply: FastifyReply,
    query: TeamSelectionEntriesQuery | TeamSelectionEntriesSearch,
  ): Promise<TeamSelectionEntriesResponse> {
    const filters = filtersOf(query);
    return inSession(request, reply, async (tx, context) => {
      const found = await listTeamSelectionRequestsPage(
        tx,
        context.accountId,
        filters,
        query.limit,
      );
      const counters = await readTeamSelectionCounters(tx, context.accountId);
      return {
        asOf: counters?.asOf ?? new Date().toISOString(),
        counters: countersOf(counters),
        items: found.items.map((entry) => rowOf(entry, context.accountId)),
        nextCursor:
          found.resumeAfter === null ? null : encodeCursor(found.resumeAfter),
      };
    });
  }

  app.get(
    TEAM_SELECTION_ENTRIES,
    {
      schema: {
        querystring: teamSelectionEntriesQuerySchema,
        response: { 200: teamSelectionEntriesResponseSchema },
      },
    },
    (request, reply): Promise<TeamSelectionEntriesResponse> =>
      page(request, reply, request.query as TeamSelectionEntriesQuery),
  );

  app.post(
    `${TEAM_SELECTION_ENTRIES}/search`,
    {
      schema: {
        body: teamSelectionEntriesSearchSchema,
        response: { 200: teamSelectionEntriesResponseSchema },
      },
    },
    (request, reply): Promise<TeamSelectionEntriesResponse> =>
      page(request, reply, request.body as TeamSelectionEntriesSearch),
  );

  app.post(
    `${TEAM_SELECTION_ENTRIES}/:id/open`,
    {
      schema: {
        params: entryParamsSchema,
        response: { 200: openTeamSelectionResponseSchema },
      },
    },
    async (request, reply): Promise<OpenTeamSelectionResponse> => {
      const requestId = (request.params as EntryParams).id.toLowerCase();
      return inSession(request, reply, async (tx) => {
        const opening = await act(tx, (savepoint) =>
          openTeamSelectionRequest(savepoint, requestId),
        );
        // After the opening, never before: what is read is what the opening decided on
        const row = await readTeamSelectionRequest(tx, requestId);
        if (row === null) {
          throw new ApiError("not_found");
        }
        const holder =
          opening.holderAccountId === null
            ? null
            : {
                accountId: opening.holderAccountId,
                displayName: await displayNameOf(tx, opening.holderAccountId),
              };
        return {
          asOf: row.asOf,
          outcome: opening.outcome,
          holder,
          claimedAt: opening.claimedAt,
          claimExpiresAt: opening.claimExpiresAt,
          request: {
            id: row.id,
            advertiserAccountId: row.advertiserAccountId,
            brandName: row.brandName,
            campaign:
              row.campaignId === null
                ? null
                : { id: row.campaignId, title: row.campaignTitle },
            language: row.language,
            filters:
              row.filters as OpenTeamSelectionResponse["request"]["filters"],
            message: row.message === null ? null : plainTextOf(row.message),
            state: row.state,
            createdAt: row.createdAt,
            slaDueAt: row.slaDueAt,
            overdue: row.overdue,
            closure:
              row.closedAt === null || row.closeReasonCode === null
                ? null
                : {
                    closedAt: row.closedAt,
                    closedBy: row.closedBy,
                    reasonCode: row.closeReasonCode as NonNullable<
                      OpenTeamSelectionResponse["request"]["closure"]
                    >["reasonCode"],
                    note:
                      row.closeNote === null
                        ? null
                        : plainTextOf(row.closeNote),
                  },
          },
        };
      });
    },
  );

  app.post(
    `${TEAM_SELECTION_ENTRIES}/:id/release`,
    {
      schema: {
        params: entryParamsSchema,
        response: { 200: releaseEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ReleaseEntryResponse> => {
      const requestId = (request.params as EntryParams).id.toLowerCase();
      return inSession(request, reply, async (tx, context) => {
        const target = await teamSelectionTargetOf(tx, requestId);
        // T14: unknown, or a request of a brand the caller holds and where he has no live claim to give back
        if (
          target === null ||
          (target.ownerAgentId === context.accountId &&
            target.heldBy !== context.accountId)
        ) {
          throw new ApiError("not_found");
        }
        await act(tx, (savepoint) =>
          releaseTeamSelectionRequest(savepoint, requestId),
        );
        return { released: true };
      });
    },
  );

  app.post(
    `${TEAM_SELECTION_ENTRIES}/:id/extend`,
    {
      schema: {
        params: entryParamsSchema,
        response: { 200: extendEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ExtendEntryResponse> => {
      const requestId = (request.params as EntryParams).id.toLowerCase();
      return inSession(request, reply, async (tx) => ({
        claimExpiresAt: await act(tx, (savepoint) =>
          extendTeamSelectionClaim(savepoint, requestId),
        ),
      }));
    },
  );

  app.post(
    `${TEAM_SELECTION_ENTRIES}/:id/close`,
    {
      schema: {
        params: entryParamsSchema,
        body: closeTeamSelectionRequestSchema,
        response: { 200: closeTeamSelectionResponseSchema },
      },
    },
    async (request, reply): Promise<CloseTeamSelectionResponse> => {
      const requestId = (request.params as EntryParams).id.toLowerCase();
      const body = request.body as CloseTeamSelectionRequest;
      return inSession(request, reply, async (tx, context) => {
        const closedAt = await act(tx, (savepoint) =>
          closeTeamSelectionRequest(
            savepoint,
            requestId,
            body.reasonCode,
            body.note ?? null,
          ),
        );
        const entryId = await nextTeamSelectionRequestId(tx, context.accountId);
        return { closedAt, next: entryId === null ? null : { entryId } };
      });
    },
  );
}

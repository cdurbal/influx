// Routes of queue 6, "identifiants modifiés", of the backoffice (docs/mvp/08 RG78, CA54; 15 RG26 to RG28, RG33,
// RG34, RG36, C1 to C8, RG29; jalons/l2f/modele.md §1 points 12, 13, §3 "0233", §5; l2f-fiche invariants 7, 8,
// 12, 13, 17; 18 T14; l2f commit 14). Backoffice surface; the aal2 guard of server.ts runs first, then each
// handler reads and writes through withBackofficeSession() (agent and admin alike).
//   GET  /v1/bo/queues/identifier-changes/entries (and POST …/entries/search): the open entries, the order and
//        the filters of queue 5 without the level and the kind; NO identifier in a line (the alias, the
//        network, how often it changed).
//   POST …/entries/:id/open      opening is claiming. The holder of the claim gets the dossier (the former
//        and the new identifier, the line as declared, the badges held) and the review token OF THE SNAPSHOT;
//        a colleague gets « en cours — {name} », read-only, and no dossier; a closed entry answers its decision.
//   POST …/entries/:id/{release, extend, force-release}   claimed-routes.ts
//   POST …/entries/:id/confirm        « même compte »: the handle typed must be the declared one; the badge is
//        never rewritten, nothing is sent
//   POST …/entries/:id/require-proof  « à reconfirmer »: no free text, the proof is asked again from the
//        member's space
// The former and the new identifier are read by the holder of the live claim only (invariants 7, 13); they are
// never in a list, never in the register, never in a log. An unknown entry and the caller's own account answer
// exactly alike (404, T14.3, T14.4); an entry of an account the caller HOLDS answers 403 `conflict_of_interest`
// after the trace of the attempt is committed (15 RG36). Every answer is `Cache-Control: no-store`.
import {
  confirmIdentifierChangeRequestSchema,
  confirmIdentifierChangeResponseSchema,
  identifierChangeEntriesQuerySchema,
  identifierChangeEntriesResponseSchema,
  identifierChangeEntriesSearchSchema,
  identifierChangeOpenResponseSchema,
  requireIdentifierProofRequestSchema,
  requireIdentifierProofResponseSchema,
  verificationEntryParamsSchema,
  type ConfirmIdentifierChangeRequest,
  type ConfirmIdentifierChangeResponse,
  type IdentifierChangeDossier,
  type IdentifierChangeEntriesQuery,
  type IdentifierChangeEntriesResponse,
  type IdentifierChangeEntriesSearch,
  type IdentifierChangeEntryRow,
  type IdentifierChangeOpenResponse,
  type RequireIdentifierProofRequest,
  type RequireIdentifierProofResponse,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import type { BackofficeContext } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { CONFLICT_OF_INTEREST, unlessConflict } from "./action-guards.ts";
import {
  closedAtOf,
  openClaimedEntry,
  readClaimedCounters,
  readClaimView,
} from "./verification-queues/claimed/repository.ts";
import { registerClaimedQueueRoutes } from "./verification-queues/claimed-routes.ts";
import {
  decodeEntryCursor,
  encodeEntryCursor,
} from "./verification-queues-routes.ts";
import {
  confirmIdentifierChange,
  IDENTIFIER_CHANGE_EXTRA,
  listIdentifierChanges,
  readIdentifierChangeDossier,
  requireIdentifierProof,
  type IdentifierChangeDossierRow,
  type IdentifierChangeFilters,
  type ListedIdentifierChange,
} from "./verification-identifier-changes/repository.ts";

type IdentifierWithdrawnCause = NonNullable<
  IdentifierChangeOpenResponse["entry"]["decision"]
>["withdrawnCause"];

export type VerificationIdentifierChangesDependencies = {
  database: ApiDatabase;
};

function filtersOf(
  query: IdentifierChangeEntriesQuery | IdentifierChangeEntriesSearch,
): IdentifierChangeFilters {
  const filters: IdentifierChangeFilters = {};
  if (query.network !== undefined) filters.network = query.network;
  if (query.overdue !== undefined) filters.overdue = true;
  if (query.holder !== undefined) filters.holder = query.holder.toLowerCase();
  if (query.owner !== undefined) filters.owner = query.owner.toLowerCase();
  if (query.from !== undefined) filters.from = query.from;
  if (query.to !== undefined) filters.to = query.to;
  if (query.cursor !== undefined) {
    const after = decodeEntryCursor(query.cursor, query.sort);
    if (after === null) {
      throw new RequestValidationError([
        { path: "cursor", issue: "invalid_cursor" },
      ]);
    }
    filters.after = after;
  }
  return filters;
}

function rowOf(
  entry: ListedIdentifierChange,
  caller: string,
): IdentifierChangeEntryRow {
  return {
    id: entry.id,
    accountId: entry.accountId,
    networkCode: entry.networkCode,
    displayName: entry.displayName,
    countryCode: entry.countryCode as IdentifierChangeEntryRow["countryCode"],
    changeCount: entry.changeCount,
    createdAt: entry.createdAt,
    lastChangedAt: entry.lastChangedAt,
    slaDueAt: entry.slaDueAt,
    escalateAt: entry.escalateAt,
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

/** The dossier of RG78 from what the door returned: the identifiers, the line, the badges held. */
function dossierOf(row: IdentifierChangeDossierRow): IdentifierChangeDossier {
  return {
    networkCode: row.networkCode,
    previousHandle: row.previousHandle,
    newHandle: row.newHandle ?? "",
    changeCount: row.changeCount,
    createdAt: row.createdAt,
    lastChangedAt: row.lastChangedAt,
    creator: {
      handle: row.handle,
      pseudonym: row.pseudonym,
      profileUrl: row.profileUrl,
    },
    accountBadge:
      row.badgeId === null ||
      row.badgeState === null ||
      row.badgeGrantedAt === null
        ? null
        : {
            id: row.badgeId,
            state: row.badgeState as NonNullable<
              IdentifierChangeDossier["accountBadge"]
            >["state"],
            grantedAt: row.badgeGrantedAt,
          },
    audienceBadge:
      row.audienceBadgeId === null || row.audienceState === null
        ? null
        : {
            id: row.audienceBadgeId,
            state: row.audienceState as NonNullable<
              IdentifierChangeDossier["audienceBadge"]
            >["state"],
            expiresAt: row.audienceExpiresAt,
          },
  };
}

export function registerVerificationIdentifierChangeRoutes(
  app: IdentityApp,
  dependencies: VerificationIdentifierChangesDependencies,
): void {
  const queue = registerClaimedQueueRoutes(
    app,
    dependencies.database,
    "identifier_changes",
    "identifier-changes",
  );
  const {
    entries,
    idOf,
    inSession,
    targetOf,
    decided,
    inSavepoint,
    unlessHeld,
  } = queue;

  const entriesPage = (
    request: FastifyRequest,
    reply: FastifyReply,
    query: IdentifierChangeEntriesQuery | IdentifierChangeEntriesSearch,
  ): Promise<IdentifierChangeEntriesResponse> => {
    const filters = filtersOf(query);
    return inSession(request, reply, async (tx, context) => {
      const rows = await listIdentifierChanges(
        tx,
        context.accountId,
        query.sort,
        filters,
        query.limit + 1,
      );
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);
      const counters = await readClaimedCounters(
        tx,
        context.accountId,
        "identifier_changes",
      );
      return {
        asOf: counters?.asOf ?? new Date().toISOString(),
        items: items.map((entry) => rowOf(entry, context.accountId)),
        nextCursor:
          rows.length > query.limit && last !== undefined
            ? encodeEntryCursor(query.sort, last.cursor)
            : null,
      };
    });
  };

  app.get(
    entries,
    {
      schema: {
        querystring: identifierChangeEntriesQuerySchema,
        response: { 200: identifierChangeEntriesResponseSchema },
      },
    },
    (request, reply): Promise<IdentifierChangeEntriesResponse> =>
      entriesPage(
        request,
        reply,
        request.query as IdentifierChangeEntriesQuery,
      ),
  );

  // A POST that writes nothing: no claim, no register line.
  app.post(
    `${entries}/search`,
    {
      schema: {
        body: identifierChangeEntriesSearchSchema,
        response: { 200: identifierChangeEntriesResponseSchema },
      },
    },
    (request, reply): Promise<IdentifierChangeEntriesResponse> =>
      entriesPage(
        request,
        reply,
        request.body as IdentifierChangeEntriesSearch,
      ),
  );

  async function openedEntry(
    tx: Transaction,
    context: BackofficeContext,
    reviewId: string,
  ): Promise<IdentifierChangeOpenResponse> {
    const opening = await openClaimedEntry(tx, "identifier_changes", reviewId);
    // After the opening, never before: the view is no older than the claim it shows
    const read = await readClaimView(
      tx,
      "identifier_changes",
      reviewId,
      IDENTIFIER_CHANGE_EXTRA,
    );
    if (read === null) {
      throw new ApiError("not_found");
    }
    const { view, specific } = read;
    let dossier: IdentifierChangeDossier | null = null;
    let reviewToken: string | null = null;
    if (opening.outcome === "claimed" || opening.outcome === "held") {
      const row = await readIdentifierChangeDossier(tx, reviewId);
      dossier = dossierOf(row);
      reviewToken = row.reviewToken;
    }
    const held = view.held && view.holder !== null;
    const decidedAt = closedAtOf(view);
    return {
      asOf: view.asOf,
      outcome: opening.outcome,
      reviewToken,
      entry: {
        id: view.id,
        networkCode: view.networkCode,
        state: view.state as IdentifierChangeOpenResponse["entry"]["state"],
        createdAt: view.datedAt,
        slaDueAt: view.slaDueAt,
        escalateAt: view.escalateAt,
        overdue: view.overdue,
        claim: {
          holder: view.holder,
          claimedAt: view.claimedAt,
          claimExpiresAt: view.claimExpiresAt,
          heldByCaller: held && view.holder?.accountId === context.accountId,
        },
        lastForcedRelease:
          view.forcedRelease === null
            ? null
            : {
                ...view.forcedRelease,
                holderIsCaller:
                  view.forcedRelease.holder?.accountId === context.accountId,
              },
        decision:
          view.state === "open" || decidedAt === null
            ? null
            : {
                decidedAt,
                decidedBy: view.decidedBy,
                late: view.late,
                state: view.state as
                  "confirmed" | "proof_required" | "withdrawn",
                withdrawnCause: view.withdrawnCause as IdentifierWithdrawnCause,
                observedHandle:
                  typeof specific.observed_handle === "string"
                    ? specific.observed_handle
                    : null,
                internalComment: view.internalComment,
              },
      },
      account: {
        id: view.accountId,
        countryCode: view.account
          .countryCode as IdentifierChangeOpenResponse["account"]["countryCode"],
        preferredLanguage: view.account.preferredLanguage,
        owner: view.account.owner,
      },
      dossier,
    };
  }

  app.post(
    `${entries}/:id/open`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        response: { 200: identifierChangeOpenResponseSchema },
      },
    },
    async (request, reply): Promise<IdentifierChangeOpenResponse> => {
      const reviewId = idOf(request);
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const target = await targetOf(tx, reviewId);
          if (target.state === "open") {
            const held = await unlessHeld(tx, context, target);
            if (held !== null) return held;
          }
          return inSavepoint(tx, reviewId, context.accountId, (savepoint) =>
            openedEntry(savepoint, context, reviewId),
          );
        }),
      );
    },
  );

  app.post(
    `${entries}/:id/confirm`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        body: confirmIdentifierChangeRequestSchema,
        response: { 200: confirmIdentifierChangeResponseSchema },
      },
    },
    async (request, reply): Promise<ConfirmIdentifierChangeResponse> => {
      const reviewId = idOf(request);
      const body = request.body as ConfirmIdentifierChangeRequest;
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const confirmed = await decided(tx, context, reviewId, (savepoint) =>
            confirmIdentifierChange(savepoint, reviewId, body.reviewToken, {
              observedHandle: body.observedHandle,
              internalComment: body.internalComment ?? null,
            }),
          );
          return confirmed === CONFLICT_OF_INTEREST
            ? confirmed
            : { ...confirmed, next: await queue.next(tx, context) };
        }),
      );
    },
  );

  app.post(
    `${entries}/:id/require-proof`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        body: requireIdentifierProofRequestSchema,
        response: { 200: requireIdentifierProofResponseSchema },
      },
    },
    async (request, reply): Promise<RequireIdentifierProofResponse> => {
      const reviewId = idOf(request);
      const body = request.body as RequireIdentifierProofRequest;
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const required = await decided(tx, context, reviewId, (savepoint) =>
            requireIdentifierProof(savepoint, reviewId, body.reviewToken, {
              internalComment: body.internalComment ?? null,
            }),
          );
          return required === CONFLICT_OF_INTEREST
            ? required
            : { ...required, next: await queue.next(tx, context) };
        }),
      );
    },
  );
}

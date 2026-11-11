// Decision routes of queues 2 and 3 of the backoffice (docs/mvp/07 RG5, RG10, RG78, RG94 to RG99; 15
// RG27 C2 to C4, C6 to C8, RG36, RG110, CA63; 17b §2.4, §2.6; jalons/l2g/modele.md §3 "0244", §6;
// l2g-fiche invariants 5, 7, 10, 13, 14; 18 T14). Backoffice surface; the aal2 guard of server.ts runs
// first, then each handler reads and writes through withBackofficeSession() (agent and admin).
//   Queue 2, …/profiles-creator/entries/:id/
//   - publish: the human decision that publishes (RG5), bound to the version the agent examined
//     (`reviewToken`); the first publication emits `profile.completed`, the next ones `lead.updated`.
//   - reject: a typed reason of RG96; `memberMessage` for `other` only (RG98), a direct contact in it
//     refused here as the e-mail holds no link (RG158).
//   Queue 3, …/portfolio-moderation/entries/:id/
//   - approve, reject: one visual, one decision (RG78); a reason of the grid of RG79, never a message.
//   Both queues: release, extend (the holder gives the entry back, or takes the delay again, A9),
//   force-release (an administrator lifts a live claim with a typed reason, C4; an agent who tries is
//   refused 403 and the attempt is journaled, backoffice.action_refused, CA63).
// The rules are the database's (0244): the functions lock what they decide, check the live claim of the
// caller, the token and the rules, and write the decision, the register, the e-mail and the leads events
// in ONE transaction. This file maps their refusals to codes (creator-queues/refusals.ts), never a trace.
// - RG36 (15, 13 RG35, CA19): a decision or an extension on an entry of an account the caller HOLDS
//   answers 403 with the issue `conflict_of_interest`, after the trace of the attempt
//   (backoffice.action_refused, queue.conflict_of_interest) is committed; the database refuses it too
//   (42501). Giving a claim back stays open to him (he gets rid of it, never decides).
// - The decisions of a visual answer `(decided_at, sla_breached)` as `{decidedAt, late}` (EC-L2G-04-10).
// - A decision answers with the entry to open next (17b §2.6), never opened for the caller here.
// - Every answer is `Cache-Control: no-store`.
import {
  approvePortfolioItemRequestSchema,
  creatorEntryParamsSchema,
  decidedEntryResponseSchema,
  forceReleaseCreatorEntryRequestSchema,
  publishCreatorEntryRequestSchema,
  publishCreatorEntryResponseSchema,
  rejectCreatorEntryRequestSchema,
  rejectPortfolioItemRequestSchema,
  type ApprovePortfolioItemRequest,
  type CreatorEntryParams,
  type DecidedEntryResponse,
  type PublishCreatorEntryRequest,
  type PublishCreatorEntryResponse,
  type RejectCreatorEntryRequest,
  type RejectPortfolioItemRequest,
} from "@influx/contracts/creator-queues";
import {
  extendEntryResponseSchema,
  forceReleaseResponseSchema,
  releaseEntryResponseSchema,
  type ExtendEntryResponse,
  type ForceReleaseResponse,
  type ReleaseEntryResponse,
} from "@influx/contracts/backoffice-queues";
import { RequestValidationError } from "../../platform/errors.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  adminOnly,
  CONFLICT_OF_INTEREST,
  unlessConflict,
  unlessRefused,
} from "./action-guards.ts";
import {
  approveItem,
  extendClaim,
  forceRelease,
  publishEntry,
  rejectEntry,
  rejectItem,
  releaseEntry,
} from "./creator-queues/acts/repository.ts";
import {
  actsOf,
  PORTFOLIO_MODERATION_ENTRIES,
  PROFILES_CREATOR_ENTRIES,
  type CreatorQueuesDependencies,
} from "./creator-queues/guards.ts";
import type { CreatorQueue } from "./creator-queues/lists/repository.ts";
import { displayNameOf } from "./queues/decisions/repository.ts";
import { memberMessageSignals } from "./queues/entry-alerts.ts";

export function registerCreatorQueueDecisionRoutes(
  app: IdentityApp,
  dependencies: CreatorQueuesDependencies,
): void {
  const { database } = dependencies;

  /** The three acts the two queues have in common: release, extend, force release (15 C3, C4, A9). */
  function registerClaimRoutes(queue: CreatorQueue, entries: string): void {
    const acts = actsOf(database, queue);

    app.post(
      `${entries}/:id/release`,
      {
        schema: {
          params: creatorEntryParamsSchema,
          response: { 200: releaseEntryResponseSchema },
        },
      },
      async (request, reply): Promise<ReleaseEntryResponse> => {
        const entryId = (request.params as CreatorEntryParams).id.toLowerCase();
        return acts.inSession(request, reply, async (tx, context) => {
          await acts.treated(tx, context, entryId, (savepoint) =>
            releaseEntry(savepoint, queue, entryId),
          );
          return { released: true };
        });
      },
    );

    app.post(
      `${entries}/:id/extend`,
      {
        schema: {
          params: creatorEntryParamsSchema,
          response: { 200: extendEntryResponseSchema },
        },
      },
      async (request, reply): Promise<ExtendEntryResponse> => {
        const entryId = (request.params as CreatorEntryParams).id.toLowerCase();
        const claimExpiresAt = unlessConflict(
          await acts.inSession(request, reply, (tx, context) =>
            acts.decided(tx, context, entryId, (savepoint) =>
              extendClaim(savepoint, queue, entryId),
            ),
          ),
        );
        return { claimExpiresAt };
      },
    );

    app.post(
      `${entries}/:id/force-release`,
      {
        schema: {
          params: creatorEntryParamsSchema,
          body: forceReleaseCreatorEntryRequestSchema,
          response: { 200: forceReleaseResponseSchema },
        },
      },
      async (request, reply): Promise<ForceReleaseResponse> => {
        const entryId = (request.params as CreatorEntryParams).id.toLowerCase();
        const body = request.body as { reasonCode: string };
        // CA63: an agent's attempt is refused and journaled in a transaction that commits; the 403
        // is answered after. The masking of the button on the screen is never the control.
        return unlessRefused(
          await acts.inSession(request, reply, (tx, context) =>
            adminOnly(
              tx,
              context,
              "queue.force_release_claim",
              async (): Promise<ForceReleaseResponse> => {
                const holder = await acts.treated(
                  tx,
                  context,
                  entryId,
                  (savepoint) =>
                    forceRelease(savepoint, queue, entryId, body.reasonCode),
                );
                return {
                  released: true,
                  holder:
                    holder === null
                      ? null
                      : {
                          accountId: holder,
                          displayName: await displayNameOf(tx, holder),
                        },
                };
              },
            ),
          ),
        );
      },
    );
  }

  registerClaimRoutes("profiles_creator", PROFILES_CREATOR_ENTRIES);
  registerClaimRoutes("portfolio_moderation", PORTFOLIO_MODERATION_ENTRIES);

  // ---------------------------------------------------------------------------------------------
  // Queue 2
  // ---------------------------------------------------------------------------------------------

  const creatorActs = actsOf(database, "profiles_creator");

  app.post(
    `${PROFILES_CREATOR_ENTRIES}/:id/publish`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        body: publishCreatorEntryRequestSchema,
        response: { 200: publishCreatorEntryResponseSchema },
      },
    },
    async (request, reply): Promise<PublishCreatorEntryResponse> => {
      const entryId = (request.params as CreatorEntryParams).id.toLowerCase();
      const body = request.body as PublishCreatorEntryRequest;
      return unlessConflict(
        await creatorActs.inSession(request, reply, async (tx, context) => {
          const published = await creatorActs.decided(
            tx,
            context,
            entryId,
            (savepoint) =>
              publishEntry(
                savepoint,
                entryId,
                body.reviewToken,
                body.internalComment ?? null,
              ),
          );
          return published === CONFLICT_OF_INTEREST
            ? published
            : { ...published, next: await creatorActs.next(tx, context) };
        }),
      );
    },
  );

  app.post(
    `${PROFILES_CREATOR_ENTRIES}/:id/reject`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        body: rejectCreatorEntryRequestSchema,
        response: { 200: decidedEntryResponseSchema },
      },
    },
    async (request, reply): Promise<DecidedEntryResponse> => {
      const entryId = (request.params as CreatorEntryParams).id.toLowerCase();
      const body = request.body as RejectCreatorEntryRequest;
      // RG98, RG158: the message goes to the creator in an e-mail without any link; a direct contact is
      // refused
      if (
        body.memberMessage !== undefined &&
        memberMessageSignals(body.memberMessage).length > 0
      ) {
        throw new RequestValidationError([
          { path: "memberMessage", issue: "direct_contact" },
        ]);
      }
      return unlessConflict(
        await creatorActs.inSession(request, reply, async (tx, context) => {
          const rejected = await creatorActs.decided(
            tx,
            context,
            entryId,
            (savepoint) =>
              rejectEntry(
                savepoint,
                entryId,
                body.reviewToken,
                body.reasonCode,
                body.memberMessage ?? null,
                body.internalComment ?? null,
              ),
          );
          return rejected === CONFLICT_OF_INTEREST
            ? rejected
            : { ...rejected, next: await creatorActs.next(tx, context) };
        }),
      );
    },
  );

  // ---------------------------------------------------------------------------------------------
  // Queue 3
  // ---------------------------------------------------------------------------------------------

  const portfolioActs = actsOf(database, "portfolio_moderation");

  app.post(
    `${PORTFOLIO_MODERATION_ENTRIES}/:id/approve`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        body: approvePortfolioItemRequestSchema,
        response: { 200: decidedEntryResponseSchema },
      },
    },
    async (request, reply): Promise<DecidedEntryResponse> => {
      const itemId = (request.params as CreatorEntryParams).id.toLowerCase();
      const body = request.body as ApprovePortfolioItemRequest;
      return unlessConflict(
        await portfolioActs.inSession(request, reply, async (tx, context) => {
          const approved = await portfolioActs.decided(
            tx,
            context,
            itemId,
            (savepoint) =>
              approveItem(
                savepoint,
                itemId,
                body.reviewToken,
                body.internalComment ?? null,
              ),
          );
          return approved === CONFLICT_OF_INTEREST
            ? approved
            : { ...approved, next: await portfolioActs.next(tx, context) };
        }),
      );
    },
  );

  app.post(
    `${PORTFOLIO_MODERATION_ENTRIES}/:id/reject`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        body: rejectPortfolioItemRequestSchema,
        response: { 200: decidedEntryResponseSchema },
      },
    },
    async (request, reply): Promise<DecidedEntryResponse> => {
      const itemId = (request.params as CreatorEntryParams).id.toLowerCase();
      const body = request.body as RejectPortfolioItemRequest;
      return unlessConflict(
        await portfolioActs.inSession(request, reply, async (tx, context) => {
          const rejected = await portfolioActs.decided(
            tx,
            context,
            itemId,
            (savepoint) =>
              rejectItem(
                savepoint,
                itemId,
                body.reviewToken,
                body.reasonCode,
                body.internalComment ?? null,
              ),
          );
          return rejected === CONFLICT_OF_INTEREST
            ? rejected
            : { ...rejected, next: await portfolioActs.next(tx, context) };
        }),
      );
    },
  );
}

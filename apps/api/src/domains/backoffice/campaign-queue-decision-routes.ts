// Decision routes of queue 7 of the backoffice (docs/mvp/09 RG5, RG85, RG88 to RG92; 15 RG27 C2 to C4, C6 to
// C8, RG36, RG110, CA63; 17b §3.8; jalons/l3c/modele.md §1, §3, §4; l3c-fiche invariants 1, 2, 4, 5, 11; 18
// T14). Backoffice surface; the aal2 guard of server.ts runs first, then each handler reads and writes
// through withBackofficeSession() (agent and admin).
//   …/campaigns/entries/:id/
//   - first-review: time 1 of an enhanced review: a reasoned favourable opinion, never published nor sent;
//   - publish: the human decision that publishes (RG5), bound to the version examined (`reviewToken`), a
//     responsible named; in an enhanced review only by a second person (RG85);
//   - reject: a typed reason of RG90; `memberMessage` for `illicit_content` and `other` only, a direct contact
//     in it refused here as the e-mail holds no link (RG158);
//   - release, extend (the holder gives the entry back, or takes the delay again, A9), force-release (an
//     administrator lifts a live claim with a typed reason, C4; an agent who tries is refused 403 and the
//     attempt is journaled, backoffice.action_refused, CA63).
// The rules are the database's (0307, 0308): the functions lock what they decide, check the live claim of the
// caller, the token and the rules, and write the decision, the register, the e-mail and the leads events in
// ONE transaction. This file maps their refusals to codes (campaign-queue/refusals.ts), never a trace.
// - RG36: a decision or an extension on an entry of an account the caller HOLDS answers 403 with the issue
//   `conflict_of_interest`, after the trace of the attempt is committed; the database refuses it too
//   (42501). Giving a claim back stays open to him.
// - A decision answers with the entry to open next (17b §2.6), never opened for the caller here.
// - Every answer is `Cache-Control: no-store`.
import {
  campaignEntryParamsSchema,
  firstReviewCampaignEntryRequestSchema,
  firstReviewCampaignEntryResponseSchema,
  forceReleaseCampaignEntryRequestSchema,
  publishCampaignEntryRequestSchema,
  publishCampaignEntryResponseSchema,
  rejectCampaignEntryRequestSchema,
  rejectCampaignEntryResponseSchema,
  type CampaignEntryParams,
  type FirstReviewCampaignEntryRequest,
  type FirstReviewCampaignEntryResponse,
  type PublishCampaignEntryRequest,
  type PublishCampaignEntryResponse,
  type RejectCampaignEntryRequest,
  type RejectCampaignEntryResponse,
} from "@influx/contracts/campaign-review";
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
  extendCampaignClaim,
  firstReviewCampaignEntry,
  forceReleaseCampaignClaim,
  publishCampaignEntry,
  rejectCampaignEntry,
  releaseCampaignEntry,
} from "./campaign-queue/acts/repository.ts";
import {
  CAMPAIGN_ENTRIES,
  campaignActsOf,
  type CampaignQueueDependencies,
} from "./campaign-queue/guards.ts";
import { displayNameOf } from "./queues/decisions/repository.ts";
import { memberMessageSignals } from "./queues/entry-alerts.ts";

export function registerCampaignQueueDecisionRoutes(
  app: IdentityApp,
  dependencies: CampaignQueueDependencies,
): void {
  const acts = campaignActsOf(dependencies.database);

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/release`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        response: { 200: releaseEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ReleaseEntryResponse> => {
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      return acts.inSession(request, reply, async (tx, context) => {
        await acts.treated(tx, context, entryId, (savepoint) =>
          releaseCampaignEntry(savepoint, entryId),
        );
        return { released: true };
      });
    },
  );

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/extend`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        response: { 200: extendEntryResponseSchema },
      },
    },
    async (request, reply): Promise<ExtendEntryResponse> => {
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      const claimExpiresAt = unlessConflict(
        await acts.inSession(request, reply, (tx, context) =>
          acts.decided(tx, context, entryId, (savepoint) =>
            extendCampaignClaim(savepoint, entryId),
          ),
        ),
      );
      return { claimExpiresAt };
    },
  );

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/force-release`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        body: forceReleaseCampaignEntryRequestSchema,
        response: { 200: forceReleaseResponseSchema },
      },
    },
    async (request, reply): Promise<ForceReleaseResponse> => {
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      const body = request.body as { reasonCode: string };
      // CA63: an agent's attempt is refused and journaled in a transaction that commits; the 403 is
      // answered after. The masking of the button on the screen is never the control.
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
                  forceReleaseCampaignClaim(
                    savepoint,
                    entryId,
                    body.reasonCode,
                  ),
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

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/first-review`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        body: firstReviewCampaignEntryRequestSchema,
        response: { 200: firstReviewCampaignEntryResponseSchema },
      },
    },
    async (request, reply): Promise<FirstReviewCampaignEntryResponse> => {
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      const body = request.body as FirstReviewCampaignEntryRequest;
      return unlessConflict(
        await acts.inSession(request, reply, async (tx, context) => {
          const reviewed = await acts.decided(
            tx,
            context,
            entryId,
            (savepoint) =>
              firstReviewCampaignEntry(
                savepoint,
                entryId,
                body.reviewToken,
                body.opinion,
              ),
          );
          return reviewed === CONFLICT_OF_INTEREST
            ? reviewed
            : { ...reviewed, next: await acts.next(tx, context) };
        }),
      );
    },
  );

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/publish`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        body: publishCampaignEntryRequestSchema,
        response: { 200: publishCampaignEntryResponseSchema },
      },
    },
    async (request, reply): Promise<PublishCampaignEntryResponse> => {
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      const body = request.body as PublishCampaignEntryRequest;
      return unlessConflict(
        await acts.inSession(request, reply, async (tx, context) => {
          const published = await acts.decided(
            tx,
            context,
            entryId,
            (savepoint) =>
              publishCampaignEntry(
                savepoint,
                entryId,
                body.reviewToken,
                body.ownerAgentId.toLowerCase(),
                body.internalComment ?? null,
              ),
          );
          return published === CONFLICT_OF_INTEREST
            ? published
            : { ...published, next: await acts.next(tx, context) };
        }),
      );
    },
  );

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/reject`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        body: rejectCampaignEntryRequestSchema,
        response: { 200: rejectCampaignEntryResponseSchema },
      },
    },
    async (request, reply): Promise<RejectCampaignEntryResponse> => {
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      const body = request.body as RejectCampaignEntryRequest;
      // RG90, RG158: the message goes to the brand in an e-mail without any link; a direct contact is refused
      if (
        body.memberMessage !== undefined &&
        memberMessageSignals(body.memberMessage).length > 0
      ) {
        throw new RequestValidationError([
          { path: "memberMessage", issue: "direct_contact" },
        ]);
      }
      return unlessConflict(
        await acts.inSession(request, reply, async (tx, context) => {
          const rejected = await acts.decided(
            tx,
            context,
            entryId,
            (savepoint) =>
              rejectCampaignEntry(
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
            : { ...rejected, next: await acts.next(tx, context) };
        }),
      );
    },
  );
}

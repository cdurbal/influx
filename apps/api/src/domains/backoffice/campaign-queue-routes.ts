// Routes of queue 7 of the backoffice, « campagnes à valider » (docs/mvp/09 RG1, RG5, RG85, RG87 to RG95; 15
// RG26 to RG28, RG33, RG34, RG36, C1 to C8; 17b §3.8; jalons/l3c/modele.md §1, §3, §4; l3c-fiche invariants
// 1 to 6, 11, 12; 18 T14). Backoffice surface; the aal2 guard of server.ts runs first, then each handler
// reads through withBackofficeSession() (agent and admin alike).
//   GET  /v1/bo/campaigns/entries: the list, oldest deadline first, the ones past their deadline in front
//        (C5), its filters (RG33), a page capped by the server (RG34), the counters of the queue (RG28); the
//        brand, the title, the category, the mention of the enhanced review, the alerts (RG87); no text of
//        the campaign, no band.
//   POST …/entries/search: the same page, the filters, the period and the cursor in the body (the relay
//        refuses instants and a long cursor in a query); reads only.
//   POST …/entries/:id/open: opening is claiming (C1): the entry is taken, or read in read-only mode with the
//        name of its holder (C2); the decision view comes back with the version token, the alerts of
//        detection (RG21 to RG23), the duplicate alert (RG95), the refusal reasons with the message the brand
//        will receive (the very words of the e-mail) and the note of a requested second opinion, to the HOLDER of
//        a live claim only. A POST: it has an effect (the claim, the register line).
// Decisions, release, extension and forced release: campaign-queue-decision-routes.ts, registered from here;
// the record and the acts on the campaign: campaign-record-routes.ts.
// - An unknown entry, the one of the caller's own account and an open one whose first examination he gave
//   answer exactly alike (404, T14.3, T14.4); an entry of an account the caller HOLDS answers 403 with the
//   issue `conflict_of_interest` (RG36), the attempt journaled first (CA19, backoffice.action_refused,
//   0215), and is absent from the list and the counters.
// - Every answer is `Cache-Control: no-store`: it carries internal data.
import type { UiLocale } from "@influx/contracts/auth";
import {
  campaignEntriesQuerySchema,
  campaignEntriesResponseSchema,
  campaignEntriesSearchSchema,
  campaignEntryParamsSchema,
  openCampaignEntryResponseSchema,
  type CampaignEntriesQuery,
  type CampaignEntriesResponse,
  type CampaignEntriesSearch,
  type CampaignEntryParams,
  type CampaignEntryRow,
  type CampaignQueueCounters,
  type OpenCampaignEntryResponse,
} from "@influx/contracts/campaign-review";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  campaignRejectionReasonOf,
  campaignRejectionReasonPreview,
} from "../campaigns/campaign-decision-email.ts";
import type { BackofficeContext } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  CONFLICT_OF_INTEREST,
  conflictOfInterest,
  isForbidden,
  unlessConflict,
} from "./action-guards.ts";
import { registerCampaignQueueDecisionRoutes } from "./campaign-queue-decision-routes.ts";
import { registerCampaignRecordRoutes } from "./campaign-record-routes.ts";
import {
  openCampaignEntry,
  type CampaignOpeningRow,
} from "./campaign-queue/acts/repository.ts";
import { alertCodesOf, textAlertsOf } from "./campaign-queue/alerts.ts";
import {
  CAMPAIGN_ENTRIES,
  campaignActsOf,
  type CampaignQueueDependencies,
} from "./campaign-queue/guards.ts";
import {
  campaignEntryTargetOf,
  listCampaignEntriesPage,
  readCampaignCounters,
  type CampaignCountersRow,
  type ListedCampaignEntry,
  type ListFilters,
} from "./campaign-queue/lists/repository.ts";
import {
  readCampaignBrand,
  readCampaignEntryView,
  readCampaignRejectionReasons,
  readCampaignView,
  readDuplicateOf,
  readResponsibles,
} from "./campaign-queue/views/repository.ts";
import {
  decodeCursor,
  encodeCursor,
} from "./creator-queues/lists/repository.ts";

type ListQuery = {
  overdue?: "true";
  holder?: string;
  owner?: string;
  from?: string;
  to?: string;
  alert?: "true";
  cursor?: string;
};

function filtersOf(query: ListQuery): ListFilters {
  const filters: ListFilters = {};
  if (query.overdue !== undefined) filters.overdue = true;
  if (query.holder !== undefined) filters.holder = query.holder.toLowerCase();
  if (query.owner !== undefined) filters.owner = query.owner.toLowerCase();
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
  counters: CampaignCountersRow | null,
): CampaignQueueCounters | null {
  return counters === null
    ? null
    : {
        queue: "campaigns",
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

function claimOf(
  entry: {
    holder: { accountId: string; displayName: string | null } | null;
    claimedAt: string | null;
    claimExpiresAt: string | null;
  },
  caller: string,
) {
  return {
    holder: entry.holder,
    claimedAt: entry.claimedAt,
    claimExpiresAt: entry.claimExpiresAt,
    heldByCaller: entry.holder?.accountId === caller,
  };
}

function rowOf(entry: ListedCampaignEntry, caller: string): CampaignEntryRow {
  return {
    id: entry.id,
    campaignId: entry.campaignId,
    advertiserAccountId: entry.advertiserAccountId,
    brandName: entry.brandName,
    title: entry.title,
    campaignType: entry.campaignType,
    sectorCode: entry.sectorCode,
    enhancedReview: entry.enhancedReview,
    // D84: one person decides; `second_opinion` only says an opinion was asked, it blocks nothing
    phase: entry.firstReviewer === null ? "single" : "second_opinion",
    firstReviewer: entry.firstReviewer,
    createdAt: entry.createdAt,
    slaDueAt: entry.slaDueAt,
    escalateAt: entry.escalateAt,
    overdue: entry.overdue,
    owner: entry.owner,
    claim: claimOf(entry, caller),
    alerts: alertCodesOf(entry.examined, entry.duplicate),
  };
}

export function registerCampaignQueueRoutes(
  app: IdentityApp,
  dependencies: CampaignQueueDependencies,
): void {
  const { database } = dependencies;
  registerCampaignQueueDecisionRoutes(app, dependencies);
  registerCampaignRecordRoutes(app, dependencies);
  const acts = campaignActsOf(database);

  function page(
    request: FastifyRequest,
    reply: FastifyReply,
    query: CampaignEntriesQuery | CampaignEntriesSearch,
  ): Promise<CampaignEntriesResponse> {
    const filters = filtersOf(query);
    const withAlert =
      query.alert === undefined
        ? null
        : (entry: ListedCampaignEntry): boolean =>
            alertCodesOf(entry.examined, entry.duplicate).length > 0;
    return acts.inSession(request, reply, async (tx, context) => {
      const found = await listCampaignEntriesPage(
        tx,
        context.accountId,
        filters,
        query.limit,
        withAlert,
      );
      const counters = await readCampaignCounters(tx, context.accountId);
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
    CAMPAIGN_ENTRIES,
    {
      schema: {
        querystring: campaignEntriesQuerySchema,
        response: { 200: campaignEntriesResponseSchema },
      },
    },
    (request, reply): Promise<CampaignEntriesResponse> =>
      page(request, reply, request.query as CampaignEntriesQuery),
  );

  app.post(
    `${CAMPAIGN_ENTRIES}/search`,
    {
      schema: {
        body: campaignEntriesSearchSchema,
        response: { 200: campaignEntriesResponseSchema },
      },
    },
    (request, reply): Promise<CampaignEntriesResponse> =>
      page(request, reply, request.body as CampaignEntriesSearch),
  );

  app.post(
    `${CAMPAIGN_ENTRIES}/:id/open`,
    {
      schema: {
        params: campaignEntryParamsSchema,
        response: { 200: openCampaignEntryResponseSchema },
      },
    },
    async (request, reply): Promise<OpenCampaignEntryResponse> => {
      void reply.header("cache-control", "no-store");
      const entryId = (request.params as CampaignEntryParams).id.toLowerCase();
      try {
        return unlessConflict(
          await acts.inSession(request, reply, (tx, context) =>
            openedEntry(tx, context, entryId),
          ),
        );
      } catch (error) {
        // 42501 of the database: an unknown entry, the caller's own account, the one he first examined
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
    },
  );

  async function openedEntry(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
  ): Promise<OpenCampaignEntryResponse | typeof CONFLICT_OF_INTEREST> {
    const target = await campaignEntryTargetOf(tx, entryId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    // 15 RG36, 13 RG35, 17b §2.5: the account is the caller's to hold, not to examine; the refusal is
    // journaled (CA19) and the database refuses it too (0307)
    if (target.ownerAgentId === context.accountId) {
      return conflictOfInterest(tx);
    }
    const opening: CampaignOpeningRow = await openCampaignEntry(tx, entryId);
    // After the opening, never before: the view is no older than the version of the token
    const entry = await readCampaignEntryView(tx, entryId);
    const campaign = await readCampaignView(tx, target.campaignId);
    const brand = await readCampaignBrand(tx, target.advertiserAccountId);
    if (entry === null || campaign === null || brand === null) {
      throw new ApiError("not_found");
    }
    const holds = opening.outcome === "claimed" || opening.outcome === "held";
    const duplicate =
      entry.duplicateOfCampaignId === null
        ? null
        : await readDuplicateOf(tx, entry.duplicateOfCampaignId);
    const locale: UiLocale = brand.preferredLanguage;
    const reasons: OpenCampaignEntryResponse["reasons"] = [];
    for (const reason of await readCampaignRejectionReasons(tx)) {
      const code = campaignRejectionReasonOf(reason.code);
      if (code !== null) {
        const preview = campaignRejectionReasonPreview(locale, code);
        reasons.push({
          code,
          position: reason.position,
          requiresMemberMessage: reason.requiresMemberMessage,
          message: preview.message,
          nextStepMessage: preview.nextStep,
        });
      }
    }
    return {
      asOf: entry.asOf,
      outcome: opening.outcome,
      reviewToken: opening.reviewToken,
      entry: {
        id: entry.id,
        state: entry.state,
        createdAt: entry.createdAt,
        slaDueAt: entry.slaDueAt,
        escalateAt: entry.escalateAt,
        overdue: entry.overdue,
        claim: claimOf(entry, context.accountId),
        lastForcedRelease:
          entry.forcedRelease === null
            ? null
            : {
                ...entry.forcedRelease,
                holderIsCaller:
                  entry.forcedRelease.holder?.accountId === context.accountId,
              },
        decision:
          entry.decision as OpenCampaignEntryResponse["entry"]["decision"],
        review: {
          phase: entry.firstReviewedAt === null ? "single" : "second_opinion",
          enhancedReview: entry.enhancedReview,
          firstReviewer: entry.firstReviewer,
          firstReviewedAt: entry.firstReviewedAt,
          // modele §1: the opinion goes to the holder of a live claim, the requester included, never to anybody else
          firstOpinion: holds ? opening.firstOpinion : null,
        },
      },
      campaignId: target.campaignId,
      brand: {
        ...brand,
        countryCode:
          brand.countryCode as OpenCampaignEntryResponse["brand"]["countryCode"],
      },
      campaign: campaign.fields,
      status: campaign.status,
      alerts: textAlertsOf(campaign.fields),
      duplicateOf:
        duplicate === null
          ? null
          : {
              ...duplicate,
              status: duplicate.status as NonNullable<
                OpenCampaignEntryResponse["duplicateOf"]
              >["status"],
            },
      reasons,
      responsibles: await readResponsibles(tx),
    };
  }
}

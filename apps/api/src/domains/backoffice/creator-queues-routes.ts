// Routes of queues 2 and 3 of the backoffice, « profils créateur à valider » and « visuels de portfolio à
// modérer » (docs/mvp/07 RG4 to RG10, RG77 to RG83, RG93 to RG99; 15 RG26 to RG28, RG33, RG34, RG35,
// RG36, C1 to C8; 17b §2.7 lines 2 and 3; jalons/l2g/modele.md §1 points 1, 2, 9, 10, 12, §6; l2g-fiche
// invariants 1, 5, 10, 13, 14; 18 T14). Backoffice surface; the aal2 guard of server.ts runs first, then
// each handler reads through withBackofficeSession() (agent and admin alike).
//   GET  /v1/bo/queues/{profiles-creator|portfolio-moderation}/entries: the list, oldest deadline first,
//        the ones past their deadline in front (C5), its filters (RG33), a page capped by the server
//        (RG34), the counters of the queue (RG28); no handle, no link, no figure, no caption, no
//        thumbnail (D82 (7)).
//   POST …/entries/search: the same page, the filters, the period and the cursor in the body (the relay
//        refuses instants and a long cursor in a query); reads only.
//   POST …/entries/:id/open: opening is claiming (C1): the entry is taken, or read in read-only mode with
//        the name of its holder (C2); the decision view comes back with the version token, the alerts
//        (RG93, EC-L2G-12) and the refusal reasons with the message the creator will receive (the very
//        words of the e-mail, EC-L2G-10-1). A POST: it has an effect (the claim, the register line).
//   GET  …/profiles-creator/entries/:id/portfolio/:itemId/image and …/portfolio-moderation/entries/:id/image:
//        a visual relayed as JSON, to the HOLDER of a live claim only (D82 (7)); the database journals one
//        `queue.portfolio_read` line per read, in the transaction that hands the key over. The key goes to
//        the relay of Storage and nowhere else: never in an answer, never in a log (T9.2, T1.5).
// Decisions, release, extension and forced release: creator-queues-decision-routes.ts, registered from here.
// - An unknown entry, a visual still uploading, the one of the caller's own account and a closed one the
//   caller cannot see answer exactly alike (404, T14.3, T14.4); an entry of an account the caller HOLDS
//   answers 403 with the issue `conflict_of_interest` (RG36), the attempt journaled first (CA19,
//   backoffice.action_refused, 0215), and is absent from the list and the counters.
// - Every answer is `Cache-Control: no-store`: it carries internal data.
import type { UiLocale } from "@influx/contracts/auth";
import {
  creatorEntriesQuerySchema,
  creatorEntriesResponseSchema,
  creatorEntriesSearchSchema,
  creatorEntryItemParamsSchema,
  creatorEntryParamsSchema,
  openCreatorEntryResponseSchema,
  openPortfolioItemResponseSchema,
  portfolioEntriesQuerySchema,
  portfolioEntriesResponseSchema,
  portfolioEntriesSearchSchema,
  reviewImageResponseSchema,
  type CreatorEntriesQuery,
  type CreatorEntriesResponse,
  type CreatorEntriesSearch,
  type CreatorEntryItemParams,
  type CreatorEntryParams,
  type CreatorEntryRow,
  type CreatorQueueCounters,
  type CreatorReviewedRevision,
  type OpenCreatorEntryResponse,
  type OpenPortfolioItemResponse,
  type PortfolioEntriesQuery,
  type PortfolioEntriesResponse,
  type PortfolioEntriesSearch,
  type PortfolioEntryRow,
  type ReviewImageResponse,
} from "@influx/contracts/creator-queues";
import type { Transaction } from "../../db/index.ts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import type { BackofficeContext } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  creatorRejectionReasonOf,
  creatorRejectionReasonPreview,
  portfolioRejectionReasonOf,
  portfolioRejectionReasonPreview,
} from "../profiles/creator/decision-email.ts";
import { PORTFOLIO_BUCKET } from "../profiles/creator/portfolio.ts";
import {
  CONFLICT_OF_INTEREST,
  conflictOfInterest,
  isForbidden,
  unlessConflict,
} from "./action-guards.ts";
import { registerCreatorQueueDecisionRoutes } from "./creator-queues-decision-routes.ts";
import {
  alertCodesOf,
  reviewAlertsOf,
  type ExaminedRows,
} from "./creator-queues/alerts.ts";
import {
  openEntry,
  readCreatorEntryItem,
  readPortfolioItem,
  type ReviewedObject,
} from "./creator-queues/acts/repository.ts";
import {
  actsOf,
  PORTFOLIO_MODERATION_ENTRIES,
  PROFILES_CREATOR_ENTRIES,
  type CreatorQueuesDependencies,
} from "./creator-queues/guards.ts";
import {
  decodeCursor,
  encodeCursor,
  entryAccountOf,
  listCreatorEntriesPage,
  listPortfolioEntriesPage,
  readCounters,
  type CountersRow,
  type CreatorQueue,
  type ListFilters,
  type ListedCreatorEntry,
  type ListedPortfolioEntry,
} from "./creator-queues/lists/repository.ts";
import {
  readCreatorEntryView,
  readCreatorRejectionReasons,
  readPendingRevisions,
  readPortfolioItemView,
  readPortfolioRejectionReasons,
  readReviewedLines,
  readReviewedVisuals,
  type PendingRevisionRow,
  type ReviewedLineRow,
  type ReviewedVisualRow,
} from "./creator-queues/views/repository.ts";

export type BackofficeCreatorQueuesDependencies = CreatorQueuesDependencies & {
  /** Storage, for the visual of an entry (the bucket `portfolio` of the member routes). */
  store: ObjectStore;
};

const PROFILE_FIELD_PREFIX = "creator.";

type ListQuery = {
  kind?: string;
  country?: string;
  network?: string;
  badge?: "with" | "without";
  account?: string;
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
  if (query.kind !== undefined) filters.kind = query.kind;
  if (query.country !== undefined) filters.country = query.country;
  if (query.network !== undefined) filters.network = query.network;
  if (query.badge !== undefined) filters.badge = query.badge;
  if (query.account !== undefined)
    filters.account = query.account.toLowerCase();
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
  queue: CreatorQueue,
  counters: CountersRow | null,
): CreatorQueueCounters | null {
  return counters === null
    ? null
    : {
        queue,
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
    held: boolean;
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

function creatorRowOf(
  entry: ListedCreatorEntry,
  caller: string,
): CreatorEntryRow {
  return {
    id: entry.id,
    accountId: entry.accountId,
    kind: entry.kind,
    createdAt: entry.createdAt,
    slaDueAt: entry.slaDueAt,
    escalateAt: entry.escalateAt,
    overdue: entry.overdue,
    alias: entry.alias,
    countryCode: entry.countryCode as CreatorEntryRow["countryCode"],
    networks: entry.networks,
    badges: entry.badges as CreatorEntryRow["badges"],
    completenessPercent: entry.completenessPercent,
    modifiedFields: entry.modifiedFields as CreatorEntryRow["modifiedFields"],
    owner: entry.owner,
    claim: claimOf(entry, caller),
    alerts: alertCodesOf(entry.examined),
  };
}

function portfolioRowOf(
  entry: ListedPortfolioEntry,
  caller: string,
): PortfolioEntryRow {
  return {
    id: entry.id,
    accountId: entry.accountId,
    alias: entry.alias,
    kind: entry.kind,
    createdAt: entry.createdAt,
    slaDueAt: entry.slaDueAt,
    escalateAt: entry.escalateAt,
    overdue: entry.overdue,
    visualCount: entry.visualCount,
    owner: entry.owner,
    claim: claimOf(entry, caller),
    alerts: alertCodesOf(entry.examined),
  };
}

/** The text of a proposed value: a title, a bio, a handle or a link are plain strings. */
function textOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** A caption proposal: `{caption, brand_declaration_id}` (0243). */
function captionOf(value: unknown): {
  caption: string | null;
  brandDeclared: boolean;
} {
  if (typeof value !== "object" || value === null) {
    return { caption: null, brandDeclared: false };
  }
  const found = value as { caption?: unknown; brand_declaration_id?: unknown };
  return {
    caption: typeof found.caption === "string" ? found.caption : null,
    brandDeclared: typeof found.brand_declaration_id === "string",
  };
}

/**
 * A pending revision with what is served today beside it (07 RG9, modele point 6). A revision of a
 * field this contract does not name is left out rather than guessed.
 */
function revisionOf(
  row: PendingRevisionRow,
  headline: string | null,
  bio: string | null,
  lines: readonly ReviewedLineRow[],
  visuals: readonly ReviewedVisualRow[],
): CreatorReviewedRevision | null {
  if (!row.fieldCode.startsWith(PROFILE_FIELD_PREFIX)) return null;
  const field = row.fieldCode.slice(PROFILE_FIELD_PREFIX.length);
  const base = { id: row.id, rowKey: row.rowKey, submittedAt: row.submittedAt };
  const line = lines.find((candidate) => candidate.id === row.rowKey);
  switch (field) {
    case "headline":
      return {
        ...base,
        field,
        validated: { kind: "text", text: headline },
        proposed: { kind: "text", text: textOf(row.proposed) },
      };
    case "bio":
      return {
        ...base,
        field,
        validated: { kind: "text", text: bio },
        proposed: { kind: "text", text: textOf(row.proposed) },
      };
    case "network_line":
      return {
        ...base,
        field,
        validated: null,
        proposed: { kind: "line", networkCode: line?.networkCode ?? "unknown" },
      };
    case "network_handle":
      return {
        ...base,
        field,
        validated: { kind: "text", text: line?.handle ?? null },
        proposed: { kind: "text", text: textOf(row.proposed) },
      };
    case "network_url":
      return {
        ...base,
        field,
        validated: { kind: "text", text: line?.profileUrl ?? null },
        proposed: { kind: "text", text: textOf(row.proposed) },
      };
    case "portfolio_caption": {
      const visual = visuals.find((candidate) => candidate.id === row.rowKey);
      return {
        ...base,
        field,
        validated: {
          kind: "caption",
          caption: visual?.caption ?? null,
          brandDeclared: visual?.brandDeclared ?? false,
        },
        proposed: { kind: "caption", ...captionOf(row.proposed) },
      };
    }
    default:
      return null;
  }
}

/** The texts the moderator examines in a view: a pending proposal replaces the live text (07 RG9). */
function examinedRowsOf(
  headline: string | null,
  bio: string | null,
  visuals: readonly ReviewedVisualRow[],
  revisions: readonly CreatorReviewedRevision[],
): ExaminedRows {
  const proposedText = (field: "headline" | "bio", live: string | null) => {
    const found = revisions.find((revision) => revision.field === field);
    return found?.proposed.kind === "text" ? found.proposed.text : live;
  };
  return {
    headline: proposedText("headline", headline),
    bio: proposedText("bio", bio),
    captions: visuals.map((visual) => {
      const found = revisions.find(
        (revision) =>
          revision.field === "portfolio_caption" &&
          revision.rowKey === visual.id,
      );
      return {
        rowKey: visual.id,
        text:
          found?.proposed.kind === "caption"
            ? found.proposed.caption
            : visual.caption,
      };
    }),
  };
}

/** Reads and relays one visual of Storage as the member route does: JSON, base64, no key, no address. */
async function relayedImage(
  store: ObjectStore,
  request: FastifyRequest,
  object: ReviewedObject | null,
): Promise<ReviewImageResponse> {
  if (object === null) {
    throw new ApiError("not_found");
  }
  // (b) the object, by the key of the database: never named by the client (T9.3)
  const read = await store.read(PORTFOLIO_BUCKET, object.objectKey);
  if (!read.ok) {
    request.log.error(
      { reason: read.reason, status: read.status, errorCode: read.errorCode },
      "queue.portfolio.read_failed",
    );
    throw new ApiError("service_unavailable");
  }
  if (read.value === null) {
    // a row without its object (purged meanwhile): a person looks (D60 error line), the screen says so
    request.log.error({}, "queue.portfolio.object_missing");
    throw new ApiError("not_found");
  }
  const bytes = read.value;
  return {
    state: object.state,
    image: {
      contentType: "image/webp",
      width: object.width,
      height: object.height,
      byteSize: bytes.length,
      data: Buffer.from(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      ).toString("base64"),
    },
  };
}

export function registerCreatorQueueRoutes(
  app: IdentityApp,
  dependencies: BackofficeCreatorQueuesDependencies,
): void {
  const { database, store } = dependencies;
  registerCreatorQueueDecisionRoutes(app, dependencies);
  const creatorActs = actsOf(database, "profiles_creator");
  const portfolioActs = actsOf(database, "portfolio_moderation");

  // ---------------------------------------------------------------------------------------------
  // Queue 2: profils créateur à valider
  // ---------------------------------------------------------------------------------------------

  function creatorPage(
    request: FastifyRequest,
    reply: FastifyReply,
    query: CreatorEntriesQuery | CreatorEntriesSearch,
  ): Promise<CreatorEntriesResponse> {
    const filters = filtersOf(query);
    const withAlert =
      query.alert === undefined
        ? null
        : (entry: ListedCreatorEntry): boolean =>
            alertCodesOf(entry.examined).length > 0;
    return creatorActs.inSession(request, reply, async (tx, context) => {
      const page = await listCreatorEntriesPage(
        tx,
        context.accountId,
        filters,
        query.limit,
        withAlert,
      );
      const counters = await readCounters(
        tx,
        "profiles_creator",
        context.accountId,
      );
      return {
        asOf: counters?.asOf ?? new Date().toISOString(),
        counters: countersOf("profiles_creator", counters),
        items: page.items.map((entry) =>
          creatorRowOf(entry, context.accountId),
        ),
        nextCursor:
          page.resumeAfter === null ? null : encodeCursor(page.resumeAfter),
      };
    });
  }

  app.get(
    PROFILES_CREATOR_ENTRIES,
    {
      schema: {
        querystring: creatorEntriesQuerySchema,
        response: { 200: creatorEntriesResponseSchema },
      },
    },
    (request, reply): Promise<CreatorEntriesResponse> =>
      creatorPage(request, reply, request.query as CreatorEntriesQuery),
  );

  app.post(
    `${PROFILES_CREATOR_ENTRIES}/search`,
    {
      schema: {
        body: creatorEntriesSearchSchema,
        response: { 200: creatorEntriesResponseSchema },
      },
    },
    (request, reply): Promise<CreatorEntriesResponse> =>
      creatorPage(request, reply, request.body as CreatorEntriesSearch),
  );

  app.post(
    `${PROFILES_CREATOR_ENTRIES}/:id/open`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        response: { 200: openCreatorEntryResponseSchema },
      },
    },
    async (request, reply): Promise<OpenCreatorEntryResponse> => {
      void reply.header("cache-control", "no-store");
      const entryId = (request.params as CreatorEntryParams).id.toLowerCase();
      try {
        return unlessConflict(
          await creatorActs.inSession(request, reply, (tx, context) =>
            openedCreatorEntry(tx, context, entryId),
          ),
        );
      } catch (error) {
        // 42501 of the database: an unknown entry, or the caller's own account (C(3)): one answer
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
    },
  );

  async function openedCreatorEntry(
    tx: Transaction,
    context: BackofficeContext,
    entryId: string,
  ): Promise<OpenCreatorEntryResponse | typeof CONFLICT_OF_INTEREST> {
    const target = await entryAccountOf(tx, "profiles_creator", entryId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    // 15 RG36, 13 RG35, 17b §2.5: the account is the caller's to hold, not to examine; the refusal is
    // journaled (CA19) and the database refuses it too (0244)
    if (target.ownerAgentId === context.accountId) {
      return conflictOfInterest(tx);
    }
    const opening = await openEntry(tx, "profiles_creator", entryId);
    // After the opening, never before: the view is no older than the version of the token
    const view = await readCreatorEntryView(tx, entryId);
    if (view === null) {
      throw new ApiError("not_found");
    }
    const { entry, account, profile } = view;
    const lines = await readReviewedLines(tx, target.accountId);
    const visuals = await readReviewedVisuals(tx, target.accountId);
    const pending =
      entry.state === "open" ? await readPendingRevisions(tx, entryId) : [];
    const revisions = pending.flatMap((row) => {
      const revision = revisionOf(
        row,
        profile.headline,
        profile.bio,
        lines,
        visuals,
      );
      return revision === null ? [] : [revision];
    });
    const locale: UiLocale = account.preferredLanguage;
    const reasons: OpenCreatorEntryResponse["reasons"] = [];
    for (const reason of await readCreatorRejectionReasons(tx)) {
      const code = creatorRejectionReasonOf(reason.code);
      if (code !== null) {
        reasons.push({
          code,
          position: reason.position,
          requiresMemberMessage: reason.requiresMemberMessage,
          ...creatorRejectionReasonPreview(locale, code),
        });
      }
    }
    return {
      asOf: view.asOf,
      outcome: opening.outcome,
      reviewToken: opening.reviewToken,
      entry: {
        id: entry.id,
        kind: entry.kind,
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
          entry.decision as OpenCreatorEntryResponse["entry"]["decision"],
      },
      account: {
        id: target.accountId,
        countryCode:
          account.countryCode as OpenCreatorEntryResponse["account"]["countryCode"],
        preferredLanguage: locale,
        owner: account.owner,
      },
      profile: {
        ...profile,
        status: profile.status as OpenCreatorEntryResponse["profile"]["status"],
        travelScope:
          profile.travelScope as OpenCreatorEntryResponse["profile"]["travelScope"],
        collaborationExperience:
          profile.collaborationExperience as OpenCreatorEntryResponse["profile"]["collaborationExperience"],
        deliveryLead:
          profile.deliveryLead as OpenCreatorEntryResponse["profile"]["deliveryLead"],
        maxExclusivity:
          profile.maxExclusivity as OpenCreatorEntryResponse["profile"]["maxExclusivity"],
        availability:
          profile.availability as OpenCreatorEntryResponse["profile"]["availability"],
        lists: {
          ...profile.lists,
          usageRights: profile.lists
            .usageRights as OpenCreatorEntryResponse["profile"]["lists"]["usageRights"],
        },
        lines: lines.map((line) => ({
          ...line,
          badge:
            line.badge as OpenCreatorEntryResponse["profile"]["lines"][number]["badge"],
        })),
        visuals,
      },
      revisions,
      alerts: reviewAlertsOf(
        examinedRowsOf(profile.headline, profile.bio, visuals, revisions),
      ),
      reasons,
    };
  }

  /**
   * GET …/entries/:id/portfolio/:itemId/image (D82 (7), modele point 10): a visual of the account of the
   * entry, to the holder of its live claim. (a) the journaled door of the database, in the transaction;
   * (b) the object by the key it gave, relayed after the commit.
   */
  app.get(
    `${PROFILES_CREATOR_ENTRIES}/:id/portfolio/:itemId/image`,
    {
      schema: {
        params: creatorEntryItemParamsSchema,
        response: { 200: reviewImageResponseSchema },
      },
    },
    async (request, reply): Promise<ReviewImageResponse> => {
      void reply.header("cache-control", "no-store");
      const params = request.params as CreatorEntryItemParams;
      const entryId = params.id.toLowerCase();
      const itemId = params.itemId.toLowerCase();
      let object: ReviewedObject | null;
      try {
        object = unlessConflict(
          await creatorActs.inSession(request, reply, async (tx, context) => {
            const target = await entryAccountOf(
              tx,
              "profiles_creator",
              entryId,
            );
            if (target === null) {
              throw new ApiError("not_found");
            }
            if (target.ownerAgentId === context.accountId) {
              return conflictOfInterest(tx);
            }
            return creatorActs.run(tx, context, entryId, (savepoint) =>
              readCreatorEntryItem(savepoint, entryId, itemId),
            );
          }),
        );
      } catch (error) {
        // 42501: unknown entry, own account, a visual that is not one of the account's to read
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
      return relayedImage(store, request, object);
    },
  );

  // ---------------------------------------------------------------------------------------------
  // Queue 3: visuels de portfolio à modérer
  // ---------------------------------------------------------------------------------------------

  function portfolioPage(
    request: FastifyRequest,
    reply: FastifyReply,
    query: PortfolioEntriesQuery | PortfolioEntriesSearch,
  ): Promise<PortfolioEntriesResponse> {
    const filters = filtersOf(query);
    const withAlert =
      query.alert === undefined
        ? null
        : (entry: ListedPortfolioEntry): boolean =>
            alertCodesOf(entry.examined).length > 0;
    return portfolioActs.inSession(request, reply, async (tx, context) => {
      const page = await listPortfolioEntriesPage(
        tx,
        context.accountId,
        filters,
        query.limit,
        withAlert,
      );
      const counters = await readCounters(
        tx,
        "portfolio_moderation",
        context.accountId,
      );
      return {
        asOf: counters?.asOf ?? new Date().toISOString(),
        counters: countersOf("portfolio_moderation", counters),
        items: page.items.map((entry) =>
          portfolioRowOf(entry, context.accountId),
        ),
        nextCursor:
          page.resumeAfter === null ? null : encodeCursor(page.resumeAfter),
      };
    });
  }

  app.get(
    PORTFOLIO_MODERATION_ENTRIES,
    {
      schema: {
        querystring: portfolioEntriesQuerySchema,
        response: { 200: portfolioEntriesResponseSchema },
      },
    },
    (request, reply): Promise<PortfolioEntriesResponse> =>
      portfolioPage(request, reply, request.query as PortfolioEntriesQuery),
  );

  app.post(
    `${PORTFOLIO_MODERATION_ENTRIES}/search`,
    {
      schema: {
        body: portfolioEntriesSearchSchema,
        response: { 200: portfolioEntriesResponseSchema },
      },
    },
    (request, reply): Promise<PortfolioEntriesResponse> =>
      portfolioPage(request, reply, request.body as PortfolioEntriesSearch),
  );

  app.post(
    `${PORTFOLIO_MODERATION_ENTRIES}/:id/open`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        response: { 200: openPortfolioItemResponseSchema },
      },
    },
    async (request, reply): Promise<OpenPortfolioItemResponse> => {
      void reply.header("cache-control", "no-store");
      const itemId = (request.params as CreatorEntryParams).id.toLowerCase();
      try {
        return unlessConflict(
          await portfolioActs.inSession(request, reply, (tx, context) =>
            openedPortfolioItem(tx, context, itemId),
          ),
        );
      } catch (error) {
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
    },
  );

  async function openedPortfolioItem(
    tx: Transaction,
    context: BackofficeContext,
    itemId: string,
  ): Promise<OpenPortfolioItemResponse | typeof CONFLICT_OF_INTEREST> {
    const target = await entryAccountOf(tx, "portfolio_moderation", itemId);
    if (target === null) {
      throw new ApiError("not_found");
    }
    if (target.ownerAgentId === context.accountId) {
      return conflictOfInterest(tx);
    }
    const opening = await openEntry(tx, "portfolio_moderation", itemId);
    const view = await readPortfolioItemView(tx, itemId);
    if (view === null) {
      throw new ApiError("not_found");
    }
    const { item, account } = view;
    const locale: UiLocale = account.preferredLanguage;
    const reasons: OpenPortfolioItemResponse["reasons"] = [];
    for (const reason of await readPortfolioRejectionReasons(tx)) {
      const code = portfolioRejectionReasonOf(reason.code);
      if (code !== null) {
        reasons.push({
          code,
          position: reason.position,
          gridControl: reason.gridControl,
          message: portfolioRejectionReasonPreview(locale, code),
        });
      }
    }
    return {
      asOf: view.asOf,
      outcome: opening.outcome,
      reviewToken: opening.reviewToken,
      item: {
        id: item.id,
        kind: item.kind,
        state: item.state,
        createdAt: item.createdAt,
        slaDueAt: item.slaDueAt,
        escalateAt: item.escalateAt,
        overdue: item.overdue,
        claim: claimOf(item, context.accountId),
        lastForcedRelease:
          item.forcedRelease === null
            ? null
            : {
                ...item.forcedRelease,
                holderIsCaller:
                  item.forcedRelease.holder?.accountId === context.accountId,
              },
        decision:
          item.decision as OpenPortfolioItemResponse["item"]["decision"],
        width: item.width,
        height: item.height,
        byteSize: item.byteSize,
        caption: item.caption,
        brandDeclared: item.brandDeclared,
        replaces: item.replaces,
      },
      account: {
        id: target.accountId,
        alias: account.alias,
        countryCode:
          account.countryCode as OpenPortfolioItemResponse["account"]["countryCode"],
        preferredLanguage: locale,
        owner: account.owner,
      },
      alerts: reviewAlertsOf({
        headline: null,
        bio: null,
        captions: [{ rowKey: item.id, text: item.caption }],
      }),
      reasons,
    };
  }

  /**
   * GET …/portfolio-moderation/entries/:id/image: the visual of the entry, to the holder of its live
   * claim (D82 (7)); no thumbnail in the list, the read is here and journaled.
   */
  app.get(
    `${PORTFOLIO_MODERATION_ENTRIES}/:id/image`,
    {
      schema: {
        params: creatorEntryParamsSchema,
        response: { 200: reviewImageResponseSchema },
      },
    },
    async (request, reply): Promise<ReviewImageResponse> => {
      void reply.header("cache-control", "no-store");
      const itemId = (request.params as CreatorEntryParams).id.toLowerCase();
      let object: ReviewedObject | null;
      try {
        object = unlessConflict(
          await portfolioActs.inSession(request, reply, async (tx, context) => {
            const target = await entryAccountOf(
              tx,
              "portfolio_moderation",
              itemId,
            );
            if (target === null) {
              throw new ApiError("not_found");
            }
            if (target.ownerAgentId === context.accountId) {
              return conflictOfInterest(tx);
            }
            return portfolioActs.run(tx, context, itemId, (savepoint) =>
              readPortfolioItem(savepoint, itemId),
            );
          }),
        );
      } catch (error) {
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
      return relayedImage(store, request, object);
    },
  );
}

// Routes of queue 1, "profils marque à valider", of the backoffice (docs/mvp/06 RG63 to RG70, RG80;
// 15 RG26 to RG28, RG33, RG34, RG36, RG121, C1 to C8; 17b §2; jalons/l2c/file.md A1 to A10, D81;
// l2c-fiche invariants 2, 7, 9, 11 to 14; 18 T14). Backoffice surface; the aal2 guard of server.ts
// runs first, then each handler reads through withBackofficeSession() (agent and admin alike).
// - GET  /v1/bo/queues/counters: the permanent counters of the queue and its delay (RG28).
// - GET  /v1/bo/queues/profiles-advertiser/entries: the list, oldest deadline first, the ones past
//   their deadline in front (C5), its filters (RG33), a page capped by the server (RG34); no
//   coordinate, never the contact person.
// - POST /v1/bo/queues/profiles-advertiser/entries/search (L2C 18c): the same page, filters, period
//   and cursor in the body (the relay refuses instants and a long cursor in a query); reads only.
// - POST /v1/bo/queues/profiles-advertiser/entries/:id/open: opening is claiming (C1): the entry is
//   taken, or read in read-only mode with the name of its holder (C2); the decision view comes back
//   with the version token (L2BS-1), the alerts (RG19, RG25, RG70, L2BS-8) and the refusal reasons
//   with the message the brand will receive. A POST: it has an effect (the claim, the register line).
// Decisions, release, extension and forced release: queues-decision-routes.ts (commit 12); the logo of an
// entry: queues-logo-routes.ts (commit 18b); both registered
// from here: one registration point for queue 1.
// - An unknown entry, the one of the caller's own account and a closed one that the caller cannot see
//   answer exactly alike (404, T14.3, T14.4); an entry of an account the caller HOLDS answers 403
//   with the issue `conflict_of_interest` (17b §2.5, RG36) and is absent from the list and the counters.
// - Every answer is `Cache-Control: no-store`: it carries internal data.
import {
  BRAND_REVIEW_QUEUE,
  entriesQuerySchema,
  entriesResponseSchema,
  entriesSearchSchema,
  entryParamsSchema,
  openEntryResponseSchema,
  queueCountersResponseSchema,
  type EntriesQuery,
  type EntriesResponse,
  type EntriesSearch,
  type EntryParams,
  type OpenEntryResponse,
  type QueueCountersResponse,
  type QueueEntryRow,
  type ReviewAlert,
  type ReviewReason,
  type RevisionValue,
} from "@influx/contracts/backoffice-queues";
import type { UiLocale } from "@influx/contracts/auth";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { registerBackofficeQueueDecisionRoutes } from "./queues-decision-routes.ts";
import { registerBackofficeQueueLogoRoutes } from "./queues-logo-routes.ts";
import {
  rejectionReasonOf,
  rejectionReasonPreview,
} from "../profiles/brand-decision-email.ts";
import { isForbidden } from "./action-guards.ts";
import {
  alertCodesOf,
  contactAlerts,
  domainAlerts,
  type ExaminedValues,
} from "./queues/entry-alerts.ts";
import {
  entryAccountOf,
  listEntriesPage,
  openEntry,
  readCounters,
  readDuplicates,
  readEntryView,
  readLogos,
  readPendingRevisions,
  readRejectionReasons,
  type EntryFilters,
  type ListedEntry,
  type LogoRow,
} from "./queues/repository.ts";

export type BackofficeQueuesDependencies = {
  database: ApiDatabase;
  /** Storage, for the logo of an entry (queues-logo-routes.ts): the one of the brand-profile routes. */
  store: ObjectStore;
};

const INSTANT_MICRO = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z";
const CURSOR_PATTERN = new RegExp(
  `^(${INSTANT_MICRO})\\|(${INSTANT_MICRO})\\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

/** The opaque cursor: the sort key of the last line (deadline, creation, id), microseconds kept. */
export function encodeEntryCursor(cursor: ListedEntry["cursor"]): string {
  return Buffer.from(
    `${cursor.dueAt}|${cursor.createdAt}|${cursor.id}`,
    "utf8",
  ).toString("base64url");
}

export function decodeEntryCursor(
  cursor: string,
): { dueAt: string; createdAt: string; id: string } | null {
  const match = CURSOR_PATTERN.exec(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  if (
    match === null ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return null;
  }
  return { dueAt: match[1], createdAt: match[2], id: match[3] };
}

function filtersOf(query: EntriesQuery | EntriesSearch): EntryFilters {
  const filters: EntryFilters = {};
  if (query.kind !== undefined) filters.kind = query.kind;
  if (query.country !== undefined) filters.country = query.country;
  if (query.overdue !== undefined) filters.overdue = true;
  if (query.holder !== undefined) filters.holder = query.holder.toLowerCase();
  if (query.owner !== undefined) filters.owner = query.owner.toLowerCase();
  if (query.from !== undefined) filters.from = query.from;
  if (query.to !== undefined) filters.to = query.to;
  if (query.cursor !== undefined) {
    const after = decodeEntryCursor(query.cursor);
    if (after === null) {
      throw new RequestValidationError([
        { path: "cursor", issue: "invalid_cursor" },
      ]);
    }
    filters.after = after;
  }
  return filters;
}

function rowOf(entry: ListedEntry, caller: string): QueueEntryRow {
  return {
    id: entry.id,
    accountId: entry.accountId,
    kind: entry.kind,
    createdAt: entry.createdAt,
    slaDueAt: entry.slaDueAt,
    escalateAt: entry.escalateAt,
    overdue: entry.overdue,
    brandName: entry.brandName,
    countryCode: entry.countryCode as QueueEntryRow["countryCode"],
    completenessPercent: entry.completenessPercent,
    modifiedFields: entry.modifiedFields,
    owner: entry.owner,
    claim: {
      holder: entry.holder,
      claimedAt: entry.claimedAt,
      claimExpiresAt: entry.claimExpiresAt,
      heldByCaller: entry.holder?.accountId === caller,
    },
    alerts: alertCodesOf(entry.examined, {
      brandName: entry.duplicateBrand,
      domain: entry.duplicateDomain,
    }),
  };
}

/** The values the moderator examines: a pending proposal of a text field replaces the live one. */
function examinedOf(
  live: ExaminedValues,
  revisions: readonly { fieldCode: string; proposed: RevisionValue }[],
): ExaminedValues {
  const examined = { ...live };
  for (const { fieldCode, proposed } of revisions) {
    if (proposed.kind !== "text") continue;
    if (fieldCode === "advertiser.brand_name" && proposed.text !== null) {
      examined.brandName = proposed.text;
    } else if (fieldCode === "advertiser.presentation") {
      examined.presentation = proposed.text;
    } else if (fieldCode === "advertiser.website_domain") {
      examined.websiteDomain = proposed.text;
    }
  }
  return examined;
}

/** The validated value of a moderated field, as the live row holds it (06 RG9). */
function validatedOf(
  fieldCode: string,
  profile: NonNullable<Awaited<ReturnType<typeof readEntryView>>>["profile"],
  logos: readonly LogoRow[],
): RevisionValue {
  switch (fieldCode) {
    case "advertiser.logo":
      return {
        kind: "logo",
        logoObjectId: logos.find((logo) => logo.state === "active")?.id ?? null,
      };
    case "advertiser.brand_name":
      return { kind: "text", text: profile.brandName };
    case "advertiser.presentation":
      return { kind: "text", text: profile.presentation };
    case "advertiser.website_domain":
      return { kind: "text", text: profile.websiteDomain };
    case "advertiser.contact_role":
      return { kind: "text", text: profile.contactRole };
    default:
      return { kind: "text", text: profile.primarySector };
  }
}

function logoOf(logo: LogoRow | undefined) {
  return logo === undefined
    ? null
    : {
        id: logo.id,
        byteSize: logo.byteSize,
        width: logo.width,
        height: logo.height,
        activatedAt: logo.activatedAt,
      };
}

export function registerBackofficeQueueRoutes(
  app: IdentityApp,
  dependencies: BackofficeQueuesDependencies,
): void {
  const { database } = dependencies;
  registerBackofficeQueueDecisionRoutes(app, dependencies);
  registerBackofficeQueueLogoRoutes(app, dependencies);

  app.get(
    "/v1/bo/queues/counters",
    { schema: { response: { 200: queueCountersResponseSchema } } },
    async (request, reply): Promise<QueueCountersResponse> => {
      void reply.header("cache-control", "no-store");
      const counters = await withBackofficeSession(
        database,
        request,
        reply,
        (tx, context) => readCounters(tx, context.accountId),
      );
      return {
        asOf: counters?.asOf ?? new Date().toISOString(),
        queues:
          counters === null
            ? []
            : [
                {
                  queue: BRAND_REVIEW_QUEUE,
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
                },
              ],
      };
    },
  );

  /** One page of the list, whether the filters came in the query string or in the body. */
  function entriesPage(
    request: FastifyRequest,
    reply: FastifyReply,
    query: EntriesQuery | EntriesSearch,
  ): Promise<EntriesResponse> {
    void reply.header("cache-control", "no-store");
    const filters = filtersOf(query);
    const withAlert =
      query.alert === undefined
        ? null
        : (entry: ListedEntry): boolean =>
            alertCodesOf(entry.examined, {
              brandName: entry.duplicateBrand,
              domain: entry.duplicateDomain,
            }).length > 0;
    return withBackofficeSession(
      database,
      request,
      reply,
      async (tx, context) => {
        const page = await listEntriesPage(
          tx,
          context.accountId,
          filters,
          query.limit,
          withAlert,
        );
        const counters = await readCounters(tx, context.accountId);
        return {
          asOf: counters?.asOf ?? new Date().toISOString(),
          items: page.items.map((entry) => rowOf(entry, context.accountId)),
          nextCursor:
            page.resumeAfter === null
              ? null
              : encodeEntryCursor(page.resumeAfter),
        };
      },
    );
  }

  app.get(
    "/v1/bo/queues/profiles-advertiser/entries",
    {
      schema: {
        querystring: entriesQuerySchema,
        response: { 200: entriesResponseSchema },
      },
    },
    (request, reply): Promise<EntriesResponse> =>
      entriesPage(request, reply, request.query as EntriesQuery),
  );

  // L2C 18c (EC-L2C-16-1): the same page, the period and the cursor in the body, which the relay
  // carries where it refuses them in a query. A POST that writes nothing: no claim, no register line.
  app.post(
    "/v1/bo/queues/profiles-advertiser/entries/search",
    {
      schema: {
        body: entriesSearchSchema,
        response: { 200: entriesResponseSchema },
      },
    },
    (request, reply): Promise<EntriesResponse> =>
      entriesPage(request, reply, request.body as EntriesSearch),
  );

  app.post(
    "/v1/bo/queues/profiles-advertiser/entries/:id/open",
    {
      schema: {
        params: entryParamsSchema,
        response: { 200: openEntryResponseSchema },
      },
    },
    async (request, reply): Promise<OpenEntryResponse> => {
      void reply.header("cache-control", "no-store");
      const entryId = (request.params as EntryParams).id.toLowerCase();
      try {
        return await openedEntry(request, reply, entryId);
      } catch (error) {
        // 42501 of the database: an unknown entry, or the caller's own account (C(3)): one answer
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
    },
  );

  function openedEntry(
    request: FastifyRequest,
    reply: FastifyReply,
    entryId: string,
  ): Promise<OpenEntryResponse> {
    return withBackofficeSession(
      database,
      request,
      reply,
      async (tx, context) => {
        const target = await entryAccountOf(tx, entryId);
        if (target === null) {
          throw new ApiError("not_found");
        }
        // 15 RG36, 13 RG35, 17b §2.5: the account is the caller's to hold, not to examine
        if (target.ownerAgentId === context.accountId) {
          throw new ApiError("forbidden", [
            { path: "entry", issue: "conflict_of_interest" },
          ]);
        }
        const opening = await openEntry(tx, entryId);
        // After the opening, never before: the view is no older than the version of the token
        const view = await readEntryView(tx, entryId);
        if (view === null) {
          throw new ApiError("not_found");
        }
        const logos = await readLogos(tx, target.accountId);
        const pending =
          view.entry.state === "open"
            ? await readPendingRevisions(tx, entryId)
            : [];
        const examined = examinedOf(
          {
            brandName: view.profile.brandName,
            presentation: view.profile.presentation,
            websiteDomain: view.profile.websiteDomain,
          },
          pending,
        );
        const duplicates = await readDuplicates(
          tx,
          target.accountId,
          examined.brandName,
          examined.websiteDomain,
        );
        const alerts: ReviewAlert[] = [...contactAlerts(examined)];
        for (const code of ["duplicate_brand", "duplicate_domain"] as const) {
          const matches = duplicates
            .filter(
              (match) =>
                match.matchedOn ===
                (code === "duplicate_brand" ? "brand_name" : "domain"),
            )
            .map(({ accountId, brandName }) => ({ accountId, brandName }));
          if (matches.length > 0) alerts.push({ code, matches });
        }
        alerts.push(...domainAlerts(examined));

        const locale: UiLocale = view.account.preferredLanguage;
        const reasons: ReviewReason[] = [];
        for (const reason of await readRejectionReasons(tx)) {
          const code = rejectionReasonOf(reason.code);
          if (code !== null) {
            reasons.push({
              code,
              position: reason.position,
              requiresMemberMessage: reason.requiresMemberMessage,
              ...rejectionReasonPreview(locale, code),
            });
          }
        }

        const { entry } = view;
        const held = entry.held && entry.holder !== null;
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
            claim: {
              holder: entry.holder,
              claimedAt: entry.claimedAt,
              claimExpiresAt: entry.claimExpiresAt,
              heldByCaller:
                held && entry.holder?.accountId === context.accountId,
            },
            lastForcedRelease:
              entry.forcedRelease === null
                ? null
                : {
                    ...entry.forcedRelease,
                    holderIsCaller:
                      entry.forcedRelease.holder?.accountId ===
                      context.accountId,
                  },
            decision: entry.decision as OpenEntryResponse["entry"]["decision"],
          },
          account: {
            id: target.accountId,
            countryCode: view.account
              .countryCode as OpenEntryResponse["account"]["countryCode"],
            preferredLanguage: locale,
            owner: view.account.owner,
          },
          profile: {
            ...view.profile,
            status: view.profile
              .status as OpenEntryResponse["profile"]["status"],
            logos: {
              active: logoOf(logos.find((logo) => logo.state === "active")),
              inReview: logoOf(
                logos.find((logo) => logo.state === "in_review"),
              ),
            },
          },
          revisions: pending.map((revision) => ({
            id: revision.id,
            fieldCode: revision.fieldCode,
            submittedAt: revision.submittedAt,
            validated: validatedOf(revision.fieldCode, view.profile, logos),
            proposed: revision.proposed,
          })),
          alerts,
          reasons,
        };
      },
    );
  }
}

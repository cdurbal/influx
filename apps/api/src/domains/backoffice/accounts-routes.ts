// Read routes of the backoffice v0 on member accounts (docs/mvp/05 §K RG97 to RG100, RG105, RG107;
// 15 RG34, RG40, RG49, RG50; 03 §3.1 "compte — lister et consulter" L · J; 21 §J8 commit 5).
// Backoffice surface; the aal2 guard of server.ts runs first, then each handler reads through
// withBackofficeSession() (agent and admin read the same thing).
// - GET /v1/bo/accounts: the list (RG97), a page capped by the server (15 RG34), its filters and
//   never a search term: a term in the query string is refused (J8S-7).
// - POST /v1/bo/accounts/search (J8S-7, EC-J8-58): the same page, its filters and at most one term
//   in the BODY, never in a URL (access logs, history, proxies): the exact search (free) and the
//   partial one (one reservation per page, journaled by its length, 429 beyond the limit: RG98).
//   The screen lists through it: the instants of a period are no plain query characters (EC-62).
// - GET /v1/bo/accounts/counters: the head banner of the day (RG105).
// - GET /v1/bo/accounts/:id: the record, its state per destination with the cause in clear (RG99,
//   RG100), the responsible salespersons (RG49), the contact person and the profile of a brand (15
//   RG41 blocks 2 and 3; L2C-18: its read is covered by the line of the opening), the "mes
//   données" requests that an admin executes from here under 2V + R (15 §G, J8 commit 8: their
//   state, never an export's content) and the history (EC-31), whose read is the journal of the
//   opening (RG40, EC-J8-24). Unknown, malformed-free but internal, or own: the same 404 (18
//   T14.3, T14.4).
// - Every answer is `Cache-Control: no-store`: it carries personal data.
import {
  ACCOUNT_HISTORY_PAGE_SIZE,
  accountCountersResponseSchema,
  accountDetailResponseSchema,
  accountParamsSchema,
  accountQuerySchema,
  accountsQuerySchema,
  accountsResponseSchema,
  accountsSearchSchema,
  COUNTERS_TOP_COUNTRIES,
  PARTIAL_SEARCH_WINDOW_SECONDS,
  accountDataRequestSchema,
  type AccountCountersResponse,
  type AccountDataRequest,
  type AccountDetailResponse,
  type AccountParams,
  type AccountQuery,
  type AccountRow,
  type AccountsQuery,
  type AccountsResponse,
  type AccountsSearch,
  type HistoryEvent,
} from "@influx/contracts/backoffice-accounts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase } from "../../db/index.ts";
import {
  ApiError,
  RequestValidationError,
  RetryLaterError,
} from "../../platform/errors.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  accountHistory,
  dataRequestsOf,
  dayCounters,
  reserveAccountSearch,
  type AccountDataRequestRow,
  type HistoryRow,
} from "./account-history/repository.ts";
import { brandRecordOf } from "./account-brand/repository.ts";
import {
  listMemberAccounts,
  memberAccountDetail,
  ownershipOf,
  type AccountFilters,
  type MemberAccountRow,
} from "./accounts/repository.ts";
import { syncStatusOf } from "./sync-causes.ts";

export type BackofficeAccountsDependencies = { database: ApiDatabase };

/** A request as the record shows it; the schema checks the database's values again. */
function dataRequestOf(row: AccountDataRequestRow): AccountDataRequest {
  return accountDataRequestSchema.parse({
    id: row.id,
    type: row.requestType,
    receivedAt: row.receivedAt,
    dueAt: row.dueAt,
    status: row.status,
    completedAt: row.completedAt,
    outcome: row.outcomeCode,
    execution:
      row.approvedAt === null || row.authorisedBy === null
        ? null
        : {
            authorisedBy: row.authorisedBy,
            approvedAt: row.approvedAt,
            approvedBy: row.approvedBy,
            executedAt: row.executedAt,
            authUserDeletedAt: row.authUserDeletedAt,
          },
    export:
      row.exportPublishedAt === null || row.exportExpiresAt === null
        ? null
        : {
            publishedAt: row.exportPublishedAt,
            expiresAt: row.exportExpiresAt,
            downloads: row.exportDownloads ?? 0,
            purgedAt: row.exportPurgedAt,
          },
  });
}

const CURSOR_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

/** The opaque cursor of the list: the last line's instant (microseconds) and id. */
export function encodeCursor(row: { cursorAt: string; id: string }): string {
  return Buffer.from(`${row.cursorAt}|${row.id}`, "utf8").toString("base64url");
}

export function decodeCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  const match = CURSOR_PATTERN.exec(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  if (match === null || match[1] === undefined || match[2] === undefined) {
    return null;
  }
  return { createdAt: match[1], id: match[2] };
}

function rowOf(row: MemberAccountRow): AccountRow {
  return {
    id: row.id,
    createdAt: row.createdAt,
    role: row.role,
    status: row.status,
    countryCode: row.countryCode as AccountRow["countryCode"],
    preferredLanguage: row.preferredLanguage as AccountRow["preferredLanguage"],
    declaredStatus: row.declaredStatus,
    source: {
      viaInvitation: row.viaInvitation,
      utmSource: row.utmSource,
      utmMedium: row.utmMedium,
      utmCampaign: row.utmCampaign,
      referrerDomain: row.referrerDomain,
      heardFrom: row.heardFrom as AccountRow["source"]["heardFrom"],
    },
    consent:
      row.consent === null
        ? null
        : {
            granted: row.consent.granted,
            occurredAt: row.consent.occurredAt,
            source: row.consent.source as NonNullable<
              AccountRow["consent"]
            >["source"],
          },
    sync: {
      brevo: syncStatusOf(row.brevo, row.role),
      apollo: syncStatusOf(row.apollo, row.role),
    },
    owner: row.owner,
    lastSeenAt: row.lastSeenAt,
  };
}

/** The payload of a register line as key / value pairs (no free-form object in a response). */
function historyEventOf(row: HistoryRow): HistoryEvent {
  return {
    seq: row.seq,
    occurredAt: row.occurredAt,
    eventType: row.eventType,
    actorType: row.actorType,
    actorAccountId: row.actorAccountId,
    details: Object.keys(row.payload)
      .sort()
      .map((key) => {
        const value = row.payload[key];
        return {
          key,
          value:
            value === null || value === undefined
              ? null
              : typeof value === "string"
                ? value
                : JSON.stringify(value),
        };
      }),
  };
}

function filtersOf(query: AccountsQuery | AccountsSearch): AccountFilters {
  const filters: AccountFilters = {};
  if (query.role !== undefined) filters.role = query.role;
  if (query.country !== undefined) filters.country = query.country;
  if (query.language !== undefined) filters.language = query.language;
  if (query.declaredStatus !== undefined) {
    filters.declaredStatus = query.declaredStatus;
  }
  if (query.syncDestination !== undefined) {
    filters.syncDestination = query.syncDestination;
  }
  if (query.syncState !== undefined) filters.syncState = query.syncState;
  if (query.consent !== undefined) filters.consent = query.consent;
  if (query.from !== undefined) filters.from = query.from;
  if (query.to !== undefined) filters.to = query.to;
  if ("email" in query && query.email !== undefined) {
    filters.email = query.email;
  }
  if ("q" in query && query.q !== undefined) filters.fragment = query.q;
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

/** One page of the list, searched or not (RG97, RG98); the same answer for both routes. */
async function accountsPage(
  database: ApiDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  query: AccountsQuery | AccountsSearch,
): Promise<AccountsResponse> {
  void reply.header("cache-control", "no-store");
  const filters = filtersOf(query);
  const fragment = filters.fragment;
  const page = await withBackofficeSession(
    database,
    request,
    reply,
    async (tx) => {
      // RG98: every page of a partial search is one search; the line commits either way
      if (
        fragment !== undefined &&
        !(await reserveAccountSearch(tx, fragment.length))
      ) {
        return null;
      }
      return listMemberAccounts(tx, filters, query.limit + 1);
    },
  );
  if (page === null) {
    throw new RetryLaterError("rate_limited", PARTIAL_SEARCH_WINDOW_SECONDS);
  }
  const items = page.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items: items.map(rowOf),
    nextCursor:
      page.length > query.limit && last !== undefined
        ? encodeCursor(last)
        : null,
    search:
      filters.email !== undefined
        ? "exact"
        : fragment !== undefined
          ? "partial"
          : "none",
  };
}

export function registerBackofficeAccountRoutes(
  app: IdentityApp,
  dependencies: BackofficeAccountsDependencies,
): void {
  const { database } = dependencies;

  app.get(
    "/v1/bo/accounts",
    {
      schema: {
        querystring: accountsQuerySchema,
        response: { 200: accountsResponseSchema },
      },
    },
    (request, reply): Promise<AccountsResponse> =>
      accountsPage(database, request, reply, request.query as AccountsQuery),
  );

  app.post(
    "/v1/bo/accounts/search",
    {
      schema: {
        body: accountsSearchSchema,
        response: { 200: accountsResponseSchema },
      },
    },
    (request, reply): Promise<AccountsResponse> =>
      accountsPage(database, request, reply, request.body as AccountsSearch),
  );

  app.get(
    "/v1/bo/accounts/counters",
    { schema: { response: { 200: accountCountersResponseSchema } } },
    async (request, reply): Promise<AccountCountersResponse> => {
      void reply.header("cache-control", "no-store");
      const counters = await withBackofficeSession(
        database,
        request,
        reply,
        async (tx) => dayCounters(tx),
      );
      const top = counters.countries.slice(0, COUNTERS_TOP_COUNTRIES);
      return {
        day: counters.day,
        signups: {
          total: counters.total,
          advertiser: counters.advertiser,
          creator: counters.creator,
        },
        topCountries: top.map((country) => ({
          countryCode:
            country.countryCode as AccountCountersResponse["topCountries"][number]["countryCode"],
          count: country.count,
        })),
        otherCountries: counters.countries
          .slice(COUNTERS_TOP_COUNTRIES)
          .reduce((sum, country) => sum + country.count, 0),
        brevoWithinHour: {
          synced: counters.brevoSynced,
          eligible: counters.brevoEligible,
        },
        apolloWithin24Hours: {
          synced: counters.apolloSynced,
          eligible: counters.apolloEligible,
        },
        unhandledFailures: {
          brevo: counters.brevoFailures,
          apollo: counters.apolloFailures,
        },
      };
    },
  );

  app.get(
    "/v1/bo/accounts/:id",
    {
      schema: {
        params: accountParamsSchema,
        querystring: accountQuerySchema,
        response: { 200: accountDetailResponseSchema },
      },
    },
    async (request, reply): Promise<AccountDetailResponse> => {
      void reply.header("cache-control", "no-store");
      const accountId = (request.params as AccountParams).id.toLowerCase();
      const { historyBefore } = request.query as AccountQuery;
      return withBackofficeSession(database, request, reply, async (tx) => {
        const account = await memberAccountDetail(tx, accountId);
        if (account === null) {
          throw new ApiError("not_found");
        }
        const ownership = await ownershipOf(tx, accountId);
        // blocks 2 and 3 of a brand (L2C-18, L2BS-7): read before the history, whose line is the
        // journal of this opening, contact person included, once (RG40)
        const brand =
          account.role === "advertiser"
            ? await brandRecordOf(tx, accountId)
            : null;
        const dataRequests = (await dataRequestsOf(tx, accountId)).map(
          dataRequestOf,
        );
        // last: the register lock is held until COMMIT (04 §7.2)
        const history = await accountHistory(
          tx,
          accountId,
          ACCOUNT_HISTORY_PAGE_SIZE + 1,
          historyBefore ?? null,
        );
        const events = history.slice(0, ACCOUNT_HISTORY_PAGE_SIZE);
        const last = events.at(-1);
        return {
          account: {
            ...rowOf(account),
            email: account.email,
            emailStatus: account.emailStatus,
            companyName: account.companyName,
            suspendedAt: account.suspendedAt,
            deletedAt: account.deletedAt,
          },
          ownership,
          brand,
          dataRequests,
          history: {
            events: events.map(historyEventOf),
            nextBefore:
              history.length > ACCOUNT_HISTORY_PAGE_SIZE && last !== undefined
                ? last.seq
                : null,
          },
        };
      });
    },
  );
}

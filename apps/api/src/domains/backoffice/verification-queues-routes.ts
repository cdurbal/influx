// Routes of queue 4, "vérifications", of the backoffice (docs/mvp/08 RG43, RG53, RG55, RG61 to RG67,
// RG84; 15 RG26 to RG28, RG33, RG34, RG36, C1 to C8; 17b §3; jalons/l2e/modele.md §6; l2e-fiche
// invariants 2, 5, 9 to 11, 15, 17; 18 T14, T9.7). Backoffice surface; the aal2 guard of server.ts
// runs first, then each handler reads through withBackofficeSession() (agent and admin alike). One
// table, two views, never a mixed screen (RG61): every route below exists once per view, under
// `verification-creators` and `verification-brands`.
// - GET  …/<view>/entries (and POST …/entries/search: the same page, the period and the cursor in
//   the body): the list, in the order of RG62 (the oldest submission first by default), its filters,
//   a page capped by the server (RG34); the deadline passed is marked, the entry stays decidable.
//   No handle, no figure, no coordinate: the alias of a creator or the trading name of a brand.
// - POST …/<view>/entries/:id/open: opening is claiming (RG64). The holder of the claim gets the
//   dossier of RG55 and the review token OF THE SNAPSHOT the dossier was read in; a colleague gets
//   « en cours — {name} », read-only, and no dossier; a closed entry answers its decision.
// - The counters of both views join GET /v1/bo/queues/counters (verificationCounters()).
// Decisions and the piece: verification-queues-decision-routes.ts.
// - An unknown request, a draft, one of the other view, and the one of the caller's own account answer
//   exactly alike (404, T14.3, T14.4); an entry of an account the caller HOLDS answers 403 with the
//   issue `conflict_of_interest` (RG53), the attempt journaled first (backoffice.action_refused,
//   `queue.conflict_of_interest`, 0215), and is absent from the list and the counters.
// - Every answer is `Cache-Control: no-store`: it carries internal data. Nothing is logged here.
import type { QueueCounters } from "@influx/contracts/backoffice-queues";
import {
  IDENTITY_CHANGE_QUEUE,
  VERIFICATION_BRANDS_QUEUE,
  VERIFICATION_CREATORS_QUEUE,
  VERIFICATION_DISPUTES_QUEUE,
} from "@influx/contracts/backoffice-queues";
import {
  verificationEntriesQuerySchema,
  verificationEntriesResponseSchema,
  verificationEntriesSearchSchema,
  verificationEntryParamsSchema,
  verificationOpenResponseSchema,
  type VerificationDossier,
  type VerificationEntriesQuery,
  type VerificationEntriesResponse,
  type VerificationEntriesSearch,
  type VerificationEntryParams,
  type VerificationOpenResponse,
  type VerificationOpening,
  type VerificationQueueEntryRow,
  type VerificationQueueSort,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  verificationReasonPreview,
  type VerificationEmailLevel,
} from "../verification/verification-email.ts";
import { isForbidden, unlessConflict } from "./action-guards.ts";
import { registerVerificationQueueDecisionRoutes } from "./verification-queues-decision-routes.ts";
import { registerVerificationDisputeRoutes } from "./verification-disputes-routes.ts";
import { registerVerificationIdentifierChangeRoutes } from "./verification-identifier-changes-routes.ts";
import {
  readClaimedCounters,
  type ClaimedQueueKind,
} from "./verification-queues/claimed/repository.ts";
import type { CountersRow } from "./verification-queues/repository.ts";
import {
  inSavepoint,
  targetOf,
  unlessHeld,
  VIEW_SEGMENT,
  VIEWS,
  type VerificationQueuesDependencies,
} from "./verification-queues/guards.ts";
import {
  listEntries,
  openRequest,
  readCounters,
  readDossier,
  readEntryView,
  readReasons,
  readRegistrySources,
  type DossierRow,
  type EntryFilters,
  type ListedEntry,
  type RequestTarget,
} from "./verification-queues/repository.ts";

const COUNTER_CODE = {
  creators: VERIFICATION_CREATORS_QUEUE,
  brands: VERIFICATION_BRANDS_QUEUE,
} as const;

const INSTANT_MICRO = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z";
const CURSOR_PATTERN = new RegExp(
  `^(age|sla|level|network)\\|(${INSTANT_MICRO}|[a-z0-9_]{0,63})\\|(${INSTANT_MICRO})\\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

/** The opaque cursor: the sort, its key on the last line, its submission to the microsecond, its id. */
export function encodeEntryCursor(
  sort: VerificationQueueSort,
  cursor: ListedEntry["cursor"],
): string {
  return Buffer.from(
    `${sort}|${cursor.primary}|${cursor.submittedAt}|${cursor.id}`,
    "utf8",
  ).toString("base64url");
}

export function decodeEntryCursor(
  cursor: string,
  sort: VerificationQueueSort,
): { primary: string; submittedAt: string; id: string } | null {
  const match = CURSOR_PATTERN.exec(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  if (
    match === null ||
    match[1] !== sort ||
    match[2] === undefined ||
    match[3] === undefined ||
    match[4] === undefined
  ) {
    return null;
  }
  return { primary: match[2], submittedAt: match[3], id: match[4] };
}

function filtersOf(
  query: VerificationEntriesQuery | VerificationEntriesSearch,
): EntryFilters {
  const filters: EntryFilters = {};
  if (query.level !== undefined) filters.level = query.level;
  if (query.network !== undefined) filters.network = query.network;
  if (query.overdue !== undefined) filters.overdue = true;
  if (query.holder !== undefined) filters.holder = query.holder.toLowerCase();
  if (query.owner !== undefined) filters.owner = query.owner.toLowerCase();
  if (query.from !== undefined) filters.from = query.from;
  if (query.to !== undefined) filters.to = query.to;
  if (query.alert !== undefined) filters.alert = true;
  if (query.reexamine !== undefined) filters.reexamine = true;
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

function alertCodesOf(entry: ListedEntry): VerificationQueueEntryRow["alerts"] {
  const codes: VerificationQueueEntryRow["alerts"] = [];
  if (entry.priorRejections) codes.push("prior_rejections");
  if (entry.sameHandleElsewhere) codes.push("same_handle_elsewhere");
  if (entry.handleVerifiedElsewhere) codes.push("handle_verified_elsewhere");
  return codes;
}

function rowOf(entry: ListedEntry, caller: string): VerificationQueueEntryRow {
  return {
    id: entry.id,
    accountId: entry.accountId,
    level: entry.level as VerificationQueueEntryRow["level"],
    networkCode: entry.networkCode,
    displayName: entry.displayName,
    countryCode: entry.countryCode as VerificationQueueEntryRow["countryCode"],
    submittedAt: entry.submittedAt,
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
    reexamine:
      entry.reexamine === null
        ? null
        : {
            reasonCode: entry.reexamine.reasonCode as NonNullable<
              VerificationQueueEntryRow["reexamine"]
            >["reasonCode"],
            reexaminedAt: entry.reexamine.reexaminedAt,
          },
    alerts: alertCodesOf(entry),
    openedBy: entry.openedBy as VerificationQueueEntryRow["openedBy"],
  };
}

/** A timestamp a jsonb carries (`2026-11-07T18:29:58.1+00:00`) as the instant of the contract. */
function instantOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

type Json = Record<string, unknown>;

function objectsOf(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Json => typeof item === "object" && item !== null,
      )
    : [];
}

function textOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : null;
}

/** The dossier of RG55 from what the door returned: the figures declared are not among its columns. */
async function dossierOf(
  tx: Transaction,
  population: "creator" | "brand",
  row: DossierRow,
): Promise<VerificationDossier> {
  const alerts: VerificationDossier["alerts"] = [];
  if (row.recentRejections > 0) {
    alerts.push({ code: "prior_rejections", count: row.recentRejections });
  }
  if (row.sameHandleAccounts > 0) {
    alerts.push({
      code: "same_handle_elsewhere",
      accounts: row.sameHandleAccounts,
    });
  }
  if (row.handleVerifiedElsewhere) {
    alerts.push({ code: "handle_verified_elsewhere" });
  }
  const internalDetails =
    row.legalName !== null &&
    row.registrationCountryCode !== null &&
    row.registrationNumber !== null
      ? {
          legalName: row.legalName,
          registrationCountryCode: row.registrationCountryCode as Country,
          registrationNumber: row.registrationNumber,
        }
      : null;
  return {
    codeExpiresAt: row.codeExpiresAt,
    creator:
      population === "creator"
        ? {
            handle: row.handle,
            pseudonym: row.pseudonym,
            profileUrl: row.profileUrl,
          }
        : null,
    brand:
      population === "brand"
        ? {
            tradeName: row.tradeName,
            websiteDomain: row.websiteDomain,
            internalDetails,
            registrySources:
              row.registrationCountryCode === null
                ? []
                : (
                    await readRegistrySources(tx, row.registrationCountryCode)
                  ).map((source) => ({
                    id: source.id,
                    sourceType: source.sourceType as SourceType,
                    countryCode: source.countryCode as Country | null,
                    name: source.name,
                    url: source.url,
                    checkedOn: source.checkedOn,
                  })),
          }
        : null,
    evidence: objectsOf(row.evidence).map((piece) => ({
      id: String(piece.id),
      byteSize: numberOf(piece.byte_size),
      width: numberOf(piece.width),
      height: numberOf(piece.height),
      activatedAt: instantOf(piece.activated_at),
    })),
    history: objectsOf(row.history).map((past) => ({
      id: String(past.id),
      level: String(
        past.level,
      ) as VerificationDossier["history"][number]["level"],
      status: String(
        past.status,
      ) as VerificationDossier["history"][number]["status"],
      submittedAt: instantOf(past.submitted_at),
      decidedAt: instantOf(past.decided_at),
      reasonCode: textOf(
        past.rejection_reason_code,
      ) as VerificationDossier["history"][number]["reasonCode"],
    })),
    badges: objectsOf(row.badges).map((badge) => ({
      id: String(badge.id),
      level: String(
        badge.level,
      ) as VerificationDossier["badges"][number]["level"],
      state: String(
        badge.state,
      ) as VerificationDossier["badges"][number]["state"],
      grantedAt: instantOf(badge.granted_at) ?? "",
      expiresAt: instantOf(badge.expires_at),
    })),
    alerts,
    opening: {
      openedBy: row.openedBy as VerificationOpening["openedBy"],
      reasonCode: row.openingReasonCode as VerificationOpening["reasonCode"],
      comment: row.openingComment,
      // a creator's request has no login-address proof (null): nothing to offer
      loginAddressEligible: row.loginAddressEligible === true,
    },
  };
}

type Country = VerificationOpenResponse["account"]["countryCode"];
type SourceType = NonNullable<
  VerificationDossier["brand"]
>["registrySources"][number]["sourceType"];

function countersOf(
  queue: QueueCounters["queue"],
  counters: CountersRow,
): QueueCounters {
  return {
    queue,
    pending: counters.pending,
    oldestCreatedAt: counters.oldestSubmittedAt,
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

const CLAIMED_COUNTER_CODE: Readonly<
  Record<ClaimedQueueKind, QueueCounters["queue"]>
> = {
  disputes: VERIFICATION_DISPUTES_QUEUE,
  identifier_changes: IDENTITY_CHANGE_QUEUE,
};

/**
 * The counters of the two views of queue 4 and of queues 5 and 6 (L2F-14), as the caller sees them, for
 * GET /v1/bo/queues/counters.
 */
export async function verificationCounters(
  tx: Transaction,
  caller: string,
): Promise<{ asOf: string | null; queues: QueueCounters[] }> {
  const queues: QueueCounters[] = [];
  let asOf: string | null = null;
  for (const view of VIEWS) {
    const counters = await readCounters(tx, caller, view);
    if (counters === null) continue;
    asOf = counters.asOf;
    queues.push(countersOf(COUNTER_CODE[view], counters));
  }
  for (const kind of ["disputes", "identifier_changes"] as const) {
    const counters = await readClaimedCounters(tx, caller, kind);
    if (counters === null) continue;
    asOf ??= counters.asOf;
    queues.push(countersOf(CLAIMED_COUNTER_CODE[kind], counters));
  }
  return { asOf, queues };
}

export function registerVerificationQueueRoutes(
  app: IdentityApp,
  dependencies: VerificationQueuesDependencies,
): void {
  const { database } = dependencies;
  registerVerificationQueueDecisionRoutes(app, dependencies);
  registerVerificationDisputeRoutes(app, dependencies);
  registerVerificationIdentifierChangeRoutes(app, dependencies);

  for (const view of VIEWS) {
    const entries = `/v1/bo/queues/${VIEW_SEGMENT[view]}/entries`;

    /** One page of the list, whether the filters came in the query string or in the body. */
    const entriesPage = (
      request: FastifyRequest,
      reply: FastifyReply,
      query: VerificationEntriesQuery | VerificationEntriesSearch,
    ): Promise<VerificationEntriesResponse> => {
      void reply.header("cache-control", "no-store");
      const filters = filtersOf(query);
      return withBackofficeSession(
        database,
        request,
        reply,
        async (tx, context) => {
          const rows = await listEntries(
            tx,
            context.accountId,
            view,
            query.sort,
            filters,
            query.limit + 1,
          );
          const items = rows.slice(0, query.limit);
          const last = items.at(-1);
          const counters = await readCounters(tx, context.accountId, view);
          return {
            asOf: counters?.asOf ?? new Date().toISOString(),
            items: items.map((entry) => rowOf(entry, context.accountId)),
            nextCursor:
              rows.length > query.limit && last !== undefined
                ? encodeEntryCursor(query.sort, last.cursor)
                : null,
          };
        },
      );
    };

    app.get(
      entries,
      {
        schema: {
          querystring: verificationEntriesQuerySchema,
          response: { 200: verificationEntriesResponseSchema },
        },
      },
      (request, reply): Promise<VerificationEntriesResponse> =>
        entriesPage(request, reply, request.query as VerificationEntriesQuery),
    );

    // A POST that writes nothing: no claim, no register line (as the search of queue 1).
    app.post(
      `${entries}/search`,
      {
        schema: {
          body: verificationEntriesSearchSchema,
          response: { 200: verificationEntriesResponseSchema },
        },
      },
      (request, reply): Promise<VerificationEntriesResponse> =>
        entriesPage(request, reply, request.body as VerificationEntriesSearch),
    );

    app.post(
      `${entries}/:id/open`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          response: { 200: verificationOpenResponseSchema },
        },
      },
      async (request, reply): Promise<VerificationOpenResponse> => {
        void reply.header("cache-control", "no-store");
        const requestId = (
          request.params as VerificationEntryParams
        ).id.toLowerCase();
        try {
          return unlessConflict(
            await withBackofficeSession(
              database,
              request,
              reply,
              async (tx, context) => {
                const target = await targetOf(tx, requestId, view);
                // 0224: an OPEN request of an account the caller holds is refused; a closed one
                // answers `closed` as to anybody
                if (target.status === "pending") {
                  const held = await unlessHeld(tx, context, target);
                  if (held !== null) return held;
                }
                return inSavepoint(
                  tx,
                  requestId,
                  context.accountId,
                  async (savepoint) =>
                    openedEntry(savepoint, context, requestId, target),
                );
              },
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
  }
}

/** The opening and, for the holder of the claim, the dossier in the snapshot of its own token. */
async function openedEntry(
  tx: Transaction,
  context: BackofficeContext,
  requestId: string,
  target: RequestTarget,
): Promise<VerificationOpenResponse> {
  const opening = await openRequest(tx, requestId);
  // After the opening, never before: the view is no older than the claim it shows
  const view = await readEntryView(tx, requestId);
  if (view === null) {
    throw new ApiError("not_found");
  }
  let dossier: VerificationDossier | null = null;
  let reviewToken: string | null = null;
  if (opening.outcome === "claimed" || opening.outcome === "held") {
    // The token of the dossier is the one of ITS snapshot: a decision is taken on the version shown
    const row = await readDossier(tx, requestId);
    dossier = await dossierOf(tx, target.population, row);
    reviewToken = row.reviewToken;
  }
  const { entry } = view;
  const held = entry.held && entry.holder !== null;
  const reasons = await readReasons(tx, target.population);
  return {
    asOf: view.asOf,
    outcome: opening.outcome,
    reviewToken,
    entry: {
      id: entry.id,
      level: entry.level as VerificationOpenResponse["entry"]["level"],
      networkCode: entry.networkCode,
      status: entry.status as VerificationOpenResponse["entry"]["status"],
      submittedAt: entry.submittedAt,
      slaDueAt: entry.slaDueAt,
      escalateAt: entry.escalateAt,
      overdue: entry.overdue,
      claim: {
        holder: entry.holder,
        claimedAt: entry.claimedAt,
        claimExpiresAt: entry.claimExpiresAt,
        heldByCaller: held && entry.holder?.accountId === context.accountId,
      },
      lastForcedRelease:
        entry.forcedRelease === null
          ? null
          : {
              ...entry.forcedRelease,
              holderIsCaller:
                entry.forcedRelease.holder?.accountId === context.accountId,
            },
      reexamine:
        entry.reexamine as VerificationOpenResponse["entry"]["reexamine"],
      decision: entry.decision as VerificationOpenResponse["entry"]["decision"],
    },
    account: {
      id: target.accountId,
      countryCode: view.account
        .countryCode as VerificationOpenResponse["account"]["countryCode"],
      preferredLanguage: view.account.preferredLanguage,
      owner: view.account.owner,
    },
    dossier,
    reasons: reasons.flatMap((reason) => {
      // what the member will read for this reason (08 RG57), from the files of the e-mail itself
      const preview = verificationReasonPreview(
        view.account.preferredLanguage,
        view.entry.level as VerificationEmailLevel,
        reason.code,
      );
      return preview === null
        ? []
        : [
            {
              ...reason,
              ...preview,
              code: reason.code as VerificationOpenResponse["reasons"][number]["code"],
            },
          ];
    }),
  };
}

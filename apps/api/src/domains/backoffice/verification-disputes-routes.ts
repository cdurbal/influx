// Routes of queue 5, "contestations", of the backoffice (docs/mvp/08 RG77, CA52, CA53; 15 RG26 to RG28, RG33,
// RG34, RG36, C1 to C8, RG29; 03 §3; jalons/l2f/modele.md §1 points 7 to 10, §3 "0232", §5; l2f-fiche
// invariants 6, 8, 12, 13, 17; 18 T14; l2f commit 14). Backoffice surface; the aal2 guard of server.ts runs
// first, then each handler reads and writes through withBackofficeSession() (agent and admin alike).
//   GET  /v1/bo/queues/verification-disputes/entries   (and POST …/entries/search: the same page, the
//        period and the cursor in the body): the open contests, in the order of 08 RG62, its filters, a page
//        capped by the server (RG34); the deadline passed is marked, the entry stays decidable. No handle, no
//        text of the creator: his alias.
//   POST …/entries/:id/open      opening is claiming (C1, C2). The holder of the claim gets the dossier (the
//        text of the creator, his line, the decision contested with its reason, the pieces as metadata, the
//        persons who took that decision) and the review token OF THE SNAPSHOT the dossier was read in; a
//        colleague gets « en cours — {name} », read-only, and no dossier; a decider of the decision
//        contested opens it read-only while another person exists (modele point 10); a closed entry
//        answers its decision.
//   POST …/entries/:id/{release, extend, force-release}   claimed-routes.ts
//   POST …/entries/:id/uphold    the decision stands, with a motive of the upheld ones (and the team's text
//        for `other`, RG19: no direct contact)
//   POST …/entries/:id/overturn  the decision is reversed, by what was contested (`refusal_account`,
//        `refusal_audience`, `revocation`): the handle typed again (0228), a new date of decision (CA53)
//   GET  …/entries/:id/evidence/:evidenceId   a piece of the refused request, relayed from Storage
// The rules are the database's (0232): each door locks the contest, checks the live claim, the person
// (another than the decider as soon as the team counts one, otherwise after the reflection delay, `review_mode`
// `independent` or `delayed`), the review token and the typed values, and writes the decision, the register,
// the badge and the outbox in ONE transaction. This file maps their refusals to codes (refusals.ts).
// - The review token of a decision is the one of the dossier the agent read; a stale one refuses it.
// - An unknown contest and the one of the caller's own account answer exactly alike (404, T14.3, T14.4); an
//   entry of an account the caller HOLDS answers 403 `conflict_of_interest` after the trace of the attempt
//   (backoffice.action_refused, `queue.conflict_of_interest`, 0215) is committed, and is absent from the
//   list and the counters (15 RG36).
// - The piece: the database hands the key of an ACTIVE piece to the holder of the live claim and writes
//   `verification.evidence_viewed` (with the contest) in the same transaction; this process then reads the
//   object with its own relay of Storage and answers JSON (type, sides, base64 bounded). The key is never
//   written to a response nor a log; Storage that does not answer: 503 `decision_blocked`.
// - Every answer is `Cache-Control: no-store`: it carries internal data. Nothing is logged here.
import {
  disputeEntriesQuerySchema,
  disputeEntriesResponseSchema,
  disputeEntriesSearchSchema,
  decideDisputeResponseSchema,
  disputeOpenResponseSchema,
  overturnDisputeRequestSchema,
  upholdDisputeRequestSchema,
  verificationEntryEvidenceParamsSchema,
  verificationEntryParamsSchema,
  verificationEvidenceReadResponseSchema,
  type DecideDisputeResponse,
  type DisputeDossier,
  type DisputeEntriesQuery,
  type DisputeEntriesResponse,
  type DisputeEntriesSearch,
  type DisputeEntryRow,
  type DisputeOpenResponse,
  type OverturnDisputeRequest,
  type UpholdDisputeRequest,
  type VerificationEntryEvidenceParams,
  type VerificationEntryParams,
  type VerificationEvidenceReadResponse,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import type { BackofficeContext } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import type { ApiDatabase } from "../../db/index.ts";
import {
  disputeOutcomePreview,
  revocationReasonOf,
  type ContestedReason,
} from "../verification/badge-notice-email.ts";
import { EVIDENCE_BUCKET } from "../verification/evidence.ts";
import {
  verificationNetworkOf,
  verificationReasonOf,
  type VerificationEmailLevel,
} from "../verification/verification-email.ts";
import { CONFLICT_OF_INTEREST, unlessConflict } from "./action-guards.ts";
import { memberMessageSignals } from "./queues/entry-alerts.ts";
import {
  closedAtOf,
  openClaimedEntry,
  readClaimView,
  type ClaimView,
} from "./verification-queues/claimed/repository.ts";
import { registerClaimedQueueRoutes } from "./verification-queues/claimed-routes.ts";
import {
  decodeEntryCursor,
  encodeEntryCursor,
} from "./verification-queues-routes.ts";
import {
  DISPUTE_EXTRA,
  listDisputes,
  overturnRefusalAccount,
  overturnRefusalAudience,
  overturnRevocation,
  readDeciders,
  readDisputeDossier,
  readDisputeEvidenceDescription,
  readDisputeEvidenceKey,
  readOutcomeReasons,
  upholdDispute,
  type DecidedDispute,
  type DisputeDossierRow,
  type DisputeFilters,
  type ListedDispute,
} from "./verification-disputes/repository.ts";
import { readClaimedCounters } from "./verification-queues/claimed/repository.ts";

export type VerificationDisputesDependencies = {
  database: ApiDatabase;
  /** Storage, for the pieces of the refused request. */
  store: ObjectStore;
};

type Json = Record<string, unknown>;

function filtersOf(
  query: DisputeEntriesQuery | DisputeEntriesSearch,
): DisputeFilters {
  const filters: DisputeFilters = {};
  if (query.level !== undefined) filters.level = query.level;
  if (query.network !== undefined) filters.network = query.network;
  if (query.kind !== undefined) filters.kind = query.kind;
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

function rowOf(entry: ListedDispute, caller: string): DisputeEntryRow {
  return {
    id: entry.id,
    accountId: entry.accountId,
    kind: entry.kind,
    level: entry.level as DisputeEntryRow["level"],
    networkCode: entry.networkCode,
    displayName: entry.displayName,
    countryCode: entry.countryCode as DisputeEntryRow["countryCode"],
    reasonCode: entry.reasonCode as DisputeEntryRow["reasonCode"],
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
  };
}

/** A timestamp a jsonb carries (`2026-11-07T18:29:58.1+00:00`) as the instant of the contract. */
function instantOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function numberOf(value: unknown): number | null {
  return typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : null;
}

function objectsOf(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Json => typeof item === "object" && item !== null,
      )
    : [];
}

/** The dossier of RG77 from what the door returned: never a declared figure, never a key. */
async function dossierOf(
  tx: Transaction,
  row: DisputeDossierRow,
): Promise<DisputeDossier> {
  const deciders = await readDeciders(tx, row.originalDeciderIds);
  return {
    kind: row.kind,
    reasonCode: row.reasonCode as DisputeDossier["reasonCode"],
    text: row.text,
    submittedAt: row.submittedAt,
    reviewMode: row.reviewMode,
    reflectionUntil: row.reflectionUntil,
    deciders,
    creator: {
      handle: row.handle,
      pseudonym: row.pseudonym,
      profileUrl: row.profileUrl,
    },
    refusal:
      row.requestId === null ||
      row.refusalReasonCode === null ||
      row.refusalDecidedAt === null
        ? null
        : {
            requestId: row.requestId,
            reasonCode: row.refusalReasonCode as NonNullable<
              DisputeDossier["refusal"]
            >["reasonCode"],
            memberMessage: row.refusalMemberMessage,
            decidedAt: row.refusalDecidedAt,
            codeExpiresAt: row.codeExpiresAt,
          },
    revocation:
      row.badgeId === null ||
      row.badgeGrantedAt === null ||
      row.revokedAt === null ||
      row.revocationReasonCode === null
        ? null
        : {
            badgeId: row.badgeId,
            grantedAt: row.badgeGrantedAt,
            expiresAt: row.badgeExpiresAt,
            revokedAt: row.revokedAt,
            reasonCode: row.revocationReasonCode as NonNullable<
              DisputeDossier["revocation"]
            >["reasonCode"],
            memberMessage: row.revocationMemberMessage,
            cascadeBadgeIds: row.cascadeBadgeIds,
          },
    evidence: objectsOf(row.evidence).map((piece) => ({
      id: String(piece.id),
      byteSize: numberOf(piece.byte_size),
      width: numberOf(piece.width),
      height: numberOf(piece.height),
      activatedAt: instantOf(piece.activated_at),
    })),
  };
}

/** The reason the decision contested stood on, as the e-mail names it (the sentence of `decision_confirmed`). */
function contestedOf(
  row: DisputeDossierRow,
  level: VerificationEmailLevel,
): ContestedReason | null {
  if (row.kind === "refusal") {
    const code = row.refusalReasonCode;
    const reason = code === null ? null : verificationReasonOf(level, code);
    return reason === null || reason.population !== "creator"
      ? null
      : { decision: "refusal", code: reason.code };
  }
  const code =
    row.revocationReasonCode === null
      ? null
      : revocationReasonOf(row.revocationReasonCode);
  return code === null ? null : { decision: "revocation", code };
}

/** The outcomes with the sentence the member will receive for each, in his language (what the agent sees is what is sent). */
async function outcomeReasonsOf(
  tx: Transaction,
  view: ClaimView,
  level: VerificationEmailLevel,
  dossierRow: DisputeDossierRow,
): Promise<DisputeOpenResponse["outcomeReasons"]> {
  const locale = view.account.preferredLanguage;
  const networkName = verificationNetworkOf(locale, view.networkCode);
  const contested = contestedOf(dossierRow, level);
  const restoredAt = new Date(Date.parse(view.asOf));
  return (await readOutcomeReasons(tx)).flatMap((reason) => {
    const message = disputeOutcomePreview({
      locale,
      level,
      networkName: networkName ?? view.networkCode,
      outcomeCode: reason.code,
      contested,
      restoredAt,
    });
    return message === null
      ? []
      : [
          {
            code: reason.code as DisputeOpenResponse["outcomeReasons"][number]["code"],
            outcome: reason.outcome,
            position: reason.position,
            requiresMemberMessage: reason.requiresMemberMessage,
            message,
          },
        ];
  });
}

/** The decision of a closed (or withdrawn) contest (C8): the internal comment is for agents only. */
function decisionOf(
  view: ClaimView,
  specific: Json,
): DisputeOpenResponse["entry"]["decision"] {
  const decidedAt = closedAtOf(view);
  if (view.state === "open" || decidedAt === null) {
    return null;
  }
  return {
    decidedAt,
    decidedBy: view.decidedBy,
    late: view.late,
    state: view.state as "upheld" | "overturned" | "withdrawn",
    outcomeReasonCode: (specific.outcome_reason_code ?? null) as NonNullable<
      DisputeOpenResponse["entry"]["decision"]
    >["outcomeReasonCode"],
    reviewMode: (specific.review_mode ?? null) as NonNullable<
      DisputeOpenResponse["entry"]["decision"]
    >["reviewMode"],
    withdrawnCause: view.withdrawnCause as NonNullable<
      DisputeOpenResponse["entry"]["decision"]
    >["withdrawnCause"],
    memberMessage:
      typeof specific.member_message === "string"
        ? specific.member_message
        : null,
    internalComment: view.internalComment,
  };
}

export function registerVerificationDisputeRoutes(
  app: IdentityApp,
  dependencies: VerificationDisputesDependencies,
): void {
  const { database, store } = dependencies;
  const queue = registerClaimedQueueRoutes(
    app,
    database,
    "disputes",
    "verification-disputes",
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

  /** One page of the list, whether the filters came in the query string or in the body. */
  const entriesPage = (
    request: FastifyRequest,
    reply: FastifyReply,
    query: DisputeEntriesQuery | DisputeEntriesSearch,
  ): Promise<DisputeEntriesResponse> => {
    const filters = filtersOf(query);
    return inSession(request, reply, async (tx, context) => {
      const rows = await listDisputes(
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
        "disputes",
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
        querystring: disputeEntriesQuerySchema,
        response: { 200: disputeEntriesResponseSchema },
      },
    },
    (request, reply): Promise<DisputeEntriesResponse> =>
      entriesPage(request, reply, request.query as DisputeEntriesQuery),
  );

  // A POST that writes nothing: no claim, no register line (as the search of queues 1 and 4).
  app.post(
    `${entries}/search`,
    {
      schema: {
        body: disputeEntriesSearchSchema,
        response: { 200: disputeEntriesResponseSchema },
      },
    },
    (request, reply): Promise<DisputeEntriesResponse> =>
      entriesPage(request, reply, request.body as DisputeEntriesSearch),
  );

  /** The opening and, for the holder of the claim, the dossier in the snapshot of its own token. */
  async function openedEntry(
    tx: Transaction,
    context: BackofficeContext,
    disputeId: string,
  ): Promise<DisputeOpenResponse> {
    const opening = await openClaimedEntry(tx, "disputes", disputeId);
    // After the opening, never before: the view is no older than the claim it shows
    const read = await readClaimView(tx, "disputes", disputeId, DISPUTE_EXTRA);
    if (read === null) {
      throw new ApiError("not_found");
    }
    const { view, specific } = read;
    const level = String(specific.level) as VerificationEmailLevel;
    let dossier: DisputeDossier | null = null;
    let reviewToken: string | null = null;
    let outcomeReasons: DisputeOpenResponse["outcomeReasons"] = [];
    if (opening.outcome === "claimed" || opening.outcome === "held") {
      // The token of the dossier is the one of ITS snapshot: a decision is taken on the version shown
      const row = await readDisputeDossier(tx, disputeId);
      dossier = await dossierOf(tx, row);
      reviewToken = row.reviewToken;
      outcomeReasons = await outcomeReasonsOf(tx, view, level, row);
    }
    const held = view.held && view.holder !== null;
    return {
      asOf: view.asOf,
      outcome: opening.outcome,
      reviewToken,
      entry: {
        id: view.id,
        kind: specific.is_refusal === true ? "refusal" : "revocation",
        level: level as DisputeOpenResponse["entry"]["level"],
        networkCode: view.networkCode,
        state: view.state as DisputeOpenResponse["entry"]["state"],
        submittedAt: view.datedAt,
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
        decision: decisionOf(view, {
          outcome_reason_code: specific.outcome_reason_code,
          review_mode: specific.review_mode,
          member_message: specific.member_message,
        }),
      },
      account: {
        id: view.accountId,
        countryCode: view.account
          .countryCode as DisputeOpenResponse["account"]["countryCode"],
        preferredLanguage: view.account.preferredLanguage,
        owner: view.account.owner,
      },
      dossier,
      outcomeReasons,
    };
  }

  app.post(
    `${entries}/:id/open`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        response: { 200: disputeOpenResponseSchema },
      },
    },
    async (request, reply): Promise<DisputeOpenResponse> => {
      const disputeId = idOf(request);
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const target = await targetOf(tx, disputeId);
          // 0232: an OPEN contest of an account the caller holds is refused; a closed one answers
          // `closed` as to anybody
          if (target.state === "open") {
            const held = await unlessHeld(tx, context, target);
            if (held !== null) return held;
          }
          return inSavepoint(tx, disputeId, context.accountId, (savepoint) =>
            openedEntry(savepoint, context, disputeId),
          );
        }),
      );
    },
  );

  /** The answer of a decision: what the door wrote, and the entry to open next. */
  async function decisionAnswer(
    tx: Transaction,
    context: BackofficeContext,
    decidedDispute: DecidedDispute,
  ): Promise<DecideDisputeResponse> {
    return {
      outcome: decidedDispute.outcome,
      badgeId: decidedDispute.badgeId,
      decidedAt: decidedDispute.decidedAt,
      late: decidedDispute.late,
      reviewMode: decidedDispute.reviewMode,
      next: await queue.next(tx, context),
    };
  }

  app.post(
    `${entries}/:id/uphold`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        body: upholdDisputeRequestSchema,
        response: { 200: decideDisputeResponseSchema },
      },
    },
    async (request, reply): Promise<DecideDisputeResponse> => {
      const disputeId = idOf(request);
      const body = request.body as UpholdDisputeRequest;
      // RG19: the message goes to the creator in an e-mail without any link; a direct contact is refused
      if (
        body.memberMessage !== undefined &&
        memberMessageSignals(body.memberMessage).length > 0
      ) {
        throw new RequestValidationError([
          { path: "memberMessage", issue: "direct_contact" },
        ]);
      }
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const upheld = await decided(tx, context, disputeId, (savepoint) =>
            upholdDispute(savepoint, disputeId, body.reviewToken, {
              outcomeReasonCode: body.outcomeReasonCode,
              memberMessage: body.memberMessage ?? null,
              internalComment: body.internalComment ?? null,
            }),
          );
          return upheld === CONFLICT_OF_INTEREST
            ? upheld
            : decisionAnswer(tx, context, upheld);
        }),
      );
    },
  );

  app.post(
    `${entries}/:id/overturn`,
    {
      schema: {
        params: verificationEntryParamsSchema,
        body: overturnDisputeRequestSchema,
        response: { 200: decideDisputeResponseSchema },
      },
    },
    async (request, reply): Promise<DecideDisputeResponse> => {
      const disputeId = idOf(request);
      const body = request.body as OverturnDisputeRequest;
      return unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const overturned = await decided(
            tx,
            context,
            disputeId,
            (savepoint): Promise<DecidedDispute> => {
              switch (body.target) {
                case "refusal_account":
                  return overturnRefusalAccount(
                    savepoint,
                    disputeId,
                    body.reviewToken,
                    {
                      observedCode: body.observedCode,
                      observedHandle: body.observedHandle,
                      observedPlatformAccountRef:
                        body.observedPlatformAccountRef ?? null,
                      internalComment: body.internalComment ?? null,
                    },
                  );
                case "refusal_audience":
                  return overturnRefusalAudience(
                    savepoint,
                    disputeId,
                    body.reviewToken,
                    {
                      followers: body.followers,
                      postsLast30Days: body.postsLast30Days,
                      avgComments: body.avgComments,
                      engagementBp: body.engagementBp,
                      periodStart: body.periodStart,
                      periodEnd: body.periodEnd,
                      observedHandle: body.observedHandle,
                      internalComment: body.internalComment ?? null,
                    },
                  );
                case "revocation":
                  return overturnRevocation(
                    savepoint,
                    disputeId,
                    body.reviewToken,
                    {
                      observedHandle: body.observedHandle,
                      internalComment: body.internalComment ?? null,
                    },
                  );
              }
            },
          );
          return overturned === CONFLICT_OF_INTEREST
            ? overturned
            : decisionAnswer(tx, context, overturned);
        }),
      );
    },
  );

  /**
   * The piece: the contest in its queue, the piece named by the request the contest contests (another
   * request's piece is an unknown one), then the door that hands the key to the holder of the live claim
   * and writes its register line in this transaction. 42501: one answer.
   */
  async function openedPiece(
    request: FastifyRequest,
    reply: FastifyReply,
    disputeId: string,
    evidenceId: string,
  ): Promise<{ key: string; width: number; height: number }> {
    return unlessConflict(
      await inSession(request, reply, async (tx, context) => {
        const target = await targetOf(tx, disputeId);
        const held = await unlessHeld(tx, context, target);
        if (held !== null) return held;
        const description = await readDisputeEvidenceDescription(
          tx,
          disputeId,
          evidenceId,
        );
        if (description === null) {
          throw new ApiError("not_found");
        }
        const key = await inSavepoint(
          tx,
          disputeId,
          context.accountId,
          (savepoint) =>
            readDisputeEvidenceKey(savepoint, disputeId, evidenceId),
        );
        return { key, width: description.width, height: description.height };
      }),
    );
  }

  app.get(
    `${entries}/:id/evidence/:evidenceId`,
    {
      schema: {
        params: verificationEntryEvidenceParamsSchema,
        response: { 200: verificationEvidenceReadResponseSchema },
      },
    },
    async (request, reply): Promise<VerificationEvidenceReadResponse> => {
      void reply.header("cache-control", "no-store");
      void reply.header("x-content-type-options", "nosniff");
      const params = request.params as VerificationEntryEvidenceParams;
      const disputeId = (params as VerificationEntryParams).id.toLowerCase();
      const evidenceId = params.evidenceId.toLowerCase();
      // (a) the door of the database, its register line in the same transaction
      const read = await openedPiece(request, reply, disputeId, evidenceId);

      // (b) the object, by the key of the database: never named by the client (T9.3)
      const stored = await store.read(EVIDENCE_BUCKET, read.key);
      if (!stored.ok) {
        request.log.error(
          {
            reason: stored.reason,
            status: stored.status,
            errorCode: stored.errorCode,
          },
          "verification.queue.evidence_read_failed",
        );
        throw new ApiError("service_unavailable", [
          { path: "evidence", issue: "decision_blocked" },
        ]);
      }
      if (stored.value === null) {
        // a row without its object: a person looks (D60 error line), the screen says it is unreadable
        request.log.error({}, "verification.queue.evidence_object_missing");
        throw new ApiError("not_found");
      }
      return {
        contentType: "image/webp",
        width: read.width,
        height: read.height,
        byteSize: stored.value.length,
        data: Buffer.from(
          stored.value.buffer,
          stored.value.byteOffset,
          stored.value.byteLength,
        ).toString("base64"),
      };
    },
  );
}

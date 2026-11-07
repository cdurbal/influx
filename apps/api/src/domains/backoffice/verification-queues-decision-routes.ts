// Decision routes of queue 4, "vérifications", and the relay of a piece (docs/mvp/08 RG25, RG36 to
// RG38bis, RG41, RG42, RG47 to RG54, RG56, RG57, RG59, RG64, RG65, RG67, RG84; 06 RG51, RG52; 15 RG27 C3,
// C4, C6, C8, RG36; jalons/l2e/modele.md §4, §6; D82 (5); l2e-fiche invariants 2, 5, 6, 9 to 11, 17;
// 18 T14, T9.7; l2e commit 14). Backoffice surface; the aal2 guard of server.ts runs first, then each
// handler reads and writes through withBackofficeSession() (agent and admin alike). Every route exists
// under the view it belongs to (`verification-creators`, `verification-brands`).
//   both views   POST …/entries/:id/{release, extend, force-release, reexamine, reject}
//   creators     POST …/entries/:id/{compare, grant-account, grant-audience},
//                GET  …/entries/:id/evidence/:evidenceId
//   brands       POST …/entries/:id/grant
// The rules are the database's (0224): each door locks the request, checks the live claim, the review
// token and the typed values, and writes the decision, the register, the badge and the outbox in ONE
// transaction. This file maps their refusals to codes (refusals.ts), and never a trace (invariant 17).
// - The review token of a decision is the one of the dossier the agent read; a stale one refuses it.
// - Invariant 6, RG47: nothing is pre-filled. `compare` takes the figures the agent TYPED and only then
//   returns the declared ones with the threshold and the verdict of the gap (modele -19): the gap is
//   computed here, at the read, never stored, never published, never a refusal (RG42).
// - A decision, an extension, a comparison and a piece on a request of an account the caller HOLDS answer
//   403 `conflict_of_interest` after the trace of the attempt (backoffice.action_refused,
//   `queue.conflict_of_interest`) is committed, as the opening does; giving a claim back stays open to
//   him (he gets rid of it, never decides), as the forced release of an administrator.
// - A decision answers with the entry to open next (17b §2.6), never opened for the caller here.
// - The piece: the database hands the key of an ACTIVE piece to the holder of the live claim and writes
//   `verification.evidence_viewed` in the same transaction; this process then reads the object with its
//   own relay of Storage and answers JSON (type, sides, base64 bounded). The key is never written to a
//   response nor a log; Storage that does not answer blocks the decision: 503 `decision_blocked`.
// - Every answer is `Cache-Control: no-store`.
import {
  extendEntryResponseSchema,
  forceReleaseRequestSchema,
  forceReleaseResponseSchema,
  releaseEntryResponseSchema,
  type ExtendEntryResponse,
  type ForceReleaseRequest,
  type ForceReleaseResponse,
  type ReleaseEntryResponse,
} from "@influx/contracts/backoffice-queues";
import {
  compareFiguresRequestSchema,
  compareFiguresResponseSchema,
  grantAccountRequestSchema,
  grantAudienceRequestSchema,
  grantBrandRequestSchema,
  grantVerificationResponseSchema,
  reexamineVerificationRequestSchema,
  reexamineVerificationResponseSchema,
  rejectVerificationRequestSchema,
  rejectVerificationResponseSchema,
  verificationEntryEvidenceParamsSchema,
  verificationEntryParamsSchema,
  verificationEvidenceReadResponseSchema,
  type CompareFiguresRequest,
  type CompareFiguresResponse,
  type GrantAccountRequest,
  type GrantAudienceRequest,
  type GrantBrandRequest,
  type GrantVerificationResponse,
  type ReexamineVerificationRequest,
  type ReexamineVerificationResponse,
  type RejectVerificationRequest,
  type RejectVerificationResponse,
  type VerificationEntryEvidenceParams,
  type VerificationEntryParams,
  type VerificationEvidenceReadResponse,
  type VerificationQueueView,
} from "@influx/contracts/verification";
import { figureGap } from "@influx/domain/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Transaction } from "../../db/index.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { EVIDENCE_BUCKET } from "../verification/evidence.ts";
import {
  adminOnly,
  CONFLICT_OF_INTEREST,
  isForbidden,
  unlessConflict,
  unlessRefused,
} from "./action-guards.ts";
import { memberMessageSignals } from "./queues/entry-alerts.ts";
import {
  inSavepoint,
  targetOf,
  unlessHeld,
  VIEW_SEGMENT,
  VIEWS,
  type VerificationQueuesDependencies,
} from "./verification-queues/guards.ts";
import {
  compareFigures,
  displayNameOf,
  extendClaim,
  forceRelease,
  grantAccountVerified,
  grantAudienceVerified,
  grantBrandVerified,
  nextRequestId,
  readEvidenceDescription,
  readEvidenceKey,
  reexamineRequest,
  rejectRequest,
  releaseRequest,
  type GrantedRow,
} from "./verification-queues/repository.ts";

function idOf(request: FastifyRequest): string {
  return (request.params as VerificationEntryParams).id.toLowerCase();
}

export function registerVerificationQueueDecisionRoutes(
  app: IdentityApp,
  dependencies: VerificationQueuesDependencies,
): void {
  const { database, store } = dependencies;

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  /** An act no holder of the account may take (RG53): the request exists in the view, is not his to treat. */
  async function decided<T>(
    tx: Transaction,
    context: BackofficeContext,
    view: VerificationQueueView,
    requestId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T | typeof CONFLICT_OF_INTEREST> {
    const target = await targetOf(tx, requestId, view);
    const held = await unlessHeld(tx, context, target);
    if (held !== null) return held;
    return inSavepoint(tx, requestId, context.accountId, act);
  }

  /** As `decided`, for an act that stays open to the holder of the account: giving the claim back. */
  async function treated<T>(
    tx: Transaction,
    context: BackofficeContext,
    view: VerificationQueueView,
    requestId: string,
    act: (savepoint: Transaction) => Promise<T>,
  ): Promise<T> {
    await targetOf(tx, requestId, view);
    return inSavepoint(tx, requestId, context.accountId, act);
  }

  /** 17b §2.6: the entry to open after a decision, or null. */
  async function next(
    tx: Transaction,
    context: BackofficeContext,
    view: VerificationQueueView,
  ): Promise<{ entryId: string } | null> {
    const entryId = await nextRequestId(tx, context.accountId, view);
    return entryId === null ? null : { entryId };
  }

  /** The answer of a grant: the outcome and the entry to open next. */
  async function grantAnswer(
    tx: Transaction,
    context: BackofficeContext,
    view: VerificationQueueView,
    granted: GrantedRow,
  ): Promise<GrantVerificationResponse> {
    return {
      outcome: granted.outcome,
      badgeId: granted.badgeId,
      decidedAt: granted.decidedAt,
      late: granted.late,
      next: await next(tx, context, view),
    };
  }

  for (const view of VIEWS) {
    const entries = `/v1/bo/queues/${VIEW_SEGMENT[view]}/entries`;

    app.post(
      `${entries}/:id/reject`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          body: rejectVerificationRequestSchema,
          response: { 200: rejectVerificationResponseSchema },
        },
      },
      async (request, reply): Promise<RejectVerificationResponse> => {
        const requestId = idOf(request);
        const body = request.body as RejectVerificationRequest;
        // RG19: the message goes to the member in an e-mail without any link; a direct contact is refused
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
            const rejected = await decided(
              tx,
              context,
              view,
              requestId,
              (savepoint) =>
                rejectRequest(
                  savepoint,
                  requestId,
                  body.reviewToken,
                  body.reasonCode,
                  body.memberMessage ?? null,
                  body.internalComment ?? null,
                ),
            );
            return rejected === CONFLICT_OF_INTEREST
              ? rejected
              : { ...rejected, next: await next(tx, context, view) };
          }),
        );
      },
    );

    app.post(
      `${entries}/:id/reexamine`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          body: reexamineVerificationRequestSchema,
          response: { 200: reexamineVerificationResponseSchema },
        },
      },
      async (request, reply): Promise<ReexamineVerificationResponse> => {
        const requestId = idOf(request);
        const body = request.body as ReexamineVerificationRequest;
        return unlessConflict(
          await inSession(request, reply, async (tx, context) => {
            const reexaminedAt = await decided(
              tx,
              context,
              view,
              requestId,
              (savepoint) =>
                reexamineRequest(
                  savepoint,
                  requestId,
                  body.reviewToken,
                  body.reasonCode,
                ),
            );
            return reexaminedAt === CONFLICT_OF_INTEREST
              ? reexaminedAt
              : { reexaminedAt, next: await next(tx, context, view) };
          }),
        );
      },
    );

    app.post(
      `${entries}/:id/release`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          response: { 200: releaseEntryResponseSchema },
        },
      },
      async (request, reply): Promise<ReleaseEntryResponse> => {
        const requestId = idOf(request);
        return inSession(request, reply, async (tx, context) => {
          await treated(tx, context, view, requestId, (savepoint) =>
            releaseRequest(savepoint, requestId),
          );
          return { released: true };
        });
      },
    );

    app.post(
      `${entries}/:id/extend`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          response: { 200: extendEntryResponseSchema },
        },
      },
      async (request, reply): Promise<ExtendEntryResponse> => {
        const requestId = idOf(request);
        const claimExpiresAt = unlessConflict(
          await inSession(request, reply, (tx, context) =>
            decided(tx, context, view, requestId, (savepoint) =>
              extendClaim(savepoint, requestId),
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
          params: verificationEntryParamsSchema,
          body: forceReleaseRequestSchema,
          response: { 200: forceReleaseResponseSchema },
        },
      },
      async (request, reply): Promise<ForceReleaseResponse> => {
        const requestId = idOf(request);
        const body = request.body as ForceReleaseRequest;
        // CA63: an agent's attempt is refused and journaled in a transaction that commits; the 403
        // is answered after. The masking of the button on the screen is never the control.
        return unlessRefused(
          await inSession(request, reply, (tx, context) =>
            adminOnly(
              tx,
              context,
              "queue.force_release_claim",
              async (): Promise<ForceReleaseResponse> => {
                const holder = await treated(
                  tx,
                  context,
                  view,
                  requestId,
                  (savepoint) =>
                    forceRelease(savepoint, requestId, body.reasonCode),
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

  registerCreatorRoutes();
  registerBrandRoute();

  // -------------------------------------------------------------------------------------------
  // Creators: the typing, the two grants, the piece
  // -------------------------------------------------------------------------------------------

  /**
   * (a) of the piece: the target in its view, the piece named by the request of the path (another
   * request's piece is an unknown one), then the door that hands the key to the holder of the live claim
   * and writes its register line in this transaction. 42501: one answer.
   */
  async function openedPiece(
    request: FastifyRequest,
    reply: FastifyReply,
    requestId: string,
    evidenceId: string,
  ): Promise<{ key: string; width: number; height: number }> {
    try {
      const found = unlessConflict(
        await inSession(request, reply, async (tx, context) => {
          const target = await targetOf(tx, requestId, "creators");
          const held = await unlessHeld(tx, context, target);
          if (held !== null) return held;
          const description = await readEvidenceDescription(
            tx,
            requestId,
            evidenceId,
          );
          if (description === null) {
            throw new ApiError("not_found");
          }
          const key = await inSavepoint(
            tx,
            requestId,
            context.accountId,
            (savepoint) => readEvidenceKey(savepoint, evidenceId),
          );
          return { key, width: description.width, height: description.height };
        }),
      );
      return found;
    } catch (error) {
      if (isForbidden(error)) {
        throw new ApiError("not_found");
      }
      throw error;
    }
  }

  function registerCreatorRoutes(): void {
    const entries = `/v1/bo/queues/${VIEW_SEGMENT.creators}/entries`;

    app.post(
      `${entries}/:id/compare`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          body: compareFiguresRequestSchema,
          response: { 200: compareFiguresResponseSchema },
        },
      },
      async (request, reply): Promise<CompareFiguresResponse> => {
        const requestId = idOf(request);
        const { reviewToken, ...typed } = request.body as CompareFiguresRequest;
        const compared = unlessConflict(
          await inSession(request, reply, (tx, context) =>
            decided(tx, context, "creators", requestId, (savepoint) =>
              compareFigures(savepoint, requestId, reviewToken, typed),
            ),
          ),
        );
        const gaps = [
          figureGap({
            declared: compared.followers,
            observed: typed.followers,
            thresholdPercent: compared.gapAlertPercent,
          }),
          figureGap({
            declared: compared.postsLast30Days,
            observed: typed.postsLast30Days,
            thresholdPercent: compared.gapAlertPercent,
          }),
          figureGap({
            declared: compared.avgComments,
            observed: typed.avgComments,
            thresholdPercent: compared.gapAlertPercent,
          }),
          typed.engagementBp === null
            ? null
            : figureGap({
                declared: compared.engagementBp,
                observed: typed.engagementBp,
                thresholdPercent: compared.gapAlertPercent,
              }),
        ];
        return {
          declared: {
            followers: compared.followers,
            postsLast30Days: compared.postsLast30Days,
            avgComments: compared.avgComments,
            engagementBp: compared.engagementBp,
          },
          gapAlertPercent: compared.gapAlertPercent,
          alert: gaps.some((gap) => gap !== null && gap.alert),
        };
      },
    );

    app.post(
      `${entries}/:id/grant-account`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          body: grantAccountRequestSchema,
          response: { 200: grantVerificationResponseSchema },
        },
      },
      async (request, reply): Promise<GrantVerificationResponse> => {
        const requestId = idOf(request);
        const body = request.body as GrantAccountRequest;
        return unlessConflict(
          await inSession(request, reply, async (tx, context) => {
            const granted = await decided(
              tx,
              context,
              "creators",
              requestId,
              (savepoint) =>
                grantAccountVerified(savepoint, requestId, body.reviewToken, {
                  observedCode: body.observedCode,
                  observedHandle: body.observedHandle,
                  observedPlatformAccountRef:
                    body.observedPlatformAccountRef ?? null,
                  internalComment: body.internalComment ?? null,
                }),
            );
            return granted === CONFLICT_OF_INTEREST
              ? granted
              : grantAnswer(tx, context, "creators", granted);
          }),
        );
      },
    );

    app.post(
      `${entries}/:id/grant-audience`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          body: grantAudienceRequestSchema,
          response: { 200: grantVerificationResponseSchema },
        },
      },
      async (request, reply): Promise<GrantVerificationResponse> => {
        const requestId = idOf(request);
        const body = request.body as GrantAudienceRequest;
        return unlessConflict(
          await inSession(request, reply, async (tx, context) => {
            const granted = await decided(
              tx,
              context,
              "creators",
              requestId,
              (savepoint) =>
                grantAudienceVerified(savepoint, requestId, body.reviewToken, {
                  followers: body.followers,
                  postsLast30Days: body.postsLast30Days,
                  avgComments: body.avgComments,
                  engagementBp: body.engagementBp,
                  periodStart: body.periodStart,
                  periodEnd: body.periodEnd,
                  observedHandle: body.observedHandle,
                  internalComment: body.internalComment ?? null,
                }),
            );
            return granted === CONFLICT_OF_INTEREST
              ? granted
              : grantAnswer(tx, context, "creators", granted);
          }),
        );
      },
    );

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
        const requestId = params.id.toLowerCase();
        const evidenceId = params.evidenceId.toLowerCase();
        // (a) the door of the database, its register line in the same transaction
        const read = await openedPiece(request, reply, requestId, evidenceId);

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
          // D82 (5): the audience decision waits for Storage; « à réexaminer » is the agent's way out
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

  // -------------------------------------------------------------------------------------------
  // Brands: the grant
  // -------------------------------------------------------------------------------------------

  function registerBrandRoute(): void {
    app.post(
      `/v1/bo/queues/${VIEW_SEGMENT.brands}/entries/:id/grant`,
      {
        schema: {
          params: verificationEntryParamsSchema,
          body: grantBrandRequestSchema,
          response: { 200: grantVerificationResponseSchema },
        },
      },
      async (request, reply): Promise<GrantVerificationResponse> => {
        const requestId = idOf(request);
        const body = request.body as GrantBrandRequest;
        return unlessConflict(
          await inSession(request, reply, async (tx, context) => {
            const granted = await decided(
              tx,
              context,
              "brands",
              requestId,
              (savepoint) =>
                grantBrandVerified(savepoint, requestId, body.reviewToken, {
                  observedCode: body.observedCode,
                  observedDomain: body.observedDomain,
                  observedChannel: body.observedChannel,
                  registrySourceId: body.registrySourceId,
                  internalComment: body.internalComment ?? null,
                }),
            );
            return granted === CONFLICT_OF_INTEREST
              ? granted
              : grantAnswer(tx, context, "brands", granted);
          }),
        );
      },
    );
  }
}

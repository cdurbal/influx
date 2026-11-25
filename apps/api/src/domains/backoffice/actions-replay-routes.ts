// Lead sync actions of the backoffice v0 (docs/mvp/05 §K RG81, RG93, RG103; 15 §F, RG110; 03 §1.3
// PD1 to PD7; 17b §3.11). Backoffice surface; the aal2 guard of server.ts runs first. The rules are
// the database's (0132, 0134): these handlers choose the transaction, read the refusal and say it.
// - POST /v1/bo/leads/replays: unit or batch replay of failed contact lines, selected by (account,
//   destination), never by an internal line id; 200 pairs and 200 lines at most, the surplus
//   refused and reported (CA59); one winner per line (CA61); a pair without consent is refused,
//   never replayed (RG103, CA60, EC-J8-4); no nominative lock (15 RG30). Agent and admin.
// - POST /v1/bo/accounts/:id/brevo-suppression/lift (RG93, B-5): admin only, an agent's attempt
//   refused AND journaled (CA63, backoffice.action_refused).
// Unknown, internal and own targets answer the same 404 (18 T14.3, T14.4). `Cache-Control:
// no-store` everywhere.
import {
  accountActionParamsSchema,
  REPLAY_BATCH_CAP,
  replayRequestSchema,
  replayResponseSchema,
  suppressionLiftRequestSchema,
  suppressionLiftResponseSchema,
  type AccountActionParams,
  type ReplayOutcome,
  type ReplayRequest,
  type ReplayResponse,
  type SuppressionLiftRequest,
  type SuppressionLiftResponse,
} from "@influx/contracts/backoffice-actions";
import type { Transaction } from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import { ApiError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  withSensitiveAction,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import {
  liftBrevoSuppression,
  replayCandidates,
  replayOutboxLines,
  type ContactDestination,
  type ReplayCandidate,
} from "./sync-replay/repository.ts";
import {
  adminOnly,
  unlessRefused,
  type BackofficeActionsDependencies,
} from "./action-guards.ts";

const CONTACT_DESTINATION: Readonly<
  Record<"brevo" | "apollo", ContactDestination>
> = { brevo: "brevo_contact", apollo: "apollo_contact" };

/** The outcome of a pair submitted to the database, from the outcomes of its lines (0132). */
function submittedOutcome(
  lines: readonly { outcome: string; detail: string | null }[],
): { outcome: ReplayOutcome; requeued: number } {
  const requeued = lines.filter((line) => line.outcome === "requeued").length;
  if (requeued > 0) {
    return { outcome: "requeued", requeued };
  }
  if (lines.some((line) => line.detail === "already_queued")) {
    return { outcome: "already_in_progress", requeued: 0 };
  }
  if (lines.some((line) => line.detail === "already_succeeded")) {
    return { outcome: "already_synced", requeued: 0 };
  }
  if (lines.some((line) => line.detail === "no_consent")) {
    return { outcome: "no_consent", requeued: 0 };
  }
  if (lines.some((line) => line.detail === "normal_case")) {
    return { outcome: "normal_case", requeued: 0 };
  }
  return { outcome: "nothing_to_replay", requeued: 0 };
}

/** The outcome of a pair without a failed line, from its state (RG100, RG103, CA61). */
function idleOutcome(candidate: ReplayCandidate | undefined): ReplayOutcome {
  if (candidate === undefined) {
    return "nothing_to_replay";
  }
  if (candidate.live) {
    return "already_in_progress";
  }
  if (candidate.lastStatus === "succeeded") {
    return "already_synced";
  }
  if (candidate.lastStatus === "skipped") {
    return candidate.lastCode === "no_consent" ? "no_consent" : "normal_case";
  }
  return "nothing_to_replay";
}

const IGNORED: ReadonlySet<ReplayOutcome> = new Set([
  "already_in_progress",
  "already_synced",
]);

async function replay(
  tx: Transaction,
  body: ReplayRequest,
): Promise<ReplayResponse> {
  // the same pair twice is one pair
  const seen = new Set<string>();
  const pairs = body.items
    .map((item) => ({
      accountId: item.accountId.toLowerCase(),
      destination: item.destination,
    }))
    .filter((pair) => {
      const key = `${pair.accountId}|${pair.destination}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  const within = pairs.slice(0, REPLAY_BATCH_CAP);
  const candidates = new Map(
    (
      await replayCandidates(
        tx,
        within.map((pair) => ({
          accountId: pair.accountId,
          destination: CONTACT_DESTINATION[pair.destination],
        })),
      )
    ).map((candidate) => [
      `${candidate.accountId}|${candidate.destination}`,
      candidate,
    ]),
  );

  // CA59: 200 lines at most per operation; the pairs beyond are refused, and said
  const submitted = new Map<string, number[]>();
  let lineCount = 0;
  const overCap = new Set<string>();
  for (const pair of pairs.slice(REPLAY_BATCH_CAP)) {
    overCap.add(`${pair.accountId}|${pair.destination}`);
  }
  for (const pair of within) {
    const key = `${pair.accountId}|${pair.destination}`;
    const candidate = candidates.get(
      `${pair.accountId}|${CONTACT_DESTINATION[pair.destination]}`,
    );
    const ids = candidate?.failedIds ?? [];
    if (ids.length === 0) {
      continue;
    }
    if (lineCount + ids.length > REPLAY_BATCH_CAP) {
      overCap.add(key);
      continue;
    }
    lineCount += ids.length;
    submitted.set(key, ids);
  }

  const allIds = [...submitted.values()].flat();
  const lines =
    allIds.length === 0
      ? []
      : await replayOutboxLines(tx, allIds, body.reasonCode);
  const byId = new Map(lines.map((line) => [line.outboxId, line]));

  const items = pairs.map((pair) => {
    const key = `${pair.accountId}|${pair.destination}`;
    if (overCap.has(key)) {
      return { ...pair, outcome: "over_cap" as const, lines: 0 };
    }
    const ids = submitted.get(key);
    if (ids === undefined) {
      const candidate = candidates.get(
        `${pair.accountId}|${CONTACT_DESTINATION[pair.destination]}`,
      );
      return { ...pair, outcome: idleOutcome(candidate), lines: 0 };
    }
    const { outcome, requeued } = submittedOutcome(
      ids.flatMap((id) => {
        const line = byId.get(id);
        return line === undefined ? [] : [line];
      }),
    );
    return { ...pair, outcome, lines: requeued };
  });

  const requeued = items.filter((item) => item.outcome === "requeued").length;
  const ignored = items.filter((item) => IGNORED.has(item.outcome)).length;
  return {
    replayId: lines[0]?.replayId ?? null,
    requested: pairs.length,
    requeued,
    ignored,
    refused: pairs.length - requeued - ignored,
    items,
  };
}

export function registerReplayRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

  app.post(
    "/v1/bo/leads/replays",
    {
      schema: {
        body: replayRequestSchema,
        response: { 200: replayResponseSchema },
      },
    },
    async (request, reply): Promise<ReplayResponse> => {
      void reply.header("cache-control", "no-store");
      const body = request.body as ReplayRequest;
      return withBackofficeSession(database, request, reply, (tx) =>
        replay(tx, body),
      );
    },
  );

  app.post(
    "/v1/bo/accounts/:id/brevo-suppression/lift",
    {
      schema: {
        params: accountActionParamsSchema,
        body: suppressionLiftRequestSchema,
        response: { 200: suppressionLiftResponseSchema },
      },
    },
    async (request, reply): Promise<SuppressionLiftResponse> => {
      void reply.header("cache-control", "no-store");
      const accountId = (
        request.params as AccountActionParams
      ).id.toLowerCase();
      const body = request.body as SuppressionLiftRequest;
      try {
        const resyncQueued = unlessRefused(
          await withSensitiveAction(database, request, reply, (tx, context) =>
            adminOnly(tx, context, "leads.lift_brevo_suppression", () =>
              liftBrevoSuppression(tx, context.sessionId, accountId, {
                reasonCode: body.reasonCode,
                comment: body.comment ?? null,
              }),
            ),
          ),
        );
        return { resyncQueued };
      } catch (error) {
        if (sqlStateOf(error) === "55000") {
          // RG93: nothing recorded to lift
          throw new ApiError("conflict");
        }
        throw error;
      }
    },
  );
}

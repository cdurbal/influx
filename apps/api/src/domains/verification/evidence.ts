// The pieces of a creator's audience request: deposit and removal (docs/mvp/08 RG34, RG35, RG85, CA21,
// CA22, CA67; 18 T9.2 to T9.5, T9.8, T9.9, T14; D82 (1) to (4), (6); jalons/l2e/modele.md §4, §6;
// commit 13). The model of the brand logo (stockage.md §3), the row written BEFORE the object:
//   (a) a creator of the session, terms accepted; anything else the answer of a route that does not
//       exist (T14);
//   (b) one transaction: a slot of re-encoding taken (503 when both are, shared with the logo), the
//       quotas consumed and the row pending (verification.begin_evidence_upload(), 0223): six pieces
//       per request (409 evidence_cap), 18 deposits and 64 MiB per UTC day (429
//       upload_quota_exceeded, Retry-After until the next UTC midnight); a request of another, an
//       unknown one: 404; not a draft: 409 request_not_draft; an account request: 400 invalid_level;
//   (c) the bytes checked and re-encoded in memory (platform/images.ts reencodeEvidence(): the same
//       pixels, no metadata); refused = row deleted, 422 image_rejected with its typed reason;
//   (d) the WebP written to Storage under the key the base generated; failed = row purging, 503
//       "deposit again" (08 edge case 5, CA67: the other pieces and the request are untouched);
//   (e) one transaction: the row active, a piece of the same request with the same SHA-256 to purging
//       (modele §4); a request that left draft meanwhile: the deposit failed (row purging, object
//       removed), 409 request_not_draft; a row taken by the purge (over 15 minutes): 503;
//   (f) the replaced object removed at once, at best (the hourly task storage_purge otherwise).
// DELETE: the active piece of a draft to purging, its object removed at once at best; a piece of
// another request is an unknown one. The answer never carries the key, the checksum nor the bytes
// (EC-L2E-7: the creator never reads them back). One log line per gesture: outcome, sizes, duration;
// never a name, an account, a key nor a byte (D60).
import {
  verificationEvidenceResponseSchema,
  type VerificationEvidenceResponse,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import { createHash } from "node:crypto";
import type { Transaction } from "../../db/index.ts";
import { sqlDetailOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RetryLaterError } from "../../platform/errors.ts";
import { reencodeEvidence, type ImageSlots } from "../../platform/images.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import {
  IMAGE_BUSY_RETRY_AFTER_SECONDS,
  secondsUntilNextUtcMidnight,
  type InMemberTransaction,
} from "../profiles/brand-logo.ts";
import {
  activateEvidence,
  beginEvidenceUpload,
  discardEvidenceUpload,
  failEvidenceUpload,
  readOwnEvidence,
  readOwnEvidenceRequestId,
  removeOwnEvidence,
  type EvidenceObjectRef,
} from "./repository.ts";
import { answerOf, refusalOf } from "./service.ts";

export const EVIDENCE_BUCKET = "verification-evidence";

const PROGRAM_LIMIT_EXCEEDED = "54000";
const NOT_IN_PREREQUISITE_STATE = "55000";

export type EvidenceLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
};

export type EvidenceDependencies = {
  /** The creator's transactions of THIS request (session and role checked each time). */
  inTransaction: InMemberTransaction;
  store: ObjectStore;
  slots: ImageSlots;
  log: EvidenceLogger;
  now: () => Date;
};

/** A door of 0223 refused: the quotas of 54000 here, every other refusal as the requests read it. */
function depositRefusalOf(error: unknown, now: Date): unknown {
  if (sqlStateOf(error) === PROGRAM_LIMIT_EXCEEDED) {
    return sqlDetailOf(error) === "files"
      ? new ApiError("conflict", [{ path: "request", issue: "evidence_cap" }])
      : new RetryLaterError(
          "upload_quota_exceeded",
          secondsUntilNextUtcMidnight(now),
        );
  }
  return refusalOf(error);
}

/** (f), and the removal: an object removed at once when Storage answers; the task otherwise. */
async function removeAtBest(
  dependencies: EvidenceDependencies,
  object: EvidenceObjectRef,
  gesture: "replaced" | "removed" | "abandoned",
): Promise<void> {
  const removed = await dependencies.store.remove(
    EVIDENCE_BUCKET,
    object.objectKey,
  );
  if (!removed.ok) {
    dependencies.log.warn(
      {
        gesture,
        reason: removed.reason,
        status: removed.status,
        errorCode: removed.errorCode,
      },
      "verification.evidence.removal_deferred",
    );
  }
}

/** PUT …/requests/:id/evidence: the bytes received, re-encoded, stored, attached (stockage.md §3). */
export async function uploadEvidence(
  dependencies: EvidenceDependencies,
  requestId: string,
  received: Uint8Array,
): Promise<VerificationEvidenceResponse> {
  const { inTransaction, store, slots, log, now } = dependencies;
  const started = performance.now();
  const outcomeLine = (outcome: string, extra: object = {}) => {
    log.info(
      {
        outcome,
        receivedBytes: received.length,
        durationMs: Math.round(performance.now() - started),
        ...extra,
      },
      "verification.evidence.upload",
    );
  };

  let release: (() => void) | null = null;
  try {
    // (a) and (b), in one transaction: nothing counted when it fails.
    let upload: EvidenceObjectRef;
    try {
      upload = await inTransaction(async (tx) => {
        release = slots.tryAcquire();
        if (release === null) {
          throw new RetryLaterError(
            "service_unavailable",
            IMAGE_BUSY_RETRY_AFTER_SECONDS,
          );
        }
        return beginEvidenceUpload(tx, requestId, received.length);
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error instanceof RetryLaterError &&
          error.code === "service_unavailable"
        ) {
          outcomeLine("busy");
        }
        throw error;
      }
      const refusal = depositRefusalOf(error, now());
      if (refusal instanceof ApiError) {
        outcomeLine("refused", {
          issue: refusal.details?.[0]?.issue ?? refusal.code,
        });
      }
      throw refusal;
    }

    // (c) in memory, outside any transaction.
    const reencoded = await reencodeEvidence(received);
    if (!reencoded.ok) {
      await inTransaction((tx) => discardEvidenceUpload(tx, upload.evidenceId));
      outcomeLine("rejected", { reason: reencoded.reason });
      throw new ApiError("image_rejected", [
        { path: "evidence", issue: reencoded.reason },
      ]);
    }
    const output = reencoded.value;

    // (d) the object, under the key of the base.
    const written = await store.write(
      EVIDENCE_BUCKET,
      upload.objectKey,
      output.bytes,
      "image/webp",
    );
    if (!written.ok) {
      await inTransaction((tx) => failEvidenceUpload(tx, upload.evidenceId));
      outcomeLine("storage_failed", {
        reason: written.reason,
        status: written.status,
        errorCode: written.errorCode,
      });
      throw new ApiError("service_unavailable");
    }

    // (e) attached, the same piece deposited before to purge.
    let attached: {
      previous: EvidenceObjectRef | null;
      evidence: VerificationEvidenceResponse["evidence"];
    };
    try {
      attached = await inTransaction(async (tx: Transaction) => {
        const previous = await activateEvidence(tx, upload.evidenceId, {
          byteSize: output.bytes.length,
          width: output.width,
          height: output.height,
          checksumHex: createHash("sha256").update(output.bytes).digest("hex"),
        });
        const stored = (await readOwnEvidence(tx)).find(
          (piece) => piece.id === upload.evidenceId,
        );
        if (stored === undefined) {
          throw new Error("the piece activated is not readable by its owner");
        }
        return {
          previous,
          evidence: verificationEvidenceResponseSchema.parse({
            evidence: {
              id: stored.id,
              state: stored.state,
              createdAt: stored.createdAt,
              width: stored.width,
              height: stored.height,
              byteSize: stored.byteSize,
            },
          }).evidence,
        };
      });
    } catch (error) {
      if (sqlStateOf(error) !== NOT_IN_PREREQUISITE_STATE) {
        throw error;
      }
      if (sqlDetailOf(error) === "request_not_draft") {
        // Submitted or cancelled meanwhile: the deposit fails, its object goes (EC-L2E-07-4).
        await inTransaction((tx) => failEvidenceUpload(tx, upload.evidenceId));
        await removeAtBest(dependencies, upload, "abandoned");
        outcomeLine("request_not_draft");
        throw refusalOf(error);
      }
      // The pending row was taken by the purge meanwhile (over 15 minutes): its object goes too.
      await removeAtBest(dependencies, upload, "abandoned");
      outcomeLine("expired");
      throw new ApiError("service_unavailable");
    }

    // (f) at best.
    if (attached.previous !== null) {
      await removeAtBest(dependencies, attached.previous, "replaced");
    }
    outcomeLine("stored", {
      storedBytes: output.bytes.length,
      replaced: attached.previous !== null,
    });
    return { evidence: attached.evidence };
  } finally {
    // The slot is held from (b) to the end, the write to Storage included.
    (release as (() => void) | null)?.();
  }
}

/**
 * DELETE …/requests/:id/evidence/:evidenceId: the active piece of the draft to purge, its object
 * removed at once at best; the request as it now stands. A piece of another request, of another
 * creator, unknown: 404 (T14). Already withdrawn: nothing is written, the answer is the same.
 */
export async function removeEvidence(
  dependencies: EvidenceDependencies,
  requestId: string,
  evidenceId: string,
): Promise<VerificationRequestResponse> {
  const { inTransaction, log } = dependencies;
  const removal = await inTransaction(async (tx) => {
    if ((await readOwnEvidenceRequestId(tx, evidenceId)) !== requestId) {
      throw new ApiError("not_found");
    }
    let purged: EvidenceObjectRef | null;
    try {
      purged = await removeOwnEvidence(tx, evidenceId);
    } catch (error) {
      throw refusalOf(error);
    }
    return { purged, answer: await answerOf(tx, requestId, false) };
  });
  if (removal.purged !== null) {
    await removeAtBest(dependencies, removal.purged, "removed");
  }
  log.info(
    { removed: removal.purged !== null },
    "verification.evidence.remove",
  );
  return removal.answer;
}

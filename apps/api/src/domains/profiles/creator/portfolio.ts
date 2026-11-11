// The portfolio of the member's own creator account: deposit, replacement, caption and RG83, order,
// removal, list and the read of a visual (docs/mvp/07 RG77 to RG84, RG9; 18 T9.2 to T9.5, T9.8, T9.9,
// T14; D82 (7); jalons/l2g/modele.md points 3, 4, 10; commit 07). The model of a piece of verification
// (evidence.ts), the row written BEFORE the object:
//   (a) a creator of the session, terms accepted, holding a storefront; anything else the answer of a
//       route that does not exist (T14);
//   (b) one transaction: a slot of re-encoding taken (503 when both are, shared with the logo and the
//       pieces), the quotas consumed, the place checked and the row uploading
//       (profiles.begin_portfolio_upload(), 0242): eight places (409 portfolio_full), a replacement of
//       an approved visual of his only (409 not_replaceable, replacement_pending; another's: 404), 16
//       deposits and 64 MiB per UTC day (429 upload_quota_exceeded, Retry-After until UTC midnight);
//   (c) the bytes checked and re-encoded in memory (platform/images.ts reencodePortfolio(): the same
//       pixels, no metadata, RG80); refused = row deleted, 422 image_rejected with its typed reason;
//   (d) the WebP written to Storage under the key the base generated (T9.9); failed = row purging, 503;
//   (e) one transaction: the visual pending in queue 3 (its deadlines frozen by the base), the score
//       stored by the base; a row taken by the purge meanwhile (over 15 minutes): 503; a replacement
//       whose original left meanwhile: 409, the row purging, the object removed at best.
// A replaced or removed visual is never purged at once: withdrawn, its object kept 30 days by the base
// (07 Q9, D79 (8)). The read relays the object as JSON, its bytes in base64: no URL, no host of
// Supabase, no key (T9.2 as D80, D82 amend it); the owner's read is not journalised (stockage.md §4).
// One log line per gesture: outcome, sizes, duration; never an account, a key, a caption nor a name of
// file (D60; no name of file is read at all, T9.9).
import {
  portfolioCaptionResponseSchema,
  portfolioImageResponseSchema,
  portfolioItemSchema,
  portfolioRemovalResponseSchema,
  portfolioResponseSchema,
  portfolioUploadResponseSchema,
  type PortfolioCaptionBody,
  type PortfolioCaptionResponse,
  type PortfolioConflictIssue,
  type PortfolioImageResponse,
  type PortfolioItem,
  type PortfolioRemovalResponse,
  type PortfolioResponse,
  type PortfolioUploadResponse,
} from "@influx/contracts/creator-portfolio";
import { depositedPortfolioCount } from "@influx/domain/creator-profile";
import { createHash } from "node:crypto";
import type { Transaction } from "../../../db/index.ts";
import { sqlDetailOf, sqlStateOf } from "../../../db/sql-state.ts";
import {
  ApiError,
  RequestValidationError,
  RetryLaterError,
} from "../../../platform/errors.ts";
import {
  reencodePortfolio,
  type ImageSlots,
} from "../../../platform/images.ts";
import type { ObjectStore } from "../../../platform/storage.ts";
import {
  IMAGE_BUSY_RETRY_AFTER_SECONDS,
  secondsUntilNextUtcMidnight,
  type InMemberTransaction,
} from "../brand-logo.ts";
import {
  beginPortfolioUpload,
  discardPortfolioUpload,
  failPortfolioUpload,
  readOwnPortfolioItems,
  readOwnPortfolioObject,
  removeOwnPortfolioItem,
  reorderOwnPortfolio,
  setOwnPortfolioCaption,
  storePortfolioItem,
  type PortfolioUploadRef,
  type StoredPortfolioItem,
} from "./portfolio/repository.ts";
import { refreshCreatorScoreAfterPortfolio } from "./profile.ts";

export const PORTFOLIO_BUCKET = "portfolio";

const INSUFFICIENT_PRIVILEGE = "42501";
const PROGRAM_LIMIT_EXCEEDED = "54000";
const NOT_IN_PREREQUISITE_STATE = "55000";
const INVALID_PARAMETER_VALUE = "22023";
const CHECK_VIOLATION = "23514";

/** The DETAIL of a 55000 of the doors, as the contract names it (PORTFOLIO_CONFLICT_ISSUES). */
const CONFLICT_ISSUE_OF_DETAIL: Readonly<
  Record<
    string,
    { path: "portfolio" | "replaces"; issue: PortfolioConflictIssue }
  >
> = {
  portfolio_full: { path: "portfolio", issue: "portfolio_full" },
  portfolio_minimum: { path: "portfolio", issue: "portfolio_minimum" },
  not_replaceable: { path: "replaces", issue: "not_replaceable" },
  replacement_pending: { path: "replaces", issue: "replacement_pending" },
  item_state: { path: "portfolio", issue: "item_state" },
  suspended: { path: "portfolio", issue: "profile_state" },
};

export type PortfolioLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type PortfolioDependencies = {
  /** The creator's transactions of THIS request (session and role checked each time). */
  inTransaction: InMemberTransaction;
  store: ObjectStore;
  slots: ImageSlots;
  log: PortfolioLogger;
  now: () => Date;
};

/**
 * A refusal of the doors of 0242 and 0243 as the routes answer it: another's or an unknown visual as
 * an unknown route (42501, T14); the quotas (54000); a state (55000, the DETAIL as the issue); a
 * value (22023). Anything else is not a refusal and goes on.
 */
export function portfolioRefusalOf(error: unknown, now: Date): unknown {
  const detail = sqlDetailOf(error);
  switch (sqlStateOf(error)) {
    case INSUFFICIENT_PRIVILEGE:
      return new ApiError("not_found");
    case PROGRAM_LIMIT_EXCEEDED:
      return new RetryLaterError(
        "upload_quota_exceeded",
        secondsUntilNextUtcMidnight(now),
      );
    case NOT_IN_PREREQUISITE_STATE: {
      const conflict =
        detail === null ? undefined : CONFLICT_ISSUE_OF_DETAIL[detail];
      return conflict === undefined
        ? new ApiError("conflict")
        : new ApiError("conflict", [conflict]);
    }
    case INVALID_PARAMETER_VALUE:
      return new RequestValidationError([
        detail === "order"
          ? { path: "itemIds", issue: "order" }
          : detail === "caption"
            ? { path: "caption", issue: "invalid" }
            : { path: "", issue: "invalid" },
      ]);
    case CHECK_VIOLATION:
      return new RequestValidationError([{ path: "", issue: "invalid" }]);
    default:
      return error;
  }
}

/** A visual as its owner reads it (portfolioItemSchema): the reason on a refused one only. */
function itemOf(stored: StoredPortfolioItem): PortfolioItem {
  return portfolioItemSchema.parse({
    id: stored.id,
    state: stored.state,
    displayOrder: stored.displayOrder,
    caption: stored.caption,
    brandDeclared: stored.brandDeclared,
    width: stored.width,
    height: stored.height,
    byteSize: stored.byteSize,
    replacesItemId: stored.replacesItemId,
    replacementPending: stored.replacementPending,
    captionPending: stored.captionPending,
    reasonCode: stored.state === "rejected" ? stored.rejectionReasonCode : null,
    deleteAfter:
      stored.state === "rejected" || stored.state === "withdrawn"
        ? stored.retentionDueAt
        : null,
    createdAt: stored.createdAt,
    decidedAt: stored.decidedAt,
  });
}

/** The portfolio as GET answers it, and the count of RG4 and RG88 (packages/domain). */
function portfolioOf(items: readonly StoredPortfolioItem[]): PortfolioResponse {
  return portfolioResponseSchema.parse({
    items: items.map(itemOf),
    deposited: depositedPortfolioCount(
      items.flatMap((item) =>
        item.state === "pending" || item.state === "approved"
          ? [
              {
                id: item.id,
                state: item.state,
                replacesItemId: item.replacesItemId,
              },
            ]
          : [],
      ),
    ),
  });
}

/** One visual of his, read back in the transaction of the gesture. */
async function readOwnItem(
  tx: Transaction,
  itemId: string,
): Promise<StoredPortfolioItem> {
  const [stored] = await readOwnPortfolioItems(tx, itemId);
  if (stored === undefined) {
    throw new ApiError("not_found");
  }
  return stored;
}

/** An object removed at once, at best (the hourly task storage_purge otherwise). */
async function removeAtBest(
  dependencies: PortfolioDependencies,
  upload: PortfolioUploadRef,
): Promise<void> {
  const removed = await dependencies.store.remove(
    PORTFOLIO_BUCKET,
    upload.objectKey,
  );
  if (!removed.ok) {
    dependencies.log.warn(
      {
        gesture: "abandoned",
        reason: removed.reason,
        status: removed.status,
        errorCode: removed.errorCode,
      },
      "profiles.portfolio.removal_deferred",
    );
  }
}

/** PUT …/portfolio[?replaces=<uuid>]: the bytes received, re-encoded, stored, in queue 3. */
export async function uploadPortfolioItem(
  dependencies: PortfolioDependencies,
  received: Uint8Array,
  replacesItemId: string | null,
): Promise<PortfolioUploadResponse> {
  const { inTransaction, store, slots, log, now } = dependencies;
  const started = performance.now();
  const outcomeLine = (outcome: string, extra: object = {}) => {
    log.info(
      {
        outcome,
        kind: replacesItemId === null ? "deposit" : "replacement",
        receivedBytes: received.length,
        durationMs: Math.round(performance.now() - started),
        ...extra,
      },
      "profiles.portfolio.upload",
    );
  };

  let release: (() => void) | null = null;
  try {
    // (a) and (b), in one transaction: nothing counted when it fails.
    let upload: PortfolioUploadRef;
    try {
      upload = await inTransaction(async (tx) => {
        release = slots.tryAcquire();
        if (release === null) {
          throw new RetryLaterError(
            "service_unavailable",
            IMAGE_BUSY_RETRY_AFTER_SECONDS,
          );
        }
        return beginPortfolioUpload(tx, received.length, replacesItemId);
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
      const refusal = portfolioRefusalOf(error, now());
      if (refusal instanceof ApiError) {
        outcomeLine("refused", {
          issue: refusal.details?.[0]?.issue ?? refusal.code,
        });
      }
      throw refusal;
    }

    // (c) in memory, outside any transaction.
    const reencoded = await reencodePortfolio(received);
    if (!reencoded.ok) {
      await inTransaction((tx) => discardPortfolioUpload(tx, upload.itemId));
      outcomeLine("rejected", { reason: reencoded.reason });
      throw new ApiError("image_rejected", [
        { path: "portfolio", issue: reencoded.reason },
      ]);
    }
    const output = reencoded.value;

    // (d) the object, under the key of the base.
    const written = await store.write(
      PORTFOLIO_BUCKET,
      upload.objectKey,
      output.bytes,
      "image/webp",
    );
    if (!written.ok) {
      await inTransaction((tx) => failPortfolioUpload(tx, upload.itemId));
      outcomeLine("storage_failed", {
        reason: written.reason,
        status: written.status,
        errorCode: written.errorCode,
      });
      throw new ApiError("service_unavailable");
    }

    // (e) the visual pending in queue 3, the score stored by the base.
    let answer: PortfolioUploadResponse;
    try {
      answer = await inTransaction(async (tx) => {
        await storePortfolioItem(tx, upload.itemId, {
          byteSize: output.bytes.length,
          width: output.width,
          height: output.height,
          checksumHex: createHash("sha256").update(output.bytes).digest("hex"),
        });
        const item = itemOf(await readOwnItem(tx, upload.itemId));
        const progress = await refreshCreatorScoreAfterPortfolio(tx);
        return portfolioUploadResponseSchema.parse({
          item,
          deposited: progress.deposited,
          completeness: progress.completeness,
        });
      });
    } catch (error) {
      if (
        sqlStateOf(error) === NOT_IN_PREREQUISITE_STATE &&
        sqlDetailOf(error) === "item_not_uploading"
      ) {
        // The uploading row was taken by the purge meanwhile (over 15 minutes): its object goes too.
        await removeAtBest(dependencies, upload);
        outcomeLine("expired");
        throw new ApiError("service_unavailable");
      }
      const refusal = portfolioRefusalOf(error, now());
      if (!(refusal instanceof ApiError)) {
        throw refusal;
      }
      // The original of a replacement left meanwhile, or the profile was suspended: the deposit fails,
      // its object goes (a suspended profile refuses this write too: the purge takes the row).
      try {
        await inTransaction((tx) => failPortfolioUpload(tx, upload.itemId));
      } catch (failure) {
        if (sqlStateOf(failure) !== NOT_IN_PREREQUISITE_STATE) {
          throw failure;
        }
      }
      await removeAtBest(dependencies, upload);
      outcomeLine("refused", {
        issue: refusal.details?.[0]?.issue ?? refusal.code,
      });
      throw refusal;
    }

    outcomeLine("stored", { storedBytes: output.bytes.length });
    return answer;
  } finally {
    // The slot is held from (b) to the end, the write to Storage included.
    (release as (() => void) | null)?.();
  }
}

/** GET …/portfolio: his visuals (modele point 10) and the count of RG4, RG88. */
export async function readPortfolio(
  dependencies: PortfolioDependencies,
): Promise<PortfolioResponse> {
  return dependencies.inTransaction(async (tx) =>
    portfolioOf(await readOwnPortfolioItems(tx)),
  );
}

/** PUT …/portfolio/order (RG84): the placed visuals in his order, each once. */
export async function reorderPortfolio(
  dependencies: PortfolioDependencies,
  itemIds: readonly string[],
): Promise<PortfolioResponse> {
  const { inTransaction, log, now } = dependencies;
  const answer = await inTransaction(async (tx) => {
    try {
      await reorderOwnPortfolio(tx, itemIds);
    } catch (error) {
      throw portfolioRefusalOf(error, now());
    }
    return portfolioOf(await readOwnPortfolioItems(tx));
  });
  log.info({ placed: itemIds.length }, "profiles.portfolio.order");
  return answer;
}

/**
 * PATCH …/portfolio/:id (RG82, RG83, RG9): the caption and the box, direct; on an approved visual of a
 * published profile a revision, the validated caption served meanwhile (CA48).
 */
export async function setPortfolioCaption(
  dependencies: PortfolioDependencies,
  itemId: string,
  body: PortfolioCaptionBody,
): Promise<PortfolioCaptionResponse> {
  const { inTransaction, log, now } = dependencies;
  const answer = await inTransaction(async (tx) => {
    let revision: string | null;
    try {
      revision = await setOwnPortfolioCaption(
        tx,
        itemId,
        body.caption,
        body.brandDeclared,
      );
    } catch (error) {
      throw portfolioRefusalOf(error, now());
    }
    return portfolioCaptionResponseSchema.parse({
      item: itemOf(await readOwnItem(tx, itemId)),
      revisionStatus:
        revision === "pending_review" ? "pending_review" : "applied",
    });
  });
  log.info(
    {
      revisionStatus: answer.revisionStatus,
      captioned: body.caption !== null,
      brandDeclared: body.brandDeclared,
    },
    "profiles.portfolio.caption",
  );
  return answer;
}

/**
 * DELETE …/portfolio/:id: his pending or approved visual withdrawn (its replacement in progress with
 * it), its object kept 30 days by the base; a published profile keeps three (409 portfolio_minimum).
 * Already withdrawn, refused or purging: nothing is written, the answer is the same.
 */
export async function removePortfolioItem(
  dependencies: PortfolioDependencies,
  itemId: string,
): Promise<PortfolioRemovalResponse> {
  const { inTransaction, log, now } = dependencies;
  const { removed, answer } = await inTransaction(async (tx) => {
    let removed: boolean;
    try {
      removed = await removeOwnPortfolioItem(tx, itemId);
    } catch (error) {
      throw portfolioRefusalOf(error, now());
    }
    const progress = await refreshCreatorScoreAfterPortfolio(tx);
    return {
      removed,
      answer: portfolioRemovalResponseSchema.parse({
        deposited: progress.deposited,
        completeness: progress.completeness,
        profileStatus: progress.status,
      }),
    };
  });
  log.info({ removed }, "profiles.portfolio.remove");
  return answer;
}

/**
 * GET …/portfolio/:id/image: one of his visuals relayed from Storage as JSON (modele point 10), in
 * any state he reads; another's, unknown or whose object is gone: as an unknown route (T14).
 */
export async function readPortfolioImage(
  dependencies: PortfolioDependencies,
  itemId: string,
): Promise<PortfolioImageResponse> {
  const { inTransaction, store, log } = dependencies;
  const object = await inTransaction((tx) =>
    readOwnPortfolioObject(tx, itemId),
  );
  if (object === null) {
    throw new ApiError("not_found");
  }
  const read = await store.read(PORTFOLIO_BUCKET, object.objectKey);
  if (!read.ok) {
    log.error(
      { reason: read.reason, status: read.status, errorCode: read.errorCode },
      "profiles.portfolio.read_failed",
    );
    throw new ApiError("service_unavailable");
  }
  if (read.value === null) {
    // A row without its object (purged meanwhile): never shown as a broken image.
    log.warn({}, "profiles.portfolio.object_missing");
    throw new ApiError("not_found");
  }
  const bytes = read.value;
  return portfolioImageResponseSchema.parse({
    contentType: "image/webp",
    width: object.width,
    height: object.height,
    byteSize: bytes.length,
    data: Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).toString("base64"),
  });
}

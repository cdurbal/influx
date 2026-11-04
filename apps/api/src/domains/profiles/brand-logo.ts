// The logo of the brand of the member's own account: deposit, read, removal (docs/mvp/06 RG15,
// RG18, edge cases 3 and 6; 18 T9.2 to T9.5, T9.8, T9.9, T14; D80, jalons/l2b/stockage.md §1 to §7;
// commit 09). The row is written BEFORE the object, in this order (stockage.md §3):
//   (a) the advertiser owning the profile, not suspended; otherwise the answer of a route that does
//       not exist (T14) or a conflict, as the autosave;
//   (b) one transaction: a slot of re-encoding taken (503 when both are), the quota consumed, the
//       row pending (54000 = 429 upload_quota_exceeded, Retry-After until the next UTC midnight);
//   (c) the bytes checked and re-encoded in memory (platform/images.ts); refused = row deleted,
//       422 image_rejected with its typed reason;
//   (d) the WebP written to Storage under the key the base generated; failed = row purging, 503,
//       "deposit again" (06 edge case 6);
//   (e) one transaction: the row active, the previous one purging, the completeness stored; on a
//       PUBLISHED profile (06 RG9, file.md A4) the row goes `in_review` instead and the active logo
//       stays served until the decision: the answer says so (`state`);
//   (f) the previous object removed at once, at best (the hourly task storage_purge otherwise).
// The read relays the object as JSON, its bytes in base64: no URL, no host of Supabase, no token
// (T9.2 as D80 amends it). One log line per gesture: outcome, sizes, duration; never a name, a key
// nor a byte (D60). The owner's read is not journalised (stockage.md §4).
import type {
  BrandLogo,
  BrandLogoRemovalResponse,
  BrandLogoResponse,
  BrandLogoUploadResponse,
} from "@influx/contracts/brand-profile";
import type { Transaction } from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RetryLaterError } from "../../platform/errors.ts";
import { readPendingChanges } from "./revisions/repository.ts";
import { reencodeLogo, type ImageSlots } from "../../platform/images.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import {
  lockEditableBrandProfile,
  refreshStoredScore,
} from "./brand-profile.ts";
import {
  activateBrandLogo,
  beginBrandLogoUpload,
  discardBrandLogoUpload,
  failBrandLogoUpload,
  readOwnActiveLogo,
  readOwnInReviewLogo,
  readOwnLogoState,
  removeOwnBrandLogo,
  type LogoObjectRef,
} from "./repository.ts";

const BUCKET = "brand-logo";

/** Retry-After of a process whose two slots of re-encoding are taken. */
export const IMAGE_BUSY_RETRY_AFTER_SECONDS = 5;

const PROGRAM_LIMIT_EXCEEDED = "54000";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

/** The member's transactions of THIS request, as the routes open them (session checked each time). */
export type InMemberTransaction = <T>(
  work: (tx: Transaction) => Promise<T>,
) => Promise<T>;

export type BrandLogoLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type BrandLogoDependencies = {
  inTransaction: InMemberTransaction;
  store: ObjectStore;
  slots: ImageSlots;
  log: BrandLogoLogger;
  now: () => Date;
};

/** Seconds until the next UTC midnight, when the daily quota opens again (at least 1). */
export function secondsUntilNextUtcMidnight(now: Date): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

function logoOf(
  bytes: Uint8Array,
  described: { width: number; height: number; updatedAt: string },
): BrandLogo {
  return {
    contentType: "image/webp",
    width: described.width,
    height: described.height,
    byteSize: bytes.length,
    data: Buffer.from(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).toString("base64"),
    updatedAt: described.updatedAt,
  };
}

/** (f), and the removal: an object removed at once when Storage answers; the task otherwise. */
async function removeAtBest(
  dependencies: BrandLogoDependencies,
  previous: LogoObjectRef,
  gesture: "replaced" | "removed",
): Promise<boolean> {
  const removed = await dependencies.store.remove(BUCKET, previous.objectKey);
  if (!removed.ok) {
    dependencies.log.warn(
      {
        gesture,
        reason: removed.reason,
        status: removed.status,
        errorCode: removed.errorCode,
      },
      "profiles.logo.previous_removal_deferred",
    );
  }
  return removed.ok;
}

/** PUT: the bytes received, re-encoded, stored, attached (stockage.md §3). */
export async function uploadBrandLogo(
  dependencies: BrandLogoDependencies,
  received: Uint8Array,
): Promise<BrandLogoUploadResponse> {
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
      "profiles.logo.upload",
    );
  };

  let release: (() => void) | null = null;
  try {
    // (a) and (b), in one transaction: nothing counted when it fails.
    let upload: LogoObjectRef;
    try {
      upload = await inTransaction(async (tx) => {
        await lockEditableBrandProfile(tx);
        release = slots.tryAcquire();
        if (release === null) {
          throw new RetryLaterError(
            "service_unavailable",
            IMAGE_BUSY_RETRY_AFTER_SECONDS,
          );
        }
        return beginBrandLogoUpload(tx, received.length);
      });
    } catch (error) {
      switch (sqlStateOf(error)) {
        case PROGRAM_LIMIT_EXCEEDED:
          outcomeLine("quota_exceeded");
          throw new RetryLaterError(
            "upload_quota_exceeded",
            secondsUntilNextUtcMidnight(now()),
          );
        case INSUFFICIENT_PRIVILEGE:
          throw new ApiError("not_found");
        default:
          if (error instanceof RetryLaterError) {
            outcomeLine("busy");
          }
          throw error;
      }
    }

    // (c) in memory, outside any transaction.
    const reencoded = await reencodeLogo(received);
    if (!reencoded.ok) {
      await inTransaction((tx) => discardBrandLogoUpload(tx, upload.logoId));
      outcomeLine("rejected", { reason: reencoded.reason });
      throw new ApiError("image_rejected", [
        { path: "logo", issue: reencoded.reason },
      ]);
    }
    const output = reencoded.value;

    // (d) the object, under the key of the base.
    const written = await store.write(
      BUCKET,
      upload.objectKey,
      output.bytes,
      "image/webp",
    );
    if (!written.ok) {
      await inTransaction((tx) => failBrandLogoUpload(tx, upload.logoId));
      outcomeLine("storage_failed", {
        reason: written.reason,
        status: written.status,
        errorCode: written.errorCode,
      });
      throw new ApiError("service_unavailable");
    }

    // (e) attached, the previous one to purge, the completeness stored.
    let attached: {
      previous: LogoObjectRef | null;
      completeness: BrandLogoUploadResponse["completeness"];
      state: BrandLogoUploadResponse["state"];
      activatedAt: string;
    };
    try {
      attached = await inTransaction(async (tx) => {
        const previous = await activateBrandLogo(tx, upload.logoId, {
          byteSize: output.bytes.length,
          width: output.width,
          height: output.height,
        });
        const completeness = await refreshStoredScore(tx);
        const state =
          (await readOwnLogoState(tx, upload.logoId)) === "in_review"
            ? "in_review"
            : "active";
        const stored =
          state === "active"
            ? await readOwnActiveLogo(tx)
            : await readOwnInReviewLogo(tx);
        return {
          previous,
          completeness,
          state,
          activatedAt: stored?.activatedAt ?? now().toISOString(),
        };
      });
    } catch (error) {
      if (sqlStateOf(error) !== NOT_IN_PREREQUISITE_STATE) {
        throw error;
      }
      // The pending row was taken by the purge meanwhile (over 15 minutes): its object goes too.
      await store.remove(BUCKET, upload.objectKey);
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
      state: attached.state,
    });
    return {
      logo: logoOf(output.bytes, {
        width: output.width,
        height: output.height,
        updatedAt: attached.activatedAt,
      }),
      state: attached.state,
      completeness: attached.completeness,
    };
  } finally {
    // The slot is held from (b) to the end, the write to Storage included.
    (release as (() => void) | null)?.();
  }
}

/**
 * The logo waiting for review, relayed like the active one; absent when none waits, and when its
 * object cannot be read (the logo in force is the answer: a pending preview never fails the read).
 */
async function readPendingLogo(
  dependencies: BrandLogoDependencies,
  pending: Awaited<ReturnType<typeof readOwnInReviewLogo>>,
): Promise<BrandLogo | null> {
  if (pending === null) {
    return null;
  }
  const read = await dependencies.store.read(BUCKET, pending.objectKey);
  if (!read.ok || read.value === null) {
    dependencies.log.warn(
      { reason: read.ok ? "missing" : read.reason },
      "profiles.logo.pending_unreadable",
    );
    return null;
  }
  return logoOf(read.value, {
    width: pending.width,
    height: pending.height,
    updatedAt: pending.activatedAt,
  });
}

/**
 * GET: the logo in force, relayed from Storage as JSON; null when the brand has none. On a published
 * profile a replacement waiting for review comes as `pendingLogo` (file.md A4).
 */
export async function readBrandLogo(
  dependencies: BrandLogoDependencies,
): Promise<BrandLogoResponse> {
  const { inTransaction, store, log } = dependencies;
  const { active, pending } = await inTransaction(async (tx) => ({
    active: await readOwnActiveLogo(tx),
    pending: await readOwnInReviewLogo(tx),
  }));
  const pendingLogo = await readPendingLogo(dependencies, pending);
  const withPending = (logo: BrandLogo | null): BrandLogoResponse =>
    pendingLogo === null ? { logo } : { logo, pendingLogo };
  if (active === null) {
    return withPending(null);
  }
  const read = await store.read(BUCKET, active.objectKey);
  if (!read.ok) {
    log.error(
      { reason: read.reason, status: read.status, errorCode: read.errorCode },
      "profiles.logo.read_failed",
    );
    throw new ApiError("service_unavailable");
  }
  if (read.value === null) {
    // A row without its object: never shown as a broken image; a person looks (D60 error line).
    log.error({}, "profiles.logo.object_missing");
    return withPending(null);
  }
  return withPending(
    logoOf(read.value, {
      width: active.width,
      height: active.height,
      updatedAt: active.activatedAt,
    }),
  );
}

/**
 * DELETE: the active logo to purge, its object removed at once at best. On a PUBLISHED profile the
 * removal is proposed instead (file.md A4): the logo stays served, `removed` is false and `inReview`
 * true; only an object that was waiting for review (a replacement now withdrawn) is purged.
 */
export async function removeBrandLogo(
  dependencies: BrandLogoDependencies,
): Promise<BrandLogoRemovalResponse> {
  const { inTransaction, log } = dependencies;
  const removal = await inTransaction(async (tx) => {
    const regime = await lockEditableBrandProfile(tx);
    const purged = await removeOwnBrandLogo(tx);
    const completeness = await refreshStoredScore(tx);
    const inReview =
      regime === "published" &&
      (await readPendingChanges(tx)).some(
        (change) => change.field === "logo" && change.change === "clear",
      );
    return { purged, regime, inReview, completeness };
  });
  if (removal.purged !== null) {
    await removeAtBest(dependencies, removal.purged, "removed");
  }
  const removed = removal.regime !== "published" && removal.purged !== null;
  log.info({ removed, inReview: removal.inReview }, "profiles.logo.remove");
  return {
    removed,
    inReview: removal.inReview,
    completeness: removal.completeness,
  };
}

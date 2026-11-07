// Adapter of Supabase Storage: the ONLY importer of @supabase/storage-js in apps/api (D80,
// jalons/l2b/stockage.md §2; ESLint and tests/supabase-guards.test.ts).
// - Three gestures, nothing else: write an object (`upload`, never `upsert`), read it (`download`,
//   at most the limit of its bucket: 1 MiB the logo, 8 MiB a piece, D82 (3)), remove it (`remove`,
//   an absent object is a success). No signed URL, no public URL, no listing: no address of Storage
//   ever leaves apps/api (T9.2 as amended by D80 and D82).
// - The secret key of the service (SUPABASE_SECRET_KEY, already in api and worker, 03 §6.7 point 4),
//   as `apikey` and `Authorization: Bearer`, and our fixed User-Agent; 10 s per call.
// - Every key is checked before any call against the shape the base generates for its bucket
//   (0204: `<account_id>/<id>.webp`; 0223: `<account_id>/<request_id>/<id>.webp`; T9.3, T9.9).
//   Anything else is refused without a call.
// - An error is reduced to the HTTP status and the error code of Storage, never its message (D60);
//   no key, no byte, no address is logged here.
import { isStorageError, StorageClient } from "@supabase/storage-js";
import { boundedFetch, GOTRUE_USER_AGENT } from "./supabase.ts";

/** Bound of each call to Storage (stockage.md §2). */
export const STORAGE_CALL_TIMEOUT_MS = 10_000;

/** The buckets apps/api writes (a closed list, as the quotas of 0204 and 0223). */
export const STORAGE_BUCKETS = ["brand-logo", "verification-evidence"] as const;
export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** What a read accepts at most: the limit of each bucket (0204: 1 MiB; 0223, D82 (3): 8 MiB). */
export const STORAGE_READ_MAX_BYTES: Readonly<Record<StorageBucket, number>> = {
  "brand-logo": 1_048_576,
  "verification-evidence": 8_388_608,
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The keys the base generates, lowercase, per bucket. */
export const OBJECT_KEY_PATTERNS: Readonly<Record<StorageBucket, RegExp>> = {
  /** `<account uuid>/<object uuid>.webp` (0204). */
  "brand-logo": new RegExp(`^${UUID}/${UUID}\\.webp$`),
  /** `<account uuid>/<request uuid>/<object uuid>.webp` (0223). */
  "verification-evidence": new RegExp(`^${UUID}/${UUID}/${UUID}\\.webp$`),
};

/** Where Storage is, and the key that opens it (SUPABASE_URL, SUPABASE_SECRET_KEY). */
export type StorageSettings = {
  /** Origin of the project, `https://<ref>.supabase.co` (http only on a loopback host). */
  url: string;
  /** `sb_secret_…` key of this service. */
  secretKey: string;
};

export type StorageFailure = {
  ok: false;
  /**
   * `rejected`: Storage answered with a refusal (4xx), or the key was refused before any call.
   * `unavailable`: no usable answer (time-out, network, 5xx, malformed or oversized answer).
   */
  reason: "rejected" | "unavailable";
  /** HTTP status, or null when no answer was received. */
  status: number | null;
  /** Storage's error code (`NoSuchKey`, `Duplicate`…), never its message. */
  errorCode: string | null;
};

export type StorageOutcome<Value> = { ok: true; value: Value } | StorageFailure;

export type ObjectStore = {
  /** Writes a new object; an object already at that key is a refusal (never overwritten). */
  write(
    bucket: StorageBucket,
    key: string,
    bytes: Uint8Array,
    contentType: "image/webp",
  ): Promise<StorageOutcome<null>>;
  /** Reads an object, null when it does not exist; refused beyond the bound of its bucket. */
  read(
    bucket: StorageBucket,
    key: string,
  ): Promise<StorageOutcome<Uint8Array | null>>;
  /** Removes an object; an absent object is a success. */
  remove(bucket: StorageBucket, key: string): Promise<StorageOutcome<null>>;
};

const KEY_REFUSED: StorageFailure = {
  ok: false,
  reason: "rejected",
  status: null,
  errorCode: "invalid_key",
};

const MALFORMED_ANSWER: StorageFailure = {
  ok: false,
  reason: "unavailable",
  status: null,
  errorCode: null,
};

/** A key of the shape the base generates for `bucket`, and nothing else (T9.3: no traversal). */
export function isObjectKey(bucket: StorageBucket, key: string): boolean {
  const pattern = OBJECT_KEY_PATTERNS[bucket] as RegExp | undefined;
  return pattern !== undefined && pattern.test(key);
}

/** An error of the library reduced to its status and code (D60: never its message). */
export function storageFailureOf(error: unknown): StorageFailure {
  const found = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
  };
  const status =
    typeof found.status === "number" && found.status > 0
      ? found.status
      : typeof found.statusCode === "string" &&
          /^[1-5][0-9]{2}$/.test(found.statusCode)
        ? Number(found.statusCode)
        : null;
  const errorCode =
    typeof found.code === "string" && /^[A-Za-z_]{1,64}$/.test(found.code)
      ? found.code
      : null;
  const isRefusal = status !== null && status >= 400 && status < 500;
  return {
    ok: false,
    reason: isRefusal ? "rejected" : "unavailable",
    status,
    errorCode,
  };
}

/** Whether a failed read means "no such object" (Storage answers 400 or 404 with NoSuchKey). */
function isMissingObject(failure: StorageFailure): boolean {
  return (
    failure.status === 404 ||
    failure.errorCode === "NoSuchKey" ||
    (failure.status === 400 && failure.errorCode === "not_found")
  );
}

/**
 * Runs a call of the library. Its errors come back as values; a StorageError thrown is reduced the
 * same way, a failure of the network (or the time-out) is `unavailable`.
 */
async function settled<Value>(
  call: () => Promise<{ data: Value | null; error: unknown }>,
): Promise<StorageOutcome<Value | null>> {
  try {
    const result = await call();
    if (result.error !== null) {
      return storageFailureOf(result.error);
    }
    return { ok: true, value: result.data };
  } catch (error) {
    if (isStorageError(error)) {
      return storageFailureOf(error);
    }
    return MALFORMED_ANSWER;
  }
}

export function createObjectStore(settings: StorageSettings): ObjectStore {
  const client = new StorageClient(
    `${settings.url}/storage/v1`,
    {
      apikey: settings.secretKey,
      Authorization: `Bearer ${settings.secretKey}`,
      "User-Agent": GOTRUE_USER_AGENT,
    },
    boundedFetch(STORAGE_CALL_TIMEOUT_MS),
  );

  return {
    async write(bucket, key, bytes, contentType) {
      if (!isObjectKey(bucket, key)) {
        return KEY_REFUSED;
      }
      const outcome = await settled(() =>
        client.from(bucket).upload(key, bytes, {
          contentType,
          upsert: false,
        }),
      );
      return outcome.ok ? { ok: true, value: null } : outcome;
    },

    async read(bucket, key) {
      if (!isObjectKey(bucket, key)) {
        return KEY_REFUSED;
      }
      const outcome = await settled(async () => {
        const result = await client.from(bucket).download(key);
        return { data: result.data, error: result.error };
      });
      if (!outcome.ok) {
        return isMissingObject(outcome) ? { ok: true, value: null } : outcome;
      }
      const blob = outcome.value;
      if (
        !(blob instanceof Blob) ||
        blob.size > STORAGE_READ_MAX_BYTES[bucket]
      ) {
        return MALFORMED_ANSWER;
      }
      return { ok: true, value: new Uint8Array(await blob.arrayBuffer()) };
    },

    async remove(bucket, key) {
      if (!isObjectKey(bucket, key)) {
        return KEY_REFUSED;
      }
      const outcome = await settled(() => client.from(bucket).remove([key]));
      return outcome.ok ? { ok: true, value: null } : outcome;
    },
  };
}

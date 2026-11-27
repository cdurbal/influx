// Adapter of Cloudflare R2 over path-style S3 signed with AWS Signature V4 (`node:crypto` +
// `boundedFetch`, D90, docs/mvp/23-migration-cloudflare-r2.md §3.3 A1, §5.2, RG6-RG9):
// - Three gestures, nothing else: write an object (`PUT` with `If-None-Match: "*"`, real SHA-256),
//   read it (`GET`, stream bounded per bucket: 1 MiB logo, 8 MiB piece/visual, D82), remove it
//   (`DELETE`, an absent object is a success). No presigned URL, no public URL, no listing: no
//   address of R2 ever leaves apps/api (T9.2, T9.6, T9.7).
// - Every key is checked before any URL construction or signature against the shape the base
//   generates for its bucket (0204 and 0242: `<account_id>/<id>.webp`; 0223:
//   `<account_id>/<request_id>/<id>.webp`; T9.3, T9.9). Anything else is refused without a call.
// - An error HTTP >= 400 reads at most 8,192 bytes and extracts `<Code>` only, never `<Message>`,
//   `<Key>`, the URL, Authorization or credentials (D60).
import { createHash, createHmac } from "node:crypto";
import type { R2Config } from "../config/schema.ts";
import { boundedFetch } from "./supabase.ts";

/** Bound of each call to R2 (23 §5.2, RG7). */
export const STORAGE_CALL_TIMEOUT_MS = 10_000;

/** Fixed User-Agent of apps/api towards R2 (23 RG7). */
export const STORAGE_USER_AGENT = "influx-api";

/** Maximum bytes read from an S3 error body before closing the stream (D60, 23 §5.2 pt 4). */
export const STORAGE_ERROR_BODY_MAX_BYTES = 8_192;

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const EMPTY_PAYLOAD_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ERROR_CODE_PATTERN = /<Code>([A-Za-z0-9_]{1,64})<\/Code>/;

/** The buckets apps/api writes (a closed list, as the quotas of 0204, 0223 and 0242). */
export const STORAGE_BUCKETS = [
  "brand-logo",
  "verification-evidence",
  "portfolio",
] as const;
export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/**
 * What a read accepts at most: the limit of each bucket (0204: 1 MiB; 0223, D82 (3): 8 MiB; 0242,
 * D82 (7): 8 MiB).
 */
export const STORAGE_READ_MAX_BYTES: Readonly<Record<StorageBucket, number>> = {
  "brand-logo": 1_048_576,
  "verification-evidence": 8_388_608,
  portfolio: 8_388_608,
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** The keys the base generates, lowercase, per bucket. */
export const OBJECT_KEY_PATTERNS: Readonly<Record<StorageBucket, RegExp>> = {
  /** `<account uuid>/<object uuid>.webp` (0204). */
  "brand-logo": new RegExp(`^${UUID}/${UUID}\\.webp$`),
  /** `<account uuid>/<request uuid>/<object uuid>.webp` (0223). */
  "verification-evidence": new RegExp(`^${UUID}/${UUID}/${UUID}\\.webp$`),
  /** `<account uuid>/<visual uuid>.webp` (0242). */
  portfolio: new RegExp(`^${UUID}/${UUID}\\.webp$`),
};

export type StorageFailure = {
  ok: false;
  /**
   * `rejected`: R2 answered with a refusal (4xx), or the key was refused before any call.
   * `unavailable`: no usable answer (time-out, network, 5xx, malformed or oversized answer).
   */
  reason: "rejected" | "unavailable";
  /** HTTP status, or null when no answer was received. */
  status: number | null;
  /** S3 XML error `<Code>` (`NoSuchKey`, `PreconditionFailed`…), never `<Message>`. */
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

export type ObjectStoreOptions = {
  fetch?: typeof fetch;
  now?: () => Date;
};

export type SigV4SignInput = {
  method: "GET" | "PUT" | "DELETE";
  url: URL;
  headers: Readonly<Record<string, string>>;
  payloadSha256: string;
  accessKeyId: string;
  secretAccessKey: string;
  amzDate: string;
  region?: string;
  service?: string;
};

export type SigV4Signature = {
  authorizationHeader: string;
  canonicalRequest: string;
  stringToSign: string;
  signedHeaders: string;
  signature: string;
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

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Uint8Array | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function formatAmzDate(now: Date): string {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function uriEncodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalUriOf(pathname: string): string {
  const segments = pathname.split("/");
  const encoded = segments.map((segment) =>
    uriEncodeRfc3986(decodeURIComponent(segment)),
  );
  const joined = encoded.join("/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

function canonicalQueryOf(rawSearch: string): string {
  const rawQuery = rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch;
  if (rawQuery.length === 0) {
    return "";
  }
  const pairs: [string, string][] = [];
  for (const part of rawQuery.split("&")) {
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    pairs.push([
      uriEncodeRfc3986(decodeURIComponent(rawKey.replaceAll("+", " "))),
      uriEncodeRfc3986(decodeURIComponent(rawValue.replaceAll("+", " "))),
    ]);
  }
  pairs.sort(([ka, va], [kb, vb]) =>
    ka === kb ? (va < vb ? -1 : va > vb ? 1 : 0) : ka < kb ? -1 : 1,
  );
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

/** Computes AWS4-HMAC-SHA256 `Authorization` header signature (never query-string signing). */
export function signAwsSigV4(input: SigV4SignInput): SigV4Signature {
  const region = input.region ?? R2_REGION;
  const service = input.service ?? R2_SERVICE;
  const dateStamp = input.amzDate.slice(0, 8);

  const normalized = new Map<string, string>();
  for (const [name, value] of Object.entries(input.headers)) {
    const lower = name.toLowerCase();
    const cleaned = value.trim().replace(/[ \t]+/g, " ");
    const existing = normalized.get(lower);
    normalized.set(
      lower,
      existing === undefined ? cleaned : `${existing},${cleaned}`,
    );
  }
  const signedNames = [...normalized.keys()].sort();
  const signedHeaders = signedNames.join(";");
  const canonicalHeaders = signedNames
    .map((name) => `${name}:${normalized.get(name) ?? ""}\n`)
    .join("");

  const canonicalRequest = [
    input.method,
    canonicalUriOf(input.url.pathname),
    canonicalQueryOf(input.url.search),
    canonicalHeaders,
    signedHeaders,
    input.payloadSha256,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    input.amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  return {
    authorizationHeader: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    canonicalRequest,
    stringToSign,
    signedHeaders,
    signature,
  };
}

/** Extracts at most `<Code>` from an S3 XML error snippet, discarding all other fields (D60). */
export function extractS3ErrorCode(xml: string): string | null {
  const match = ERROR_CODE_PATTERN.exec(xml);
  return match?.[1] ?? null;
}

async function cancelBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (body === null) {
    return;
  }
  try {
    await body.cancel();
  } catch {
    // Closing an aborted or already closed response stream is best-effort.
  }
}

async function readBoundedStream(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  onOverflow: "reject" | "truncate",
): Promise<Uint8Array | null> {
  if (body === null) {
    return new Uint8Array(0);
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (total + value.byteLength > maxBytes) {
        if (onOverflow === "reject") {
          await reader.cancel();
          return null;
        }
        const remaining = maxBytes - total;
        if (remaining > 0) {
          chunks.push(value.subarray(0, remaining));
          total += remaining;
        }
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

function objectUrlOf(
  settings: R2Config,
  bucket: StorageBucket,
  key: string,
): URL {
  const endpoint = settings.endpoint.replace(/\/+$/, "");
  return new URL(`${endpoint}/${settings.bucketPrefix}${bucket}/${key}`);
}

async function failureFromResponse(
  response: Response,
): Promise<StorageFailure> {
  const errorBytes = await readBoundedStream(
    response.body,
    STORAGE_ERROR_BODY_MAX_BYTES,
    "truncate",
  );
  const errorCode =
    errorBytes === null
      ? null
      : extractS3ErrorCode(new TextDecoder("utf-8").decode(errorBytes));
  const isRefusal = response.status >= 400 && response.status < 500;
  return {
    ok: false,
    reason: isRefusal ? "rejected" : "unavailable",
    status: response.status,
    errorCode,
  };
}

function isMissingObject(failure: StorageFailure): boolean {
  return failure.status === 404 || failure.errorCode === "NoSuchKey";
}

export function createObjectStore(
  settings: R2Config,
  options: ObjectStoreOptions = {},
): ObjectStore {
  const timedFetch = boundedFetch(STORAGE_CALL_TIMEOUT_MS, options.fetch);
  const now = options.now ?? (() => new Date());

  async function sendSigned(
    method: "GET" | "PUT" | "DELETE",
    bucket: StorageBucket,
    key: string,
    payload?: { bytes: Uint8Array; contentType: "image/webp" },
  ): Promise<Response> {
    const url = objectUrlOf(settings, bucket, key);
    const amzDate = formatAmzDate(now());
    const payloadSha256 =
      payload === undefined ? EMPTY_PAYLOAD_SHA256 : sha256Hex(payload.bytes);
    const signedHeadersInput: Record<string, string> =
      method === "PUT" && payload !== undefined
        ? {
            "content-type": payload.contentType,
            host: url.host,
            "if-none-match": "*",
            "x-amz-content-sha256": payloadSha256,
            "x-amz-date": amzDate,
          }
        : {
            host: url.host,
            "x-amz-content-sha256": payloadSha256,
            "x-amz-date": amzDate,
          };
    const { authorizationHeader } = signAwsSigV4({
      method,
      url,
      headers: signedHeadersInput,
      payloadSha256,
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
      amzDate,
    });
    const requestHeaders: Record<string, string> = {
      "User-Agent": STORAGE_USER_AGENT,
      Authorization: authorizationHeader,
      "x-amz-content-sha256": payloadSha256,
      "x-amz-date": amzDate,
      ...(method === "PUT" && payload !== undefined
        ? {
            "Content-Type": payload.contentType,
            "If-None-Match": "*",
          }
        : {}),
    };
    const body =
      payload === undefined ? undefined : new Uint8Array(payload.bytes);
    return timedFetch(url, {
      method,
      headers: requestHeaders,
      redirect: "manual",
      ...(body === undefined ? {} : { body }),
    });
  }

  return {
    async write(bucket, key, bytes, contentType) {
      if (!isObjectKey(bucket, key)) {
        return KEY_REFUSED;
      }
      try {
        const response = await sendSigned("PUT", bucket, key, {
          bytes,
          contentType,
        });
        if (response.status >= 400) {
          return await failureFromResponse(response);
        }
        await cancelBody(response.body);
        if (response.status < 200 || response.status >= 300) {
          return MALFORMED_ANSWER;
        }
        return { ok: true, value: null };
      } catch {
        return MALFORMED_ANSWER;
      }
    },

    async read(bucket, key) {
      if (!isObjectKey(bucket, key)) {
        return KEY_REFUSED;
      }
      try {
        const response = await sendSigned("GET", bucket, key);
        if (response.status >= 400) {
          const failure = await failureFromResponse(response);
          return isMissingObject(failure) ? { ok: true, value: null } : failure;
        }
        if (response.status < 200 || response.status >= 300) {
          await cancelBody(response.body);
          return MALFORMED_ANSWER;
        }
        const maxBytes = STORAGE_READ_MAX_BYTES[bucket];
        const declaredHeader = response.headers.get("content-length");
        if (declaredHeader !== null) {
          const trimmed = declaredHeader.trim();
          if (!/^\d+$/.test(trimmed)) {
            await cancelBody(response.body);
            return MALFORMED_ANSWER;
          }
          const declaredLength = Number(trimmed);
          if (
            !Number.isSafeInteger(declaredLength) ||
            declaredLength > maxBytes
          ) {
            await cancelBody(response.body);
            return MALFORMED_ANSWER;
          }
        }
        const bytes = await readBoundedStream(
          response.body,
          maxBytes,
          "reject",
        );
        if (bytes === null) {
          return MALFORMED_ANSWER;
        }
        return { ok: true, value: bytes };
      } catch {
        return MALFORMED_ANSWER;
      }
    },

    async remove(bucket, key) {
      if (!isObjectKey(bucket, key)) {
        return KEY_REFUSED;
      }
      try {
        const response = await sendSigned("DELETE", bucket, key);
        if (response.status >= 400) {
          const failure = await failureFromResponse(response);
          return isMissingObject(failure) ? { ok: true, value: null } : failure;
        }
        await cancelBody(response.body);
        if (response.status < 200 || response.status >= 300) {
          return MALFORMED_ANSWER;
        }
        return { ok: true, value: null };
      } catch {
        return MALFORMED_ANSWER;
      }
    },
  };
}

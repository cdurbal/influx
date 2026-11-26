// The local S3 SigV4 double (docs/mvp/23-migration-cloudflare-r2.md RG10, 16 RG148): a fake
// path-style S3 server on the LOOPBACK only (`127.0.0.1`), for tests and local development.
// - Verifies AWS4-HMAC-SHA256 Authorization and real `x-amz-content-sha256` (no UNSIGNED-PAYLOAD)
//   against the received body; rejects missing, malformed, or altered signatures with 403
//   `SignatureDoesNotMatch`.
// - Implements path-style `PUT` (`If-None-Match: "*"` -> 412 `PreconditionFailed` on existing key,
//   otherwise 200), `GET` (200 or 404 `NoSuchKey`), and `DELETE` (204, idempotent).
// - Exposes `/_double/state` (GET) and `/_double/reset` (POST) without SigV4 for out-of-process
//   Playwright journeys, plus `queue()` for fault/delay/disconnect injection.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export const S3_DOUBLE_HOST = "127.0.0.1";
export const S3_DOUBLE_DEFAULT_REGION = "auto";
export const S3_DOUBLE_DEFAULT_SERVICE = "s3";
export const S3_DOUBLE_DEFAULT_ACCESS_KEY_ID = "influx-s3-double-access-key";
export const S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY =
  "influx-s3-double-secret-key-0123456789abcdef";

const REQUIRED_SIGNED_HEADERS = [
  "host",
  "x-amz-content-sha256",
  "x-amz-date",
] as const;

const AUTH_PATTERN =
  /^AWS4-HMAC-SHA256\s+Credential=([^,\s]+)\s*,\s*SignedHeaders=([^,\s]+)\s*,\s*Signature=([0-9a-f]{64})$/;
const AMZ_DATE_PATTERN = /^(\d{8})T\d{6}Z$/;

export type S3DoubleOptions = {
  /** Port to listen on; defaults to 0 (ephemeral loopback port). */
  port?: number;
  /** Expected AWS access key id; defaults to S3_DOUBLE_DEFAULT_ACCESS_KEY_ID. */
  accessKeyId?: string;
  /** Secret access key used to verify SigV4 signatures; defaults to S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY. */
  secretAccessKey?: string;
  /** Expected SigV4 region; defaults to "auto". */
  region?: string;
  /** Expected SigV4 service; defaults to "s3". */
  service?: string;
};

export type S3DoubleObject = {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
  etag: string;
};

export type S3DoubleRequest = {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: Uint8Array;
  answeredStatus: number;
  errorCode: string | null;
};

export type S3DoubleAnswer = {
  status: number;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
  delayMs?: number;
  /** Close the connection without answering (a transport failure). */
  destroy?: boolean;
  errorCode?: string;
};

export type S3DoubleState = {
  ok: true;
  objectCount: number;
  keys: string[];
  requestCount: number;
  queuedCount: number;
};

export type S3Double = {
  /** `http://127.0.0.1:<port>`: the value of R2_ENDPOINT in tests and local dev. */
  endpoint: string;
  port: number;
  /** Stored objects keyed by `<bucket>/<key>`. */
  objects: Map<string, S3DoubleObject>;
  /** Every S3 request received (excluding `/_double/*` control routes), in order. */
  requests: S3DoubleRequest[];
  /** Queued responses used in order by the next S3 requests, bypassing default handling. */
  queue(...answers: S3DoubleAnswer[]): void;
  /** Delay of every default answer, in milliseconds. */
  setDefaultDelay(delayMs: number): void;
  reset(): void;
  close(): Promise<void>;
};

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Uint8Array | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function xmlError(
  status: number,
  code: string,
  message: string,
): S3DoubleAnswer {
  return {
    status,
    headers: { "content-type": "application/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<Error><Code>${escapeXml(code)}</Code><Message>${escapeXml(message)}</Message></Error>`,
    errorCode: code,
  };
}

function uriEncodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalUriOf(rawPathname: string): string | null {
  const segments = rawPathname.split("/");
  const encoded: string[] = [];
  for (const segment of segments) {
    try {
      encoded.push(uriEncodeRfc3986(decodeURIComponent(segment)));
    } catch {
      return null;
    }
  }
  const joined = encoded.join("/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

function canonicalQueryOf(rawQuery: string): string | null {
  if (rawQuery.length === 0) {
    return "";
  }
  const pairs: [string, string][] = [];
  for (const part of rawQuery.split("&")) {
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    try {
      pairs.push([
        uriEncodeRfc3986(decodeURIComponent(rawKey.replaceAll("+", " "))),
        uriEncodeRfc3986(decodeURIComponent(rawValue.replaceAll("+", " "))),
      ]);
    } catch {
      return null;
    }
  }
  pairs.sort(([ka, va], [kb, vb]) =>
    ka === kb ? (va < vb ? -1 : va > vb ? 1 : 0) : ka < kb ? -1 : 1,
  );
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

function headerValue(
  headers: IncomingHttpHeaders,
  name: string,
): string | null {
  const raw = headers[name];
  if (raw === undefined) {
    return null;
  }
  const joined = Array.isArray(raw) ? raw.join(",") : raw;
  return joined.trim().replace(/[ \t]+/g, " ");
}

function isSorted(items: readonly string[]): boolean {
  for (let i = 1; i < items.length; i++) {
    const previous = items[i - 1];
    const current = items[i];
    if (
      previous === undefined ||
      current === undefined ||
      previous >= current
    ) {
      return false;
    }
  }
  return true;
}

type SigV4Config = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
};

/**
 * Verifies AWS4-HMAC-SHA256 Authorization and `x-amz-content-sha256` against the raw body bytes.
 * Returns null on success, or a 403 SignatureDoesNotMatch answer on any mismatch.
 */
function verifySigV4(
  method: string,
  rawUrl: string,
  headers: IncomingHttpHeaders,
  body: Uint8Array,
  config: SigV4Config,
): S3DoubleAnswer | null {
  const reject = () =>
    xmlError(
      403,
      "SignatureDoesNotMatch",
      "The request signature we calculated does not match the signature you provided.",
    );

  const auth = headerValue(headers, "authorization");
  const amzDate = headerValue(headers, "x-amz-date");
  const contentSha256 = headerValue(headers, "x-amz-content-sha256");
  if (auth === null || amzDate === null || contentSha256 === null) {
    return reject();
  }

  const dateMatch = AMZ_DATE_PATTERN.exec(amzDate);
  const authMatch = AUTH_PATTERN.exec(auth);
  if (dateMatch === null || authMatch === null) {
    return reject();
  }

  const bodyDigest = sha256Hex(body);
  if (contentSha256 !== bodyDigest) {
    return reject();
  }

  const [, credentialScope = "", signedHeadersRaw = "", providedSig = ""] =
    authMatch;
  const scopeParts = credentialScope.split("/");
  if (scopeParts.length !== 5) {
    return reject();
  }
  const [credKeyId, dateStamp, credRegion, credService, terminator] =
    scopeParts;
  const expectedDateStamp = dateMatch[1];
  if (
    expectedDateStamp === undefined ||
    credKeyId !== config.accessKeyId ||
    dateStamp !== expectedDateStamp ||
    credRegion !== config.region ||
    credService !== config.service ||
    terminator !== "aws4_request"
  ) {
    return reject();
  }

  const signedHeaders = signedHeadersRaw.split(";");
  if (
    signedHeaders.length === 0 ||
    !isSorted(signedHeaders) ||
    REQUIRED_SIGNED_HEADERS.some(
      (required) => !signedHeaders.includes(required),
    )
  ) {
    return reject();
  }

  const canonicalHeaderLines: string[] = [];
  for (const name of signedHeaders) {
    if (name !== name.toLowerCase()) {
      return reject();
    }
    const value = headerValue(headers, name);
    if (value === null) {
      return reject();
    }
    canonicalHeaderLines.push(`${name}:${value}\n`);
  }

  const qIndex = rawUrl.indexOf("?");
  const rawPathname = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const rawQuery = qIndex === -1 ? "" : rawUrl.slice(qIndex + 1);
  const canonicalUri = canonicalUriOf(rawPathname);
  const canonicalQuery = canonicalQueryOf(rawQuery);
  if (canonicalUri === null || canonicalQuery === null) {
    return reject();
  }

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaderLines.join(""),
    signedHeadersRaw,
    bodyDigest,
  ].join("\n");

  const scope = `${dateStamp}/${config.region}/${config.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, config.region);
  const kService = hmacSha256(kRegion, config.service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const expectedSig = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const actualBuf = Buffer.from(providedSig, "hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  if (
    actualBuf.length !== expectedBuf.length ||
    !timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return reject();
  }
  return null;
}

function parseBucketAndKey(
  rawPathname: string,
): { bucket: string; key: string } | null {
  const trimmed = rawPathname.startsWith("/")
    ? rawPathname.slice(1)
    : rawPathname;
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) {
    return null;
  }
  return {
    bucket: trimmed.slice(0, slash),
    key: trimmed.slice(slash + 1),
  };
}

function readRawBody(request: NodeJS.ReadableStream): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    request.on("error", reject);
  });
}

/** Starts an in-memory path-style S3 SigV4 double bound exclusively to `127.0.0.1`. */
export async function startS3Double(
  options: S3DoubleOptions = {},
): Promise<S3Double> {
  const port = options.port ?? 0;
  const sigConfig: SigV4Config = {
    accessKeyId: options.accessKeyId ?? S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
    secretAccessKey:
      options.secretAccessKey ?? S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
    region: options.region ?? S3_DOUBLE_DEFAULT_REGION,
    service: options.service ?? S3_DOUBLE_DEFAULT_SERVICE,
  };

  const objects = new Map<string, S3DoubleObject>();
  const requests: S3DoubleRequest[] = [];
  const pending: S3DoubleAnswer[] = [];
  let defaultDelayMs = 0;

  function handleS3(
    method: string,
    rawPathname: string,
    headers: IncomingHttpHeaders,
    body: Uint8Array,
  ): S3DoubleAnswer {
    const target = parseBucketAndKey(rawPathname);
    if (target === null) {
      return xmlError(
        400,
        "InvalidRequest",
        "Expected path-style /<bucket>/<key>.",
      );
    }
    const storeKey = `${target.bucket}/${target.key}`;

    if (method === "PUT") {
      if (
        headerValue(headers, "if-none-match") === "*" &&
        objects.has(storeKey)
      ) {
        return xmlError(
          412,
          "PreconditionFailed",
          "At least one pre-condition you specified did not hold.",
        );
      }
      const etag = `"${createHash("md5").update(body).digest("hex")}"`;
      objects.set(storeKey, {
        bucket: target.bucket,
        key: target.key,
        body: new Uint8Array(body),
        contentType:
          headerValue(headers, "content-type") ?? "application/octet-stream",
        etag,
      });
      return { status: 200, headers: { etag } };
    }

    if (method === "GET") {
      const stored = objects.get(storeKey);
      if (stored === undefined) {
        return xmlError(404, "NoSuchKey", "The specified key does not exist.");
      }
      return {
        status: 200,
        headers: {
          "content-type": stored.contentType,
          "content-length": String(stored.body.byteLength),
          etag: stored.etag,
        },
        body: stored.body,
      };
    }

    if (method === "DELETE") {
      objects.delete(storeKey);
      return { status: 204 };
    }

    return xmlError(
      405,
      "MethodNotAllowed",
      "The specified method is not allowed against this resource.",
    );
  }

  function reset(): void {
    objects.clear();
    requests.length = 0;
    pending.length = 0;
    defaultDelayMs = 0;
  }

  const server: Server = createServer((request, response) => {
    void (async () => {
      const method = (request.method ?? "GET").toUpperCase();
      const rawUrl = request.url ?? "/";
      const qIndex = rawUrl.indexOf("?");
      const rawPathname = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);

      if (method === "GET" && rawPathname === "/_double/state") {
        const state: S3DoubleState = {
          ok: true,
          objectCount: objects.size,
          keys: [...objects.keys()],
          requestCount: requests.length,
          queuedCount: pending.length,
        };
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(state));
        return;
      }

      if (method === "POST" && rawPathname === "/_double/reset") {
        reset();
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      const body = await readRawBody(request);
      const queued = pending.shift();
      const answer =
        queued ??
        verifySigV4(method, rawUrl, request.headers, body, sigConfig) ??
        handleS3(method, rawPathname, request.headers, body);

      requests.push({
        method,
        path: rawUrl,
        headers: request.headers,
        body,
        answeredStatus: answer.destroy === true ? 0 : answer.status,
        errorCode: answer.errorCode ?? null,
      });

      const send = () => {
        if (answer.destroy === true) {
          request.socket.destroy();
          return;
        }
        response.writeHead(answer.status, answer.headers ?? {});
        if (answer.body === undefined || answer.status === 204) {
          response.end();
          return;
        }
        response.end(
          typeof answer.body === "string"
            ? answer.body
            : Buffer.from(answer.body),
        );
      };

      const delay =
        answer.delayMs ?? (queued === undefined ? defaultDelayMs : 0);
      if (delay > 0) {
        setTimeout(send, delay);
      } else {
        send();
      }
    })();
  });

  await new Promise<void>((resolve) => {
    server.listen(port, S3_DOUBLE_HOST, resolve);
  });
  const { port: bound } = server.address() as AddressInfo;

  return {
    endpoint: `http://${S3_DOUBLE_HOST}:${bound}`,
    port: bound,
    objects,
    requests,
    queue(...answers) {
      pending.push(...answers);
    },
    setDefaultDelay(delayMs) {
      defaultDelayMs = delayMs;
    },
    reset,
    close() {
      return new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}

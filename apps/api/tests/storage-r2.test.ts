// R2B-T1 (docs/mvp/jalons/r2b/annexe.md, 23-migration-cloudflare-r2.md RG6-RG9, RG15, RG22):
// Unit proof of the native S3 SigV4 adapter in src/platform/storage.ts:
// - Official AWS SigV4 test vectors matched character-for-character.
// - PUT / GET / DELETE across all three buckets against startS3Double().
// - isObjectKey checked before URL construction or network call (T9.3, T9.9).
// - If-None-Match: "*" -> 412 PreconditionFailed (RG8).
// - Stream-bounded read() per bucket with Content-Length, lying Content-Length, and chunked stream (RG9).
// - Error XML <Code> extraction capped at 8,192 bytes and zero secret/key/URL leakage (D60).
import { valuesFoundIn } from "@influx/test-kit/logs";
import {
  S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
  S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
  startS3Double,
  type S3Double,
} from "@influx/test-kit/s3-double";
import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { R2Config } from "../src/config/schema.ts";
import { createLogger } from "../src/platform/logger.ts";
import {
  createObjectStore,
  extractS3ErrorCode,
  isObjectKey,
  signAwsSigV4,
  STORAGE_BUCKETS,
  STORAGE_ERROR_BODY_MAX_BYTES,
  STORAGE_READ_MAX_BYTES,
  STORAGE_USER_AGENT,
  type StorageBucket,
} from "../src/platform/storage.ts";
import { captureLogs } from "./helpers.ts";

const doubles: S3Double[] = [];
const httpServers: Server[] = [];

async function openDouble(bucketPrefix = "test-"): Promise<{
  double: S3Double;
  config: R2Config;
}> {
  const double = await startS3Double();
  doubles.push(double);
  return {
    double,
    config: {
      endpoint: double.endpoint,
      accessKeyId: S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
      secretAccessKey: S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
      bucketPrefix,
    },
  };
}

function validKey(bucket: StorageBucket): string {
  const a = randomUUID();
  const b = randomUUID();
  const c = randomUUID();
  return bucket === "verification-evidence"
    ? `${a}/${b}/${c}.webp`
    : `${a}/${b}.webp`;
}

afterEach(async () => {
  await Promise.all([
    ...doubles.splice(0).map((double) => double.close()),
    ...httpServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  ]);
});

describe("R2B-T1: AWS SigV4 signer (official vectors)", () => {
  it("matches the official AWS S3 GET Object SigV4 test vector character-for-character", () => {
    const emptySha256 =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const result = signAwsSigV4({
      method: "GET",
      url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
      headers: {
        Host: "examplebucket.s3.amazonaws.com",
        Range: "bytes=0-9",
        "x-amz-content-sha256": emptySha256,
        "x-amz-date": "20130524T000000Z",
      },
      payloadSha256: emptySha256,
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      amzDate: "20130524T000000Z",
      region: "us-east-1",
      service: "s3",
    });

    expect(result.canonicalRequest).toBe(
      [
        "GET",
        "/test.txt",
        "",
        "host:examplebucket.s3.amazonaws.com",
        "range:bytes=0-9",
        `x-amz-content-sha256:${emptySha256}`,
        "x-amz-date:20130524T000000Z",
        "",
        "host;range;x-amz-content-sha256;x-amz-date",
        emptySha256,
      ].join("\n"),
    );
    expect(result.stringToSign).toBe(
      [
        "AWS4-HMAC-SHA256",
        "20130524T000000Z",
        "20130524/us-east-1/s3/aws4_request",
        "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972",
      ].join("\n"),
    );
    expect(result.signature).toBe(
      "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(result.authorizationHeader).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });

  it("matches the official AWS SigV4 test-suite get-vanilla vector character-for-character", () => {
    const emptySha256 =
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const result = signAwsSigV4({
      method: "GET",
      url: new URL("https://example.amazonaws.com/"),
      headers: {
        Host: "example.amazonaws.com",
        "X-Amz-Date": "20150830T123600Z",
      },
      payloadSha256: emptySha256,
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      amzDate: "20150830T123600Z",
      region: "us-east-1",
      service: "service",
    });

    expect(result.canonicalRequest).toBe(
      [
        "GET",
        "/",
        "",
        "host:example.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        emptySha256,
      ].join("\n"),
    );
    expect(result.signature).toBe(
      "5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
    expect(result.authorizationHeader).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });
});

describe("R2B-T1: ObjectStore against startS3Double()", () => {
  it("writes, reads and removes WebP objects across all three buckets", async () => {
    const { double, config } = await openDouble("r2b-");
    const store = createObjectStore(config);
    const bytes = new Uint8Array(
      Buffer.from("RIFF\x0c\x00\x00\x00WEBPVP8 ", "latin1"),
    );

    for (const bucket of STORAGE_BUCKETS) {
      const key = validKey(bucket);
      expect(await store.write(bucket, key, bytes, "image/webp")).toEqual({
        ok: true,
        value: null,
      });
      expect(double.objects.has(`r2b-${bucket}/${key}`)).toBe(true);

      const read = await store.read(bucket, key);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value).toEqual(bytes);
      }

      expect(await store.remove(bucket, key)).toEqual({
        ok: true,
        value: null,
      });
      expect(double.objects.has(`r2b-${bucket}/${key}`)).toBe(false);
    }
  });

  it("sends path-style URLs, fixed User-Agent, real SHA-256, If-None-Match '*' and exact SigV4 headers", async () => {
    const { double, config } = await openDouble("unit-");
    const store = createObjectStore(config);
    const key = validKey("brand-logo");
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02]);
    const digest = createHash("sha256").update(bytes).digest("hex");

    await store.write("brand-logo", key, bytes, "image/webp");
    await store.read("brand-logo", key);
    await store.remove("brand-logo", key);

    expect(double.requests).toHaveLength(3);
    const [putReq, getReq, delReq] = double.requests;
    expect(putReq?.method).toBe("PUT");
    expect(putReq?.path).toBe(`/unit-brand-logo/${key}`);
    expect(putReq?.headers["user-agent"]).toBe(STORAGE_USER_AGENT);
    expect(putReq?.headers["content-type"]).toBe("image/webp");
    expect(putReq?.headers["if-none-match"]).toBe("*");
    expect(putReq?.headers["x-amz-content-sha256"]).toBe(digest);
    expect(putReq?.headers["x-amz-content-sha256"]).not.toBe(
      "UNSIGNED-PAYLOAD",
    );
    expect(putReq?.headers.authorization).toContain(
      "/auto/s3/aws4_request, SignedHeaders=content-type;host;if-none-match;x-amz-content-sha256;x-amz-date,",
    );

    for (const [req, method] of [
      [getReq, "GET"],
      [delReq, "DELETE"],
    ] as const) {
      expect(req?.method).toBe(method);
      expect(req?.path).toBe(`/unit-brand-logo/${key}`);
      expect(req?.headers["user-agent"]).toBe(STORAGE_USER_AGENT);
      expect(req?.headers["x-amz-content-sha256"]).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
      expect(req?.headers.authorization).toContain(
        "/auto/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date,",
      );
    }
  });

  it("refuses invalid keys before URL construction or any network call (T9.3, T9.9)", async () => {
    const { double, config } = await openDouble();
    const store = createObjectStore(config);
    const logoKey = validKey("brand-logo");
    const evidenceKey = validKey("verification-evidence");
    const badKeys: [StorageBucket, string][] = [
      ["brand-logo", "../etc/passwd"],
      ["brand-logo", logoKey.toUpperCase()],
      ["brand-logo", `${randomUUID()}/${randomUUID()}.png`],
      ["brand-logo", evidenceKey],
      ["verification-evidence", logoKey],
      ["portfolio", `${randomUUID()}/${randomUUID()}/${randomUUID()}.webp`],
    ];

    for (const [bucket, key] of badKeys) {
      expect(isObjectKey(bucket, key)).toBe(false);
      expect(
        await store.write(bucket, key, new Uint8Array([1]), "image/webp"),
      ).toEqual({
        ok: false,
        reason: "rejected",
        status: null,
        errorCode: "invalid_key",
      });
      expect(await store.read(bucket, key)).toEqual({
        ok: false,
        reason: "rejected",
        status: null,
        errorCode: "invalid_key",
      });
      expect(await store.remove(bucket, key)).toEqual({
        ok: false,
        reason: "rejected",
        status: null,
        errorCode: "invalid_key",
      });
    }
    expect(double.requests).toEqual([]);
  });

  it("refuses overwriting an existing object with 412 PreconditionFailed (If-None-Match: '*')", async () => {
    const { double, config } = await openDouble();
    const store = createObjectStore(config);
    const key = validKey("portfolio");
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([4, 5, 6]);

    expect(await store.write("portfolio", key, first, "image/webp")).toEqual({
      ok: true,
      value: null,
    });
    expect(await store.write("portfolio", key, second, "image/webp")).toEqual({
      ok: false,
      reason: "rejected",
      status: 412,
      errorCode: "PreconditionFailed",
    });
    expect(double.objects.get(`test-portfolio/${key}`)?.body).toEqual(first);
  });

  it("returns null on read() when the object is missing (404 NoSuchKey or bare 404)", async () => {
    const { double, config } = await openDouble();
    const store = createObjectStore(config);
    const key = validKey("brand-logo");

    expect(await store.read("brand-logo", key)).toEqual({
      ok: true,
      value: null,
    });
    double.queue({ status: 404 });
    expect(await store.read("brand-logo", key)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("treats remove() of a missing object as idempotent success (204 and 404 NoSuchKey)", async () => {
    const { double, config } = await openDouble();
    const store = createObjectStore(config);
    const key = validKey("verification-evidence");

    expect(await store.remove("verification-evidence", key)).toEqual({
      ok: true,
      value: null,
    });
    double.queue({
      status: 404,
      headers: { "content-type": "application/xml" },
      body: "<Error><Code>NoSuchKey</Code><Message>Missing</Message></Error>",
    });
    expect(await store.remove("verification-evidence", key)).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe("R2B-T1: Stream bounds, failures and D60 error reduction", () => {
  it("accepts objects up to the exact bucket byte limit (1 MiB logo, 8 MiB portfolio)", async () => {
    const { config } = await openDouble();
    const store = createObjectStore(config);

    for (const bucket of ["brand-logo", "portfolio"] as const) {
      const key = validKey(bucket);
      const exact = new Uint8Array(STORAGE_READ_MAX_BYTES[bucket]);
      exact[0] = 0x52;
      exact[exact.length - 1] = 0x45;
      expect(await store.write(bucket, key, exact, "image/webp")).toEqual({
        ok: true,
        value: null,
      });
      const read = await store.read(bucket, key);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value?.byteLength).toBe(STORAGE_READ_MAX_BYTES[bucket]);
      }
    }
  });

  it("cancels read() immediately when Content-Length exceeds STORAGE_READ_MAX_BYTES without consuming chunks", async () => {
    let pulled = 0;
    let cancelled = false;
    const store = createObjectStore(
      {
        endpoint: "http://127.0.0.1:4999",
        accessKeyId: "ak",
        secretAccessKey: "sk-01234567890123456789012345678901",
        bucketPrefix: "test-",
      },
      {
        fetch: async () =>
          new Response(
            new ReadableStream<Uint8Array>(
              {
                pull(controller) {
                  pulled += 1;
                  controller.enqueue(new Uint8Array(64));
                },
                cancel() {
                  cancelled = true;
                },
              },
              new CountQueuingStrategy({ highWaterMark: 0 }),
            ),
            {
              status: 200,
              headers: {
                "content-length": String(
                  STORAGE_READ_MAX_BYTES["brand-logo"] + 1,
                ),
              },
            },
          ),
      },
    );

    const outcome = await store.read("brand-logo", validKey("brand-logo"));
    expect(outcome).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });
    expect(cancelled).toBe(true);
    expect(pulled).toBe(0);
  });

  it("cancels chunked or lying streams immediately once received bytes exceed 1 MiB or 8 MiB", async () => {
    let bytesSent = 0;
    let streamClosedEarly = false;

    const server = createServer((_req, res) => {
      bytesSent = 0;
      streamClosedEarly = false;
      const chunk = Buffer.alloc(262_144, 0x41);
      res.writeHead(200, { "content-type": "image/webp" });
      let sentChunks = 0;
      const timer = setInterval(() => {
        if (res.destroyed || res.closed) {
          clearInterval(timer);
          return;
        }
        bytesSent += chunk.byteLength;
        sentChunks += 1;
        res.write(chunk);
        if (sentChunks >= 40) {
          clearInterval(timer);
          res.end();
        }
      }, 2);
      res.on("close", () => {
        clearInterval(timer);
        if (bytesSent < 40 * chunk.byteLength) {
          streamClosedEarly = true;
        }
      });
    });
    httpServers.push(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const { port } = server.address() as AddressInfo;

    const store = createObjectStore({
      endpoint: `http://127.0.0.1:${port}`,
      accessKeyId: "ak",
      secretAccessKey: "sk-01234567890123456789012345678901",
      bucketPrefix: "test-",
    });

    // Chunked HTTP stream without Content-Length exceeding 1 MiB (brand-logo)
    expect(await store.read("brand-logo", validKey("brand-logo"))).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(streamClosedEarly).toBe(true);
    expect(bytesSent).toBeLessThan(STORAGE_READ_MAX_BYTES["brand-logo"] * 2);

    // Chunked HTTP stream without Content-Length exceeding 8 MiB (verification-evidence)
    expect(
      await store.read(
        "verification-evidence",
        validKey("verification-evidence"),
      ),
    ).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(streamClosedEarly).toBe(true);
    expect(bytesSent).toBeLessThan(40 * 262_144);

    // Stream with a smaller lying Content-Length exceeding 8 MiB (portfolio)
    let cancelled = false;
    let pushedBytes = 0;
    const lyingStore = createObjectStore(
      {
        endpoint: "http://127.0.0.1:4999",
        accessKeyId: "ak",
        secretAccessKey: "sk-01234567890123456789012345678901",
        bucketPrefix: "test-",
      },
      {
        fetch: async () =>
          new Response(
            new ReadableStream<Uint8Array>(
              {
                pull(controller) {
                  const chunk = new Uint8Array(1_048_576);
                  pushedBytes += chunk.byteLength;
                  controller.enqueue(chunk);
                },
                cancel() {
                  cancelled = true;
                },
              },
              new CountQueuingStrategy({ highWaterMark: 0 }),
            ),
            {
              status: 200,
              headers: { "content-length": "524288" },
            },
          ),
      },
    );
    expect(await lyingStore.read("portfolio", validKey("portfolio"))).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });
    expect(cancelled).toBe(true);
    expect(pushedBytes).toBe(STORAGE_READ_MAX_BYTES.portfolio + 1_048_576);
  });

  it("maps 403 AccessDenied to rejected and 500/503 to unavailable across write, read and remove", async () => {
    const { double, config } = await openDouble();
    const store = createObjectStore(config);
    const key = validKey("brand-logo");

    double.queue(
      {
        status: 403,
        headers: { "content-type": "application/xml" },
        body: "<Error><Code>AccessDenied</Code><Message>Denied</Message></Error>",
      },
      {
        status: 503,
        headers: { "content-type": "application/xml" },
        body: "<Error><Code>SlowDown</Code><Message>Retry</Message></Error>",
      },
      {
        status: 500,
        headers: { "content-type": "application/xml" },
        body: "<Error><Code>InternalError</Code><Message>Boom</Message></Error>",
      },
    );

    expect(
      await store.write("brand-logo", key, new Uint8Array([1]), "image/webp"),
    ).toEqual({
      ok: false,
      reason: "rejected",
      status: 403,
      errorCode: "AccessDenied",
    });
    expect(await store.read("brand-logo", key)).toEqual({
      ok: false,
      reason: "unavailable",
      status: 503,
      errorCode: "SlowDown",
    });
    expect(await store.remove("brand-logo", key)).toEqual({
      ok: false,
      reason: "unavailable",
      status: 500,
      errorCode: "InternalError",
    });
  });

  it("returns unavailable (null, null) on destroyed socket and fetch timeout/abort", async () => {
    const { double, config } = await openDouble();
    const store = createObjectStore(config);
    const key = validKey("portfolio");

    double.queue({ status: 200, destroy: true });
    expect(await store.read("portfolio", key)).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });

    const timedOutStore = createObjectStore(config, {
      fetch: async () => {
        throw new DOMException("Timed out", "TimeoutError");
      },
    });
    expect(
      await timedOutStore.write(
        "portfolio",
        key,
        new Uint8Array([1]),
        "image/webp",
      ),
    ).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });
  });

  it("never follows redirects (3xx answers unavailable)", async () => {
    let seenRedirectMode: RequestInit["redirect"] | undefined;
    const store = createObjectStore(
      {
        endpoint: "http://127.0.0.1:4999",
        accessKeyId: "ak",
        secretAccessKey: "sk-01234567890123456789012345678901",
        bucketPrefix: "test-",
      },
      {
        fetch: async (_input, init) => {
          seenRedirectMode = init?.redirect;
          return new Response(null, {
            status: 302,
            headers: { location: "https://evil.example/steal" },
          });
        },
      },
    );

    expect(await store.read("brand-logo", validKey("brand-logo"))).toEqual({
      ok: false,
      reason: "unavailable",
      status: null,
      errorCode: null,
    });
    expect(seenRedirectMode).toBe("manual");
  });

  it("caps error XML reads at 8,192 bytes and keeps only <Code>([A-Za-z0-9_]{1,64})</Code>", async () => {
    expect(
      extractS3ErrorCode("<Error><Code>PreconditionFailed</Code></Error>"),
    ).toBe("PreconditionFailed");
    expect(
      extractS3ErrorCode("<Error><Code>Bad Code!</Code></Error>"),
    ).toBeNull();
    expect(
      extractS3ErrorCode(`<Error><Code>${"A".repeat(65)}</Code></Error>`),
    ).toBeNull();

    let cancelled = false;
    const store = createObjectStore(
      {
        endpoint: "http://127.0.0.1:4999",
        accessKeyId: "ak",
        secretAccessKey: "sk-01234567890123456789012345678901",
        bucketPrefix: "test-",
      },
      {
        fetch: async () => {
          const padding = "x".repeat(STORAGE_ERROR_BODY_MAX_BYTES + 100);
          const payload = Buffer.from(
            `<Error><Message>${padding}</Message><Code>LateCode</Code></Error>`,
            "utf8",
          );
          let sent = false;
          return new Response(
            new ReadableStream<Uint8Array>({
              pull(controller) {
                if (!sent) {
                  sent = true;
                  controller.enqueue(payload);
                } else {
                  controller.enqueue(new Uint8Array(4096));
                }
              },
              cancel() {
                cancelled = true;
              },
            }),
            { status: 500 },
          );
        },
      },
    );

    expect(await store.read("brand-logo", validKey("brand-logo"))).toEqual({
      ok: false,
      reason: "unavailable",
      status: 500,
      errorCode: null,
    });
    expect(cancelled).toBe(true);
  });

  it("never leaks secrets, credentials, endpoints, keys or S3 XML <Message>/<Key> into outcomes or logs (D60)", async () => {
    const { double, config } = await openDouble("secret-prefix-");
    const store = createObjectStore(config);
    const key = validKey("verification-evidence");
    const secretMessage = "secret-s3-xml-message-never-logged";
    const secretRequestId = "req-id-never-returned-12345";

    double.queue(
      {
        status: 403,
        headers: { "content-type": "application/xml" },
        body: `<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>${secretMessage}</Message><Key>${key}</Key><RequestId>${secretRequestId}</RequestId></Error>`,
      },
      {
        status: 500,
        headers: { "content-type": "application/xml" },
        body: `<?xml version="1.0"?><Error><Code>InternalError</Code><Message>${secretMessage}</Message><Key>${key}</Key><RequestId>${secretRequestId}</RequestId></Error>`,
      },
    );

    const logs = captureLogs();
    const logger = createLogger(
      { service: "api", environment: "development", version: "test" },
      logs.destination,
    );

    const outcomes = [
      await store.write(
        "verification-evidence",
        key,
        new Uint8Array([1, 2]),
        "image/webp",
      ),
      await store.read("verification-evidence", key),
    ];
    for (const outcome of outcomes) {
      if (!outcome.ok) {
        logger.error(
          {
            reason: outcome.reason,
            status: outcome.status,
            errorCode: outcome.errorCode,
          },
          "storage operation failed",
        );
      }
    }

    const haystack = `${JSON.stringify(outcomes)}\n${logs.text()}`;
    expect(
      valuesFoundIn(haystack, [
        config.endpoint,
        config.accessKeyId,
        config.secretAccessKey,
        config.bucketPrefix,
        key,
        secretMessage,
        secretRequestId,
      ]),
    ).toEqual([]);
  });
});

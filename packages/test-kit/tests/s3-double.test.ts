// R2A-T1 (docs/mvp/jalons/r2a/annexe.md, CA12): local S3 SigV4 double checks.
import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
  S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
  S3_DOUBLE_HOST,
  startS3Double,
  type S3Double,
} from "../src/s3-double.ts";

let s3: S3Double;

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Uint8Array | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function signRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  service?: string;
  amzDate?: string;
}): Record<string, string> {
  const parsed = new URL(options.url);
  const bodyBytes =
    options.body === undefined
      ? new Uint8Array(0)
      : typeof options.body === "string"
        ? Buffer.from(options.body, "utf8")
        : options.body;
  const payloadHash = sha256Hex(bodyBytes);
  const amzDate = options.amzDate ?? "20261126T120000Z";
  const dateStamp = amzDate.slice(0, 8);
  const region = options.region ?? "auto";
  const service = options.service ?? "s3";
  const accessKeyId = options.accessKeyId ?? S3_DOUBLE_DEFAULT_ACCESS_KEY_ID;
  const secretAccessKey =
    options.secretAccessKey ?? S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY;

  const allHeaders: Record<string, string> = {
    host: parsed.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  for (const [k, v] of Object.entries(options.headers ?? {})) {
    allHeaders[k.toLowerCase()] = v.trim();
  }

  const signedHeaderNames = Object.keys(allHeaders).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${allHeaders[name]}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    options.method.toUpperCase(),
    parsed.pathname,
    parsed.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    ...allHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

beforeEach(async () => {
  s3 = await startS3Double();
});

afterEach(async () => {
  await s3.close();
});

describe("R2A-T1: startS3Double (CA12)", () => {
  it("binds exclusively on 127.0.0.1 loopback", () => {
    expect(S3_DOUBLE_HOST).toBe("127.0.0.1");
    expect(s3.endpoint).toBe(`http://127.0.0.1:${s3.port}`);
    expect(s3.port).toBeGreaterThan(0);
  });

  it("rejects missing Authorization with 403 SignatureDoesNotMatch XML", async () => {
    const response = await fetch(`${s3.endpoint}/test-brand-logo/a/b.webp`, {
      method: "GET",
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      "<Code>SignatureDoesNotMatch</Code>",
    );
  });

  it("rejects UNSIGNED-PAYLOAD and altered x-amz-content-sha256 with 403 SignatureDoesNotMatch", async () => {
    const url = `${s3.endpoint}/test-brand-logo/a/b.webp`;
    const body = new Uint8Array([1, 2, 3, 4]);
    const headers = signRequest({
      method: "PUT",
      url,
      headers: { "content-type": "image/webp" },
      body,
    });

    const unsignedRes = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "x-amz-content-sha256": "UNSIGNED-PAYLOAD" },
      body,
    });
    expect(unsignedRes.status).toBe(403);
    expect(await unsignedRes.text()).toContain(
      "<Code>SignatureDoesNotMatch</Code>",
    );

    const tamperedBodyRes = await fetch(url, {
      method: "PUT",
      headers,
      body: new Uint8Array([1, 2, 3, 99]),
    });
    expect(tamperedBodyRes.status).toBe(403);
    expect(await tamperedBodyRes.text()).toContain(
      "<Code>SignatureDoesNotMatch</Code>",
    );
  });

  it("rejects an altered Authorization signature or wrong credential scope", async () => {
    const url = `${s3.endpoint}/test-brand-logo/a/b.webp`;
    const headers = signRequest({ method: "GET", url });
    const flippedSig = (headers.authorization ?? "").replace(
      /Signature=([0-9a-f])/,
      (_, first: string) => `Signature=${first === "a" ? "b" : "a"}`,
    );
    const badSigRes = await fetch(url, {
      method: "GET",
      headers: { ...headers, authorization: flippedSig },
    });
    expect(badSigRes.status).toBe(403);
    expect(await badSigRes.text()).toContain(
      "<Code>SignatureDoesNotMatch</Code>",
    );

    const wrongRegionHeaders = signRequest({
      method: "GET",
      url,
      region: "us-east-1",
    });
    const wrongRegionRes = await fetch(url, {
      method: "GET",
      headers: wrongRegionHeaders,
    });
    expect(wrongRegionRes.status).toBe(403);
  });

  it("verifies an independently computed AWS4-HMAC-SHA256 vector for region auto and service s3", async () => {
    // Fixed timestamp, path, headers, and payload verified against the AWS SigV4 derivation.
    const url = `${s3.endpoint}/test-portfolio/u1/v1.webp`;
    const body = Buffer.from("RIFF\x00\x00\x00\x00WEBP", "latin1");
    const amzDate = "20261126T000000Z";
    const payloadHash = sha256Hex(body);
    const canonicalRequest = [
      "PUT",
      "/test-portfolio/u1/v1.webp",
      "",
      `content-type:image/webp\nhost:127.0.0.1:${s3.port}\nif-none-match:*\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
      "content-type;host;if-none-match;x-amz-content-sha256;x-amz-date",
      payloadHash,
    ].join("\n");
    const scope = "20261126/auto/s3/aws4_request";
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join("\n");
    const kSigning = hmac(
      hmac(
        hmac(
          hmac(`AWS4${S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY}`, "20261126"),
          "auto",
        ),
        "s3",
      ),
      "aws4_request",
    );
    const sig = createHmac("sha256", kSigning)
      .update(stringToSign, "utf8")
      .digest("hex");

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "content-type": "image/webp",
        "if-none-match": "*",
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        authorization: `AWS4-HMAC-SHA256 Credential=${S3_DOUBLE_DEFAULT_ACCESS_KEY_ID}/${scope}, SignedHeaders=content-type;host;if-none-match;x-amz-content-sha256;x-amz-date, Signature=${sig}`,
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  it("PUT stores bytes and GET returns 200 with exact bytes and Content-Type", async () => {
    const url = `${s3.endpoint}/e2e-brand-logo/acc-1/logo-1.webp`;
    const payload = new Uint8Array([82, 73, 70, 70, 12, 34, 56, 78]);
    const putRes = await fetch(url, {
      method: "PUT",
      headers: signRequest({
        method: "PUT",
        url,
        headers: { "content-type": "image/webp" },
        body: payload,
      }),
      body: payload,
    });
    expect(putRes.status).toBe(200);
    expect(putRes.headers.get("etag")).toMatch(/^"[0-9a-f]{32}"$/);

    const getRes = await fetch(url, {
      method: "GET",
      headers: signRequest({ method: "GET", url }),
    });
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("content-type")).toBe("image/webp");
    expect(new Uint8Array(await getRes.arrayBuffer())).toEqual(payload);
  });

  it("PUT with If-None-Match: * returns 412 PreconditionFailed when key exists without overwriting", async () => {
    const url = `${s3.endpoint}/e2e-brand-logo/acc-1/logo-2.webp`;
    const first = new Uint8Array([1, 2, 3]);
    const second = new Uint8Array([9, 8, 7]);

    const firstRes = await fetch(url, {
      method: "PUT",
      headers: signRequest({
        method: "PUT",
        url,
        headers: { "content-type": "image/webp", "if-none-match": "*" },
        body: first,
      }),
      body: first,
    });
    expect(firstRes.status).toBe(200);

    const duplicateRes = await fetch(url, {
      method: "PUT",
      headers: signRequest({
        method: "PUT",
        url,
        headers: { "content-type": "image/webp", "if-none-match": "*" },
        body: second,
      }),
      body: second,
    });
    expect(duplicateRes.status).toBe(412);
    expect(await duplicateRes.text()).toContain(
      "<Code>PreconditionFailed</Code>",
    );

    const getRes = await fetch(url, {
      method: "GET",
      headers: signRequest({ method: "GET", url }),
    });
    expect(new Uint8Array(await getRes.arrayBuffer())).toEqual(first);
  });

  it("GET on an absent key returns 404 NoSuchKey XML", async () => {
    const url = `${s3.endpoint}/e2e-portfolio/missing/key.webp`;
    const res = await fetch(url, {
      method: "GET",
      headers: signRequest({ method: "GET", url }),
    });
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toBe("application/xml");
    expect(await res.text()).toContain("<Code>NoSuchKey</Code>");
  });

  it("DELETE removes an existing object (204) and is idempotent on absent keys", async () => {
    const url = `${s3.endpoint}/e2e-verification-evidence/a/b/c.webp`;
    const body = new Uint8Array([42]);
    await fetch(url, {
      method: "PUT",
      headers: signRequest({
        method: "PUT",
        url,
        headers: { "content-type": "image/webp" },
        body,
      }),
      body,
    });

    const del1 = await fetch(url, {
      method: "DELETE",
      headers: signRequest({ method: "DELETE", url }),
    });
    expect(del1.status).toBe(204);

    const afterGet = await fetch(url, {
      method: "GET",
      headers: signRequest({ method: "GET", url }),
    });
    expect(afterGet.status).toBe(404);

    const del2 = await fetch(url, {
      method: "DELETE",
      headers: signRequest({ method: "DELETE", url }),
    });
    expect(del2.status).toBe(204);
  });

  it("exposes /_double/state without SigV4 and without recording itself in requests", async () => {
    const url = `${s3.endpoint}/e2e-brand-logo/a/state.webp`;
    const body = new Uint8Array([5, 6]);
    await fetch(url, {
      method: "PUT",
      headers: signRequest({
        method: "PUT",
        url,
        headers: { "content-type": "image/webp" },
        body,
      }),
      body,
    });

    const stateRes = await fetch(`${s3.endpoint}/_double/state`);
    expect(stateRes.status).toBe(200);
    expect(await stateRes.json()).toEqual({
      ok: true,
      objectCount: 1,
      keys: ["e2e-brand-logo/a/state.webp"],
      requestCount: 1,
      queuedCount: 0,
    });
    expect(s3.requests).toHaveLength(1);
  });

  it("clears stored objects, requests, and queued answers on POST /_double/reset", async () => {
    const url = `${s3.endpoint}/e2e-brand-logo/a/reset.webp`;
    const body = new Uint8Array([7, 8]);
    await fetch(url, {
      method: "PUT",
      headers: signRequest({
        method: "PUT",
        url,
        headers: { "content-type": "image/webp" },
        body,
      }),
      body,
    });
    s3.queue({ status: 503 });

    const resetRes = await fetch(`${s3.endpoint}/_double/reset`, {
      method: "POST",
    });
    expect(resetRes.status).toBe(200);

    const stateRes = await fetch(`${s3.endpoint}/_double/state`);
    expect(await stateRes.json()).toEqual({
      ok: true,
      objectCount: 0,
      keys: [],
      requestCount: 0,
      queuedCount: 0,
    });
  });

  it("injects faults and transport failures in FIFO order via queue()", async () => {
    const url = `${s3.endpoint}/e2e-brand-logo/a/fault.webp`;
    s3.queue(
      {
        status: 503,
        headers: { "content-type": "application/xml" },
        body: "<Error><Code>InternalError</Code><Message>boom</Message></Error>",
        errorCode: "InternalError",
      },
      { status: 500, destroy: true },
    );

    const res1 = await fetch(url, {
      method: "GET",
      headers: signRequest({ method: "GET", url }),
    });
    expect(res1.status).toBe(503);
    expect(await res1.text()).toContain("<Code>InternalError</Code>");

    await expect(
      fetch(url, {
        method: "GET",
        headers: signRequest({ method: "GET", url }),
      }),
    ).rejects.toThrow();
    expect(s3.requests[1]?.answeredStatus).toBe(0);

    const res3 = await fetch(url, {
      method: "GET",
      headers: signRequest({ method: "GET", url }),
    });
    expect(res3.status).toBe(404);
  });
});

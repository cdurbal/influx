// The browser client of the relay (docs/mvp/02 §9.3; jalons/l2b, commit 12): what it sends and
// how it reads an answer, against a stubbed fetch. The JSON calls keep their shape; a Blob (the
// raw bytes of the logo, D80) leaves as is, as `application/octet-stream`, never stringified.
import { afterEach, describe, expect, it, vi } from "vitest";
import { callRelay } from "@influx/web-platform/relay-client";

type Sent = { url: string; init: RequestInit };

const anySchema = {
  safeParse: (value: unknown) =>
    typeof value === "object" && value !== null && "ok" in value
      ? { success: true as const, data: value }
      : { success: false as const },
};

function stubFetch(
  status: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): Sent[] {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      sent.push({ url, init });
      return Promise.resolve(
        new Response(JSON.stringify(payload), {
          status,
          headers: { "content-type": "application/json", ...extraHeaders },
        }),
      );
    }),
  );
  return sent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("callRelay body", () => {
  it("sends a JSON object stringified, as application/json (unchanged)", async () => {
    const sent = stubFetch(200, { ok: true });
    const result = await callRelay("PATCH", "/v1/me/brand-profile", anySchema, {
      website: "exemple.com",
    });
    expect(result.kind).toBe("ok");
    expect(sent[0]?.init.body).toBe('{"website":"exemple.com"}');
    expect(sent[0]?.init.headers).toEqual({
      "content-type": "application/json",
    });
  });

  it("sends a Blob as is, as application/octet-stream, whatever its own type", async () => {
    const sent = stubFetch(200, { ok: true });
    const bytes = new Blob([new Uint8Array([1, 2, 3, 255])], {
      type: "image/jpeg",
    });
    const result = await callRelay(
      "PUT",
      "/v1/me/brand-profile/logo",
      anySchema,
      bytes,
    );
    expect(result.kind).toBe("ok");
    expect(sent[0]?.init.body).toBe(bytes);
    expect(sent[0]?.init.headers).toEqual({
      "content-type": "application/octet-stream",
    });
    expect(sent[0]?.init.method).toBe("PUT");
    expect(sent[0]?.init.credentials).toBe("same-origin");
  });

  it("sends no header and no body when there is none", async () => {
    const sent = stubFetch(200, { ok: true });
    await callRelay("GET", "/v1/me/brand-profile/logo", anySchema);
    expect(sent[0]?.init.headers).toBeUndefined();
    expect(sent[0]?.init.body).toBeUndefined();
  });

  it("refuses a Blob on a method without a body", async () => {
    stubFetch(200, { ok: true });
    await expect(
      callRelay("DELETE", "/v1/me/brand-profile/logo", anySchema, new Blob([])),
    ).rejects.toThrow("relay body on a method without one");
  });
});

describe("callRelay answers", () => {
  it("hands over the code and the issues of an error envelope", async () => {
    stubFetch(422, {
      error: {
        code: "image_rejected",
        message: "The image is refused",
        details: [{ path: "logo", issue: "too_small" }],
      },
    });
    const result = await callRelay(
      "PUT",
      "/v1/me/brand-profile/logo",
      anySchema,
      new Blob([new Uint8Array([1])]),
    );
    expect(result).toEqual({
      kind: "failed",
      code: "image_rejected",
      issues: ["too_small"],
    });
  });

  it("hands over the delay of Retry-After, whole seconds only (L2E 18, 08 RG60)", async () => {
    const envelope = {
      error: {
        code: "conflict",
        details: [{ path: "request", issue: "retry_after" }],
      },
    };
    stubFetch(409, envelope, { "retry-after": "3600" });
    expect(
      await callRelay("POST", "/v1/me/verification/requests", anySchema),
    ).toEqual({
      kind: "failed",
      code: "conflict",
      issues: ["retry_after"],
      retryAfterSeconds: 3600,
    });
    // a date, a negative or a huge number, an empty header: no delay is invented
    for (const header of [
      "Wed, 21 Oct 2026 07:28:00 GMT",
      "-5",
      "99999999999",
      "",
    ]) {
      stubFetch(409, envelope, { "retry-after": header });
      const result = await callRelay(
        "POST",
        "/v1/me/verification/requests",
        anySchema,
      );
      expect(result, header).toEqual({
        kind: "failed",
        code: "conflict",
        issues: ["retry_after"],
      });
    }
  });

  it("reports a 401 as unauthenticated and a network failure as failed", async () => {
    stubFetch(401, { error: { code: "unauthenticated" } });
    expect((await callRelay("GET", "/v1/me", anySchema)).kind).toBe(
      "unauthenticated",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network"))),
    );
    expect(await callRelay("GET", "/v1/me", anySchema)).toEqual({
      kind: "failed",
    });
  });
});

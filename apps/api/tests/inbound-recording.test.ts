// The `inbound` mode of the manual trial (J7 commit 10; 16 §M6 RG146; D62): the throwaway
// receiver of Brevo's webhook bodies, under the conditions of expert-cybersecurite (blocking).
// Real sockets on the loopback, an ephemeral port; short timers, no Brevo.
import { request } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertInboundHost,
  INBOUND_HOST,
  parseInboundArguments,
  startInboundRecorder,
  type InboundRecord,
  type InboundRecorder,
} from "../scripts/inbound-recording.ts";

type Answer = {
  status: number;
  body: string;
  headers: Record<string, unknown>;
};

/** One call; resolves on the answer, whatever happens to the rest of the upload. */
function call(
  port: number,
  options: {
    method?: string;
    path: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
    /** The upload is left open: the answer must come before the end of the body. */
    holdOpen?: boolean;
  },
): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      {
        host: INBOUND_HOST,
        port,
        method: options.method ?? "POST",
        path: options.path,
        headers: options.headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
          });
          outgoing.destroy();
        });
      },
    );
    outgoing.on("error", reject);
    if (options.holdOpen === true) {
      outgoing.flushHeaders();
      if (options.body !== undefined) {
        outgoing.write(options.body);
      }
    } else {
      outgoing.end(options.body);
    }
  });
}

describe("the inbound receiver", () => {
  let recorder: InboundRecorder | null = null;
  let records: InboundRecord[] = [];

  async function start(
    overrides: { durationMs?: number; maxBodies?: number } = {},
  ): Promise<InboundRecorder> {
    records = [];
    recorder = await startInboundRecorder({
      host: INBOUND_HOST,
      port: 0,
      durationMs: overrides.durationMs ?? 60_000,
      maxBodies: overrides.maxBodies ?? 20,
      sink: (record) => records.push(record),
      now: () => new Date("2026-10-14T10:06:00.000Z"),
    });
    return recorder;
  }

  function valid(started: InboundRecorder, body = '{"event":"spam"}') {
    return {
      path: `/${started.pathToken}`,
      headers: {
        "content-type": "application/json",
        "brevo-webhook-token": started.headerToken,
      },
      body,
    };
  }

  afterEach(async () => {
    await recorder?.stop("signal");
    recorder = null;
  });

  it("draws two different tokens of 32 random bytes", async () => {
    const started = await start();
    expect(started.pathToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.headerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.pathToken).not.toBe(started.headerToken);
  });

  it("stores exactly {kind, receivedAt, contentType, body}, answers a bare 200", async () => {
    const started = await start();
    const answer = await call(started.port, {
      ...valid(started, '{"event":"unsubscribed","email":"a@example.test"}'),
      headers: {
        ...valid(started).headers,
        "content-type": "application/json; charset=utf-8",
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "Brevo",
      },
    });
    expect(answer).toMatchObject({ status: 200, body: "" });
    expect(records).toEqual([
      {
        kind: "inbound",
        receivedAt: "2026-10-14T10:06:00.000Z",
        contentType: "application/json; charset=utf-8",
        body: { event: "unsubscribed", email: "a@example.test" },
      },
    ]);
    expect(Object.keys(records[0] ?? {})).toEqual([
      "kind",
      "receivedAt",
      "contentType",
      "body",
    ]);
    const stored = JSON.stringify(records);
    expect(stored).not.toContain(started.pathToken);
    expect(stored).not.toContain(started.headerToken);
    expect(stored).not.toContain("203.0.113.9");
  });

  it.each([
    [
      "a GET",
      (s: InboundRecorder) => ({ ...valid(s), method: "GET", body: undefined }),
    ],
    ["a PUT", (s: InboundRecorder) => ({ ...valid(s), method: "PUT" })],
    ["another path", (s: InboundRecorder) => ({ ...valid(s), path: "/other" })],
    [
      "the path with a query",
      (s: InboundRecorder) => ({ ...valid(s), path: `/${s.pathToken}?a=1` }),
    ],
    [
      "the header token as path",
      (s: InboundRecorder) => ({ ...valid(s), path: `/${s.headerToken}` }),
    ],
    [
      "a wrong header token",
      (s: InboundRecorder) => ({
        ...valid(s),
        headers: { ...valid(s).headers, "brevo-webhook-token": s.pathToken },
      }),
    ],
    [
      "no header token",
      (s: InboundRecorder) => ({
        ...valid(s),
        headers: { "content-type": "application/json" },
      }),
    ],
    [
      "a text body",
      (s: InboundRecorder) => ({
        ...valid(s),
        headers: { ...valid(s).headers, "content-type": "text/plain" },
      }),
    ],
    [
      "no content type",
      (s: InboundRecorder) => ({
        ...valid(s),
        headers: { "brevo-webhook-token": s.headerToken },
      }),
    ],
    ["a body that is not JSON", (s: InboundRecorder) => valid(s, "{not json")],
  ])(
    "refuses %s with the same bare 404, nothing stored",
    async (_name, make) => {
      const started = await start();
      const answer = await call(started.port, make(started));
      expect(answer.status).toBe(404);
      expect(answer.body).toBe("");
      expect(answer.headers["content-type"]).toBeUndefined();
      expect(records).toEqual([]);
    },
  );

  it("refuses a body over 64 KiB with a bare 413, declared or streamed", async () => {
    const started = await start();
    // Announced: refused before a byte of the body is read.
    const declared = await call(started.port, {
      ...valid(started),
      headers: { ...valid(started).headers, "content-length": "65537" },
      body: undefined,
      holdOpen: true,
    });
    expect(declared).toMatchObject({ status: 413, body: "" });

    // Chunked, no length announced: refused once 64 KiB are passed while reading, without
    // waiting for the end of the upload.
    const streamed = await call(started.port, {
      ...valid(started, `{"pad":"${"x".repeat(65_536)}`),
      headers: { ...valid(started).headers, "transfer-encoding": "chunked" },
      holdOpen: true,
    });
    expect(streamed).toMatchObject({ status: 413, body: "" });
    expect(records).toEqual([]);

    // The receiver still serves a valid body afterwards.
    expect((await call(started.port, valid(started))).status).toBe(200);
  });

  it("stops by itself after N bodies, the server closed", async () => {
    const started = await start({ maxBodies: 2 });
    expect((await call(started.port, valid(started))).status).toBe(200);
    expect((await call(started.port, valid(started))).status).toBe(200);
    expect(await started.stopped).toBe("count");
    expect(records).toHaveLength(2);
    await expect(call(started.port, valid(started))).rejects.toThrow();
  });

  it("stops by itself after its time, the server closed", async () => {
    const started = await start({ durationMs: 50 });
    expect(await started.stopped).toBe("time");
    await expect(call(started.port, valid(started))).rejects.toThrow();
  });
});

describe("the inbound receiver's binding", () => {
  it.each(["localhost", "0.0.0.0", "::", "::1", "[::1]", "192.168.1.10"])(
    "refuses to bind to %s",
    async (host) => {
      expect(() => assertInboundHost(host)).toThrow(/127\.0\.0\.1 only/);
      await expect(
        startInboundRecorder({
          host,
          port: 0,
          durationMs: 1_000,
          maxBodies: 1,
          sink: () => undefined,
        }),
      ).rejects.toThrow(/127\.0\.0\.1 only/);
    },
  );

  it("takes a port of 1024 to 65535, 30 minutes and 20 bodies by default", () => {
    expect(parseInboundArguments([])).toEqual({
      port: 8790,
      minutes: 30,
      maxBodies: 20,
    });
    expect(
      parseInboundArguments(["--port=1024", "--minutes=5", "--max-bodies=3"]),
    ).toEqual({ port: 1024, minutes: 5, maxBodies: 3 });
    expect(parseInboundArguments(["--port=65535"]).port).toBe(65_535);
  });

  it.each([
    ["--port=0"],
    ["--port=1023"],
    ["--port=65536"],
    ["--port=80.5"],
    ["--port=-1"],
    ["--port="],
    ["--host=0.0.0.0"],
    ["--minutes=0"],
    ["--max-bodies=0"],
  ])("refuses %s", (argument) => {
    expect(() => parseInboundArguments([argument])).toThrow();
  });
});

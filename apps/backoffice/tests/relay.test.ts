// The relay of the backoffice, against a FAKE apps/api (node:http on 127.0.0.1), never the real
// API (docs/mvp/03 §6.4, docs/mvp/18 T7, docs/mvp/21 §4 J1-H and J1-J T-1).
// The relay files are byte-for-byte those of apps/web (guards.test.ts), where the full table of
// PP cases runs. This file checks that the backoffice copy runs in its own build context, and the
// 10 s delay without waiting for it.
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { relay } from "@/server/relay";

type Received = { url: string; headers: IncomingHttpHeaders };

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const SECRET = "backoffice-relay-secret-for-tests-0123456789";

const answerOk: Handler = (_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok" }));
};

let server: Server;
let apiUrl = "";
let received: Received[] = [];
let handler: Handler = answerOk;

beforeAll(async () => {
  server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      received.push({ url: request.url ?? "", headers: request.headers });
      handler(request, response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  process.env.INFLUX_API_INTERNAL_URL = apiUrl;
  process.env.INFLUX_API_INTERNAL_SECRET = SECRET;
  received = [];
  handler = answerOk;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function call(path: string, init?: RequestInit): Promise<Response> {
  return relay(new Request(`http://localhost:3001${path}`, init));
}

describe("backoffice relay", () => {
  it("forwards /api/v1/bo/… with its own secret, never cached, never indexed", async () => {
    const response = await call("/api/v1/bo/status");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    expect(received[0]?.url).toBe("/v1/bo/status");
    expect(received[0]?.headers["x-influx-internal"]).toBe(SECRET);
  });

  it("refuses any % in the path, without calling apps/api (PP-2, R1)", async () => {
    const response = await call("/api/v1/bo%2Fstatus");
    expect(response.status).toBe(404);
    expect(received).toEqual([]);
  });

  it("forwards origin, sec-fetch-site and a well-formed x-real-ip, never x-forwarded-for (PP-5, PP-6)", async () => {
    await call("/api/v1/bo/status", {
      headers: {
        origin: "https://bo.influx.example",
        "sec-fetch-site": "same-origin",
        "x-real-ip": "198.51.100.1",
        "x-forwarded-for": "203.0.113.7",
      },
    });
    const headers = received[0]?.headers ?? {};
    expect(headers).toMatchObject({
      origin: "https://bo.influx.example",
      "sec-fetch-site": "same-origin",
      "x-real-ip": "198.51.100.1",
    });
    expect(headers["x-forwarded-for"]).toBeUndefined();
  });

  it("waits 10 s at most for apps/api, then answers 502 (T-1, no real wait)", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const expiry = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(expiry.signal);
    handler = () => {
      expiry.abort(new DOMException("The delay expired", "TimeoutError"));
      // Never answers.
    };
    const response = await call("/api/v1/bo/slow");
    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000);
    expect(response.status).toBe(502);
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("service_unavailable");
    expect(logged).toHaveBeenCalledOnce();
  });
});

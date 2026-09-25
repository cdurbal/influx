// Relay conditions PP-2 to PP-11, against a FAKE apps/api (node:http on 127.0.0.1), never the real
// API (docs/mvp/03-matrice-des-droits-et-rls.md §6.4, docs/mvp/18 T7, docs/mvp/21 §4 J1-H).
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
import * as route from "@/app/api/[...path]/route";
import { relay } from "@/server/relay";

type Received = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

const SECRET = "web-relay-secret-for-tests-0123456789abcdef";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks),
      });
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
  return relay(new Request(`http://localhost:3000${path}`, init));
}

async function expectRefusal(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = (await response.json()) as {
    error: { code: string; message: string; requestId: string };
  };
  expect(Object.keys(body.error).sort()).toEqual([
    "code",
    "message",
    "requestId",
  ]);
  expect(body.error.code).toBe(code);
  expect(body.error.requestId).toMatch(UUID);
}

describe("forwarding", () => {
  it("forwards /api/v1/… to /v1/… on the configured base, with the internal secret (PP-1, PP-8)", async () => {
    const response = await call("/api/v1/status?page=2");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(received).toHaveLength(1);
    expect(received[0]?.method).toBe("GET");
    expect(received[0]?.url).toBe("/v1/status?page=2");
    expect(received[0]?.headers["x-influx-internal"]).toBe(SECRET);
  });

  it("forwards a body byte for byte, never interpreted", async () => {
    const payload = JSON.stringify({ email: "someone@example.com" });
    await call("/api/v1/echo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(received[0]?.body.toString("utf8")).toBe(payload);
    expect(received[0]?.headers["content-type"]).toBe("application/json");
  });
});

describe("PP-2: path validated after decoding", () => {
  it.each([
    "/api/v1/../admin",
    "/api/v1/%2e%2e/admin",
    "/api/v1/%2e%2e%2fadmin",
    "/api/v1//status",
    "/api/v1/a%5Cb",
    "/api/v1/a%3Ab",
    "/api/v1/a@evil",
    "/api/v1/https%3A%2F%2Fevil.tld%2F",
    "/api/v1/api.internal%40evil.tld",
    "/api/v1/status.json",
    "/api/v1/%E0%A4%A",
    "/api/v2/status",
    "/api/health",
    `/api/v1/${"a".repeat(201)}`,
  ])("refuses %s with 404, without calling apps/api", async (path) => {
    await expectRefusal(await call(path), 404, "not_found");
    expect(received).toEqual([]);
  });
});

describe("PP-3: five methods only", () => {
  it.each(["HEAD", "OPTIONS"])("refuses %s with 404", async (method) => {
    const response = await call("/api/v1/status", { method });
    expect(response.status).toBe(404);
    expect(received).toEqual([]);
  });

  it("exports GET, POST, PATCH, PUT and DELETE only, never cached (PP-11)", () => {
    expect(Object.keys(route).sort()).toEqual(
      [
        "DELETE",
        "GET",
        "PATCH",
        "POST",
        "PUT",
        "dynamic",
        "revalidate",
        "runtime",
      ].sort(),
    );
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(route.runtime).toBe("nodejs");
  });
});

describe("PP-5 and PP-6: allow-list of request headers", () => {
  it("forwards the five allowed headers and drops every other one", async () => {
    await call("/api/v1/status", {
      method: "POST",
      headers: {
        cookie: "__Host-influx-session=abc",
        "content-type": "application/json",
        accept: "application/json",
        "accept-language": "fr-FR",
        "idempotency-key": "key-1",
        "x-middleware-subrequest": "middleware",
        "x-forwarded-host": "evil.tld",
        "x-forwarded-for": "203.0.113.7",
        "x-real-ip": "203.0.113.7",
        "x-influx-internal": "forged-by-the-client",
        authorization: "Bearer token",
        origin: "https://evil.tld",
        "x-custom": "value",
      },
      body: "{}",
    });
    const headers = received[0]?.headers ?? {};
    expect(headers).toMatchObject({
      cookie: "__Host-influx-session=abc",
      "content-type": "application/json",
      accept: "application/json",
      "accept-language": "fr-FR",
      "idempotency-key": "key-1",
      "x-influx-internal": SECRET,
    });
    for (const dropped of [
      "x-middleware-subrequest",
      "x-forwarded-host",
      "x-forwarded-for",
      "x-real-ip",
      "authorization",
      "origin",
      "x-custom",
    ]) {
      expect(headers[dropped], dropped).toBeUndefined();
    }
  });
});

describe("PP-7: request identifier", () => {
  it("generates the audit identifier and keeps the client's apart", async () => {
    await call("/api/v1/status", {
      headers: { "x-request-id": "client-chosen-id" },
    });
    const headers = received[0]?.headers ?? {};
    expect(headers["x-request-id"]).toMatch(UUID);
    expect(headers["x-request-id"]).not.toBe("client-chosen-id");
    expect(headers["client-request-id"]).toBe("client-chosen-id");
  });

  it("drops a client identifier that is not short and plain", async () => {
    await call("/api/v1/status", {
      headers: { "x-request-id": "a bé".padEnd(200, "x") },
    });
    expect(received[0]?.headers["client-request-id"]).toBeUndefined();
  });
});

describe("PP-9: body size and delay", () => {
  it("forwards a body of exactly 1 MiB", async () => {
    await call("/api/v1/upload", {
      method: "POST",
      body: "x".repeat(1_048_576),
    });
    expect(received[0]?.body.byteLength).toBe(1_048_576);
  });

  it("refuses a body over 1 MiB with 413, without calling apps/api", async () => {
    const response = await call("/api/v1/upload", {
      method: "POST",
      body: "x".repeat(1_048_577),
    });
    await expectRefusal(response, 413, "payload_too_large");
    expect(received).toEqual([]);
  });

  it("answers 502 when apps/api does not answer within 10 s", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    handler = () => {
      // Never answers.
    };
    const response = await call("/api/v1/slow");
    await expectRefusal(response, 502, "service_unavailable");
    expect(logged).toHaveBeenCalledOnce();
  }, 20_000);

  it("answers 502 when apps/api is unreachable, and logs without the URL", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.INFLUX_API_INTERNAL_URL = "http://127.0.0.1:1";
    const response = await call("/api/v1/status?email=someone@example.com");
    await expectRefusal(response, 502, "service_unavailable");
    const line = String(logged.mock.calls[0]?.[0]);
    expect(line).toContain("requestId");
    expect(line).not.toContain("someone@example.com");
    expect(line).not.toContain("127.0.0.1");
  });

  it("answers 502 when its configuration is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.INFLUX_API_INTERNAL_SECRET;
    await expectRefusal(
      await call("/api/v1/status"),
      502,
      "service_unavailable",
    );
    expect(received).toEqual([]);
  });
});

describe("PP-4, PP-10, PP-11: the answer", () => {
  it("relays a redirect as is, without following it (PP-4)", async () => {
    handler = (_request, response) => {
      response.writeHead(302, { location: `${apiUrl}/v1/elsewhere` });
      response.end();
    };
    const response = await call("/api/v1/moved");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${apiUrl}/v1/elsewhere`);
    expect(received).toHaveLength(1);
  });

  it("relays several Set-Cookie headers verbatim (PP-10)", async () => {
    const cookies = [
      "__Host-influx-session=abc; Path=/; Secure; HttpOnly; SameSite=Lax; Partitioned",
      "__Host-influx-flow=def; Path=/; Secure; HttpOnly; SameSite=Strict; Priority=High",
    ];
    handler = (_request, response) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": cookies,
      });
      response.end("{}");
    };
    const response = await call("/api/v1/session");
    expect(response.headers.getSetCookie()).toEqual(cookies);
  });

  it("refuses the whole answer when a cookie is not a __Host- cookie (PP-10)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    handler = (_request, response) => {
      response.writeHead(200, {
        "set-cookie": ["__Host-ok=1; Path=/; Secure", "session=2; Path=/"],
      });
      response.end("{}");
    };
    const response = await call("/api/v1/session");
    await expectRefusal(response, 502, "service_unavailable");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("relays allowed headers only, and forces no-store and noindex (PP-11)", async () => {
    handler = (_request, response) => {
      response.writeHead(429, {
        "content-type": "application/json",
        "retry-after": "30",
        "cache-control": "public, max-age=3600",
        "x-powered-by": "fastify",
        "server-timing": "db;dur=12",
        "x-internal-host": "api.railway.internal",
      });
      response.end(JSON.stringify({ error: { code: "rate_limited" } }));
    };
    const response = await call("/api/v1/status");
    expect(response.status).toBe(429);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("retry-after")).toBe("30");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe(
      "noindex, nofollow, noarchive",
    );
    for (const dropped of [
      "x-powered-by",
      "server-timing",
      "x-internal-host",
    ]) {
      expect(response.headers.get(dropped), dropped).toBeNull();
    }
  });
});

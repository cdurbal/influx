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

describe("PP-2: raw path, any % refused, never decoded (21 J1-J R1)", () => {
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
    // Would decode to an allowed path: refused all the same, a "%" is never read (R1).
    "/api/v1/%73tatus",
    "/api/v1/bo%2Fx",
    "/api/v1/status%20",
    "/api/v1/a%2541",
  ])("refuses %s with 404, without calling apps/api", async (path) => {
    await expectRefusal(await call(path), 404, "not_found");
    expect(received).toEqual([]);
  });

  it("forwards an allowed raw path unchanged", async () => {
    await call("/api/v1/bo/Some_path-1/x");
    expect(received[0]?.url).toBe("/v1/bo/Some_path-1/x");
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

describe("PP-5: allow-list of request headers (21 J1-J A4)", () => {
  it("forwards the seven allowed headers and drops every other one", async () => {
    await call("/api/v1/status", {
      method: "POST",
      headers: {
        cookie: "__Host-influx-session=abc",
        "content-type": "application/json",
        accept: "application/json",
        "accept-language": "fr-FR",
        "idempotency-key": "key-1",
        origin: "https://influx.example",
        "sec-fetch-site": "same-origin",
        "x-middleware-subrequest": "middleware",
        "x-forwarded-host": "evil.tld",
        "x-forwarded-for": "203.0.113.7",
        "x-influx-internal": "forged-by-the-client",
        authorization: "Bearer token",
        "sec-fetch-dest": "document",
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
      origin: "https://influx.example",
      "sec-fetch-site": "same-origin",
      "x-influx-internal": SECRET,
    });
    for (const dropped of [
      "x-middleware-subrequest",
      "x-forwarded-host",
      "x-forwarded-for",
      "authorization",
      "sec-fetch-dest",
      "x-custom",
    ]) {
      expect(headers[dropped], dropped).toBeUndefined();
    }
  });
});

// C-2 (end-of-J1 security review, 21 J1-J): the origin check of apps/api reads `origin` and
// `sec-fetch-site` only (03 §6.4 A4). What Node's fetch does to the forwarded request is checked
// here, and run by CI under Node 24, the production runtime (job `relay-node-24`).
describe("C-2: what Node's fetch changes on the way to apps/api", () => {
  it("sets sec-fetch-mode: cors, and leaves origin and sec-fetch-site untouched", async () => {
    await call("/api/v1/status", {
      method: "POST",
      headers: {
        origin: "https://influx.example",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "navigate",
      },
      body: "{}",
    });
    const headers = received[0]?.headers ?? {};
    expect(headers.origin).toBe("https://influx.example");
    expect(headers["sec-fetch-site"]).toBe("same-origin");
    expect(headers["sec-fetch-mode"]).toBe("cors");
  });

  it("adds neither origin nor sec-fetch-site when the browser sent none", async () => {
    await call("/api/v1/status", { method: "POST", body: "{}" });
    const headers = received[0]?.headers ?? {};
    expect(headers.origin).toBeUndefined();
    expect(headers["sec-fetch-site"]).toBeUndefined();
  });

  it("forwards a cross-site write as such, for apps/api to refuse", async () => {
    await call("/api/v1/status", {
      method: "DELETE",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });
    const headers = received[0]?.headers ?? {};
    expect(headers.origin).toBe("https://evil.example");
    expect(headers["sec-fetch-site"]).toBe("cross-site");
  });
});

describe("PP-6: client address from x-real-ip only (03 §6.4 A5, EC-21)", () => {
  it.each(["203.0.113.7", "2001:db8::1", "::ffff:203.0.113.7"])(
    "forwards a well-formed x-real-ip %s under x-real-ip",
    async (address) => {
      await call("/api/v1/status", { headers: { "x-real-ip": address } });
      expect(received[0]?.headers["x-real-ip"]).toBe(address);
    },
  );

  it.each([
    "203.0.113.7, 198.51.100.1",
    "evil.tld",
    "203.0.113.7<script>",
    "1".repeat(46),
    "1",
  ])("drops an x-real-ip of invalid form: %s", async (address) => {
    await call("/api/v1/status", { headers: { "x-real-ip": address } });
    expect(received[0]?.headers["x-real-ip"]).toBeUndefined();
  });

  it("never reads nor forwards x-forwarded-for, even without x-real-ip", async () => {
    await call("/api/v1/status", {
      headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.1" },
    });
    const headers = received[0]?.headers ?? {};
    expect(headers["x-forwarded-for"]).toBeUndefined();
    expect(headers["x-real-ip"]).toBeUndefined();
  });

  it("keeps x-real-ip as the only source when both headers are sent", async () => {
    await call("/api/v1/status", {
      headers: {
        "x-real-ip": "198.51.100.1",
        "x-forwarded-for": "203.0.113.7",
      },
    });
    const headers = received[0]?.headers ?? {};
    expect(headers["x-real-ip"]).toBe("198.51.100.1");
    expect(headers["x-forwarded-for"]).toBeUndefined();
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

  it("waits 10 s at most for apps/api, then answers 502 (T-1, no real wait)", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // The 10 s timer is replaced by a signal that the fake apps/api aborts once it holds the
    // request: the test checks the delay asked for, and what happens when it expires.
    const expiry = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(expiry.signal);
    handler = () => {
      expiry.abort(new DOMException("The delay expired", "TimeoutError"));
      // Never answers.
    };
    const response = await call("/api/v1/slow");
    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000);
    await expectRefusal(response, 502, "service_unavailable");
    expect(received).toHaveLength(1);
    expect(logged).toHaveBeenCalledOnce();
  });

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

  it("answers 502 when its configuration is missing, and logs which variable (R3)", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.INFLUX_API_INTERNAL_SECRET;
    await expectRefusal(
      await call("/api/v1/status"),
      502,
      "service_unavailable",
    );
    expect(received).toEqual([]);
    const line = JSON.parse(String(logged.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(line).toMatchObject({
      error: "ServerConfigError",
      message: "INFLUX_API_INTERNAL_SECRET is required",
    });
  });

  it("refuses a secret that still holds the CHANGE_ME placeholder, without quoting it (R4)", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const placeholder = "CHANGE_ME".padEnd(40, "z");
    process.env.INFLUX_API_INTERNAL_SECRET = placeholder;
    await expectRefusal(
      await call("/api/v1/status"),
      502,
      "service_unavailable",
    );
    expect(received).toEqual([]);
    const line = String(logged.mock.calls[0]?.[0]);
    expect(line).toContain(
      "INFLUX_API_INTERNAL_SECRET must not contain the CHANGE_ME placeholder",
    );
    expect(line).not.toContain(placeholder);
  });
});

describe("R2: GET and DELETE bodies are ignored (21 J1-J)", () => {
  it("forwards a GET that arrives with a body, without the body, and logs nothing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // A Request cannot be built as GET with a body: the method is overridden on a POST.
    const request = new Request("http://localhost:3000/api/v1/status", {
      method: "POST",
      body: JSON.stringify({ ignored: true }),
    });
    Object.defineProperty(request, "method", { value: "GET" });
    const response = await relay(request);
    expect(response.status).toBe(200);
    expect(received[0]?.method).toBe("GET");
    expect(received[0]?.body.byteLength).toBe(0);
    expect(logged).not.toHaveBeenCalled();
  });

  it("forwards a DELETE without its body", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call("/api/v1/items/42", {
      method: "DELETE",
      body: "x".repeat(2_000_000),
    });
    expect(response.status).toBe(200);
    expect(received[0]?.method).toBe("DELETE");
    expect(received[0]?.body.byteLength).toBe(0);
    expect(logged).not.toHaveBeenCalled();
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

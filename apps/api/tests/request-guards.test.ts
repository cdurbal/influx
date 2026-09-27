// Guards of every request with a valid internal secret, before any handler (21 §4 J3 points 10
// and 11, J3-D): origin of writes (03 §6.4 A4, 18 T8.13), client address (A5, 18 T7.12) and the
// bodiless DELETE (C-3). Through fastify.inject(): the relay forwards `origin` and
// `sec-fetch-site` untouched, which its own test proves against a fake server under Node 24 (C-2).
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { clientAddressOf } from "../src/platform/client-address.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "./helpers.ts";

const okSchema = z.object({ status: z.literal("ok") });

let app: ApiServer | undefined;
let logs = captureLogs();
let handled = 0;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A server with a probe route of each write method on both surfaces; `handled` counts calls. */
function server(): ApiServer {
  logs = captureLogs();
  handled = 0;
  const api = buildServer(testApiConfig(), {
    logDestination: logs.destination,
  });
  app = api;
  const handler = async () => {
    handled += 1;
    return { status: "ok" as const };
  };
  const options = { schema: { response: { 200: okSchema } } };
  for (const url of ["/v1/probe", "/v1/bo/probe"]) {
    api.get(url, options, handler);
    api.post(url, options, handler);
    api.patch(url, options, handler);
    api.put(url, options, handler);
    api.delete(url, options, handler);
  }
  return api;
}

// ---------------------------------------------------------------------------------------------
// A4: origin of writes
// ---------------------------------------------------------------------------------------------

describe("A4: a write is refused unless it comes from the surface's own origin (18 T8.13)", () => {
  const WEB = { "x-influx-internal": WEB_SECRET };

  it.each<[string, Record<string, string>]>([
    ["sec-fetch-site: cross-site", { "sec-fetch-site": "cross-site" }],
    [
      "sec-fetch-site: same-site (the backoffice is a sub-domain of the same site)",
      { "sec-fetch-site": "same-site" },
    ],
    ["sec-fetch-site: none", { "sec-fetch-site": "none" }],
    ["neither header", {}],
    ["Origin: null", { origin: "null" }],
    ["the origin of the other surface", { origin: BACKOFFICE_ORIGIN }],
    ["a foreign origin", { origin: "https://evil.example" }],
    [
      "the right origin, but sec-fetch-site: cross-site",
      { origin: WEB_ORIGIN, "sec-fetch-site": "cross-site" },
    ],
    [
      "only the headers the check ignores (referer, sec-fetch-mode, host)",
      {
        referer: `${WEB_ORIGIN}/fr`,
        "sec-fetch-mode": "cors",
        host: "influx.example",
      },
    ],
  ])(
    "refuses a POST with %s, with 403 and before any effect",
    async (_case, headers) => {
      const response = await server().inject({
        method: "POST",
        url: "/v1/probe",
        headers: { ...WEB, ...headers },
        payload: { any: "body" },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("forbidden");
      expect(handled).toBe(0);
    },
  );

  it.each([["POST"], ["PATCH"], ["PUT"], ["DELETE"]] as const)(
    "checks %s",
    async (method) => {
      const api = server();
      const refused = await api.inject({
        method,
        url: "/v1/probe",
        headers: WEB,
      });
      expect(refused.statusCode).toBe(403);
      const accepted = await api.inject({
        method,
        url: "/v1/probe",
        headers: { ...WEB, "sec-fetch-site": "same-origin" },
      });
      expect(accepted.statusCode).toBe(200);
      expect(handled).toBe(1);
    },
  );

  it.each<[string, Record<string, string>]>([
    ["sec-fetch-site: same-origin", { "sec-fetch-site": "same-origin" }],
    [
      "sec-fetch-site: same-origin and the sec-fetch-mode that Node's fetch sets (C-2)",
      { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" },
    ],
    ["no sec-fetch-site and the origin of the surface", { origin: WEB_ORIGIN }],
  ])("accepts a POST with %s", async (_case, headers) => {
    const response = await server().inject({
      method: "POST",
      url: "/v1/probe",
      headers: { ...WEB, ...headers },
    });
    expect(response.statusCode).toBe(200);
    expect(handled).toBe(1);
  });

  it("does not check a GET", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/v1/probe",
      headers: { ...WEB, "sec-fetch-site": "cross-site" },
    });
    expect(response.statusCode).toBe(200);
  });

  it("expects the backoffice origin on the backoffice surface", async () => {
    const api = server();
    const backoffice = { "x-influx-internal": BACKOFFICE_SECRET };
    const withWebOrigin = await api.inject({
      method: "POST",
      url: "/v1/bo/probe",
      headers: { ...backoffice, origin: WEB_ORIGIN },
    });
    expect(withWebOrigin.statusCode).toBe(403);
    const withOwnOrigin = await api.inject({
      method: "POST",
      url: "/v1/bo/probe",
      headers: { ...backoffice, origin: BACKOFFICE_ORIGIN },
    });
    expect(withOwnOrigin.statusCode).toBe(200);
  });

  it("answers 401 to a write without the secret, before the origin check", async () => {
    const response = await server().inject({
      method: "POST",
      url: "/v1/probe",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("never parses a form body (no formbody parser)", async () => {
    const response = await server().inject({
      method: "POST",
      url: "/v1/probe",
      headers: {
        ...WEB,
        "sec-fetch-site": "same-origin",
        "content-type": "application/x-www-form-urlencoded",
      },
      payload: "status=ok&email=form.marker%40example.test",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_failed");
    expect(handled).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// A5: client address
// ---------------------------------------------------------------------------------------------

describe("A5: the client address is read after the secret, and never logged", () => {
  const ADDRESS = "203.0.113.77";

  /** A probe route that reports what clientAddressOf() gives, without the key. */
  function addressServer(): ApiServer {
    const api = server();
    api.get(
      "/v1/address",
      {
        schema: {
          response: {
            200: z.strictObject({
              status: z.enum(["known", "unknown"]),
              detail: z.string(),
            }),
          },
        },
      },
      async (request) => {
        const address = clientAddressOf(request);
        clientAddressOf(request); // A second read writes no second line.
        return address.status === "known"
          ? { status: "known" as const, detail: address.family }
          : { status: "unknown" as const, detail: address.reason };
      },
    );
    return api;
  }

  async function read(headers: Record<string, string>) {
    const response = await addressServer().inject({
      method: "GET",
      url: "/v1/address",
      headers: { "x-influx-internal": WEB_SECRET, ...headers },
    });
    return response.json() as { status: string; detail: string };
  }

  function unknownAddressLines(): Record<string, unknown>[] {
    return logs
      .lines()
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => String(line.msg).startsWith("client address unknown"));
  }

  it("reads a valid x-real-ip, and no line quotes it", async () => {
    expect(await read({ "x-real-ip": ADDRESS })).toEqual({
      status: "known",
      detail: "ipv4",
    });
    expect(unknownAddressLines()).toEqual([]);
    expect(valuesFoundIn(logs.text(), [ADDRESS])).toEqual([]);
  });

  it("reads an IPv4-mapped address as IPv4", async () => {
    expect(await read({ "x-real-ip": `::ffff:${ADDRESS}` })).toEqual({
      status: "known",
      detail: "ipv4",
    });
  });

  it("reports an absent address with one warn line, without any value", async () => {
    expect(await read({})).toEqual({ status: "unknown", detail: "absent" });
    expect(unknownAddressLines()).toEqual([
      expect.objectContaining({ level: "warn", reason: "absent" }),
    ]);
  });

  it("reports an invalid address with one warn line that does not quote it", async () => {
    const forged = `${ADDRESS}, 198.51.100.1`;
    expect(await read({ "x-real-ip": forged })).toEqual({
      status: "unknown",
      detail: "invalid",
    });
    expect(unknownAddressLines()).toEqual([
      expect.objectContaining({ level: "warn", reason: "invalid" }),
    ]);
    expect(valuesFoundIn(logs.text(), [ADDRESS, "198.51.100.1"])).toEqual([]);
  });

  it("never reads x-forwarded-for", async () => {
    expect(await read({ "x-forwarded-for": ADDRESS })).toEqual({
      status: "unknown",
      detail: "absent",
    });
  });

  it("ignores x-real-ip without a valid secret, and writes no address line", async () => {
    const api = addressServer();
    for (const headers of [{}, { "x-influx-internal": `${WEB_SECRET}x` }]) {
      const response = await api.inject({
        method: "GET",
        url: "/v1/address",
        headers: { ...headers, "x-real-ip": "not-an-address" },
      });
      expect(response.statusCode).toBe(401);
    }
    expect(unknownAddressLines()).toEqual([]);
  });

  it("writes no address line for a route that does not need the address", async () => {
    await server().inject({
      method: "GET",
      url: "/v1/probe",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(unknownAddressLines()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// C-3: a DELETE carries neither a body nor a content-type
// ---------------------------------------------------------------------------------------------

describe("C-3: a DELETE carries neither a body nor a content-type (21 J3-D)", () => {
  const SAME_ORIGIN = {
    "x-influx-internal": WEB_SECRET,
    "sec-fetch-site": "same-origin",
  };

  it.each<[string, Record<string, string>, string | undefined]>([
    [
      "a content-type and an empty body",
      { "content-type": "application/json" },
      undefined,
    ],
    ["a text/plain body", { "content-type": "text/plain" }, "delete me"],
    ["a body without content-type", {}, "delete me"],
    [
      "a chunked body",
      { "transfer-encoding": "chunked", "content-type": "application/json" },
      "{}",
    ],
  ])(
    "refuses %s with 400, before any parsing",
    async (_case, headers, payload) => {
      const response = await server().inject({
        method: "DELETE",
        url: "/v1/probe",
        headers: { ...SAME_ORIGIN, ...headers },
        ...(payload === undefined ? {} : { payload }),
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("validation_failed");
      expect(handled).toBe(0);
      expect(logs.text()).not.toContain('"level":"error"');
    },
  );

  it("lets a DELETE without body reach its route, and a zero content-length too", async () => {
    const api = server();
    const bare = await api.inject({
      method: "DELETE",
      url: "/v1/probe",
      headers: SAME_ORIGIN,
    });
    expect(bare.statusCode).toBe(200);
    const zero = await api.inject({
      method: "DELETE",
      url: "/v1/probe",
      headers: { ...SAME_ORIGIN, "content-length": "0" },
    });
    expect(zero.statusCode).toBe(200);
    expect(handled).toBe(2);
  });

  // Fastify already refuses a body schema on GET; the guard of server.ts covers DELETE, which
  // Fastify accepts.
  it.each<[string, RegExp]>([
    ["DELETE", /declares a body for DELETE/],
    ["GET", /body/i],
  ])(
    "refuses to start with a %s route that declares a body",
    (method, message) => {
      const api = server();
      expect(() =>
        api.route({
          method: method as "DELETE" | "GET",
          url: "/v1/with-body",
          schema: {
            body: z.object({ reason: z.string() }),
            response: { 200: okSchema },
          },
          handler: async () => ({ status: "ok" as const }),
        }),
      ).toThrow(message);
    },
  );

  it("accepts a POST route that declares a body", () => {
    const api = server();
    expect(() =>
      api.post(
        "/v1/actions/delete",
        {
          schema: {
            body: z.object({ reason: z.string() }),
            response: { 200: okSchema },
          },
        },
        async () => ({ status: "ok" as const }),
      ),
    ).not.toThrow();
  });
});

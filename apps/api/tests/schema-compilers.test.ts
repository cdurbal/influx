// The response schema is an output filter: an undeclared field is never serialized
// (docs/mvp/02-architecture-3-espaces.md §2.5 point 4, docs/mvp/21 §4 J1-A and J1-H).
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  zodSerializerCompiler,
  zodValidatorCompiler,
} from "../src/platform/schema-compilers.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "./helpers.ts";

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const profileSchema = z.object({ publicId: z.string(), country: z.string() });

describe("serializer compiler", () => {
  it("strips every field that the response schema does not declare", async () => {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    app.get(
      "/v1/profile",
      { schema: { response: { 200: profileSchema } } },
      // The handler returns more than the contract: an identity field leaks from the "database".
      async () =>
        ({
          publicId: "c_8f3k2",
          country: "FR",
          handle: "@pseudo_test",
        }) as z.input<typeof profileSchema>,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/profile",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publicId: "c_8f3k2", country: "FR" });
    expect(response.body).not.toContain("@pseudo_test");
  });

  it("turns a payload that breaks its schema into a 500 without detail", async () => {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    app.get(
      "/v1/broken",
      { schema: { response: { 200: profileSchema } } },
      async () =>
        ({ publicId: 42, country: "FR" }) as unknown as z.input<
          typeof profileSchema
        >,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/broken",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("internal_error");
    expect(response.body).not.toContain("publicId");
  });

  it("refuses a schema that is not a zod schema", () => {
    expect(() =>
      zodSerializerCompiler({
        schema: { type: "object" },
        method: "GET",
        url: "/v1/json-schema",
        httpStatus: "200",
      }),
    ).toThrow(/must be zod schemas/);
  });
});

describe("validator compiler", () => {
  it("returns the parsed value, or the failing fields without their values", () => {
    const validate = zodValidatorCompiler({
      schema: z.object({ count: z.number().int() }),
      method: "POST",
      url: "/v1/count",
      httpPart: "body",
    });
    expect(validate({ count: 3, extra: "dropped" })).toEqual({
      value: { count: 3 },
    });
    const failure = validate({ count: "secret-value" });
    expect(failure).toMatchObject({
      error: { issues: [{ path: "count", issue: "invalid_type" }] },
    });
    expect(JSON.stringify(failure)).not.toContain("secret-value");
  });
});

// L2AS-2: the closed list of route models (packages/contracts/src/route-models.ts) keeps the routes
// of apps/api in step with the server itself: a new route fails here until it is listed, and a
// listed route that is gone fails too. The pages of the fronts have the same guard in their own
// package (tests/route-models.test.ts of apps/web and apps/backoffice).
import {
  API_ROUTE_MODELS,
  BACKOFFICE_PAGE_MODELS,
  KNOWN_ROUTE_MODELS,
  WEB_PAGE_MODELS,
} from "@influx/contracts/route-models";
import { afterEach, describe, expect, it } from "vitest";
import { routeModelOf } from "../src/domains/ops/scrub.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, registeredRoutes, testApiConfig } from "./helpers.ts";

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("route models of the API (L2AS-2)", () => {
  it("lists exactly the route patterns the server registers", async () => {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    const patterns = [
      ...new Set(
        (await registeredRoutes(app)).map((route) =>
          route.slice(route.indexOf(" ") + 1),
        ),
      ),
    ].sort();
    expect([...API_ROUTE_MODELS].sort()).toEqual(patterns);
  });

  it("keeps every listed model as it is, and no model twice", () => {
    for (const model of KNOWN_ROUTE_MODELS) {
      expect(routeModelOf(model), model).toBe(model);
    }
    const all = [
      ...API_ROUTE_MODELS,
      ...WEB_PAGE_MODELS,
      ...BACKOFFICE_PAGE_MODELS,
    ];
    // No family shares a model with another: one address, one family.
    expect(new Set(all).size).toBe(all.length);
    expect(KNOWN_ROUTE_MODELS.size).toBe(all.length);
  });
});

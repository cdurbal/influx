import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FastifyInstance } from "fastify";
import { type Account } from "@influx/contracts";
import { MockStore } from "../src/mocks/mock-store";
import { createApp } from "../src/server";

describe("Fastify Server & Dev Routes", () => {
  let app: FastifyInstance;
  let store: MockStore;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset({ empty: true });
    app = createApp({ logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("responds 200 on /health", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("influx-api");
  });

  it("exposes current state on GET /api/dev/state", async () => {
    const testAccount: Account = {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      email: "alex@influx.io",
      role: "agent",
      status: "active",
      preferredLanguage: "fr",
      countryCode: "FR",
      emailStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.saveAccount(testAccount);

    const res = await app.inject({
      method: "GET",
      url: "/api/dev/state",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.state.accounts.length).toBe(1);
    expect(body.state.accounts[0].email).toBe("alex@influx.io");
  });

  it("resets state to empty when requested on POST /api/dev/reset", async () => {
    const testAccount: Account = {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      email: "temp@test.com",
      role: "advertiser",
      status: "active",
      preferredLanguage: "fr",
      countryCode: "FR",
      emailStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.saveAccount(testAccount);
    expect(store.accounts.size).toBe(1);

    const res = await app.inject({
      method: "POST",
      url: "/api/dev/reset",
      payload: { empty: true },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(store.accounts.size).toBe(0);
  });

  it("resets state to default seed data on POST /api/dev/reset without empty", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/dev/reset",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(store.accounts.size).toBeGreaterThan(0);
    expect(store.getAccountByEmail("contact@maisonsolene.fr")).toBeDefined();
  });

  it("supports CORS for localhost:3000", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "GET",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

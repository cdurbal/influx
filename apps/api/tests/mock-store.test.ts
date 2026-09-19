import { beforeEach, describe, expect, it } from "vitest";
import { type Account } from "@influx/contracts";
import { MockStore } from "../src/mocks/mock-store";

describe("MockStore - In-Memory Singleton Store", () => {
  let store: MockStore;

  beforeEach(() => {
    store = MockStore.getInstance();
    store.reset({ empty: true });
  });

  it("behaves as a singleton", () => {
    const store2 = MockStore.getInstance();
    expect(store).toBe(store2);
  });

  it("can store and retrieve accounts by ID and email", () => {
    const testAccount: Account = {
      id: "11111111-1111-1111-1111-111111111111",
      email: "test@brand.com",
      role: "advertiser",
      status: "active",
      preferredLanguage: "fr",
      countryCode: "FR",
      emailStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.saveAccount(testAccount);

    expect(store.getAccountById(testAccount.id)).toEqual(testAccount);
    expect(store.getAccountByEmail("test@brand.com")).toEqual(testAccount);
    expect(store.getAccountByEmail("TEST@BRAND.COM")).toEqual(testAccount); // Case-insensitive
    expect(store.getAccountByEmail("unknown@brand.com")).toBeUndefined();
  });

  it("records append-only hash-chained audit events", () => {
    const event1 = store.recordAuditEvent(
      "account.created",
      { role: "advertiser" },
      "acc-1",
    );
    const event2 = store.recordAuditEvent(
      "terms.accepted",
      { version: "2026-09-18" },
      "acc-1",
    );

    expect(store.auditEvents.length).toBe(2);
    expect(event1.previousHash).toBe("0000000000000000");
    expect(event2.previousHash).toBe(event1.hash);
  });

  it("can dump and restore snapshot", () => {
    const testAccount: Account = {
      id: "22222222-2222-2222-2222-222222222222",
      email: "creator@influx.io",
      role: "creator",
      status: "active",
      preferredLanguage: "en",
      countryCode: "US",
      emailStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.saveAccount(testAccount);
    store.recordAuditEvent("account.created", { role: "creator" });

    const snapshot = store.dump();
    expect(snapshot.accounts.length).toBe(1);
    expect(snapshot.auditEvents.length).toBe(1);

    store.reset({ empty: true });
    expect(store.accounts.size).toBe(0);
    expect(store.auditEvents.length).toBe(0);

    store.load(snapshot);
    expect(store.accounts.size).toBe(1);
    expect(store.auditEvents.length).toBe(1);
    expect(store.getAccountById(testAccount.id)).toEqual(testAccount);
  });
});

// The `reconciliation` mode of the manual trial (J7 commit 10; 16 §M1 operations 9 and 10; D62):
// the two reads of E-4 called once each, a page of 10 at most, on the last 24 hours, under the
// recorder, and never a database connection. No network: the inner fetch is a stub.
import { describe, expect, it, vi } from "vitest";
import type { ProviderRecord } from "../scripts/provider-recording.ts";

// The driver is not even loaded by this mode; a client built anyway would fail the test.
const driver = vi.hoisted(() => ({
  loaded: false,
  factory: vi.fn(() => {
    throw new Error("the reconciliation trial must open no database");
  }),
}));
vi.mock("postgres", () => {
  driver.loaded = true;
  return { default: driver.factory };
});
const postgresFactory = driver.factory;

const { recordingFetch } = await import("../scripts/provider-recording.ts");
const { readReconciliationOnce, TRIAL_PAGE_SIZE } =
  await import("../scripts/reconciliation-reads.ts");

const NOW = new Date("2026-10-14T10:00:00.000Z");

function brevoStub(contacts: number) {
  const calls: { url: URL; headers: Headers }[] = [];
  const inner = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, headers: new Headers(init?.headers) });
    const body = url.pathname.endsWith("/contacts")
      ? {
          contacts: Array.from({ length: contacts }, (_, n) => ({
            email: `recorded-contact-${n}@example.test`,
            emailBlacklisted: false,
            modifiedAt: "2026-10-14T09:00:00.000+02:00",
            attributes: {},
          })),
          count: contacts,
        }
      : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { inner, calls };
}

describe("readReconciliationOnce", () => {
  it("calls each read once, limit 10, modifiedSince the last 24 h, recorded without a header", async () => {
    const records: ProviderRecord[] = [];
    const { inner, calls } = brevoStub(1);
    const outcome = await readReconciliationOnce({
      apiKey: "xkeysib-trial-secret",
      baseUrl: "https://api.brevo.com/v3",
      fetch: recordingFetch(inner, (record) => records.push(record)),
      now: NOW,
    });

    expect(outcome).toEqual({ contacts: 1, smtpSpamEvents: 0 });
    expect(calls.map(({ url }) => url.pathname)).toEqual([
      "/v3/contacts",
      "/v3/smtp/statistics/events",
    ]);
    const [contacts, events] = calls;
    expect(TRIAL_PAGE_SIZE).toBeLessThanOrEqual(10);
    expect(Number(contacts?.url.searchParams.get("limit"))).toBe(
      TRIAL_PAGE_SIZE,
    );
    expect(contacts?.url.searchParams.get("modifiedSince")).toBe(
      "2026-10-13T10:00:00.000Z",
    );
    expect(Number(events?.url.searchParams.get("limit"))).toBe(TRIAL_PAGE_SIZE);
    expect(events?.url.searchParams.get("startDate")).toBe("2026-10-13");
    expect(events?.url.searchParams.get("endDate")).toBe("2026-10-14");

    expect(records.map((record) => [record.method, record.path])).toEqual([
      ["GET", "/v3/contacts"],
      ["GET", "/v3/smtp/statistics/events"],
    ]);
    expect(JSON.stringify(records)).not.toContain("xkeysib-trial-secret");
    expect(postgresFactory).not.toHaveBeenCalled();
    expect(driver.loaded).toBe(false);
  });

  it("never reads a second page: a full page ends with its closed code", async () => {
    const { inner, calls } = brevoStub(TRIAL_PAGE_SIZE);
    const outcome = await readReconciliationOnce({
      apiKey: "xkeysib-trial-secret",
      baseUrl: "https://api.brevo.com/v3",
      fetch: inner,
      now: NOW,
    });
    expect(outcome.contacts).toBe("brevo.too_many_pages");
    expect(calls).toHaveLength(2);
    expect(postgresFactory).not.toHaveBeenCalled();
  });
});

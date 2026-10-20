// What the screens of the backoffice v0 compute from the answers of apps/api (src/components/
// view-model.ts; docs/mvp/05 RG84, RG100, RG101, RG103, RG144; 17b §3.11, §3.13.c). Pure functions:
// no browser, no network.
import type { AccountRow } from "@influx/contracts/backoffice-accounts";
import { describe, expect, it } from "vitest";
import {
  accountSearchOf,
  browserLabel,
  failureOf,
  formatByCountry,
  parseByCountry,
  parseCountryList,
  periodOf,
  replayPairs,
  sharePercent,
} from "@/components/view-model";
import { messages } from "@/messages/fr";

const SYNCED = {
  state: "synced",
  nature: "success",
  cause: "synced",
  retryAt: null,
  lastAttemptAt: null,
} as const;

function row(
  id: string,
  brevo: AccountRow["sync"]["brevo"]["state"],
  apollo: AccountRow["sync"]["apollo"]["state"],
): AccountRow {
  return {
    id,
    createdAt: "2026-10-16T08:00:00.000Z",
    role: "creator",
    status: "active",
    countryCode: "FR",
    preferredLanguage: "fr",
    declaredStatus: "individual",
    source: {
      viaInvitation: false,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referrerDomain: null,
      heardFrom: null,
    },
    consent: null,
    sync: {
      brevo: { ...SYNCED, state: brevo },
      apollo: { ...SYNCED, state: apollo },
    },
    owner: null,
    lastSeenAt: null,
  } as AccountRow;
}

describe("replayPairs (05 RG101, RG103)", () => {
  it("replays the failed destinations of the selected rows only, never a normal case", () => {
    const rows = [
      row("a", "failed", "skipped"),
      row("b", "failed", "failed"),
      row("c", "skipped", "failed"),
    ];
    expect(replayPairs(rows, new Set(["a", "b"]))).toEqual([
      { accountId: "a", destination: "brevo" },
      { accountId: "b", destination: "brevo" },
      { accountId: "b", destination: "apollo" },
    ]);
    expect(replayPairs(rows, new Set())).toEqual([]);
  });
});

describe("Apollo settings as typed (05 RG83, RG84)", () => {
  it("keeps the known ISO codes once, and names the unknown ones", () => {
    expect(parseCountryList("fr, BE  fr;zz")).toEqual({
      codes: ["FR", "BE"],
      unknown: ["ZZ"],
    });
    expect(parseCountryList("  ")).toEqual({ codes: [], unknown: [] });
  });

  it("reads one exception per line, refuses a malformed line or a country twice, and writes it back", () => {
    const entries = parseByCountry("DE consentement\n\nit interet");
    expect(entries).toEqual([
      { countryCode: "DE", basis: "consentement_requis" },
      { countryCode: "IT", basis: "interet_legitime_avec_opposition" },
    ]);
    expect(formatByCountry(entries ?? [])).toBe("DE consentement\nIT interet");
    expect(parseByCountry("DE")).toBeNull();
    expect(parseByCountry("DE consentement\nde interet")).toBeNull();
    expect(parseByCountry("XX consentement")).toBeNull();
  });
});

describe("words of the screens", () => {
  it("says a browser by family and system, never a version (05 RG144)", () => {
    expect(browserLabel("firefox.windows")).toBe("Firefox sur Windows");
    expect(browserLabel("unidentified.unidentified")).toBe(
      messages.browserUnidentified,
    );
  });

  it("gives a share only when somebody was concerned (05 RG105)", () => {
    expect(sharePercent(0, 0)).toBeNull();
    expect(sharePercent(2, 3)).toBe(67);
  });

  it("turns a refusal into words, R into the confirmation of identity, a lost session into sign-in", () => {
    expect(
      failureOf({ kind: "failed", code: "reauthentication_required" }),
    ).toBe("reauth");
    expect(failureOf({ kind: "unauthenticated" })).toBe("signedOut");
    expect(failureOf({ kind: "failed", code: "forbidden" })).toBe(
      messages.failure.forbidden,
    );
    expect(failureOf({ kind: "failed" })).toBe(messages.failure.unavailable);
  });
});

describe("J8S-7 (05 RG98): the search term, exact or partial, never in a URL", () => {
  it("reads a whole address as the exact search, any other term as the partial one", () => {
    expect(accountSearchOf("  Jeanne@Example.test ")).toEqual({
      email: "Jeanne@Example.test",
    });
    // EC-J8-58 lifted: '@' and '.' travel in the body
    expect(accountSearchOf("@example.")).toEqual({ q: "@example." });
    expect(accountSearchOf("dup")).toEqual({ q: "dup" });
    expect(accountSearchOf("   ")).toBeNull();
  });

  it("refuses a short fragment, a space, a term longer than an address", () => {
    expect(accountSearchOf("du")).toBe("invalid");
    expect(accountSearchOf("du pont")).toBe("invalid");
    expect(accountSearchOf("a".repeat(255))).toBe("invalid");
  });
});

describe("05 RG97: the period of the date fields, bounds included, in the browser's zone", () => {
  it("starts at the local midnight of the first day and ends just before the day after the last", () => {
    expect(periodOf("2026-10-01", "2026-10-31")).toEqual({
      from: new Date(2026, 9, 1).toISOString(),
      to: new Date(new Date(2026, 10, 1).getTime() - 1).toISOString(),
    });
    expect(periodOf(undefined, "2026-12-31")).toEqual({
      to: new Date(new Date(2027, 0, 1).getTime() - 1).toISOString(),
    });
    expect(periodOf(undefined, undefined)).toEqual({});
    // one day is a period
    expect(periodOf("2026-10-20", "2026-10-20")).not.toBe("invalid");
  });

  it("refuses a malformed or impossible day, and a period that ends before it starts", () => {
    expect(periodOf("2026-02-30", undefined)).toBe("invalid");
    expect(periodOf("20261001", undefined)).toBe("invalid");
    expect(periodOf("2026-10-02", "2026-10-01")).toBe("invalid");
  });
});

import { describe, expect, it } from "vitest";
import {
  ACCOUNTS_PAGE_SIZE_DEFAULT,
  ACCOUNTS_PAGE_SIZE_MAX,
  accountRowSchema,
  accountsQuerySchema,
  accountsSearchSchema,
} from "../src/backoffice-accounts.ts";

describe("GET /v1/bo/accounts query (05 RG97; 15 RG34; J8S-7)", () => {
  it("defaults the page and coerces it from the query string", () => {
    expect(accountsQuerySchema.parse({})).toEqual({
      limit: ACCOUNTS_PAGE_SIZE_DEFAULT,
    });
    expect(accountsQuerySchema.parse({ limit: "50", role: "creator" })).toEqual(
      { limit: ACCOUNTS_PAGE_SIZE_MAX, role: "creator" },
    );
  });

  it("refuses a search term in the URL (J8S-7), a page over the cap, an unknown filter", () => {
    for (const query of [
      { email: "a@example.test" },
      { q: "exam" },
      { limit: String(ACCOUNTS_PAGE_SIZE_MAX + 1) },
      { limit: "0" },
      { export: "csv" },
      { syncDestination: "apollo" },
      { from: "2026-10-02T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
      { cursor: "not a cursor!" },
      { country: "XX" },
    ]) {
      expect(
        accountsQuerySchema.safeParse(query).success,
        JSON.stringify(query),
      ).toBe(false);
    }
  });
});

describe("POST /v1/bo/accounts/search body (05 RG98; J8S-7)", () => {
  it("normalises the exact address and the fragment, with the filters of the list", () => {
    expect(
      accountsSearchSchema.parse({
        email: "  Jeanne@Example.TEST ",
        from: "2026-10-01T00:00:00.000Z",
      }),
    ).toEqual({
      email: "jeanne@example.test",
      from: "2026-10-01T00:00:00.000Z",
      limit: ACCOUNTS_PAGE_SIZE_DEFAULT,
    });
    // a fragment may now carry the characters of an address: it never meets a URL
    expect(accountsSearchSchema.parse({ q: " DUPont@Ex.", limit: 50 })).toEqual(
      { q: "dupont@ex.", limit: ACCOUNTS_PAGE_SIZE_MAX },
    );
  });

  it("lists without a term, with the filters and the period of the list", () => {
    expect(accountsSearchSchema.parse({})).toEqual({
      limit: ACCOUNTS_PAGE_SIZE_DEFAULT,
    });
    expect(
      accountsSearchSchema.parse({
        role: "creator",
        from: "2026-10-01T00:00:00.000Z",
        to: "2026-10-01T23:59:59.999Z",
      }),
    ).toMatchObject({ role: "creator", to: "2026-10-01T23:59:59.999Z" });
  });

  it("never both terms; refuses a short or spaced fragment, a page as text, an unknown field", () => {
    for (const body of [
      { email: "a@example.test", q: "exam" },
      { q: "ab" },
      { q: "du pont" },
      { email: "not-an-address" },
      { q: "dupont", limit: "20" },
      { q: "dupont", export: "csv" },
      { q: "dupont", syncDestination: "apollo" },
      {
        q: "dupont",
        from: "2026-10-02T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      },
    ]) {
      expect(
        accountsSearchSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });
});

describe("a line of the list (05 RG97, RG107)", () => {
  it("carries neither an address nor a company name", () => {
    const shape = Object.keys(accountRowSchema.shape);
    expect(shape).not.toContain("email");
    expect(shape).not.toContain("companyName");
  });
});

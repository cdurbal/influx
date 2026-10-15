import { describe, expect, it } from "vitest";
import {
  ACCOUNTS_PAGE_SIZE_DEFAULT,
  ACCOUNTS_PAGE_SIZE_MAX,
  accountRowSchema,
  accountsQuerySchema,
} from "../src/backoffice-accounts.ts";

describe("GET /v1/bo/accounts query (05 RG97, RG98; 15 RG34)", () => {
  it("defaults the page, normalises the exact address and the fragment", () => {
    const parsed = accountsQuerySchema.parse({
      email: "  Jeanne@Example.TEST ",
    });
    expect(parsed).toEqual({
      email: "jeanne@example.test",
      limit: ACCOUNTS_PAGE_SIZE_DEFAULT,
    });
    expect(accountsQuerySchema.parse({ q: " DUPont ", limit: "50" })).toEqual({
      q: "dupont",
      limit: ACCOUNTS_PAGE_SIZE_MAX,
    });
  });

  it("refuses a page over the cap, both searches at once, a short fragment, an unknown filter", () => {
    for (const query of [
      { limit: String(ACCOUNTS_PAGE_SIZE_MAX + 1) },
      { limit: "0" },
      { email: "a@example.test", q: "exam" },
      { q: "ab" },
      { email: "not-an-address" },
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

describe("a line of the list (05 RG97, RG107)", () => {
  it("carries neither an address nor a company name", () => {
    const shape = Object.keys(accountRowSchema.shape);
    expect(shape).not.toContain("email");
    expect(shape).not.toContain("companyName");
  });
});

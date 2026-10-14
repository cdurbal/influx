import { describe, expect, it } from "vitest";
import {
  acceptTermsBodySchema,
  meResponseSchema,
  revokeAllSessionsResponseSchema,
  sessionsResponseSchema,
  updateConsentBodySchema,
  updateMeBodySchema,
} from "../src/account.ts";

describe("PATCH /v1/me body (05 RG15, RG22; 17 §6.1)", () => {
  it("accepts any non-empty subset of the four fields", () => {
    expect(
      updateMeBodySchema.safeParse({ preferredLanguage: "en" }).success,
    ).toBe(true);
    expect(
      updateMeBodySchema.safeParse({
        countryCode: "BE",
        declaredStatus: "business",
        companyName: "Maison Exemple",
      }).success,
    ).toBe(true);
  });

  it("refuses an empty body, the address, an unknown language or country, a short company name", () => {
    for (const body of [
      {},
      { email: "autre@example.test" },
      { preferredLanguage: "de" },
      { countryCode: "XX" },
      { companyName: " a " },
    ]) {
      expect(
        updateMeBodySchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });
});

describe("the other bodies are strict", () => {
  it("refuses an extra field", () => {
    expect(
      updateConsentBodySchema.safeParse({ granted: false, purpose: "x" })
        .success,
    ).toBe(false);
    expect(
      acceptTermsBodySchema.safeParse({
        termsVersionId: "00000000-0000-4000-8000-000000000001",
        accepted: true,
      }).success,
    ).toBe(false);
  });
});

describe("the answers carry no country of a session and nothing else than declared (05 RG143)", () => {
  it("refuses a session with a country, and an unknown browser summary", () => {
    const session = {
      id: "00000000-0000-4000-8000-000000000001",
      createdAt: "2026-10-14T08:00:00.000Z",
      lastActivityAt: "2026-10-14T09:00:00.000Z",
      browser: "firefox.windows",
      current: true,
    };
    expect(
      sessionsResponseSchema.safeParse({ sessions: [session] }).success,
    ).toBe(true);
    expect(
      sessionsResponseSchema.safeParse({
        sessions: [{ ...session, countryCode: "FR" }],
      }).success,
    ).toBe(false);
    expect(
      sessionsResponseSchema.safeParse({
        sessions: [{ ...session, browser: "Firefox 131" }],
      }).success,
    ).toBe(false);
  });

  it("signs out on closing all sessions, at least one closed", () => {
    expect(
      revokeAllSessionsResponseSchema.safeParse({
        outcome: "revoked",
        revokedCount: 0,
        signedOut: true,
      }).success,
    ).toBe(false);
  });

  it("describes the terms to accept or null, never anything else", () => {
    const me = {
      email: "membre@example.test",
      role: "creator",
      preferredLanguage: "fr",
      countryCode: "FR",
      declaredStatus: "individual",
      companyName: null,
      termsToAccept: null,
    };
    expect(meResponseSchema.safeParse(me).success).toBe(true);
    expect(
      meResponseSchema.safeParse({ ...me, termsToAccept: undefined }).success,
    ).toBe(false);
  });
});

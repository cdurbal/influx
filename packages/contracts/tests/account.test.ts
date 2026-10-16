import { describe, expect, it } from "vitest";
import {
  acceptTermsBodySchema,
  confirmEmailChangeBodySchema,
  confirmEmailChangeResponseSchema,
  DATA_EXPORT_MAX_DOWNLOADS,
  dataExportDownloadResponseSchema,
  dataExportStateResponseSchema,
  emailChangeBodySchema,
  meResponseSchema,
  reauthRequestCodeBodySchema,
  reauthVerifyCodeBodySchema,
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

describe("re-authentication bodies (05 RG57; J7 decision 4)", () => {
  it("takes a purpose of the closed list only, never an address", () => {
    expect(
      reauthRequestCodeBodySchema.safeParse({ purpose: "email_change" })
        .success,
    ).toBe(true);
    for (const body of [
      {},
      { purpose: "login" },
      { purpose: "data_export", email: "autre@example.test" },
    ]) {
      expect(reauthRequestCodeBodySchema.safeParse(body).success).toBe(false);
    }
  });

  it("verifies six digits with the journey token of the request", () => {
    const body = {
      purpose: "account_deletion",
      code: "012345",
      reauthToken: "eyJ0eXAiOiJyZWF1dGgifQ.signature",
    };
    expect(reauthVerifyCodeBodySchema.safeParse(body).success).toBe(true);
    for (const wrong of [
      { ...body, code: "12345" },
      { ...body, code: "12345a" },
      { ...body, reauthToken: "" },
      { purpose: body.purpose, code: body.code },
    ]) {
      expect(reauthVerifyCodeBodySchema.safeParse(wrong).success).toBe(false);
    }
  });
});

describe("change of address (05 RG58; J7 decision 5)", () => {
  it("normalises the new address as the sign-in does (lower case, trimmed)", () => {
    expect(
      emailChangeBodySchema.parse({ newEmail: "  Lena.K@Example.TEST " }),
    ).toEqual({ newEmail: "lena.k@example.test" });
    expect(
      emailChangeBodySchema.safeParse({ newEmail: "not-an-address" }).success,
    ).toBe(false);
  });

  it("confirms one side of a request with six digits", () => {
    const body = {
      requestId: "5d0c7e1a-2b3f-4c6d-8e9f-0a1b2c3d4e5f",
      side: "new",
      code: "604218",
    };
    expect(confirmEmailChangeBodySchema.safeParse(body).success).toBe(true);
    expect(
      confirmEmailChangeBodySchema.safeParse({ ...body, side: "both" }).success,
    ).toBe(false);
  });

  it("tells a taken address by one outcome, never who holds it (decision 5 as revised, C5.a)", () => {
    for (const outcome of ["completed", "address_unavailable"]) {
      expect(
        confirmEmailChangeResponseSchema.safeParse({ outcome }).success,
      ).toBe(true);
    }
    expect(
      confirmEmailChangeResponseSchema.safeParse({
        outcome: "address_unavailable",
        heldBy: "account",
      }).success,
    ).toBe(false);
  });
});

describe("the export downloaded in the space (runbook demandes-rgpd §4; J8 commit 8)", () => {
  const ID = "8a7f6e5d-4c3b-4a29-9817-a6f5e4d3c2b1";

  it("states the latest export or null, never more than three downloads left", () => {
    expect(
      dataExportStateResponseSchema.safeParse({ export: null }).success,
    ).toBe(true);
    const state = {
      id: ID,
      requestId: ID,
      publishedAt: "2026-10-16T08:00:00.000Z",
      expiresAt: "2026-10-23T08:00:00.000Z",
      downloadsLeft: DATA_EXPORT_MAX_DOWNLOADS,
      available: true,
    };
    expect(
      dataExportStateResponseSchema.safeParse({ export: state }).success,
    ).toBe(true);
    expect(
      dataExportStateResponseSchema.safeParse({
        export: { ...state, downloadsLeft: DATA_EXPORT_MAX_DOWNLOADS + 1 },
      }).success,
    ).toBe(false);
  });

  it("carries the file as text with its digest and its name, nothing else", () => {
    const download = {
      id: ID,
      fileName: "influx-data-export-2026-10-16.json",
      content: '{"format": "influx.data_export"}',
      sha256: "a".repeat(64),
      sizeBytes: 33,
      downloadsLeft: 2,
    };
    expect(
      dataExportDownloadResponseSchema.safeParse({ export: download }).success,
    ).toBe(true);
    for (const wrong of [
      { ...download, fileName: "../etc/passwd" },
      { ...download, sha256: "A".repeat(64) },
      { ...download, accountId: ID },
    ]) {
      expect(
        dataExportDownloadResponseSchema.safeParse({ export: wrong }).success,
      ).toBe(false);
    }
  });
});

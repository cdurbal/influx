import { describe, expect, it } from "vitest";
import {
  currentTermsQuerySchema,
  currentTermsResponseSchema,
  isDraftLabel,
} from "../src/terms.ts";

describe("GET /v1/terms/current, query (21 EC-62)", () => {
  it("accepts the three public documents in French and English", () => {
    for (const document of [
      "terms_of_service",
      "privacy_policy",
      "cookie_policy",
    ]) {
      for (const locale of ["fr", "en"]) {
        expect(
          currentTermsQuerySchema.safeParse({ document, locale }).success,
        ).toBe(true);
      }
    }
  });

  it("refuses the supervision notice, another language and any other parameter", () => {
    for (const query of [
      { document: "supervision_notice", locale: "fr" },
      { document: "terms_of_service", locale: "de" },
      { document: "terms_of_service" },
      { document: "terms_of_service", locale: "fr", extra: "1" },
      { document: ["terms_of_service"], locale: "fr" },
    ]) {
      expect(currentTermsQuerySchema.safeParse(query).success).toBe(false);
    }
  });
});

describe("GET /v1/terms/current, response", () => {
  const valid = {
    id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    document: "terms_of_service",
    locale: "en",
    isFallback: true,
    versionLabel: "draft-1",
    effectiveFrom: "2026-10-08T09:00:00.000Z",
    requiresAcceptance: true,
    contentSha256: "a".repeat(64),
    content: "# Terms",
  };

  it("accepts a well-formed version and refuses an undeclared field", () => {
    expect(currentTermsResponseSchema.safeParse(valid).success).toBe(true);
    expect(
      currentTermsResponseSchema.safeParse({ ...valid, contentUri: "x" })
        .success,
    ).toBe(false);
  });

  it("refuses a malformed fingerprint, label or empty text", () => {
    for (const change of [
      { contentSha256: "A".repeat(64) },
      { contentSha256: "a".repeat(63) },
      { versionLabel: "../draft-1" },
      { content: "" },
    ]) {
      expect(
        currentTermsResponseSchema.safeParse({ ...valid, ...change }).success,
      ).toBe(false);
    }
  });

  it("tells a draft from a final version by its label", () => {
    expect(isDraftLabel("draft-1")).toBe(true);
    expect(isDraftLabel("2026-11")).toBe(false);
    expect(isDraftLabel("v1-draft-")).toBe(false);
  });
});

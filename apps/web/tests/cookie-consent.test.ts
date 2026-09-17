import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_VERSION,
  createConsent,
  isConsentValid,
  parseConsent,
  serializeConsent,
} from "../src/components/landing/cookie-consent";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const shift = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

describe("cookie consent record (11 §7)", () => {
  it("serializes and parses a decision without loss", () => {
    const record = createConsent("rejected", NOW);
    expect(parseConsent(serializeConsent(record))).toEqual(record);
  });

  it("treats an absent or corrupted value as no choice at all", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("not json")).toBeNull();
    expect(
      parseConsent('{"decision":"maybe","version":1,"decidedAt":"x"}'),
    ).toBeNull();
  });

  it("honours a choice for 6 months, and no longer", () => {
    const record = createConsent("accepted", NOW);
    expect(
      isConsentValid(record, shift(COOKIE_CONSENT_MAX_AGE_SECONDS - 1)),
    ).toBe(true);
    expect(isConsentValid(record, shift(COOKIE_CONSENT_MAX_AGE_SECONDS))).toBe(
      false,
    );
  });

  it("gives acceptance and rejection the exact same lifetime (no dark pattern)", () => {
    const halfway = shift(COOKIE_CONSENT_MAX_AGE_SECONDS / 2);
    const expired = shift(COOKIE_CONSENT_MAX_AGE_SECONDS);
    for (const decision of ["accepted", "rejected"] as const) {
      const record = createConsent(decision, NOW);
      expect(isConsentValid(record, halfway)).toBe(true);
      expect(isConsentValid(record, expired)).toBe(false);
    }
  });

  it("asks again when the consent text version changed", () => {
    const record = {
      ...createConsent("accepted", NOW),
      version: COOKIE_CONSENT_VERSION + 1,
    };
    expect(isConsentValid(record, NOW)).toBe(false);
  });
});

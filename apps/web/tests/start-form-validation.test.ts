import { describe, expect, it } from "vitest";
import {
  changeProfile,
  createInitialValues,
  firstInvalidField,
  validateStep,
  type StartFormValues,
} from "@/components/landing/start-form-validation";

function values(overrides: Partial<StartFormValues> = {}): StartFormValues {
  return { ...createInitialValues("fr"), ...overrides };
}

describe("createInitialValues", () => {
  it("never pre-checks the marketing consent and preselects the page language (CA9)", () => {
    const initial = createInitialValues("en");
    expect(initial.marketingConsent).toBe(false);
    expect(initial.terms).toBe(false);
    expect(initial.adult).toBe(false);
    expect(initial.profile).toBeNull();
    expect(initial.language).toBe("en");
  });
});

describe("validateStep, step 1", () => {
  it("requires a profile", () => {
    expect(validateStep(1, values())).toEqual({ profile: "required" });
  });

  it("accepts either profile", () => {
    expect(validateStep(1, values({ profile: "advertiser" }))).toEqual({});
    expect(validateStep(1, values({ profile: "creator" }))).toEqual({});
  });
});

describe("validateStep, step 2", () => {
  it("requires email, company and country for an advertiser", () => {
    expect(validateStep(2, values({ profile: "advertiser" }))).toEqual({
      email: "required",
      company: "required",
      country: "required",
    });
  });

  it("does not ask a creator for a company name", () => {
    expect(validateStep(2, values({ profile: "creator" }))).toEqual({
      email: "required",
      country: "required",
    });
  });

  it("treats blank spaces as empty", () => {
    const errors = validateStep(
      2,
      values({ profile: "advertiser", email: "   ", company: "  " }),
    );
    expect(errors.email).toBe("required");
    expect(errors.company).toBe("required");
  });

  it.each(["name", "name@", "name@domain", "@domain.com", "na me@domain.com"])(
    "rejects the malformed email %s",
    (email) => {
      expect(
        validateStep(2, values({ profile: "creator", email, country: "FR" }))
          .email,
      ).toBe("format");
    },
  );

  it("accepts a well-formed step", () => {
    expect(
      validateStep(
        2,
        values({
          profile: "advertiser",
          email: "name@domain.example",
          company: "Acme",
          country: "CA",
        }),
      ),
    ).toEqual({});
  });
});

describe("validateStep, step 3", () => {
  it("requires the age statement for creators only", () => {
    expect(
      validateStep(3, values({ profile: "creator", terms: true })),
    ).toEqual({
      adult: "required",
    });
    expect(
      validateStep(3, values({ profile: "advertiser", terms: true })),
    ).toEqual({});
  });

  it("requires the terms, separately from the optional marketing consent (CA9)", () => {
    expect(
      validateStep(
        3,
        values({ profile: "advertiser", marketingConsent: true }),
      ),
    ).toEqual({
      terms: "required",
    });
    expect(
      validateStep(
        3,
        values({
          profile: "creator",
          adult: true,
          terms: true,
          marketingConsent: false,
        }),
      ),
    ).toEqual({});
  });
});

describe("firstInvalidField", () => {
  it("follows the display order of the step", () => {
    expect(firstInvalidField(2, { country: "required", email: "format" })).toBe(
      "email",
    );
    expect(firstInvalidField(3, { terms: "required", adult: "required" })).toBe(
      "adult",
    );
    expect(firstInvalidField(1, {})).toBeNull();
  });
});

describe("changeProfile", () => {
  it("unchecks the marketing consent when the profile changes, and keeps the other answers", () => {
    const before = values({
      profile: "advertiser",
      email: "name@domain.example",
      company: "Acme",
      marketingConsent: true,
      terms: true,
    });
    const after = changeProfile(before, "creator");
    expect(after.profile).toBe("creator");
    expect(after.marketingConsent).toBe(false);
    expect(after.email).toBe("name@domain.example");
    expect(after.company).toBe("Acme");
    expect(after.terms).toBe(true);
  });

  it("keeps the consent when the same profile is selected again", () => {
    const before = values({ profile: "creator", marketingConsent: true });
    expect(changeProfile(before, "creator")).toBe(before);
  });
});

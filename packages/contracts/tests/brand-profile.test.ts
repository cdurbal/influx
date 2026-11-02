import { describe, expect, it } from "vitest";
import {
  brandProfileResponseSchema,
  submitBrandProfileResponseSchema,
  updateBrandProfileBodySchema,
  updateBrandProfileResponseSchema,
} from "../src/brand-profile.ts";

describe("PATCH /v1/me/brand-profile body (06 RG14, RG15, RG27, RG35)", () => {
  it("accepts any non-empty subset of the fields, `null` emptying a single value", () => {
    for (const body of [
      { companySize: "11_50" },
      { primarySector: null, presentation: null, website: null },
      { topics: ["fashion", "beauty"], targetMarkets: ["FR", "BE"] },
      { workingLanguages: ["fr", "en"], usageRights: [] },
      { contact: { firstName: "Camille", phone: "+33612345678" } },
      { contact: { email: null } },
      { contactRole: "ecommerce", offersNonMonetary: false },
    ]) {
      expect(
        updateBrandProfileBodySchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(true);
    }
  });

  it("refuses an empty body, an unknown field, and every field the profile does not hold (CA2, CA14, D48, D78)", () => {
    for (const body of [
      {},
      { contact: {} },
      { countryCode: "FR" },
      { preferredLanguage: "fr" },
      { email: "a@b.test" },
      { status: "published" },
      { accountId: "00000000-0000-4000-8000-000000000000" },
      { instagram: "@maison" },
      { budgetBand: "up_to_1000" },
      { logo: "data:image/png;base64,AAAA" },
    ]) {
      expect(
        updateBrandProfileBodySchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });

  it("holds the caps and the closed values the database holds (RG15, RG27, L2-amend)", () => {
    const refused = [
      { topics: ["a", "b", "c", "d"] },
      { topics: ["a", "a"] },
      { secondarySectors: ["a", "b", "c"] },
      { targetMarkets: ["FR", "BE", "DE", "ES", "IT", "GB"] },
      { audienceCountries: ["XX"] },
      { workingLanguages: ["de"] },
      { usageRights: ["none"] },
      { companySize: "12" },
      { companySize: 12 },
      { exclusivityBand: "forever" },
      { contactRole: "intern" },
      { primarySector: "Not A Code" },
      { presentation: "é".repeat(1001) },
      { presentation: "bad\u0007text" },
    ];
    for (const body of refused) {
      expect(
        updateBrandProfileBodySchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
    expect(
      updateBrandProfileBodySchema.safeParse({
        presentation: `${"é".repeat(990)}\n\t\r${"a".repeat(7)}`,
      }).success,
    ).toBe(true);
  });

  it("normalises and checks the contact person like the database (RG35)", () => {
    const parsed = updateBrandProfileBodySchema.parse({
      contact: { email: "  Contact@Exemple.TEST " },
    });
    expect(parsed.contact?.email).toBe("contact@exemple.test");
    for (const contact of [
      { email: "not-an-address" },
      { phone: "06 12 34 56 78" },
      { phone: "+12345" },
      { url: "http://exemple.test" },
      { url: "https://user:secret@exemple.test" },
      { firstName: "x".repeat(41) },
    ]) {
      expect(
        updateBrandProfileBodySchema.safeParse({ contact }).success,
        JSON.stringify(contact),
      ).toBe(false);
    }
  });
});

describe("the answers of the brand profile (06 RG57, RG61, D46)", () => {
  const completeness = {
    score: 9,
    earnedPoints: 7,
    attainablePoints: 82,
    blocks: [
      {
        id: "identity",
        earnedPoints: 7,
        attainablePoints: 40,
        criteria: [
          { code: "legalName", points: 5, offered: true, earned: true },
        ],
      },
    ],
  };
  const profile = {
    status: "draft",
    submittedAt: null,
    companyName: "Maison Exemple",
    country: "FR",
    preferredLanguage: "fr",
    primarySector: null,
    secondarySectors: [],
    companySize: null,
    targetMarkets: [],
    workingLanguages: [],
    website: null,
    presentation: null,
    topics: [],
    networks: [],
    formats: [],
    audienceCountries: [],
    usageRights: [],
    exclusivityBand: null,
    collaborationRhythm: null,
    offersNonMonetary: null,
    contactRole: null,
    contact: { firstName: null, email: null, phone: null, url: null },
    signInEmail: "marque@example.test",
    completeness,
    missingRequired: ["primarySector", "contactRole"],
    references: {
      sectors: [],
      topics: [],
      networks: [],
      formats: [],
      usageRights: [],
      countries: [],
      languages: ["en", "fr"],
    },
  };

  it("parses a profile, and strips nothing it does not declare: an extra field is refused", () => {
    expect(brandProfileResponseSchema.safeParse(profile).success).toBe(true);
    expect(
      brandProfileResponseSchema.safeParse({ ...profile, accountId: "x" })
        .success,
    ).toBe(false);
    expect(
      brandProfileResponseSchema.safeParse({
        ...profile,
        contact: { ...profile.contact, secret: "x" },
      }).success,
    ).toBe(false);
  });

  it("refuses a state, a band or a missing field outside the closed lists", () => {
    for (const change of [
      { status: "approved" },
      { companySize: "12" },
      { missingRequired: ["budgetBand"] },
      { country: "XX" },
    ]) {
      expect(
        brandProfileResponseSchema.safeParse({ ...profile, ...change }).success,
        JSON.stringify(change),
      ).toBe(false);
    }
  });

  it("extends the profile with what PATCH and submit add, and nothing else", () => {
    expect(
      updateBrandProfileResponseSchema.safeParse({
        ...profile,
        websiteNormalized: true,
      }).success,
    ).toBe(true);
    expect(
      submitBrandProfileResponseSchema.safeParse({ ...profile, changed: false })
        .success,
    ).toBe(true);
    expect(updateBrandProfileResponseSchema.safeParse(profile).success).toBe(
      false,
    );
  });

  it("carries no amount, rate, net or price field (CLAUDE.md §2, D48, D78)", () => {
    expect(
      Object.keys(brandProfileResponseSchema.shape).filter((key) =>
        /^(budget|price|rate|net$|netAmount|netCreator|commission|amount|tariff)/i.test(
          key,
        ),
      ),
    ).toEqual([]);
  });
});

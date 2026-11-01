import { describe, expect, it } from "vitest";
import {
  BRAND_PROFILE_REQUIRED_FIELDS,
  BRAND_PROFILE_SUSPENDED_REQUIRED_FIELDS,
  missingRequiredFields,
  type BrandProfileRequiredInput,
} from "../src/brand-profile/index.ts";

const FILLED: BrandProfileRequiredInput = {
  legalName: "Maison Aube",
  primarySector: "fashion",
  companySize: "11-50",
  country: "FR",
  targetMarkets: ["FR"],
  workingLanguages: ["fr"],
  presentation: "x".repeat(120),
  topics: ["beauty"],
  networks: ["instagram"],
  formats: ["reel"],
  audienceCountries: ["FR"],
  contactRole: "marketing",
};

describe("required fields of 06 RG15, RG27, RG35", () => {
  it("lists them in the order of the form, block by block (RG5, RG61)", () => {
    expect(BRAND_PROFILE_REQUIRED_FIELDS).toEqual([
      "legalName",
      "primarySector",
      "companySize",
      "country",
      "targetMarkets",
      "workingLanguages",
      "presentation",
      "topics",
      "networks",
      "formats",
      "audienceCountries",
      "contactRole",
    ]);
  });

  it("leaves the budget out while it is suspended (answer A, D78)", () => {
    expect(BRAND_PROFILE_SUSPENDED_REQUIRED_FIELDS).toEqual(["budgetBand"]);
    expect(BRAND_PROFILE_REQUIRED_FIELDS).not.toContain("budgetBand");
  });

  it("holds no optional field (logo, secondary sectors, site, first name, phone, e-mail)", () => {
    for (const optional of [
      "logo",
      "secondarySectors",
      "websiteDomain",
      "firstName",
      "contactPhone",
      "contactEmail",
    ]) {
      expect(BRAND_PROFILE_REQUIRED_FIELDS).not.toContain(optional);
    }
  });
});

describe("RG61 what is missing, named and in order", () => {
  it("names every field of an empty profile in the order of the form", () => {
    expect(missingRequiredFields({})).toEqual([
      ...BRAND_PROFILE_REQUIRED_FIELDS,
    ]);
  });

  it("names nothing once the required fields are filled, whatever the score (CA37)", () => {
    expect(missingRequiredFields(FILLED)).toEqual([]);
  });

  it("keeps the order of the form whatever the order of the input", () => {
    const shuffled: BrandProfileRequiredInput = {
      contactRole: null,
      formats: [],
      companySize: "",
      legalName: "Maison Aube",
      presentation: "x".repeat(119),
    };
    expect(missingRequiredFields(shuffled)).toEqual([
      "primarySector",
      "companySize",
      "country",
      "targetMarkets",
      "workingLanguages",
      "presentation",
      "topics",
      "networks",
      "formats",
      "audienceCountries",
      "contactRole",
    ]);
  });

  it("counts a blank or one-letter name, and a blank choice, as missing", () => {
    expect(
      missingRequiredFields({
        ...FILLED,
        legalName: " a ",
        primarySector: "  ",
      }),
    ).toEqual(["legalName", "primarySector"]);
  });
});

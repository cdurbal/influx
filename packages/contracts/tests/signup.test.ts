// TM10.3 (18): the rules of screen 3, as the server applies them to any caller (05 RG10). The same
// schema serves the browser; the database half is apps/api/db-tests/tm10-signup-route.test.ts.
import { describe, expect, it } from "vitest";
import { ISO_COUNTRY_CODES } from "../src/countries.ts";
import {
  CONSENT_WORDING_KEYS,
  normalizeReferrerDomain,
  normalizeUtmValue,
  signupBodySchema,
  signupResponseSchema,
} from "../src/signup.ts";

const TERMS_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const ADVERTISER = {
  role: "advertiser",
  companyName: "Maison Test",
  countryCode: "GB",
  preferredLanguage: "en",
  termsVersionId: TERMS_ID,
  termsAccepted: true,
  marketingConsent: true,
  consentWordingKey: CONSENT_WORDING_KEYS.advertiser,
  consentWording:
    "I agree that INFLUX records my details in Brevo and Apollo.io.",
  displayLocale: "en",
} as const;

const CREATOR = {
  role: "creator",
  countryCode: "FR",
  preferredLanguage: "fr",
  declaredStatus: "individual",
  adultAttested: true,
  termsVersionId: TERMS_ID,
  termsAccepted: true,
  marketingConsent: true,
  consentWordingKey: CONSENT_WORDING_KEYS.creator,
  consentWording:
    "J'accepte qu'INFLUX enregistre mes coordonnées dans Brevo et Apollo.io.",
  displayLocale: "fr",
} as const;

function issuesOf(body: unknown): string[] {
  const parsed = signupBodySchema.safeParse(body);
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => issue.path.join("."));
}

describe("POST /v1/signup, body: two variants never merged (05 RG1)", () => {
  it("accepts a complete advertiser and a complete creator", () => {
    expect(signupBodySchema.safeParse(ADVERTISER).success).toBe(true);
    expect(signupBodySchema.safeParse(CREATOR).success).toBe(true);
  });

  it("refuses an internal role, a missing role and an unknown one (EC-30)", () => {
    for (const role of ["agent", "admin", undefined, "brand"]) {
      expect(signupBodySchema.safeParse({ ...CREATOR, role }).success).toBe(
        false,
      );
    }
  });

  it.each([
    ["a declared status (RG22)", { declaredStatus: "individual" }],
    [
      "a business declared status (RG22: imposed, never sent)",
      { declaredStatus: "business" },
    ],
    ["an adult attestation", { adultAttested: true }],
    [
      "the creator's wording key (RG4)",
      { consentWordingKey: CONSENT_WORDING_KEYS.creator },
    ],
    ["an e-mail address (EC-4: the token's only)", { email: "a@example.test" }],
    ["a phone number (RG16)", { phone: "+447700900000" }],
  ])("refuses an advertiser with %s", (_label, extra) => {
    expect(
      signupBodySchema.safeParse({ ...ADVERTISER, ...extra }).success,
    ).toBe(false);
  });

  it.each([
    ["a company name (RG21)", { companyName: "Maison Test" }],
    ["no declared status (RG18, CA7)", { declaredStatus: undefined }],
    ["an unknown declared status", { declaredStatus: "company" }],
    ["no adult attestation (RG19, CA8)", { adultAttested: undefined }],
    ["an unchecked adult attestation (D15)", { adultAttested: false }],
    [
      "the advertiser's wording key (RG4)",
      { consentWordingKey: CONSENT_WORDING_KEYS.advertiser },
    ],
    ["a pseudonym (RG21, CA9)", { pseudonym: "creator" }],
    ["a follower count (RG21, CA9)", { followers: 1000 }],
  ])("refuses a creator with %s", (_label, extra) => {
    expect(signupBodySchema.safeParse({ ...CREATOR, ...extra }).success).toBe(
      false,
    );
  });
});

describe("POST /v1/signup, body: fields of screen 3", () => {
  it("refuses unchecked terms (RG23, CA4), whatever the consent", () => {
    for (const termsAccepted of [false, undefined, "true"]) {
      expect(issuesOf({ ...ADVERTISER, termsAccepted })).toEqual([
        "termsAccepted",
      ]);
    }
  });

  it("lets the database decide on a refused consent (D63: a setting may lift it)", () => {
    expect(
      signupBodySchema.safeParse({ ...CREATOR, marketingConsent: false })
        .success,
    ).toBe(true);
    expect(issuesOf({ ...CREATOR, marketingConsent: undefined })).toEqual([
      "marketingConsent",
    ]);
  });

  it("accepts the 249 ISO 3166-1 countries and nothing else (RG8, RG14)", () => {
    expect(ISO_COUNTRY_CODES).toHaveLength(249);
    expect(new Set(ISO_COUNTRY_CODES).size).toBe(249);
    for (const countryCode of ISO_COUNTRY_CODES) {
      expect(
        signupBodySchema.safeParse({ ...CREATOR, countryCode }).success,
      ).toBe(true);
    }
    for (const countryCode of ["", "fr", "FRA", "ZZ", "UK", undefined]) {
      expect(issuesOf({ ...CREATOR, countryCode })).toEqual(["countryCode"]);
    }
  });

  it("has no default country nor language (TM10.5)", () => {
    for (const field of ["countryCode", "preferredLanguage"]) {
      expect(issuesOf({ ...CREATOR, [field]: undefined })).toEqual([field]);
    }
    expect(issuesOf({ ...CREATOR, preferredLanguage: "de" })).toEqual([
      "preferredLanguage",
    ]);
  });

  it.each([
    ["empty", ""],
    ["spaces only", "   "],
    ["one character", " A "],
    ["121 characters", "A".repeat(121)],
    ["a line break", "Maison\nTest"],
  ])("refuses a company name: %s (RG11, CA3)", (_label, companyName) => {
    expect(issuesOf({ ...ADVERTISER, companyName })).toEqual(["companyName"]);
  });

  it("keeps the company name as typed (RG13), counted in characters", () => {
    const parsed = signupBodySchema.parse({
      ...ADVERTISER,
      companyName: " maison TEST ",
    });
    expect(parsed.role === "advertiser" && parsed.companyName).toBe(
      " maison TEST ",
    );
    // 120 characters outside the BMP: 240 UTF-16 units, accepted like the database does
    expect(
      signupBodySchema.safeParse({
        ...ADVERTISER,
        companyName: "😀".repeat(120),
      }).success,
    ).toBe(true);
  });

  it("refuses a wording that is empty, too long or on several lines (RG32)", () => {
    for (const consentWording of ["", "x".repeat(1501), "line\nline"]) {
      expect(issuesOf({ ...CREATOR, consentWording })).toEqual([
        "consentWording",
      ]);
    }
  });

  it("lists every invalid field at once (CA69)", () => {
    expect(
      issuesOf({
        ...CREATOR,
        countryCode: "ZZ",
        declaredStatus: undefined,
        adultAttested: false,
      }).sort(),
    ).toEqual(["adultAttested", "countryCode", "declaredStatus"]);
  });

  it("refuses a terms version that is not a uuid", () => {
    expect(issuesOf({ ...CREATOR, termsVersionId: "draft-2" })).toEqual([
      "termsVersionId",
    ]);
  });
});

describe("POST /v1/signup, body: source of acquisition (RG120, EC-11)", () => {
  it("normalises the UTM values and drops what cannot be stored", () => {
    expect(normalizeUtmValue("  Spring Launch  ")).toBe("spring-launch");
    expect(normalizeUtmValue("newsletter_2026.10")).toBe("newsletter_2026.10");
    expect(normalizeUtmValue("")).toBeNull();
    expect(normalizeUtmValue("<script>")).toBeNull();
    expect(normalizeUtmValue("é")).toBeNull();
    expect(normalizeUtmValue("a".repeat(101))).toBeNull();
  });

  it("keeps a host name only, never a full address (RG120)", () => {
    expect(normalizeReferrerDomain("WWW.Example.COM.")).toBe("www.example.com");
    expect(normalizeReferrerDomain("xn--bcher-kva.example")).toBe(
      "xn--bcher-kva.example",
    );
    for (const raw of [
      "https://www.example.com/path",
      "example.com/path?x=1",
      "localhost",
      "",
      "user@example.com",
    ]) {
      expect(normalizeReferrerDomain(raw)).toBeNull();
    }
  });

  it("drops an IP literal, never a name that only starts with digits (0110)", () => {
    for (const raw of ["127.0.0.1", "192.168.1.1.", "127.1", "[::1]", "::1"]) {
      expect(normalizeReferrerDomain(raw)).toBeNull();
    }
    for (const raw of ["1password.com", "123.example.com", "example.co.uk"]) {
      expect(normalizeReferrerDomain(raw)).toBe(raw);
    }
  });

  it("parses the acquisition block, every field optional, and the closed list of RG120", () => {
    const parsed = signupBodySchema.parse({
      ...CREATOR,
      acquisition: {
        utmSource: "News Letter",
        referrerDomain: "https://example.com/x",
        heardFrom: "social_media",
      },
    });
    expect(parsed.acquisition).toEqual({
      utmSource: "news-letter",
      referrerDomain: null,
      heardFrom: "social_media",
    });
    expect(
      signupBodySchema.safeParse({ ...CREATOR, acquisition: {} }).success,
    ).toBe(true);
    expect(
      issuesOf({ ...CREATOR, acquisition: { heardFrom: "a friend" } }),
    ).toEqual(["acquisition.heardFrom"]);
    expect(
      issuesOf({ ...CREATOR, acquisition: { gclid: "X" } }),
    ).toEqual(["acquisition"]);
    // J8 commit 7: a malformed invitation code is dropped, never refused (05 RG119)
    expect(
      signupBodySchema.parse({ ...CREATOR, acquisition: { invitationCode: "X" } })
        .acquisition,
    ).toEqual({ invitationCode: null });
    expect(
      issuesOf({ ...CREATOR, acquisition: { utmSource: "x".repeat(257) } }),
    ).toEqual(["acquisition.utmSource"]);
  });
});

describe("POST /v1/signup, response", () => {
  it("accepts the five outcomes, and a role only with signed_up", () => {
    for (const response of [
      { outcome: "signed_up", role: "advertiser" },
      { outcome: "signed_up", role: "creator" },
      { outcome: "country_blocked" },
      { outcome: "terms_outdated" },
      { outcome: "terms_not_published" },
      { outcome: "account_unavailable" },
    ]) {
      expect(signupResponseSchema.safeParse(response).success).toBe(true);
    }
    for (const response of [
      { outcome: "signed_up" },
      { outcome: "signed_up", role: "agent" },
      { outcome: "country_blocked", role: "creator" },
      { outcome: "signed_up", role: "creator", accountId: TERMS_ID },
      { outcome: "created" },
    ]) {
      expect(signupResponseSchema.safeParse(response).success).toBe(false);
    }
  });
});

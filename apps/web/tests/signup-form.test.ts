// Screen 3 rules of the journey, as plain functions (docs/mvp/05 RG4, RG10 to RG22, RG32, RG120,
// RG121, D63; 17 §3.4, §3.5; 21 §5.2). The body built is checked against the contract that apps/api
// applies (RG10), so these tests also pin the browser to the server's rules.
import {
  CONSENT_WORDING_KEYS,
  signupBodySchema,
} from "@influx/contracts/signup";
import { describe, expect, it } from "vitest";
import {
  acquisitionFromVisit,
  buildSignupBody,
  draftAfterDoorChange,
  emptySignupDraft,
  signupResultOf,
  validateSignupDraft,
  type SignupDraft,
} from "@/components/auth/signup-form";
import frAuth from "@/locales/fr/auth.json";
import enAuth from "@/locales/en/auth.json";

const TERMS_ID = "6f1c2a8e-3b4d-4c5e-9f60-718293a4b5c6";

const CONTEXT = {
  termsVersionId: TERMS_ID,
  consentWording: "I agree.",
  displayLocale: "en" as const,
  acquisition: undefined,
};

function advertiserDraft(changes: Partial<SignupDraft> = {}): SignupDraft {
  return {
    ...emptySignupDraft("fr"),
    companyName: "Maison Lumen",
    countryCode: "FR",
    termsAccepted: true,
    marketingConsent: true,
    ...changes,
  };
}

function creatorDraft(changes: Partial<SignupDraft> = {}): SignupDraft {
  return {
    ...emptySignupDraft("en"),
    countryCode: "BR",
    declaredStatus: "individual",
    adultAttested: true,
    termsAccepted: true,
    marketingConsent: true,
    ...changes,
  };
}

describe("emptySignupDraft (05 RG11, RG17)", () => {
  it("pre-checks no box, preselects no status and no country, takes the page language", () => {
    expect(emptySignupDraft("en")).toEqual({
      companyName: "",
      countryCode: "",
      preferredLanguage: "en",
      declaredStatus: "",
      adultAttested: false,
      termsAccepted: false,
      marketingConsent: false,
      heardFrom: "",
    });
  });
});

describe("validateSignupDraft (05 RG11, RG17, RG124, CA5)", () => {
  it("lists every missing field of the brand door, in the order of the screen", () => {
    expect(validateSignupDraft("advertiser", emptySignupDraft("fr"))).toEqual([
      { field: "companyName", error: "required" },
      { field: "countryCode", error: "required" },
      { field: "termsAccepted", error: "required" },
      { field: "marketingConsent", error: "required" },
    ]);
  });

  it("lists every missing field of the creator door, never the company name", () => {
    expect(validateSignupDraft("creator", emptySignupDraft("fr"))).toEqual([
      { field: "countryCode", error: "required" },
      { field: "declaredStatus", error: "required" },
      { field: "adultAttested", error: "required" },
      { field: "termsAccepted", error: "required" },
      { field: "marketingConsent", error: "required" },
    ]);
  });

  it("refuses a form complete but for the consent (D63, CA5)", () => {
    expect(
      validateSignupDraft(
        "advertiser",
        advertiserDraft({ marketingConsent: false }),
      ),
    ).toEqual([{ field: "marketingConsent", error: "required" }]);
    expect(
      validateSignupDraft("creator", creatorDraft({ marketingConsent: false })),
    ).toEqual([{ field: "marketingConsent", error: "required" }]);
  });

  it("accepts complete answers", () => {
    expect(validateSignupDraft("advertiser", advertiserDraft())).toEqual([]);
    expect(validateSignupDraft("creator", creatorDraft())).toEqual([]);
  });

  it("applies the company name rule of the contract (05 RG11, RG13)", () => {
    const errorOf = (companyName: string) =>
      validateSignupDraft("advertiser", advertiserDraft({ companyName }));
    expect(errorOf("   ")).toEqual([
      { field: "companyName", error: "required" },
    ]);
    expect(errorOf(" A ")).toEqual([
      { field: "companyName", error: "required" },
    ]);
    expect(errorOf("é".repeat(120))).toEqual([]);
    expect(errorOf("é".repeat(121))).toEqual([
      { field: "companyName", error: "tooLong" },
    ]);
    expect(errorOf("Maison\tLumen")).toEqual([
      { field: "companyName", error: "invalid" },
    ]);
  });

  it("accepts only a code of the ISO 3166-1 list (05 RG8)", () => {
    expect(
      validateSignupDraft("creator", creatorDraft({ countryCode: "XX" })),
    ).toEqual([{ field: "countryCode", error: "required" }]);
    expect(
      validateSignupDraft("creator", creatorDraft({ countryCode: "fr" })),
    ).toEqual([{ field: "countryCode", error: "required" }]);
  });
});

describe("draftAfterDoorChange (05 RG4)", () => {
  it("unticks the consent and clears the fields of the door left", () => {
    const changed = draftAfterDoorChange(
      advertiserDraft({ heardFrom: "event", preferredLanguage: "en" }),
      "advertiser",
      "creator",
    );
    expect(changed).toEqual({
      ...emptySignupDraft("en"),
      termsAccepted: true,
      heardFrom: "event",
    });
    expect(changed.marketingConsent).toBe(false);
  });

  it("clears the creator's status and attestation when going to the brand door", () => {
    const changed = draftAfterDoorChange(
      creatorDraft(),
      "creator",
      "advertiser",
    );
    expect(changed.declaredStatus).toBe("");
    expect(changed.adultAttested).toBe(false);
    expect(changed.marketingConsent).toBe(false);
  });

  it("changes nothing when the same door is chosen again", () => {
    const draft = creatorDraft();
    expect(draftAfterDoorChange(draft, "creator", "creator")).toBe(draft);
  });
});

describe("buildSignupBody (21 §5.2; 05 RG22, RG32)", () => {
  it("builds a brand body the contract accepts, without any declared status (RG22)", () => {
    const body = buildSignupBody("advertiser", advertiserDraft(), CONTEXT);
    expect(body).toEqual({
      role: "advertiser",
      companyName: "Maison Lumen",
      countryCode: "FR",
      preferredLanguage: "fr",
      termsVersionId: TERMS_ID,
      termsAccepted: true,
      marketingConsent: true,
      consentWording: "I agree.",
      displayLocale: "en",
      consentWordingKey: CONSENT_WORDING_KEYS.advertiser,
    });
    expect(signupBodySchema.safeParse(body).success).toBe(true);
  });

  it("builds a creator body with the status and the attestation, no company name", () => {
    const body = buildSignupBody("creator", creatorDraft(), CONTEXT);
    expect(body).toMatchObject({
      role: "creator",
      declaredStatus: "individual",
      adultAttested: true,
      consentWordingKey: CONSENT_WORDING_KEYS.creator,
    });
    expect(body).not.toHaveProperty("companyName");
    expect(signupBodySchema.safeParse(body).success).toBe(true);
  });

  it("carries the source of acquisition and the optional answer (05 RG120)", () => {
    const body = buildSignupBody(
      "creator",
      creatorDraft({ heardFrom: "word_of_mouth" }),
      { ...CONTEXT, acquisition: { utmSource: "newsletter" } },
    );
    expect(body?.acquisition).toEqual({
      utmSource: "newsletter",
      heardFrom: "word_of_mouth",
    });
    expect(
      buildSignupBody("creator", creatorDraft(), CONTEXT),
    ).not.toHaveProperty("acquisition");
  });

  it("builds nothing from incomplete answers", () => {
    expect(
      buildSignupBody("creator", creatorDraft({ declaredStatus: "" }), CONTEXT),
    ).toBeNull();
    expect(
      buildSignupBody(
        "creator",
        creatorDraft({ adultAttested: false }),
        CONTEXT,
      ),
    ).toBeNull();
    expect(
      buildSignupBody(
        "advertiser",
        advertiserDraft({ termsAccepted: false }),
        CONTEXT,
      ),
    ).toBeNull();
    expect(
      buildSignupBody(
        "advertiser",
        advertiserDraft({ countryCode: "" }),
        CONTEXT,
      ),
    ).toBeNull();
  });

  it("builds nothing the contract would refuse (a terms id that is not a UUID)", () => {
    expect(
      buildSignupBody("advertiser", advertiserDraft(), {
        ...CONTEXT,
        termsVersionId: "draft-2",
      }),
    ).toBeNull();
  });
});

describe("acquisitionFromVisit (05 RG120, RG121, 21 EC-11)", () => {
  it("reads the three UTM parameters, normalised as the contract does", () => {
    expect(
      acquisitionFromVisit(
        "?utm_source=News%20Letter&utm_medium=Email&utm_campaign=launch-2026&other=x",
        "",
        "influx.test",
      ),
    ).toEqual({
      utmSource: "news-letter",
      utmMedium: "email",
      utmCampaign: "launch-2026",
    });
  });

  it("drops a UTM value the stored format refuses, never refusing the sign-up", () => {
    expect(
      acquisitionFromVisit(`?utm_source=${"a".repeat(101)}`, "", "influx.test"),
    ).toBeUndefined();
    expect(
      acquisitionFromVisit("?utm_source=%3Cscript%3E", "", "influx.test"),
    ).toBeUndefined();
  });

  it("keeps the domain of the referring site only, never its address", () => {
    expect(
      acquisitionFromVisit(
        "",
        "https://www.Example.org/path/page?q=secret#x",
        "influx.test",
      ),
    ).toEqual({ referrerDomain: "www.example.org" });
  });

  it("ignores this very site, a non-web referrer and an unreadable one", () => {
    expect(
      acquisitionFromVisit("", "https://influx.test/fr", "influx.test"),
    ).toBeUndefined();
    expect(
      acquisitionFromVisit("", "android-app://com.example", "influx.test"),
    ).toBeUndefined();
    expect(
      acquisitionFromVisit("", "not a url", "influx.test"),
    ).toBeUndefined();
    expect(
      acquisitionFromVisit("", "http://[::1]:8080/", "influx.test"),
    ).toBeUndefined();
    expect(
      acquisitionFromVisit("", "http://127.0.0.1:3000/x", "influx.test"),
    ).toBeUndefined();
  });

  it("is undefined for a visit without any source", () => {
    expect(acquisitionFromVisit("", "", "influx.test")).toBeUndefined();
  });
});

describe("signupResultOf (21 §5.2, J5 commit 4)", () => {
  it("renders each refusal of apps/api as its own state", () => {
    expect(
      signupResultOf({
        kind: "ok",
        data: { outcome: "signed_up", role: "creator" },
      }),
    ).toEqual({ kind: "signedUp", role: "creator" });
    expect(
      signupResultOf({ kind: "ok", data: { outcome: "country_blocked" } }),
    ).toEqual({ kind: "countryBlocked" });
    expect(
      signupResultOf({ kind: "ok", data: { outcome: "terms_outdated" } }),
    ).toEqual({ kind: "termsOutdated" });
    expect(
      signupResultOf({ kind: "ok", data: { outcome: "account_unavailable" } }),
    ).toEqual({ kind: "accountUnavailable" });
  });

  it("shows no published terms and any failure as the service message (05 RG29)", () => {
    expect(
      signupResultOf({ kind: "ok", data: { outcome: "terms_not_published" } }),
    ).toEqual({ kind: "unavailable" });
    expect(signupResultOf({ kind: "failed" })).toEqual({ kind: "unavailable" });
  });

  it("starts the journey again when the sign-up token is gone (401)", () => {
    expect(signupResultOf({ kind: "unauthenticated" })).toEqual({
      kind: "sessionLost",
    });
  });
});

describe("consent wording (05 RG31, RG32, RG127, D63)", () => {
  // The keys imposed by apps/api (packages/contracts CONSENT_WORDING_KEYS) exist in both files.
  const wordingOf = (
    messages: typeof frAuth,
    door: "advertiser" | "creator",
  ): string => messages.signup.consent[door].label;

  it("names Brevo and Apollo.io in both doors and both languages", () => {
    for (const messages of [frAuth, enAuth]) {
      for (const door of ["advertiser", "creator"] as const) {
        const wording = wordingOf(messages, door);
        expect(wording).toContain("Brevo");
        expect(wording).toContain("Apollo.io");
        // The contract bounds the wording copied as proof.
        expect(wording.length).toBeLessThanOrEqual(1_500);
        expect(wording).not.toMatch(/[<>{}]/);
      }
      expect(wordingOf(messages, "advertiser")).not.toBe(
        wordingOf(messages, "creator"),
      );
    }
  });

  it("keeps the imposed keys under the auth namespace", () => {
    expect(CONSENT_WORDING_KEYS).toEqual({
      advertiser: "signup.consent.advertiser.label",
      creator: "signup.consent.creator.label",
    });
  });

  it("carries no amount, rate or percentage anywhere in the journey's texts (05 RG9)", () => {
    for (const messages of [frAuth, enAuth]) {
      expect(JSON.stringify(messages)).not.toMatch(
        /%|€|\$|£|\d+ ?(?:EUR|USD|GBP)/,
      );
    }
  });
});

// The rules of the screen "mon profil de marque" that are not apps/api's (docs/mvp/06 RG5, RG14,
// RG17, RG61, RG83, RG85; 17 §4.2; jalons/l2b, commit 11): the patch of the autosave, the checks
// the browser makes with the schema of the API, what an accepted save changes in the form, the
// states that allow editing, and the focus ids of the missing fields. Pure functions, no browser.
import {
  BRAND_LOGO_MAX_UPLOAD_BYTES,
  BRAND_LOGO_REJECTIONS,
  BRAND_PROFILE_REQUIRED_FIELD_CODES,
  type BrandProfileResponse,
} from "@influx/contracts/brand-profile";
import { describe, expect, it } from "vitest";
import {
  afterSave,
  controlIdOf,
  controlIdOfRequired,
  draftOf,
  fieldErrorOf,
  isEditable,
  isRetryable,
  labelKeyOfRequired,
  logoFailureOf,
  logoFileProblem,
  missingErrors,
  nextActionOf,
  planPatch,
  sameValue,
  sectionOfRequired,
  singleFieldPatch,
  statusTextKeyOf,
  summaryOf,
  type BrandDraft,
} from "@/components/brand-profile/brand-profile-view";

const PROFILE: BrandProfileResponse = {
  status: "draft",
  submittedAt: null,
  companyName: "Maison Test",
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
  completeness: { score: 0, earnedPoints: 0, attainablePoints: 82, blocks: [] },
  missingRequired: [...BRAND_PROFILE_REQUIRED_FIELD_CODES],
  pendingChanges: [],
  refusal: null,
  references: {
    sectors: [],
    topics: [],
    networks: [],
    formats: [],
    usageRights: [],
    countries: [],
    languages: [],
  },
};

const SAVED: BrandDraft = draftOf(PROFILE);

describe("draftOf and sameValue (06 RG83)", () => {
  it("turns an empty profile into empty texts and empty lists, never into invented values (RG34, RG81)", () => {
    expect(SAVED.website).toBe("");
    expect(SAVED.presentation).toBe("");
    expect(SAVED.contactEmail).toBe("");
    expect(SAVED.topics).toEqual([]);
    expect(SAVED.primarySector).toBeNull();
    expect(SAVED.offersNonMonetary).toBeNull();
  });

  it("compares a list in order, element by element, and a value by identity", () => {
    expect(sameValue(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameValue(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameValue(["a"], ["a", "b"])).toBe(false);
    expect(sameValue("x", "x")).toBe(true);
    expect(sameValue(null, false)).toBe(false);
  });
});

describe("planPatch: the autosave sends what changed (06 RG83, RG14)", () => {
  it("sends nothing when nothing changed", () => {
    expect(planPatch(SAVED, SAVED)).toEqual({
      body: null,
      keys: [],
      refused: {},
    });
  });

  it("sends the changed fields only, a list whole and a text emptied as null", () => {
    const draft: BrandDraft = {
      ...SAVED,
      primarySector: "beauty_personal_care",
      topics: ["beauty", "fashion"],
      website: "   ",
    };
    const plan = planPatch(draft, { ...SAVED, website: "exemple.com" });
    expect(plan.refused).toEqual({});
    expect(plan.keys).toEqual(["primarySector", "website", "topics"]);
    expect(plan.body).toEqual({
      primarySector: "beauty_personal_care",
      website: null,
      topics: ["beauty", "fashion"],
    });
  });

  it("groups the contact fields in one object and leaves the website as typed for the API to reduce (RG17, CA4)", () => {
    const plan = planPatch(
      {
        ...SAVED,
        contactFirstName: "Camille",
        contactEmail: "Camille@Example.test ",
        website: "https://exemple.com/contact?utm=abc",
      },
      SAVED,
    );
    expect(plan.body).toEqual({
      website: "https://exemple.com/contact?utm=abc",
      contact: { firstName: "Camille", email: "camille@example.test" },
    });
  });

  it("refuses a field the schema refuses, names it, and still sends the others (RG85)", () => {
    const plan = planPatch(
      {
        ...SAVED,
        contactEmail: "pas une adresse",
        contactPhone: "0612345678",
        topics: ["beauty"],
      },
      SAVED,
    );
    expect(plan.refused).toEqual({
      contactEmail: "invalid",
      contactPhone: "invalid",
    });
    expect(plan.body).toEqual({ topics: ["beauty"] });
    expect(plan.keys).toEqual(["topics"]);
  });

  it("keeps a trading name emptied out of the patch: the account keeps a name", () => {
    const plan = planPatch({ ...SAVED, companyName: "  " }, SAVED);
    expect(plan.refused).toEqual({ companyName: "companyName" });
    expect(plan.body).toBeNull();
  });

  it("leaves alone a field already in error until the member changes it (no loop)", () => {
    const draft = { ...SAVED, contactEmail: "x", topics: ["beauty"] };
    const plan = planPatch(draft, SAVED, { contactEmail: "invalid" });
    expect(plan.refused).toEqual({});
    expect(plan.body).toEqual({ topics: ["beauty"] });
  });

  it("refuses more choices than the caps of the lists, as the API does (RG15: 3 topics, 2 sectors)", () => {
    const plan = planPatch(
      {
        ...SAVED,
        topics: ["a", "b", "c", "d"],
        secondarySectors: ["x", "y", "z"],
      },
      SAVED,
    );
    expect(plan.refused).toEqual({
      topics: "invalid",
      secondarySectors: "invalid",
    });
    expect(plan.body).toBeNull();
  });

  it("builds the body of one field alone, to find the wrong one of a refused patch", () => {
    const draft = {
      ...SAVED,
      contactPhone: "+33612345678",
      topics: ["beauty"],
    };
    expect(singleFieldPatch("contactPhone", draft)).toEqual({
      contact: { phone: "+33612345678" },
    });
    expect(
      singleFieldPatch("companyName", { ...draft, companyName: "" }),
    ).toBeNull();
  });
});

describe("fieldErrorOf: which message an answer of the API calls for (RG85)", () => {
  it("reads the issues of a 400, never their values", () => {
    expect(
      fieldErrorOf("website", { kind: "failed", issues: ["invalid_host"] }),
    ).toBe("website");
    expect(
      fieldErrorOf("primarySector", { kind: "failed", issues: ["unknown"] }),
    ).toBe("unknown");
    expect(
      fieldErrorOf("topics", { kind: "failed", issues: ["invalid"] }),
    ).toBe("invalid");
    expect(fieldErrorOf("companyName", { kind: "failed" })).toBe("companyName");
  });
});

describe("afterSave: what an accepted save changes in the form (06 RG17, CA4)", () => {
  it("replaces the website by the domain kept when the member typed nothing since", () => {
    const sent = { ...SAVED, website: "https://exemple.com/contact" };
    const next = afterSave(sent, SAVED, sent, ["website"], "exemple.com");
    expect(next.draft.website).toBe("exemple.com");
    expect(next.saved.website).toBe("exemple.com");
  });

  it("keeps what the member typed since, and takes the value sent as the reference", () => {
    const sent = { ...SAVED, website: "exemple.com", companyName: "Acme " };
    const typed = { ...sent, website: "exemple.com/x", companyName: "Acme C" };
    const next = afterSave(
      typed,
      SAVED,
      sent,
      ["website", "companyName"],
      "exemple.com",
    );
    expect(next.draft.website).toBe("exemple.com/x");
    expect(next.draft.companyName).toBe("Acme C");
    expect(next.saved.website).toBe("exemple.com");
    expect(next.saved.companyName).toBe("Acme ");
  });

  it("never rewrites the margins of a text being typed (the name keeps its trailing space)", () => {
    const sent = { ...SAVED, companyName: "Acme " };
    const next = afterSave(sent, SAVED, sent, ["companyName"], "");
    expect(next.draft.companyName).toBe("Acme ");
    expect(planPatch(next.draft, next.saved).body).toBeNull();
  });
});

describe("the required fields on the form (06 RG5, RG61, RG85)", () => {
  it("gives every required code of the API a label, a section and the id its control carries", () => {
    for (const code of BRAND_PROFILE_REQUIRED_FIELD_CODES) {
      expect(labelKeyOfRequired(code), code).toBeTruthy();
      expect(controlIdOfRequired(code), code).toBe(`brand-profile-${code}`);
    }
    expect(sectionOfRequired("legalName")).toBe("identity");
    expect(sectionOfRequired("formats")).toBe("expectations");
    expect(sectionOfRequired("contactRole")).toBe("contact");
    expect(controlIdOf("companyName")).toBe("brand-profile-legalName");
    expect(controlIdOf("website")).toBe("brand-profile-website");
  });

  it("flags each missing field of the form, and leaves the country (the account's) out", () => {
    expect(missingErrors(["legalName", "country", "topics"])).toEqual({
      companyName: "required",
      topics: "required",
    });
    expect(missingErrors([])).toEqual({});
  });
});

describe("the states of the profile (06 RG3, EC-L2B-07-1; 17 §4.2)", () => {
  it("allows editing until the profile is published or suspended, and gives each state its sentence", () => {
    expect(
      (["draft", "pending_review", "rejected"] as const).map(isEditable),
    ).toEqual([true, true, true]);
    expect(isEditable("published")).toBe(false);
    expect(isEditable("suspended")).toBe(false);
    expect(statusTextKeyOf("draft")).toBe("draft");
    expect(statusTextKeyOf("pending_review")).toBe("pendingSince");
    expect(statusTextKeyOf("rejected")).toBe("rejectedReason");
  });

  it("tries again after a network failure or a busy service, never after a refusal", () => {
    expect(isRetryable({ kind: "failed" })).toBe(true);
    expect(isRetryable({ kind: "failed", code: "service_unavailable" })).toBe(
      true,
    );
    expect(isRetryable({ kind: "failed", code: "validation_failed" })).toBe(
      false,
    );
    expect(isRetryable({ kind: "failed", code: "conflict" })).toBe(false);
    expect(isRetryable({ kind: "unauthenticated" })).toBe(false);
  });
});

describe("the state of the profile on the home and in the column (17 §2.3, §2.4)", () => {
  it("keeps the state, the date and the missing fields, and nothing of the score", () => {
    const summary = summaryOf({
      ...PROFILE,
      status: "pending_review",
      submittedAt: "2026-11-02T09:00:00.000Z",
    });
    expect(Object.keys(summary).sort()).toEqual([
      "missingRequired",
      "status",
      "submittedAt",
    ]);
    expect(summary.missingRequired).toEqual(PROFILE.missingRequired);
    expect(summary.missingRequired).not.toBe(PROFILE.missingRequired);
  });

  it("asks to complete while a field is missing, to submit once complete, and asks nothing of a profile under review, published or suspended", () => {
    const of = (status: BrandProfileResponse["status"], missing: number) =>
      nextActionOf({
        status,
        submittedAt: null,
        missingRequired: PROFILE.missingRequired.slice(0, missing),
      });
    expect(of("draft", 3)).toBe("complete");
    expect(of("rejected", 1)).toBe("complete");
    expect(of("draft", 0)).toBe("submit");
    expect(of("rejected", 0)).toBe("submit");
    expect(of("pending_review", 0)).toBeNull();
    expect(of("pending_review", 2)).toBeNull();
    expect(of("published", 2)).toBeNull();
    expect(of("suspended", 0)).toBeNull();
  });
});

describe("the logo (06 RG15, cas limite 2; D80)", () => {
  it("stops only a file the relay would refuse: empty, or over 2 MiB", () => {
    expect(logoFileProblem(0)).toBe("empty");
    expect(logoFileProblem(1)).toBeNull();
    expect(logoFileProblem(BRAND_LOGO_MAX_UPLOAD_BYTES)).toBeNull();
    expect(logoFileProblem(BRAND_LOGO_MAX_UPLOAD_BYTES + 1)).toBe("tooLarge");
  });

  it("names each typed reason of an image_rejected, from its issues", () => {
    for (const reason of BRAND_LOGO_REJECTIONS) {
      expect(logoFailureOf({ code: "image_rejected", issues: [reason] })).toBe(
        reason,
      );
    }
  });

  it("falls back to the cannot-be-read message for an image_rejected without a known reason", () => {
    expect(logoFailureOf({ code: "image_rejected" })).toBe("undecodable");
    expect(logoFailureOf({ code: "image_rejected", issues: ["other"] })).toBe(
      "undecodable",
    );
  });

  it("maps the quota, the size, the lock and the rest to their own message", () => {
    expect(logoFailureOf({ code: "upload_quota_exceeded" })).toBe("quota");
    expect(logoFailureOf({ code: "payload_too_large" })).toBe("tooLarge");
    expect(logoFailureOf({ code: "conflict" })).toBe("locked");
    expect(logoFailureOf({})).toBe("unavailable");
    expect(logoFailureOf({ code: "service_unavailable" })).toBe("unavailable");
  });
});

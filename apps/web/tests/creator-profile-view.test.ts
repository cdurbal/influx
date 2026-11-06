// The rules of the screen "mon profil" of a creator that are not apps/api's (docs/mvp/17 §5.2; 07
// RG14, RG27, RG111; jalons/l2d, commit 12): the patch of the autosave, the checks the browser makes
// with the schema of the API, what an accepted save changes in the form, the sections and the
// required fields, the states that allow editing, and the translations the screen reads. Pure
// functions, no browser.
import {
  CREATOR_PROFILE_REQUIRED_FIELD_CODES,
  type CreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import { describe, expect, it } from "vitest";
import {
  afterSave,
  BUILT_SECTIONS,
  controlIdOf,
  draftOf,
  fieldErrorOf,
  hasTextWarning,
  isEditable,
  isSectionComplete,
  planPatch,
  sameValue,
  sectionAnchorOf,
  sectionOfRequired,
  SECTION_IDS,
  singleFieldPatch,
  type CreatorDraft,
} from "@/components/creator-profile/creator-profile-view";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";

const PROFILE: CreatorProfileResponse = {
  status: "draft",
  alias: "7K3M9X",
  residenceCountry: "FR",
  preferredLanguage: "fr",
  headline: null,
  bio: null,
  collaborationExperience: null,
  primaryTopic: null,
  secondaryTopics: [],
  tones: [],
  publicationLanguages: [],
  residenceRegion: null,
  travelScope: null,
  formats: [],
  usageRights: [],
  deliveryLead: null,
  maxExclusivity: null,
  acceptsNonMonetary: false,
  availability: null,
  availabilityDeclaredAt: null,
  refusedSectors: [],
  identity: {
    legalFirstName: null,
    legalLastName: null,
    contactEmail: null,
    contactPhone: null,
    addressLine: null,
    postalCode: null,
    city: null,
    addressCountry: null,
  },
  completeness: { score: 0, earnedPoints: 0, attainablePoints: 90, blocks: [] },
  missingRequired: [],
  warnings: [],
  references: {
    topics: ["beauty", "fashion"],
    tones: ["humorous"],
    languages: ["fr", "en"],
    regions: [],
    formats: [],
    usageRights: [],
    sectors: [],
  },
};

const EMPTY = draftOf(PROFILE);

describe("L2D-12: the draft of the creator profile", () => {
  it("shows an empty draft for a creator with nothing entered, and what is stored otherwise", () => {
    expect(EMPTY).toEqual({
      headline: "",
      bio: "",
      collaborationExperience: null,
      legalFirstName: "",
      legalLastName: "",
      contactPhone: "",
      contactEmail: "",
      city: "",
      primaryTopic: null,
      secondaryTopics: [],
      tones: [],
      publicationLanguages: [],
      travelScope: null,
    });
    const filled = draftOf({
      ...PROFILE,
      headline: "Cuisine végétale du quotidien",
      primaryTopic: "food",
      secondaryTopics: ["wellness"],
      identity: {
        ...PROFILE.identity,
        city: "Lyon",
        contactPhone: "+33612345678",
      },
    });
    expect(filled.headline).toBe("Cuisine végétale du quotidien");
    expect(filled.primaryTopic).toBe("food");
    expect(filled.secondaryTopics).toEqual(["wellness"]);
    expect(filled.city).toBe("Lyon");
    expect(filled.contactPhone).toBe("+33612345678");
  });

  it("compares a list in order, element by element", () => {
    expect(sameValue(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameValue(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameValue("a", "a")).toBe(true);
    expect(sameValue(null, "a")).toBe(false);
  });
});

describe("L2D-12: the patch of the autosave (07 RG111, RG14)", () => {
  it("sends nothing when nothing changed, and only what changed otherwise", () => {
    expect(planPatch(EMPTY, EMPTY).body).toBeNull();
    const plan = planPatch(
      { ...EMPTY, headline: "  Voyages en famille  ", tones: ["humorous"] },
      EMPTY,
    );
    expect(plan.keys).toEqual(["headline", "tones"]);
    expect(plan.body).toEqual({
      headline: "Voyages en famille",
      tones: ["humorous"],
    });
    expect(plan.refused).toEqual({});
  });

  it("empties a value with null, a blank text included, and keeps the line breaks of the bio", () => {
    const filled: CreatorDraft = {
      ...EMPTY,
      headline: "Un titre",
      bio: "Ligne 1\n\nLigne 2",
      primaryTopic: "beauty",
    };
    expect(
      planPatch({ ...filled, headline: "   ", primaryTopic: null }, filled)
        .body,
    ).toEqual({ headline: null, primaryTopic: null });
    expect(
      planPatch({ ...filled, bio: "Ligne 1\n\nLigne 3" }, filled).body,
    ).toEqual({ bio: "Ligne 1\n\nLigne 3" });
    expect(planPatch({ ...filled, bio: "  " }, filled).body).toEqual({
      bio: null,
    });
  });

  it("gathers the identifying fields in one identity object, a blank one emptying its field", () => {
    const stored: CreatorDraft = { ...EMPTY, city: "Lyon" };
    const plan = planPatch(
      {
        ...stored,
        legalFirstName: "Camille",
        legalLastName: "Durand",
        city: "",
      },
      stored,
    );
    expect(plan.body).toEqual({
      identity: {
        legalFirstName: "Camille",
        legalLastName: "Durand",
        city: null,
      },
    });
  });

  it("refuses with the schema of the API a field it would refuse, and still sends the others (RG14)", () => {
    const plan = planPatch(
      {
        ...EMPTY,
        contactEmail: "not-an-address",
        contactPhone: "0612345678",
        tones: ["humorous", "premium", "expert"],
        city: "Lyon",
      },
      EMPTY,
    );
    expect(plan.refused).toEqual({
      contactEmail: "invalid",
      contactPhone: "invalid",
      tones: "invalid",
    });
    expect(plan.body).toEqual({ identity: { city: "Lyon" } });
    expect(plan.keys).toEqual(["city"]);
  });

  it("leaves alone a field already refused until the member changes it (no loop)", () => {
    const draft = { ...EMPTY, contactPhone: "0612345678", city: "Lyon" };
    const plan = planPatch(draft, EMPTY, { contactPhone: "invalid" });
    expect(plan.refused).toEqual({});
    expect(plan.keys).toEqual(["city"]);
  });

  it("splits a body into one field at a time, to name the wrong one", () => {
    const draft: CreatorDraft = {
      ...EMPTY,
      headline: "Un titre",
      legalFirstName: "Camille",
      contactEmail: "x",
    };
    expect(singleFieldPatch("headline", draft)).toEqual({
      headline: "Un titre",
    });
    expect(singleFieldPatch("legalFirstName", draft)).toEqual({
      identity: { legalFirstName: "Camille" },
    });
    expect(singleFieldPatch("contactEmail", draft)).toBeNull();
  });

  it("reads an unknown code from the issues of the API, anything else as invalid", () => {
    expect(
      fieldErrorOf({
        kind: "failed",
        code: "validation_failed",
        issues: ["unknown"],
      }),
    ).toBe("unknown");
    expect(
      fieldErrorOf({
        kind: "failed",
        code: "validation_failed",
        issues: ["invalid"],
      }),
    ).toBe("invalid");
    expect(fieldErrorOf({ kind: "failed", code: "validation_failed" })).toBe(
      "invalid",
    );
  });
});

describe("L2D-12: after an accepted save", () => {
  it("makes the fields sent the new reference, and takes the secondary topics the API kept (RG33)", () => {
    const sent: CreatorDraft = {
      ...EMPTY,
      primaryTopic: "beauty",
      secondaryTopics: ["beauty", "fashion"],
    };
    const next = afterSave(
      sent,
      EMPTY,
      sent,
      ["primaryTopic", "secondaryTopics"],
      {
        secondaryTopics: ["fashion"],
      },
    );
    expect(next.saved.primaryTopic).toBe("beauty");
    expect(next.saved.secondaryTopics).toEqual(["fashion"]);
    expect(next.draft.secondaryTopics).toEqual(["fashion"]);
    expect(planPatch(next.draft, next.saved).body).toBeNull();
  });

  it("keeps what the member typed meanwhile, and leaves the others as they were", () => {
    const sent: CreatorDraft = { ...EMPTY, secondaryTopics: ["fashion"] };
    const typed: CreatorDraft = {
      ...sent,
      secondaryTopics: ["fashion", "beauty"],
      headline: "En cours de frappe",
    };
    const next = afterSave(typed, EMPTY, sent, ["secondaryTopics"], {
      secondaryTopics: ["fashion"],
    });
    expect(next.draft.secondaryTopics).toEqual(["fashion", "beauty"]);
    expect(next.draft.headline).toBe("En cours de frappe");
    expect(next.saved.secondaryTopics).toEqual(["fashion"]);
    expect(planPatch(next.draft, next.saved).keys).toEqual([
      "headline",
      "secondaryTopics",
    ]);
  });
});

describe("L2D-12: sections, anchors and required fields", () => {
  it("has five sections and gives every required field of the contract one of them", () => {
    expect(SECTION_IDS).toEqual([
      "presentation",
      "editorial",
      "networks",
      "audience",
      "offer",
    ]);
    for (const code of CREATOR_PROFILE_REQUIRED_FIELD_CODES) {
      expect(SECTION_IDS, code).toContain(sectionOfRequired(code));
    }
    // blocks 4 and 5 arrive with commit 14: the summary tells them "coming soon"
    expect([...BUILT_SECTIONS]).toEqual([
      "presentation",
      "editorial",
      "networks",
    ]);
  });

  it("calls a section complete when none of its required fields is missing", () => {
    expect(isSectionComplete("presentation", [])).toBe(true);
    expect(isSectionComplete("presentation", ["bio", "handle"])).toBe(false);
    expect(isSectionComplete("editorial", ["bio", "handle"])).toBe(true);
    expect(isSectionComplete("networks", ["bio", "handle"])).toBe(false);
  });

  it("gives each section an anchor and each field a control id the labels point to", () => {
    expect(sectionAnchorOf("editorial")).toBe("creator-section-editorial");
    expect(controlIdOf("headline")).toBe("creator-profile-headline");
  });
});

describe("L2D-12: what can be edited and warned", () => {
  it("edits a draft that has its storefront, nothing else at L2D (EC-L2D-08-2)", () => {
    expect(isEditable({ alias: "7K3M9X", status: "draft" })).toBe(true);
    expect(isEditable({ alias: null, status: "draft" })).toBe(false);
    expect(isEditable({ alias: "7K3M9X", status: "pending_review" })).toBe(
      false,
    );
    expect(isEditable({ alias: "7K3M9X", status: "suspended" })).toBe(false);
  });

  it("warns on the text where the detection saw something, and only there (RG27)", () => {
    const warnings = [
      { field: "bio" as const, signal: "handle" as const, start: 4, end: 12 },
    ];
    expect(hasTextWarning("bio", warnings)).toBe(true);
    expect(hasTextWarning("headline", warnings)).toBe(false);
    expect(hasTextWarning("bio", [])).toBe(false);
  });
});

describe("L2D-12: the translations of the screen (T16-L2D, 07 RG112)", () => {
  type Messages = { [key: string]: string | Messages };
  const flatten = (messages: Messages, prefix = ""): string[] =>
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "string"
        ? [`${prefix}${key}`]
        : flatten(value, `${prefix}${key}.`),
    );
  const keysOf = (messages: Messages) => flatten(messages).sort();

  it("holds the same keys in French and in English, each one written", () => {
    expect(keysOf(enCreatorProfile)).toEqual(keysOf(frCreatorProfile));
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      for (const key of keysOf(messages)) {
        const value = key
          .split(".")
          .reduce<string | Messages>(
            (node, part) => (typeof node === "string" ? node : node[part]!),
            messages,
          );
        expect(value, key).not.toBe("");
      }
    }
  });

  it("names every required field of the contract, and the five issues of the API, in both languages", () => {
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      expect(Object.keys(messages.required).sort()).toEqual(
        [...CREATOR_PROFILE_REQUIRED_FIELD_CODES].sort(),
      );
      for (const issue of [
        "wrong_network",
        "sum_exceeds_100",
        "duplicate",
        "required",
        "unknown",
      ]) {
        expect(Object.keys(messages.issues), issue).toContain(issue);
      }
      expect(Object.keys(messages.figures)).toContain("confirmAll");
    }
  });

  it("asks for no tariff, publication or portfolio, and carries no key named like a price", () => {
    const forbidden = ["price", "rate", "net", "currency", "amount"];
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      for (const key of flatten(messages)) {
        expect(forbidden, key).not.toContain(key.split(".").at(-1));
        expect(key, key).not.toMatch(/^(rate|publish|portfolio|visibility)\./);
      }
    }
  });

  it("names the three layers in words, never by the codes A, I, N (17 §5.2)", () => {
    expect(frCreatorProfile.layer.public).toBe(
      "Visible de toutes les marques inscrites.",
    );
    expect(enCreatorProfile.layer.internal).toBe(
      "Visible only to you and the INFLUX team.",
    );
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      expect(JSON.stringify(messages.layer)).not.toMatch(
        /\b(Couche|Layer) [AIN]\b/,
      );
    }
  });
});

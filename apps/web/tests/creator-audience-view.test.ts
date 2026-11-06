// The rules of block 4 of "mon profil" of a creator that are not apps/api's (docs/mvp/07 RG55 to
// RG61, CA26 to CA28; jalons/l2d, commit 14): the draft of an audience, the body of the autosave with
// the checks of the browser (the sum of a dimension, the share of an other country), the "others" the
// API leaves, and the words of the screen (RG55: about the audience, never the creator). Pure
// functions, no browser.
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import { describe, expect, it } from "vitest";
import {
  AUDIENCE_AGE_CODES,
  audienceDraftOf,
  audienceIssueOf,
  audienceSumOf,
  planAudience,
  remainderOf,
  sameAudience,
  type AudienceDraft,
} from "@/components/creator-profile/creator-audience-view";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";

const NONE: CreatorNetworkLine["audience"] = {
  mainCountry: null,
  otherCountries: [],
  ages: [],
  genders: [],
};
const EMPTY = audienceDraftOf(NONE);

function typed(change: Partial<AudienceDraft>): AudienceDraft {
  return { ...EMPTY, ...change };
}

describe("L2D-14: the draft of an audience", () => {
  it("is empty for a line without audience, and gives back what is stored", () => {
    expect(EMPTY).toEqual({
      main: { code: "", share: "" },
      others: [],
      ages: {},
      genders: {},
    });
    const stored = audienceDraftOf({
      mainCountry: { code: "FR", share: 72 },
      otherCountries: [{ code: "BE", share: 12 }],
      ages: [{ code: "25_34", share: 60 }],
      genders: [{ code: "female", share: 55 }],
    });
    expect(stored.main).toEqual({ code: "FR", share: "72" });
    expect(stored.others).toEqual([{ code: "BE", share: "12" }]);
    expect(stored.ages).toEqual({ "25_34": "60" });
    expect(stored.genders).toEqual({ female: "55" });
    expect(
      audienceDraftOf({
        ...NONE,
        mainCountry: { code: "FR", share: null },
      }).main,
    ).toEqual({ code: "FR", share: "" });
  });

  it("offers exactly the four age bands of 07 RG60, none under 18", () => {
    expect([...AUDIENCE_AGE_CODES]).toEqual([
      "18_24",
      "25_34",
      "35_44",
      "45_plus",
    ]);
  });

  it("calls two drafts the same audience when the API would hold the same, a row on its way left out", () => {
    expect(sameAudience(EMPTY, EMPTY)).toBe(true);
    expect(
      sameAudience(EMPTY, typed({ others: [{ code: "BE", share: "" }] })),
    ).toBe(true);
    expect(sameAudience(EMPTY, typed({ ages: { "25_34": " " } }))).toBe(true);
    expect(sameAudience(EMPTY, typed({ ages: { "25_34": "10" } }))).toBe(false);
  });
});

describe("L2D-14: the body of the autosave (07 RG56, RG57, CA26, CA27)", () => {
  it("sends nothing when nothing changed", () => {
    expect(planAudience(EMPTY, EMPTY)).toEqual({ body: null, errors: {} });
  });

  it("sends the whole audience as typed, the main country alone first and its share when it comes", () => {
    const withCountry = typed({ main: { code: "FR", share: "" } });
    expect(planAudience(withCountry, EMPTY).body).toEqual({
      mainCountry: { code: "FR", share: null },
      otherCountries: [],
      ages: [],
      genders: [],
    });
    const full = typed({
      main: { code: "FR", share: "72" },
      others: [{ code: "BE", share: "12" }],
      ages: { "18_24": "40", "25_34": "35", "35_44": "" },
      genders: { female: "55", male: "45" },
    });
    expect(planAudience(full, EMPTY).body).toEqual({
      mainCountry: { code: "FR", share: 72 },
      otherCountries: [{ code: "BE", share: 12 }],
      ages: [
        { code: "18_24", share: 40 },
        { code: "25_34", share: 35 },
      ],
      genders: [
        { code: "female", share: 55 },
        { code: "male", share: 45 },
      ],
    });
  });

  it("refuses 140 in a dimension and names it (CA26), accepts 60 (CA27)", () => {
    const over = planAudience(
      typed({ ages: { "18_24": "60", "25_34": "80" } }),
      EMPTY,
    );
    expect(over.body).toBeNull();
    expect(over.errors).toEqual({ ages: "sum_exceeds_100" });
    const under = planAudience(
      typed({ ages: { "18_24": "40", "25_34": "20" } }),
      EMPTY,
    );
    expect(under.errors).toEqual({});
    expect(under.body?.ages).toHaveLength(2);
    expect(
      planAudience(
        typed({
          main: { code: "FR", share: "90" },
          others: [{ code: "BE", share: "20" }],
        }),
        EMPTY,
      ).errors,
    ).toEqual({ countries: "sum_exceeds_100" });
    expect(
      planAudience(typed({ genders: { female: "70", male: "40" } }), EMPTY)
        .errors,
    ).toEqual({ genders: "sum_exceeds_100" });
  });

  it("counts a share not typed yet for nothing, and adds whole numbers only", () => {
    expect(audienceSumOf(["60", "", "40"])).toBe(100);
    expect(audienceSumOf(["60", "x", " 5 "])).toBe(65);
    expect(audienceSumOf([])).toBe(0);
  });

  it("refuses a share that is not a whole number from 0 to 100, and names the dimension", () => {
    expect(
      planAudience(typed({ ages: { "25_34": "12,5" } }), EMPTY).errors,
    ).toEqual({ ages: "share" });
    expect(
      planAudience(typed({ genders: { female: "101" } }), EMPTY).errors,
    ).toEqual({ genders: "share" });
    expect(
      planAudience(typed({ main: { code: "FR", share: "abc" } }), EMPTY).errors,
    ).toEqual({ mainShare: "share" });
  });

  it("holds the other countries to 10 % at least, once each, behind a main country (RG56)", () => {
    expect(
      planAudience(
        typed({
          main: { code: "FR", share: "70" },
          others: [{ code: "BE", share: "9" }],
        }),
        EMPTY,
      ).errors,
    ).toEqual({ others: "share_min" });
    expect(
      planAudience(
        typed({
          main: { code: "FR", share: "70" },
          others: [{ code: "FR", share: "10" }],
        }),
        EMPTY,
      ).errors,
    ).toEqual({ others: "duplicate" });
    expect(
      planAudience(typed({ others: [{ code: "BE", share: "20" }] }), EMPTY)
        .errors,
    ).toEqual({ mainCountry: "required" });
    expect(
      planAudience(typed({ main: { code: "", share: "70" } }), EMPTY).errors,
    ).toEqual({ mainCountry: "required" });
  });
});

describe("L2D-14: what the API leaves and what it refused", () => {
  const LINE: Pick<CreatorNetworkLine, "audience" | "remainders"> = {
    audience: {
      mainCountry: { code: "FR", share: 72 },
      otherCountries: [],
      ages: [{ code: "25_34", share: 60 }],
      genders: [],
    },
    remainders: { countries: 28, ages: 40, genders: 100 },
  };

  it("shows the others of a dimension that holds a share, as the API says it, never the others of an empty one (RG57)", () => {
    expect(remainderOf(LINE, "countries")).toBe(28);
    expect(remainderOf(LINE, "ages")).toBe(40);
    expect(remainderOf(LINE, "genders")).toBeNull();
    expect(
      remainderOf(
        {
          ...LINE,
          audience: {
            ...LINE.audience,
            mainCountry: { code: "FR", share: null },
          },
        },
        "countries",
      ),
    ).toBeNull();
  });

  it("reads the reason of a refusal from the issues of the answer, never a value", () => {
    const failed = (issues: string[]) =>
      ({ kind: "failed", code: "validation_failed", issues }) as const;
    expect(audienceIssueOf(failed(["sum_exceeds_100"]))).toBe(
      "sum_exceeds_100",
    );
    expect(audienceIssueOf(failed(["unknown"]))).toBe("unknown");
    expect(audienceIssueOf(failed(["duplicate", "required"]))).toBe(
      "duplicate",
    );
    expect(audienceIssueOf(failed([]))).toBe("invalid");
  });
});

describe("L2D-14: the words of blocks 4 and 5 (07 RG55, CA28; D78, D48)", () => {
  type Messages = { [key: string]: string | Messages };
  const flatten = (messages: Messages, prefix = ""): [string, string][] =>
    Object.entries(messages).flatMap(([key, value]) =>
      typeof value === "string"
        ? [[`${prefix}${key}`, value] as [string, string]]
        : flatten(value, `${prefix}${key}.`),
    );

  it("writes every label of the audience about the audience, in French and in English (CA28)", () => {
    for (const [messages, about] of [
      [frCreatorProfile, /audience/u],
      [enCreatorProfile, /audience/u],
    ] as const) {
      const labels = [
        ...Object.values(messages.audience.ages.band),
        ...Object.values(messages.audience.genders.share),
        messages.audience.countries.main,
        messages.audience.countries.mainShare,
        messages.audience.countries.other,
        messages.audience.countries.otherShare,
      ];
      expect(labels).toHaveLength(11);
      for (const label of labels) {
        expect(label, label).toMatch(about);
      }
    }
  });

  it("names each age band by the age of the audience, and the three genders RG61 allows", () => {
    expect(Object.keys(frCreatorProfile.audience.ages.band)).toEqual([
      ...AUDIENCE_AGE_CODES,
    ]);
    expect(Object.keys(enCreatorProfile.audience.genders.share)).toEqual([
      "female",
      "male",
      "other",
    ]);
    expect(frCreatorProfile.audience.ages.band["25_34"]).toBe(
      "Part de votre audience âgée de 25 à 34 ans (%)",
    );
  });

  it("says costs are negotiated with the sales contact and writes no tariff, amount or currency in the offer", () => {
    expect(frCreatorProfile.offer.negotiation).toBe(
      "Les coûts se négocient avec votre commercial.",
    );
    expect(enCreatorProfile.offer.negotiation).toMatch(/negotiated/u);
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      const texts = [
        ...flatten(messages.offer as Messages),
        ...flatten(messages.audience as Messages),
        ...flatten(messages.fields as Messages),
      ].map(([, value]) => value);
      for (const text of texts) {
        expect(text, text).not.toMatch(
          /\b(tarifs?|prix|price|rates?|net|fee|montants?|amounts?)\b|[€$£]/iu,
        );
      }
    }
  });
});

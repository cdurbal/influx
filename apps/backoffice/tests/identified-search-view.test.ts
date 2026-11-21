// L3G-T12 (docs/mvp/10 RG16, RG17, RG71 to RG73, RG76, RG77; 17b §1.2, §3.3, §4.9; jalons/l3g/modele.md §4, §8): the pure
// parts of the identified creator search, without a browser. The rail holds the entry, a click on a facet changes one
// value of the filters and a chip takes away one value, the body of a search is the contract's closed entry (never a
// size of page, the campaign and the prefill only when there are), a row is worded with its identity and its exact
// figures but a link only for an https address, a block is a boolean and a sentence, a refusal is worded by what the
// base said, the campaign the record offers is one the base admits. No amount, tariff or price anywhere (D48, D78).
import { WIDENING_ORDER } from "@influx/contracts/creator-search";
import {
  campaignPrefillFiltersSchema,
  identifiedCreatorRowSchema,
  identifiedCreatorSearchBodySchema,
  IDENTIFIED_DECLARED_STATUSES,
  IDENTIFIED_PROFILE_STATES,
  type IdentifiedCreatorRow,
} from "@influx/contracts/identified-creator-search";
import { describe, expect, it } from "vitest";
import {
  activePlaceOf,
  entryStateOf,
  navItemsOf,
  subEntriesOf,
} from "../src/components/bo-nav";
import {
  BADGE_CODES,
  bodyOf,
  campaignOfAddress,
  compatibleHref,
  criteriaOf,
  failureWords,
  filtersOfPrefill,
  FIRST_QUERY,
  isCompatibleOffered,
  LIST_FACETS,
  rowViewOf,
  safeProfileUrl,
  toggledFilters,
  wideningOf,
  withCountry,
  withShareBand,
  withoutCriterion,
  withTopic,
} from "../src/components/identified-search-view";
import { messages } from "../src/messages/fr";

const CAMPAIGN = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const t = messages.identifiedSearch;

/** A row as the contract serves it, parsed by the contract itself so that the fixture cannot drift from it. */
function rowOf(
  overrides: Partial<IdentifiedCreatorRow> = {},
): IdentifiedCreatorRow {
  return identifiedCreatorRowSchema.parse({
    accountId: CAMPAIGN,
    alias: "Créateur-4F2A",
    status: "published",
    declaredStatus: "individual",
    legalName: "Camille Durand",
    city: "Lyon",
    residence: { country: "FR", region: null },
    ownerAgent: null,
    refusedSectors: [],
    blocked: false,
    networks: [
      {
        network: "instagram",
        isPrimary: true,
        pseudonym: null,
        handle: "camille.d",
        profileUrl: "https://www.instagram.com/camille.d",
        followers: 84210,
        postsLast30Days: 12,
        avgComments: 43,
        engagementBp: 320,
        measuredAt: "2026-11-12T09:00:00.000Z",
        source: "declared",
        badge: { level: "audience_verified", state: "active" },
      },
    ],
    mainAudience: { country: "FR", sharePercent: 62 },
    reasons: [{ code: "topic_match", params: { topic: "beauty" } }],
    vigilance: null,
    ...overrides,
  });
}

describe("L3G-T12: the rail and the campaign it opens from", () => {
  it("gives Créateurs one screen, the identified search, to an agent and to an admin, without a sub-menu", () => {
    for (const role of ["agent", "admin"] as const) {
      const entry = navItemsOf(role).find(
        (item) => item.key === "creatorSearch",
      );
      expect(entry?.href, role).toBe("/createurs/recherche");
      expect(entry?.sections.map((section) => section.key)).toEqual([
        "identifiedSearch",
      ]);
      expect(entry === undefined ? null : subEntriesOf(entry)).toEqual([]);
    }
    const place = activePlaceOf("/createurs/recherche");
    expect(place).toEqual({
      entry: "creatorSearch",
      section: "identifiedSearch",
    });
    const entry = navItemsOf("agent").find(
      (item) => item.key === "creatorSearch",
    );
    expect(entry === undefined ? null : entryStateOf(entry, place)).toBe(
      "current",
    );
  });

  it("offers the compatible creators for a campaign the base admits to the search only, by an address that carries its identifier", () => {
    for (const status of ["pending_review", "published", "paused", "closed"]) {
      expect(isCompatibleOffered(status), status).toBe(true);
    }
    for (const status of ["draft", "rejected"]) {
      expect(isCompatibleOffered(status), status).toBe(false);
    }
    expect(compatibleHref(CAMPAIGN)).toBe(
      `/createurs/recherche?campagne=${CAMPAIGN}`,
    );
    expect(campaignOfAddress(CAMPAIGN.toUpperCase())).toBe(CAMPAIGN);
    expect(campaignOfAddress("not-an-identifier")).toBeNull();
    expect(campaignOfAddress(null)).toBeNull();
  });
});

describe("L3G-T12: the filters a click changes and the chips that take one away (RG17)", () => {
  it("adds and takes away one value of a list, leaves the facet when it empties, and takes no more than the facet holds", () => {
    let filters = toggledFilters({}, "F3", "instagram");
    filters = toggledFilters(filters, "F3", "tiktok");
    expect(filters).toEqual({ F3: ["instagram", "tiktok"] });
    expect(toggledFilters(filters, "F3", "instagram")).toEqual({
      F3: ["tiktok"],
    });
    expect(
      toggledFilters(toggledFilters({}, "F3", "tiktok"), "F3", "tiktok"),
    ).toEqual({});
    // the badges facet holds two values at most (the contract's list of 2): a third is never sent
    const full = { F17: [...BADGE_CODES] };
    expect(toggledFilters(full, "F17", "other")).toBe(full);
  });

  it("keeps the share bands of the country while it stays and drops them with it; a band needs a country", () => {
    const withBand = withShareBand(withCountry({}, "F6", "FR"), "ge_80");
    expect(withBand).toEqual({ F6: { country: "FR", shareBands: ["ge_80"] } });
    expect(withCountry(withBand, "F6", "BE")).toEqual({
      F6: { country: "BE", shareBands: ["ge_80"] },
    });
    expect(withCountry(withBand, "F6", null)).toEqual({});
    expect(withShareBand({}, "ge_80")).toEqual({});
    expect(withShareBand(withBand, "ge_80")).toEqual({
      F6: { country: "FR" },
    });
    // a code that is no country is no facet
    expect(withCountry({}, "G9", "ZZZ")).toEqual({});
    expect(withCountry({}, "G9", "FR")).toEqual({ G9: { country: "FR" } });
    expect(withTopic({ F1: "beauty" }, null)).toEqual({});
  });

  it("makes one chip per value, in words, and takes away that value alone, or the whole of a single facet", () => {
    const filters = {
      F1: "beauty",
      F3: ["instagram", "tiktok"],
      F6: { country: "FR" as const, shareBands: ["ge_80" as const] },
      G2: ["draft"] as ("draft" | "published")[],
    };
    const criteria = criteriaOf(filters);
    expect(criteria.map((criterion) => criterion.id)).toEqual([
      "F1",
      "F6",
      "F6:ge_80",
      "F3:instagram",
      "F3:tiktok",
      "G2:draft",
    ]);
    expect(criteria.map((criterion) => criterion.text)).toEqual([
      "Thématique : Beauty",
      "Pays de l’audience : France",
      "Part du pays : 80 % et plus",
      "Réseau : Instagram",
      "Réseau : TikTok",
      "État : Brouillon",
    ]);
    const byId = (id: string) => {
      const found = criteria.find((criterion) => criterion.id === id);
      if (found === undefined) {
        throw new Error(id);
      }
      return found;
    };
    expect(withoutCriterion(filters, byId("F3:instagram")).F3).toEqual([
      "tiktok",
    ]);
    expect(withoutCriterion(filters, byId("F6:ge_80")).F6).toEqual({
      country: "FR",
    });
    expect(withoutCriterion(filters, byId("F6")).F6).toBeUndefined();
    expect(withoutCriterion(filters, byId("F1")).F1).toBeUndefined();
  });

  it("proposes the three most restrictive facets to widen with, from the contract's static list, never a G facet", () => {
    const filters = {
      F1: "beauty",
      F3: ["instagram"],
      F8: ["fr"],
      F11: ["instagram_reel"],
      G1: ["individual" as const],
    };
    const wanted = WIDENING_ORDER.filter((facet) => facet in filters).slice(
      0,
      3,
    );
    expect(wideningOf(filters).map((item) => item.facet)).toEqual(wanted);
    expect(wideningOf(filters)).toHaveLength(3);
    expect(wideningOf({ G1: ["individual"] })).toEqual([]);
  });

  it("offers the codes of the contract's closed lists for the facets that it types", () => {
    expect(LIST_FACETS.F17.codes).toEqual(BADGE_CODES);
    expect(LIST_FACETS.G1.codes).toEqual(IDENTIFIED_DECLARED_STATUSES);
    expect(LIST_FACETS.G2.codes).toEqual(IDENTIFIED_PROFILE_STATES);
    for (const facet of Object.keys(
      LIST_FACETS,
    ) as (keyof typeof LIST_FACETS)[]) {
      const codes = LIST_FACETS[facet].codes;
      expect(new Set(codes).size, facet).toBe(codes.length);
      expect(codes.length, facet).toBeLessThanOrEqual(
        facet === "F11" || facet === "G10" || facet === "F3" ? 30 : 20,
      );
    }
  });
});

describe("L3G-T12: what a search sends (RG73, RG76, CA56)", () => {
  it("sends the contract's closed entry, no size of page, the campaign and the prefill only when there are", () => {
    expect(bodyOf(FIRST_QUERY)).toEqual({
      filters: {},
      sort: "default",
      page: 1,
    });
    const query = {
      ...FIRST_QUERY,
      filters: { F1: "beauty" },
      campaignId: CAMPAIGN,
      prefillId: "0b7a62a4-7c59-4c9b-9b71-2f61d4a9b5aa",
      page: 2,
    };
    const body = bodyOf(query);
    expect(identifiedCreatorSearchBodySchema.parse(body)).toEqual(body);
    expect(Object.keys(body).sort()).toEqual([
      "campaignId",
      "filters",
      "page",
      "prefillId",
      "sort",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/size|limit|perPage/i);
  });

  it("keeps the link to the prefill when the facets are cleared, so that the correction is journaled", () => {
    const drawn = {
      ...FIRST_QUERY,
      filters: filtersOfPrefill(
        campaignPrefillFiltersSchema.parse({ F1: "beauty", F3: ["instagram"] }),
      ),
      campaignId: CAMPAIGN,
      prefillId: "0b7a62a4-7c59-4c9b-9b71-2f61d4a9b5aa",
    };
    const cleared = bodyOf({ ...drawn, filters: {}, page: 1 });
    expect(cleared.filters).toEqual({});
    expect(cleared.prefillId).toBe(drawn.prefillId);
    expect(cleared.campaignId).toBe(CAMPAIGN);
  });
});

describe("L3G-T12: a row in words (RG71, RG77, D46, D78)", () => {
  it("words the identity on two lines, the exact figures folded, the handle as a link for an https address only", () => {
    const view = rowViewOf(rowOf());
    expect(view.legalName).toBe("Camille Durand");
    expect(view.alias).toBe("Créateur-4F2A");
    expect(view.handles).toEqual([
      {
        network: "Instagram",
        text: "@camille.d",
        href: "https://www.instagram.com/camille.d",
      },
    ]);
    expect(view.state).toBe("Publié");
    expect(view.unpublished).toBe(false);
    expect(view.badges).toEqual(["Instagram : Audience vérifiée"]);
    expect(view.why).toBe("thématique Beauty");
    const exact = view.exact.join("\n");
    expect(exact).toMatch(/84\s210 abonnés/);
    expect(exact).toContain("12 publications sur 30 jours");
    expect(exact).toContain("43 commentaires en moyenne");
    expect(exact).toContain("engagement 3,2 %");
    expect(exact).toContain("mesuré le 12/11/2026");
    expect(exact).toContain("chiffres déclarés");
    expect(exact).toContain("Ville : Lyon");
    expect(safeProfileUrl("javascript:alert(1)")).toBeNull();
    expect(safeProfileUrl("http://instagram.com/a")).toBeNull();
    expect(safeProfileUrl("not a url")).toBeNull();
    expect(safeProfileUrl(null)).toBeNull();
    const unsafe = rowViewOf(
      rowOf({
        networks: [
          { ...rowOf().networks[0]!, profileUrl: "javascript:alert(1)" },
        ],
      }),
    );
    expect(unsafe.handles[0]?.href).toBeNull();
    expect(unsafe.handles[0]?.text).toBe("@camille.d");
  });

  it("labels a profile not published in words and tells a block as a boolean and one sentence, never a motive nor an author", () => {
    const draft = rowViewOf(rowOf({ status: "draft" }));
    expect(draft.unpublished).toBe(true);
    expect(draft.state).toBe("Brouillon");
    const suspended = rowViewOf(rowOf({ status: "suspended", blocked: true }));
    expect(suspended.state).toBe("Suspendu");
    expect(suspended.blocked).toBe(true);
    expect(t.row.blockedPhrase).toBe(
      "Vous ne pouvez pas proposer ce créateur à cette marque.",
    );
    const said = JSON.stringify(suspended).toLowerCase();
    for (const word of ["motif", "reason", "auteur", "author"]) {
      expect(said, word).not.toContain(word);
    }
    // a badge to renew says so; a creator without a name or an agent says that, never an empty cell
    const renew = rowViewOf(
      rowOf({
        legalName: null,
        networks: [
          {
            ...rowOf().networks[0]!,
            badge: { level: "account_verified", state: "to_refresh" },
          },
        ],
      }),
    );
    expect(renew.badges).toEqual(["Instagram : Compte vérifié (à renouveler)"]);
    expect(renew.legalName).toBe(t.row.unnamed);
    expect(renew.owner).toBe(t.row.noOwner);
  });

  it("shows no amount, rate, tariff, price nor net anywhere on the screen's words or on a worded row", () => {
    const words = JSON.stringify([
      messages.identifiedSearch,
      rowViewOf(rowOf()),
    ]);
    expect(words).not.toMatch(/€|\b(?:EUR|USD)\b/);
    expect(words).not.toMatch(/tarif|prix|budget|commission|net créateur/i);
  });
});

describe("L3G-T12: what a refusal means (RG76; modele §8)", () => {
  it("words the cap of pages, a facet refused, an unknown campaign, the rate and a missing setting, and falls back to one generic sentence", () => {
    const f = t.failures;
    expect(failureWords("validation_failed", ["page_cap"], undefined)).toBe(
      f.pageCap,
    );
    expect(
      failureWords("validation_failed", ["invalid_filters"], undefined),
    ).toBe(f.filters);
    expect(failureWords("not_found", [], undefined)).toBe(f.campaign);
    expect(failureWords("rate_limited", [], 1)).toBe(f.rateLimited(1));
    expect(failureWords("rate_limited", undefined, undefined)).toBe(
      f.rateLimited(null),
    );
    expect(failureWords("service_unavailable", undefined, undefined)).toBe(
      f.setting,
    );
    expect(failureWords("internal_error", undefined, undefined)).toBe(
      f.generic,
    );
    expect(failureWords(undefined, undefined, undefined)).toBe(f.generic);
  });
});

// The creator's feed of open campaigns (docs/mvp/11 RG15, RG26, RG33 to RG36; 17 §5.5; D11, D48, D78; jalons/l3d,
// commit 04, L3D-T7): a card drawn from the answer and from nothing else, never a figure nor a counter, a greyed
// card with no way in, the state of the screen after each answer (a late one changes nothing), the refusals told
// in words, the two sorts, and the texts of the translation files that no state may lack. Pure functions, no
// browser.
import {
  openCampaignsResponseSchema,
  type OpenCampaignCard,
  type OpenCampaignsResponse,
} from "@influx/contracts/open-campaigns";
import { describe, expect, it } from "vitest";
import enCampaign from "@/locales/en/campaign.json";
import frCampaign from "@/locales/fr/campaign.json";
import type { PreviewLabels } from "@/components/campaign/campaign-preview-view";
import {
  cardViewOf,
  DEFAULT_FEED_SORT,
  FEED_SORTS,
  feedFailureOf,
  feedReducer,
  initialFeedState,
  mergeCards,
  sortOf,
  type FeedState,
} from "@/components/campaign/open-campaigns-view";

/** Labels that write where each word comes from, so that a line is traced to its source. */
const LABELS: PreviewLabels = {
  row: (scope, key) => `${scope}:${key}`,
  option: (group, code) => `${group}/${code}`,
  country: (code) => `country/${code}`,
  language: (code) => `language/${code}`,
  civilDate: (date) => `date/${date}`,
  yes: "yes",
  no: "no",
  deliverable: (quantity, network, format) =>
    `${quantity}x ${network} ${format}`,
  nature: (kind) => `nature/${kind}`,
  notice: "notice",
  section: (id) => `section/${id}`,
  badge: (since) => `badge/${since}`,
};

const ID = (n: number) =>
  `7d6f1c43-6a0c-4cc4-9f0b-1c1f5f6d2a${String(n).padStart(2, "0")}`;

function card(n: number, over: Partial<OpenCampaignCard> = {}) {
  return {
    id: ID(n),
    publishedOn: "2026-11-10",
    applicationsClosed: false,
    campaign: {
      title: `Campagne ${n}`,
      audienceTopics: ["beauty", "fitness"],
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
      ],
      remunerationKind: "cash",
      audienceCountries: ["FR", "BE"],
      startsOn: "2027-03-01",
      endsOn: "2027-04-01",
      applicationsCloseOn: "2027-02-10",
    },
    brand: {
      companyName: "Maison Aurore",
      hasLogo: true,
      primarySector: "beauty_personal_care",
      companySize: "11_50",
      badge: { since: "2026-10-03T09:00:00.000Z" },
    },
    remunerationNotice: "campaign.budget.negotiate",
    ...over,
  } satisfies OpenCampaignCard;
}

function page(
  numbers: number[],
  over: Partial<OpenCampaignsResponse> = {},
): OpenCampaignsResponse {
  return openCampaignsResponseSchema.parse({
    total: numbers.length,
    page: 1,
    nextPage: null,
    capReached: false,
    items: numbers.map((n) => card(n)),
    ...over,
  });
}

describe("L3D-T7: a card is drawn from the answer alone (RG15 at the pilot, RG25, D78)", () => {
  it("writes the brand with its badge, the title, the topics, the deliverables, the nature, the notice, the countries, the period, the deadline and the publication", () => {
    const view = cardViewOf(card(1), LABELS);
    expect(view).toEqual({
      id: ID(1),
      closed: false,
      brandName: "Maison Aurore",
      hasLogo: true,
      badge: "badge/2026-10-03T09:00:00.000Z",
      brandFacts: "reference.sector/beauty_personal_care · companySize/11_50",
      title: "Campagne 1",
      topics: "reference.topic/beauty, reference.topic/fitness",
      deliverables: [
        "2x reference.network/instagram reference.format/instagram_reel",
      ],
      nature: "nature/cash",
      notice: "notice",
      countries: "country/FR, country/BE",
      period: { kind: "range", from: "date/2027-03-01", to: "date/2027-04-01" },
      deadline: "date/2027-02-10",
      publishedOn: "date/2026-11-10",
    });
  });

  it("carries no amount, range, currency, net, counter or contact: the keys of a view are the card's own", () => {
    const view = cardViewOf(card(1), LABELS);
    expect(Object.keys(view).sort()).toEqual(
      [
        "badge",
        "brandFacts",
        "brandName",
        "closed",
        "countries",
        "deadline",
        "deliverables",
        "hasLogo",
        "id",
        "nature",
        "notice",
        "period",
        "publishedOn",
        "title",
        "topics",
      ].sort(),
    );
    const written = JSON.stringify(view);
    for (const forbidden of [
      "€",
      "EUR",
      "budget",
      "commission",
      "mailto",
      "tel:",
    ]) {
      expect(written, forbidden).not.toContain(forbidden);
    }
  });

  it("leaves out what the answer does not hold: no badge, no sector, no size, no topic, no date, no nature", () => {
    const bare = card(2, {
      campaign: {
        title: null,
        audienceTopics: [],
        deliverables: [],
        remunerationKind: null,
        audienceCountries: [],
        startsOn: null,
        endsOn: null,
        applicationsCloseOn: null,
      },
      brand: {
        companyName: "Maison Sobre",
        hasLogo: false,
        primarySector: null,
        companySize: null,
        badge: null,
      },
    });
    const view = cardViewOf(bare, LABELS);
    expect(view).toMatchObject({
      hasLogo: false,
      badge: null,
      brandFacts: null,
      title: null,
      topics: null,
      deliverables: [],
      nature: null,
      countries: null,
      period: null,
      deadline: null,
    });
    // The notice of D78 is on every card, whatever the nature says.
    expect(view.notice).toBe("notice");
  });

  it("writes the period with the one date it has", () => {
    const only = (startsOn: string | null, endsOn: string | null) =>
      cardViewOf(
        card(3, {
          campaign: { ...card(3).campaign, startsOn, endsOn },
        }),
        LABELS,
      ).period;
    expect(only("2027-03-01", null)).toEqual({
      kind: "from",
      from: "date/2027-03-01",
    });
    expect(only(null, "2027-04-01")).toEqual({
      kind: "until",
      to: "date/2027-04-01",
    });
    expect(only(null, null)).toBeNull();
  });

  it("greys a card whose applications closed (RG26): closed, so the screen draws no way in", () => {
    expect(
      cardViewOf(card(4, { applicationsClosed: true }), LABELS).closed,
    ).toBe(true);
    expect(cardViewOf(card(4), LABELS).closed).toBe(false);
  });

  it("is refused by the contract when a card carries a figure the creator may not see (D78)", () => {
    const withBudget = {
      ...card(5),
      budget: { min: 1000, max: 2000, currency: "EUR" },
    };
    expect(
      openCampaignsResponseSchema.safeParse({
        total: 1,
        page: 1,
        nextPage: null,
        capReached: false,
        items: [withBudget],
      }).success,
    ).toBe(false);
  });
});

describe("L3D-T7: the pages of the feed (RG35, RG36, L3D-A §4)", () => {
  it("keeps the cards already seen and adds the new ones in order, ignoring an identifier already shown", () => {
    const seen = [card(1), card(2)];
    const merged = mergeCards(seen, [card(2), card(3), card(1), card(4)]);
    expect(merged.map(({ id }) => id)).toEqual([ID(1), ID(2), ID(3), ID(4)]);
    expect(mergeCards([], [])).toEqual([]);
  });

  it("opens loading in the most recent sort, then shows the first page with the count of every card", () => {
    let state: FeedState = initialFeedState();
    expect(state).toEqual({ phase: "loading", sort: "recent" });
    state = feedReducer(state, {
      type: "first",
      sort: "recent",
      response: page([1, 2], { total: 14, nextPage: 2 }),
    });
    expect(state).toMatchObject({
      phase: "ready",
      sort: "recent",
      total: 14,
      nextPage: 2,
      capReached: false,
      more: { kind: "idle" },
    });
    expect(state.phase === "ready" && state.items.length).toBe(2);
  });

  it("appends the next page on « Voir la suite » and ends the list when there is none", () => {
    let state = feedReducer(initialFeedState(), {
      type: "first",
      sort: "recent",
      response: page([1, 2], { total: 3, nextPage: 2 }),
    });
    state = feedReducer(state, { type: "more" });
    expect(state).toMatchObject({ more: { kind: "loading" } });
    // A second press while it loads asks nothing more.
    expect(feedReducer(state, { type: "more" })).toBe(state);
    state = feedReducer(state, {
      type: "page",
      sort: "recent",
      response: page([2, 3], { total: 3, page: 2, nextPage: null }),
    });
    expect(state).toMatchObject({
      phase: "ready",
      nextPage: null,
      more: { kind: "idle" },
    });
    expect(state.phase === "ready" && state.items.map(({ id }) => id)).toEqual([
      ID(1),
      ID(2),
      ID(3),
    ]);
    // Nothing to ask at the end.
    expect(feedReducer(state, { type: "more" })).toBe(state);
  });

  it("ignores a late answer: a page of the old sort, a page that is not the one asked", () => {
    let state = feedReducer(initialFeedState(), {
      type: "first",
      sort: "recent",
      response: page([1], { total: 3, nextPage: 2 }),
    });
    state = feedReducer(state, { type: "more" });
    // The sort changes while page 2 loads: loading again, in the other sort.
    const resorted = feedReducer(state, { type: "load", sort: "deadline" });
    expect(resorted).toEqual({ phase: "loading", sort: "deadline" });
    expect(
      feedReducer(resorted, {
        type: "page",
        sort: "recent",
        response: page([2], { total: 3, page: 2 }),
      }),
    ).toBe(resorted);
    expect(
      feedReducer(resorted, {
        type: "first",
        sort: "recent",
        response: page([1]),
      }),
    ).toBe(resorted);
    expect(
      feedReducer(state, {
        type: "page",
        sort: "recent",
        response: page([9], { total: 3, page: 3 }),
      }),
    ).toBe(state);
  });

  it("tells the cap when the API says it hides cards, and a page beyond it as the end, never as a failure (RG21, CA18)", () => {
    let state = feedReducer(initialFeedState(), {
      type: "first",
      sort: "recent",
      response: page([1], { total: 200, nextPage: 2, capReached: false }),
    });
    state = feedReducer(state, { type: "more" });
    const capped = feedReducer(state, {
      type: "more-failed",
      sort: "recent",
      page: 2,
      refusal: { code: "validation_failed", issues: ["page_cap"] },
    });
    expect(capped).toMatchObject({
      phase: "ready",
      nextPage: null,
      capReached: true,
      more: { kind: "idle" },
    });
  });
});

describe("L3D-T7: a refusal is told in words, never by a technical code (L3D-A §7)", () => {
  it("maps 403, 429 and the cap, and everything else to « unavailable »", () => {
    expect(feedFailureOf({ code: "forbidden" })).toBe("forbidden");
    expect(feedFailureOf({ code: "rate_limited", retryAfterSeconds: 12 })).toBe(
      "rate_limited",
    );
    expect(
      feedFailureOf({ code: "validation_failed", issues: ["page_cap"] }),
    ).toBe("page_cap");
    expect(
      feedFailureOf({ code: "validation_failed", issues: ["other"] }),
    ).toBe("unavailable");
    expect(feedFailureOf({ code: "not_found" })).toBe("unavailable");
    expect(feedFailureOf({})).toBe("unavailable");
  });

  it("keeps the delay the API asked, on the first page and on the next one, and a failure of « Voir la suite » keeps the cards", () => {
    const loading = initialFeedState();
    expect(
      feedReducer(loading, {
        type: "first-failed",
        sort: "recent",
        refusal: { code: "rate_limited", retryAfterSeconds: 30 },
      }),
    ).toEqual({
      phase: "failed",
      sort: "recent",
      failure: "rate_limited",
      retryAfterSeconds: 30,
    });
    let state = feedReducer(loading, {
      type: "first",
      sort: "recent",
      response: page([1], { total: 2, nextPage: 2 }),
    });
    state = feedReducer(state, { type: "more" });
    state = feedReducer(state, {
      type: "more-failed",
      sort: "recent",
      page: 2,
      refusal: {},
    });
    expect(state).toMatchObject({
      phase: "ready",
      nextPage: 2,
      more: { kind: "failed", failure: "unavailable", retryAfterSeconds: null },
    });
    expect(state.phase === "ready" && state.items.length).toBe(1);
    // The retry asks the same page again.
    expect(feedReducer(state, { type: "more" })).toMatchObject({
      more: { kind: "loading" },
      nextPage: 2,
    });
  });
});

describe("L3D-T7: two sorts exactly, the most recent first (RG33, RG34, D11)", () => {
  it("offers « recent » then « deadline », opens on the first, and never trusts a value of the control", () => {
    expect(FEED_SORTS).toEqual(["recent", "deadline"]);
    expect(DEFAULT_FEED_SORT).toBe("recent");
    expect(sortOf("deadline")).toBe("deadline");
    expect(sortOf("relevance")).toBe("recent");
    expect(sortOf("")).toBe("recent");
  });
});

describe("L3D-T7: the texts of the feed, in both languages", () => {
  const KEYS = (value: unknown, prefix = ""): string[] =>
    typeof value === "object" && value !== null
      ? Object.entries(value).flatMap(([key, inner]) =>
          KEYS(inner, `${prefix}${key}.`),
        )
      : [prefix.slice(0, -1)];

  it("holds the same keys in French and in English, each one written", () => {
    expect(KEYS(frCampaign.feed).sort()).toEqual(KEYS(enCampaign.feed).sort());
    for (const key of KEYS(frCampaign.feed)) {
      const read = (tree: unknown) =>
        key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            tree,
          );
      expect(read(frCampaign.feed), `fr ${key}`).toEqual(expect.any(String));
      expect(read(enCampaign.feed), `en ${key}`).toEqual(expect.any(String));
    }
  });

  it("says « À négocier avec votre commercial » once, by the notice of the campaign, and promises no figure", () => {
    expect(frCampaign.budget.negotiate).toBe(
      "À négocier avec votre commercial.",
    );
    for (const tree of [frCampaign.feed, enCampaign.feed]) {
      const written = JSON.stringify(tree);
      for (const forbidden of ["€", "EUR", "%", "net "]) {
        expect(written, forbidden).not.toContain(forbidden);
      }
    }
  });
});

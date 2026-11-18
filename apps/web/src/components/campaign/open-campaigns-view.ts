// The feed of open campaigns of a creator (docs/mvp/11 RG15, RG26, RG33 to RG36; 17 §5.5; D11, D46, D48, D78;
// jalons/l3d, commit 04), pure: the answer of `GET /v1/open-campaigns` in, the state of the screen and the
// view of each card out. The answer is the ONLY input: a card shows exactly what the contract gives it (RG15 at
// the pilot, RG25), and no amount, range, currency, net, count of applications or of views, nor contact of the
// brand exists in it, so none is built here (CLAUDE.md §2, D46, D48, D78). The nature of the consideration is
// followed by the notice of the answer, never by a figure. The order is the API's (RG33, D11): nothing here
// ranks, filters or counts. A card whose applications are closed has no way in (RG26, CA9). Every word comes from
// `labels` (the translation files), a code without a label shows as itself.
import type {
  OpenCampaignCard,
  OpenCampaignSort,
  OpenCampaignsResponse,
} from "@influx/contracts/open-campaigns";
import type { PreviewLabels } from "./campaign-preview-view";

/** The sort of the feed on opening (RG33): the most recent first. */
export const DEFAULT_FEED_SORT: OpenCampaignSort = "recent";

/** The separator of a short list written on one line. */
const JOIN = ", ";

/** The separator between two facts of the brand written on one line. */
const FACT_JOIN = " · ";

/** Why the feed is not shown: what a screen says, from the code and the issue of the refusal. */
export type FeedFailure =
  "forbidden" | "rate_limited" | "page_cap" | "unavailable";

/** What the relay says of a refusal (`RelayResult` `failed`), reduced to what is read here. */
export type FeedRefusal = {
  code?: string;
  issues?: readonly string[];
  retryAfterSeconds?: number;
};

/** The issue the API names on `page` beyond its cap (RG21, CA18). */
const PAGE_CAP_ISSUE = "page_cap";

/**
 * The refusal of the API as the screen tells it (L3D-A §7): 403 a suspended profile (RG23), 429 a read too
 * often (CA18), 400 on `page` beyond the cap, anything else is "unavailable". Never a technical word.
 */
export function feedFailureOf(refusal: FeedRefusal): FeedFailure {
  if (refusal.code === "forbidden") {
    return "forbidden";
  }
  if (refusal.code === "rate_limited") {
    return "rate_limited";
  }
  if (
    refusal.code === "validation_failed" &&
    refusal.issues?.includes(PAGE_CAP_ISSUE) === true
  ) {
    return "page_cap";
  }
  return "unavailable";
}

/** The cards a page adds to those already shown: a card already seen is ignored, the order is kept (L3D-A §4). */
export function mergeCards(
  seen: readonly OpenCampaignCard[],
  incoming: readonly OpenCampaignCard[],
): OpenCampaignCard[] {
  const ids = new Set(seen.map((card) => card.id));
  const added: OpenCampaignCard[] = [];
  for (const card of incoming) {
    if (!ids.has(card.id)) {
      ids.add(card.id);
      added.push(card);
    }
  }
  return [...seen, ...added];
}

/** What "Voir la suite" is doing. */
export type MoreState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "failed"; failure: FeedFailure; retryAfterSeconds: number | null };

/** The state of the screen: loading, unreadable, or a page of cards with what follows. */
export type FeedState =
  | { phase: "loading"; sort: OpenCampaignSort }
  | {
      phase: "failed";
      sort: OpenCampaignSort;
      failure: FeedFailure;
      retryAfterSeconds: number | null;
    }
  | {
      phase: "ready";
      sort: OpenCampaignSort;
      items: readonly OpenCampaignCard[];
      /** Every card of the feed, the greyed ones included (RG35). */
      total: number;
      /** The rank of the page "Voir la suite" asks, null at the end and at the cap (RG36). */
      nextPage: number | null;
      /** The cap hides cards: said, never a silent end (RG21). */
      capReached: boolean;
      more: MoreState;
    };

export type FeedAction =
  | { type: "load"; sort: OpenCampaignSort }
  | {
      type: "first";
      sort: OpenCampaignSort;
      response: OpenCampaignsResponse;
    }
  | { type: "first-failed"; sort: OpenCampaignSort; refusal: FeedRefusal }
  | { type: "more" }
  | {
      type: "page";
      sort: OpenCampaignSort;
      response: OpenCampaignsResponse;
    }
  | {
      type: "more-failed";
      sort: OpenCampaignSort;
      page: number;
      refusal: FeedRefusal;
    };

export function initialFeedState(
  sort: OpenCampaignSort = DEFAULT_FEED_SORT,
): FeedState {
  return { phase: "loading", sort };
}

function failureOf(refusal: FeedRefusal): {
  failure: FeedFailure;
  retryAfterSeconds: number | null;
} {
  return {
    failure: feedFailureOf(refusal),
    retryAfterSeconds: refusal.retryAfterSeconds ?? null,
  };
}

/**
 * The state after an event. An answer for another sort than the one shown, or for a page that is not the one
 * asked, is a late answer and changes nothing: a sort changed while a page loads never receives the old cards.
 */
export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "load":
      return { phase: "loading", sort: action.sort };
    case "first":
      if (state.phase !== "loading" || state.sort !== action.sort) {
        return state;
      }
      return {
        phase: "ready",
        sort: action.sort,
        items: mergeCards([], action.response.items),
        total: action.response.total,
        nextPage: action.response.nextPage,
        capReached: action.response.capReached,
        more: { kind: "idle" },
      };
    case "first-failed":
      if (state.phase !== "loading" || state.sort !== action.sort) {
        return state;
      }
      return {
        phase: "failed",
        sort: action.sort,
        ...failureOf(action.refusal),
      };
    case "more":
      if (
        state.phase !== "ready" ||
        state.nextPage === null ||
        state.more.kind === "loading"
      ) {
        return state;
      }
      return { ...state, more: { kind: "loading" } };
    case "page":
      if (
        state.phase !== "ready" ||
        state.sort !== action.sort ||
        state.more.kind !== "loading" ||
        state.nextPage !== action.response.page
      ) {
        return state;
      }
      return {
        ...state,
        items: mergeCards(state.items, action.response.items),
        total: action.response.total,
        nextPage: action.response.nextPage,
        capReached: action.response.capReached,
        more: { kind: "idle" },
      };
    case "more-failed": {
      if (
        state.phase !== "ready" ||
        state.sort !== action.sort ||
        state.more.kind !== "loading" ||
        state.nextPage !== action.page
      ) {
        return state;
      }
      const { failure, retryAfterSeconds } = failureOf(action.refusal);
      // Beyond the cap: the end of the feed, said as such, never a failure to retry (RG21, CA18).
      return failure === "page_cap"
        ? {
            ...state,
            nextPage: null,
            capReached: true,
            more: { kind: "idle" },
          }
        : { ...state, more: { kind: "failed", failure, retryAfterSeconds } };
    }
  }
}

/** The period of a campaign as a card writes it: both dates, or the one it has. */
export type CardPeriod =
  | { kind: "range"; from: string; to: string }
  | { kind: "from"; from: string }
  | { kind: "until"; to: string };

/** What a card draws (RG15 at the pilot): nothing the answer does not hold, no amount and no counter. */
export type FeedCardView = {
  id: string;
  /** Candidatures closed within the last days (RG26): greyed, no way in, the label says so. */
  closed: boolean;
  brandName: string;
  hasLogo: boolean;
  /** « Marque vérifiée le … », when the badge holds (RG15, 06 RG53). */
  badge: string | null;
  /** The sector and the size of the brand, on one line. */
  brandFacts: string | null;
  title: string | null;
  topics: string | null;
  deliverables: string[];
  /** The nature of the consideration, then `notice` (D78). */
  nature: string | null;
  notice: string;
  countries: string | null;
  period: CardPeriod | null;
  deadline: string | null;
  publishedOn: string;
};

function periodOf(
  startsOn: string | null,
  endsOn: string | null,
  labels: PreviewLabels,
): CardPeriod | null {
  if (startsOn !== null && endsOn !== null) {
    return {
      kind: "range",
      from: labels.civilDate(startsOn),
      to: labels.civilDate(endsOn),
    };
  }
  if (startsOn !== null) {
    return { kind: "from", from: labels.civilDate(startsOn) };
  }
  return endsOn === null
    ? null
    : { kind: "until", to: labels.civilDate(endsOn) };
}

function listText(items: readonly string[], separator: string): string | null {
  return items.length === 0 ? null : items.join(separator);
}

/** The card as it is drawn: every value of the answer written by `labels`, nothing added. */
export function cardViewOf(
  card: OpenCampaignCard,
  labels: PreviewLabels,
): FeedCardView {
  const { campaign, brand } = card;
  return {
    id: card.id,
    closed: card.applicationsClosed,
    brandName: brand.companyName,
    hasLogo: brand.hasLogo,
    badge: brand.badge === null ? null : labels.badge(brand.badge.since),
    brandFacts: listText(
      [
        ...(brand.primarySector === null
          ? []
          : [labels.option("reference.sector", brand.primarySector)]),
        ...(brand.companySize === null
          ? []
          : [labels.option("companySize", brand.companySize)]),
      ],
      FACT_JOIN,
    ),
    title: campaign.title,
    topics: listText(
      campaign.audienceTopics.map((code) =>
        labels.option("reference.topic", code),
      ),
      JOIN,
    ),
    deliverables: campaign.deliverables.map((line) =>
      labels.deliverable(
        line.quantity,
        labels.option("reference.network", line.networkCode),
        labels.option("reference.format", line.formatCode),
      ),
    ),
    nature:
      campaign.remunerationKind === null
        ? null
        : labels.nature(campaign.remunerationKind),
    notice: labels.notice,
    countries: listText(campaign.audienceCountries.map(labels.country), JOIN),
    period: periodOf(campaign.startsOn, campaign.endsOn, labels),
    deadline:
      campaign.applicationsCloseOn === null
        ? null
        : labels.civilDate(campaign.applicationsCloseOn),
    publishedOn: labels.civilDate(card.publishedOn),
  };
}

/** The sorts the control offers, in order (RG33): exactly two. */
export const FEED_SORTS: readonly OpenCampaignSort[] = ["recent", "deadline"];

/** The sort a value of the control names; the default when it names none (a value is never trusted). */
export function sortOf(value: string): OpenCampaignSort {
  return FEED_SORTS.find((sort) => sort === value) ?? DEFAULT_FEED_SORT;
}

// The profile a brand opens, its private lists and its request to the INFLUX team (docs/mvp/10 RG1, RG15, RG41, RG42,
// RG50, RG51, RG55, RG61, RG63, RG65; 17 §4.4, §4.9, §7.1; D38, D45, D48, D78; jalons/l3f, commit 11), pure: the answer
// of the API in, the state of the screen out; the names, notes and messages as they are checked before they leave;
// the memory of the panel « Ma sélection » and of one list as reducers; the addresses of the pages. Nothing here
// decides what a list may hold, who may be added or how many requests a day: the base and apps/api do, and a refusal
// is only told. No amount, tariff, currency, exact figure or action of introduction exists here (CLAUDE.md §2, D45,
// D48, D78): a list sends nothing to the creator (RG51), a request sends nothing to anyone but the INFLUX team.
import type { CreatorSearchFilters } from "@influx/contracts/creator-search";
import type { CreatorSearchProfileResponse } from "@influx/contracts/creator-search-profile";
import {
  SELECTION_MESSAGE_ISSUE,
  type SelectionRequestBody,
} from "@influx/contracts/selection-requests";
import {
  SHORTLIST_FULL_ISSUE,
  SHORTLIST_LIMIT_ISSUE,
  SHORTLIST_NAME_ISSUE,
  SHORTLIST_NOTE_ISSUE,
  type ShortlistItem,
  type ShortlistReadResponse,
  type ShortlistSummary,
  type ShortlistsResponse,
} from "@influx/contracts/shortlists";
import type { RelayResult } from "@influx/web-platform/relay-client";
import {
  cardOfProjection,
  type PreviewCard,
  type PreviewRow,
} from "@/components/creator-profile/creator-preview-view";
import { countCharacters } from "@/components/member/ui/text-limits";
import type { AppLocale } from "@/i18n/routing";
import { memberPageHref } from "@/lib/member-paths";
import {
  addressParamsOf,
  reasonTextsOf,
  vigilanceTextOf,
  type SearchLabels,
  type SearchQuery,
  type SearchRefusal,
} from "./creator-search-view";

/** The profile as a screen reads it (the answer of the API, its `state` apart). */
export type OpenedProfile = Extract<
  CreatorSearchProfileResponse,
  { state: "profile" }
>;

/** The bounds the base holds and the form tells (modele §5, §6); the base decides, these only keep a field honest. */
export const SHORTLIST_NAME_MAX = 80;
export const SHORTLIST_NOTE_MAX = 500;
export const SELECTION_MESSAGE_MAX = 1000;

/** The visuals of a profile: three, where a card of a list shows one (17 §7.1, RG50). */
export const PROFILE_VISUALS_SHOWN = 3;

// --- the refusals --------------------------------------------------------------------------------------

/** Why a gesture on a list or a request was refused: what a screen says, from the code and the issue (never a technical word). */
export type SelectionFailure =
  | "not_found"
  | "limit"
  | "full"
  | "invalid_name"
  | "invalid_note"
  | "invalid_message"
  | "rate_limited"
  | "unavailable";

/**
 * 404 a list, a campaign or a creator that does not exist for this brand (CA49); 409 a bound reached (the lists, a
 * list); 400 a name, a note or a message the base refused; 429 the bucket is full; anything else « unavailable ».
 */
export function selectionFailureOf(refusal: SearchRefusal): SelectionFailure {
  const issues = refusal.issues ?? [];
  switch (refusal.code) {
    case "not_found":
      return "not_found";
    case "rate_limited":
      return "rate_limited";
    case "conflict":
      if (issues.includes(SHORTLIST_LIMIT_ISSUE)) {
        return "limit";
      }
      return issues.includes(SHORTLIST_FULL_ISSUE) ? "full" : "unavailable";
    case "validation_failed":
      if (issues.includes(SHORTLIST_NAME_ISSUE)) {
        return "invalid_name";
      }
      if (issues.includes(SHORTLIST_NOTE_ISSUE)) {
        return "invalid_note";
      }
      return issues.includes(SELECTION_MESSAGE_ISSUE)
        ? "invalid_message"
        : "unavailable";
    default:
      return "unavailable";
  }
}

// --- what is typed -------------------------------------------------------------------------------------

/** What is wrong with a name of a list before it leaves; the base trims it and holds 1 to 80 characters on one line. */
export function nameProblemOf(raw: string): "empty" | "too_long" | null {
  const name = raw.trim();
  if (name === "") {
    return "empty";
  }
  return countCharacters(name) > SHORTLIST_NAME_MAX ? "too_long" : null;
}

/** The note of a creator: null when blank (it clears the note), the trimmed text otherwise. */
export function noteOf(raw: string): string | null {
  const note = raw.trim();
  return note === "" ? null : note;
}

export function noteProblemOf(raw: string): "too_long" | null {
  return countCharacters(raw.trim()) > SHORTLIST_NOTE_MAX ? "too_long" : null;
}

/** The message of a request: null when blank (the field is free and optional), the trimmed text otherwise. */
export function messageOf(raw: string): string | null {
  const message = raw.trim();
  return message === "" ? null : message;
}

export function messageProblemOf(raw: string): "too_long" | null {
  return countCharacters(raw.trim()) > SELECTION_MESSAGE_MAX
    ? "too_long"
    : null;
}

/** The body of a request for a selection (RG61): every criterion of the search, its campaign, the message. Nothing else. */
export function requestBodyOf(
  filters: CreatorSearchFilters,
  campaignId: string | null,
  message: string,
): SelectionRequestBody {
  return { filters, campaignId, message: messageOf(message) };
}

/**
 * The day the INFLUX team answers by, as the base fixed it at the deposit (`answerBy`): a delay, never a promise of a
 * result. `timeZone` is the reader's own unless a test fixes one.
 */
export function deadlineTextOf(
  iso: string,
  locale: AppLocale,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(iso));
}

// --- the panel and the lists ---------------------------------------------------------------------------

/** What the panel « Ma sélection » and « Mes sélections » know of the brand's lists, and which creators each holds. */
export type SelectionState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "closed" }
  | { phase: "brand_not_published" }
  | {
      phase: "ready";
      /** Newest first, as the API gives them. */
      lists: readonly ShortlistSummary[];
      /** The aliases of the lists read so far (a list is read once, then followed by the gestures). */
      members: Readonly<Record<string, readonly string[]>>;
    };

export type SelectionAction =
  | { type: "loading" }
  | { type: "loaded"; response: ShortlistsResponse }
  | { type: "failed" }
  | { type: "members"; listId: string; aliases: readonly string[] }
  | { type: "upserted"; list: ShortlistSummary }
  | { type: "deleted"; listId: string }
  | { type: "added"; listId: string; alias: string }
  | { type: "removed"; listId: string; alias: string };

export const INITIAL_SELECTION: SelectionState = { phase: "loading" };

/** The state of the lists after an event; a gesture on a list not known changes nothing. */
export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  if (action.type === "loading") {
    return INITIAL_SELECTION;
  }
  if (action.type === "loaded") {
    const { response } = action;
    return response.state === "shortlists"
      ? { phase: "ready", lists: response.shortlists, members: {} }
      : { phase: response.state };
  }
  if (action.type === "failed") {
    return { phase: "failed" };
  }
  if (state.phase !== "ready") {
    return state;
  }
  const { lists, members } = state;
  switch (action.type) {
    case "members":
      return {
        ...state,
        members: { ...members, [action.listId]: [...action.aliases] },
      };
    case "upserted": {
      const known = lists.some((list) => list.id === action.list.id);
      return {
        ...state,
        lists: known
          ? lists.map((list) =>
              list.id === action.list.id ? action.list : list,
            )
          : [action.list, ...lists],
      };
    }
    case "deleted": {
      const rest = Object.fromEntries(
        Object.entries(members).filter(([id]) => id !== action.listId),
      );
      return {
        ...state,
        lists: lists.filter((list) => list.id !== action.listId),
        members: rest,
      };
    }
    case "added": {
      const held = members[action.listId];
      if (held === undefined || held.includes(action.alias)) {
        return state;
      }
      return {
        ...state,
        lists: lists.map((list) =>
          list.id === action.listId ? { ...list, count: list.count + 1 } : list,
        ),
        members: { ...members, [action.listId]: [...held, action.alias] },
      };
    }
    case "removed": {
      const held = members[action.listId];
      if (held === undefined || !held.includes(action.alias)) {
        return state;
      }
      return {
        ...state,
        lists: lists.map((list) =>
          list.id === action.listId
            ? { ...list, count: Math.max(list.count - 1, 0) }
            : list,
        ),
        members: {
          ...members,
          [action.listId]: held.filter((alias) => alias !== action.alias),
        },
      };
    }
  }
}

/** The list the panel shows: the one the address names when it is one of the brand's, else the newest, else none. */
export function activeListIdOf(
  state: SelectionState,
  preferredId: string | null,
): string | null {
  if (state.phase !== "ready") {
    return null;
  }
  const preferred = state.lists.find((list) => list.id === preferredId);
  return preferred?.id ?? state.lists[0]?.id ?? null;
}

/** The aliases of a list when it has been read, else null (the button then waits for it). */
export function membersOf(
  state: SelectionState,
  listId: string | null,
): readonly string[] | null {
  if (state.phase !== "ready" || listId === null) {
    return null;
  }
  return state.members[listId] ?? null;
}

/** The summary of a list of the state, null when it is not one of the brand's. */
export function listOf(
  state: SelectionState,
  listId: string | null,
): ShortlistSummary | null {
  if (state.phase !== "ready") {
    return null;
  }
  return state.lists.find((list) => list.id === listId) ?? null;
}

// --- one list ------------------------------------------------------------------------------------------

/** One list and its visible creators, as the page of a list reads them. */
export type DetailState =
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "gone" }
  | { phase: "closed" }
  | { phase: "brand_not_published" }
  | {
      phase: "ready";
      list: ShortlistSummary;
      items: readonly ShortlistItem[];
    };

export type DetailAction =
  | { type: "loaded"; response: ShortlistReadResponse }
  | { type: "gone" }
  | { type: "failed" }
  | { type: "listChanged"; list: ShortlistSummary }
  | { type: "noted"; alias: string; note: string | null }
  | { type: "removed"; alias: string };

export const INITIAL_DETAIL: DetailState = { phase: "loading" };

export function detailReducer(
  state: DetailState,
  action: DetailAction,
): DetailState {
  switch (action.type) {
    case "loaded": {
      const { response } = action;
      return response.state === "shortlist"
        ? { phase: "ready", list: response.shortlist, items: response.items }
        : { phase: response.state };
    }
    case "gone":
      return { phase: "gone" };
    case "failed":
      return { phase: "failed" };
  }
  if (state.phase !== "ready") {
    return state;
  }
  switch (action.type) {
    case "listChanged":
      return { ...state, list: action.list };
    case "noted":
      return {
        ...state,
        items: state.items.map((item) =>
          item.creator.alias === action.alias
            ? { ...item, note: action.note }
            : item,
        ),
      };
    case "removed": {
      if (!state.items.some((item) => item.creator.alias === action.alias)) {
        return state;
      }
      return {
        ...state,
        list: { ...state.list, count: Math.max(state.list.count - 1, 0) },
        items: state.items.filter(
          (item) => item.creator.alias !== action.alias,
        ),
      };
    }
  }
}

// --- the profile ---------------------------------------------------------------------------------------

/** What the page of a profile is: the states of the answer, then the refusals (404 and 429 are errors of the relay). */
export type ProfileScreen =
  | { kind: "loading" }
  | { kind: "closed" }
  | { kind: "brand_not_published" }
  | { kind: "profile"; profile: OpenedProfile }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | { kind: "gone" }
  | { kind: "failed" };

/**
 * The screen of the answer of the profile route. An unknown alias, an excluded one and a malformed one are one and
 * the same `not_found` (CA49), told once: « ce profil n'est plus disponible ». The bucket full is a 429 (T15.2).
 */
export function profileScreenOf(
  result: RelayResult<CreatorSearchProfileResponse>,
): ProfileScreen {
  if (result.kind === "ok") {
    return result.data.state === "profile"
      ? { kind: "profile", profile: result.data }
      : { kind: result.data.state };
  }
  if (result.kind === "failed") {
    if (result.code === "not_found") {
      return { kind: "gone" };
    }
    if (result.code === "rate_limited") {
      return {
        kind: "rate_limited",
        retryAfterSeconds: result.retryAfterSeconds ?? null,
      };
    }
  }
  return { kind: "failed" };
}

/**
 * The row of the region of residence (RG15, CA14, CA15): said only when the base serves it (at least
 * `region_display_threshold` storefronts share it), the code as it is (EC-L3F-11-1: no list of region names exists
 * yet), never filterable, the city never. Null when none is served.
 */
export function regionRowOf(
  region: string | null,
  labels: SearchLabels,
): PreviewRow | null {
  return region === null
    ? null
    : {
        field: "residenceRegion",
        label: labels.text("profile.region"),
        value: region,
      };
}

/**
 * The profile as the screen draws it: the card of the search, whole and larger, with its three visuals (RG50), the
 * region when it is served, then « Proposé car » and the note of vigilance (RG41, RG42) in words. One source with the
 * card of the grid: the same function writes both (`cardOfProjection`).
 */
export function profileViewOf(
  profile: OpenedProfile,
  labels: SearchLabels,
): { card: PreviewCard; reasons: string[]; vigilance: string | null } {
  const drawn = cardOfProjection(
    profile.creator,
    labels.card,
    PROFILE_VISUALS_SHOWN,
  );
  const region = regionRowOf(profile.residenceRegion, labels);
  return {
    card:
      region === null
        ? drawn
        : { ...drawn, profile: [...drawn.profile, region] },
    reasons: reasonTextsOf(profile, labels),
    vigilance: vigilanceTextOf(profile, labels),
  };
}

// --- the addresses -------------------------------------------------------------------------------------

/** The address of a search to come back to: its criteria, sort, campaign, page and the active list (the « reprise »). */
export type SearchPlace = {
  query: SearchQuery;
  page: number;
  listId: string | null;
};

/** The path of the profile of a card, in the current language and without the prefix: the alias, then the search's address. */
export function profileHref(
  alias: string,
  locale: AppLocale,
  place: SearchPlace,
): string {
  return `${memberPageHref("advertiserCreatorProfile", locale, alias)}${addressParamsOf(place.query, place.page, place.listId)}`;
}

/** The path back to the search a profile or a request was opened from. */
export function searchHref(locale: AppLocale, place: SearchPlace): string {
  return `${memberPageHref("advertiserCreators", locale)}${addressParamsOf(place.query, place.page, place.listId)}`;
}

/** The path of the request for a selection, which takes the criteria and the campaign of the search back. */
export function requestHref(locale: AppLocale, place: SearchPlace): string {
  return `${memberPageHref("advertiserSelectionRequest", locale)}${addressParamsOf(place.query, 1, place.listId)}`;
}

/** The path of one of the brand's lists. */
export function shortlistHref(locale: AppLocale, listId: string): string {
  return memberPageHref("advertiserShortlist", locale, listId);
}

// Calls of M4, the brand's anonymous creator search (docs/mvp/10 RG1, RG2, RG65; 17 §4.4; jalons/l3f, commit 10).
// Each one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the answer with the
// schema of packages/contracts. No rule lives here: apps/api and the base decide what is open, what is visible,
// how many and how often. The account is always the session's; the only identifiers of a path are the alias of a
// card and the opaque identifier of one of its visuals (RG65). The bytes of a visual come as JSON, never an
// address (D82 (7), L3F fiche invariant 3).
import {
  creatorSearchResponseSchema,
  type CreatorSearchBody,
  type CreatorSearchResponse,
} from "@influx/contracts/creator-search";
import {
  creatorSearchVisualResponseSchema,
  type CreatorSearchVisualResponse,
} from "@influx/contracts/creator-search-profile";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const SEARCH_PATH = "/v1/creator-search";

/** One page of one search: the whole entry of the contract (filters, sort, page, campaign), nothing else (RG63). */
export function searchCreators(
  body: CreatorSearchBody,
): Promise<RelayResult<CreatorSearchResponse>> {
  return callRelay("POST", SEARCH_PATH, creatorSearchResponseSchema, body);
}

/** The bytes of an approved visual of a card, relayed as JSON by apps/api (D82 (7)). */
export function readCreatorVisual(
  alias: string,
  visualId: string,
): Promise<RelayResult<CreatorSearchVisualResponse>> {
  return callRelay(
    "GET",
    `${SEARCH_PATH}/profiles/${alias}/visuals/${visualId}`,
    creatorSearchVisualResponseSchema,
  );
}

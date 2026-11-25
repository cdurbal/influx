"use client";

// The state of M4 (docs/mvp/10 RG63, RG64; 17 §4.4; jalons/l3f, commit 10), outside the component (CLAUDE.md §5):
// the page of the query of the address asked once, the pages already answered kept (a page is one search of the
// bucket of the account, so going back asks nothing), a refusal kept until « Réessayer » is pressed. The
// transitions are `searchReducer` (creator-search-view.ts, tested alone). Nothing is decided here: apps/api and
// the base say what is open, what is served and when the bucket is full.
import { useCallback, useEffect, useReducer, useRef } from "react";
import { searchCreators } from "./creator-search-api";
import {
  bodyOf,
  initialSearchState,
  needsAsking,
  queryKeyOf,
  screenOf,
  searchReducer,
  type SearchQuery,
  type SearchScreen,
} from "./creator-search-view";

export type CreatorSearch = {
  screen: SearchScreen;
  /** Asks the page again after a refusal. */
  retry: () => void;
};

export function useCreatorSearch(options: {
  query: SearchQuery;
  page: number;
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
}): CreatorSearch {
  const { query, page } = options;
  const queryKey = queryKeyOf(query);
  const [state, dispatch] = useReducer(searchReducer, queryKey, (key) =>
    initialSearchState(key),
  );
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);
  // The page being asked, so that a second run of the effect (React's strict mode) never asks twice.
  const inflight = useRef<string | null>(null);

  useEffect(() => {
    if (!needsAsking(state, queryKey, page)) {
      return;
    }
    const id = `${queryKey}|${page}`;
    if (inflight.current === id) {
      return;
    }
    inflight.current = id;
    dispatch({ type: "ask", queryKey, page });
    void searchCreators(bodyOf(query, page)).then((result) => {
      if (result.kind === "ok") {
        dispatch({ type: "answer", queryKey, page, response: result.data });
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      } else {
        dispatch({ type: "refused", queryKey, page, refusal: result });
      }
    });
  }, [state, queryKey, page, query]);

  const retry = useCallback(() => {
    inflight.current = null;
    dispatch({ type: "retry", page });
  }, [page]);

  return { screen: screenOf(state, queryKey, page), retry };
}

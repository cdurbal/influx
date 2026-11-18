"use client";

// The state of the creator's feed of open campaigns (docs/mvp/11 RG33, RG35, RG36; 17 §5.5; jalons/l3d, commit
// 04), outside the component (CLAUDE.md §5): the first page read at the mount, the same page again when the sort
// changes or a retry is asked, the next page when "Voir la suite" is pressed. The transitions are
// `feedReducer` (open-campaigns-view.ts, tested alone): a late answer for another sort or another page changes
// nothing. Nothing is decided here: apps/api says what is visible, in which order and when a read is too soon.
import type { OpenCampaignSort } from "@influx/contracts/open-campaigns";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { readOpenCampaigns } from "./open-campaigns-api";
import {
  feedReducer,
  initialFeedState,
  type FeedState,
} from "./open-campaigns-view";

export type OpenCampaignsFeed = {
  state: FeedState;
  /** Reads the first page again, in this sort (the control, or the retry of an unreadable feed). */
  load: (sort: OpenCampaignSort) => void;
  /** Reads the page after the last one shown ("Voir la suite", or its retry). */
  more: () => void;
};

export function useOpenCampaigns(options: {
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
}): OpenCampaignsFeed {
  const [state, dispatch] = useReducer(feedReducer, undefined, () =>
    initialFeedState(),
  );
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const fetchFirst = useCallback(async (sort: OpenCampaignSort) => {
    const result = await readOpenCampaigns(sort, 1);
    if (result.kind === "ok") {
      dispatch({ type: "first", sort, response: result.data });
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      dispatch({ type: "first-failed", sort, refusal: result });
    }
  }, []);

  useEffect(() => {
    // The first read starts once, at the mount; its answer is the state of the screen.
    void fetchFirst(initialFeedState().sort);
  }, [fetchFirst]);

  const load = useCallback(
    (sort: OpenCampaignSort) => {
      dispatch({ type: "load", sort });
      void fetchFirst(sort);
    },
    [fetchFirst],
  );

  const more = useCallback(() => {
    if (
      state.phase !== "ready" ||
      state.nextPage === null ||
      state.more.kind === "loading"
    ) {
      return;
    }
    const { sort, nextPage: page } = state;
    dispatch({ type: "more" });
    void readOpenCampaigns(sort, page).then((result) => {
      if (result.kind === "ok") {
        dispatch({ type: "page", sort, response: result.data });
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      } else {
        dispatch({ type: "more-failed", sort, page, refusal: result });
      }
    });
  }, [state]);

  return { state, load, more };
}

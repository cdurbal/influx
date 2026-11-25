"use client";

// One of the brand's lists and its visible creators (docs/mvp/10 RG51, RG63; 17 §4.9; D45; jalons/l3f, commit 11),
// outside the component (CLAUDE.md §5): the list read once, then every gesture (rename, attach to a campaign, note a
// creator, take one out, delete the list) applied to the memory once the API has answered. The transitions are
// `detailReducer` (shortlists-view.ts, tested alone). A list of another brand and an unknown one answer alike (404,
// CA49): « cette sélection n'existe pas ». Nothing is decided here; nothing a gesture does reaches the creator (D45).
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  deleteShortlist,
  noteShortlistItem,
  readShortlist,
  removeFromShortlist,
  updateShortlist,
} from "./shortlists-api";
import {
  detailReducer,
  INITIAL_DETAIL,
  selectionFailureOf,
  type DetailState,
} from "./shortlists-view";
import type { SelectionOutcome } from "./use-shortlists";

export type ShortlistDetail = {
  state: DetailState;
  rename: (
    name: string,
    campaignId: string | null,
  ) => Promise<SelectionOutcome>;
  note: (alias: string, note: string | null) => Promise<SelectionOutcome>;
  remove: (alias: string) => Promise<SelectionOutcome>;
  deleteList: () => Promise<SelectionOutcome>;
};

const UNAVAILABLE: SelectionOutcome = {
  kind: "refused",
  failure: "unavailable",
};

export function useShortlistDetail(options: {
  id: string;
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
}): ShortlistDetail {
  const { id } = options;
  const [state, dispatch] = useReducer(detailReducer, INITIAL_DETAIL);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (asked.current === id) {
      return;
    }
    asked.current = id;
    void readShortlist(id).then((result) => {
      if (result.kind === "ok") {
        dispatch({ type: "loaded", response: result.data });
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      } else if (result.code === "not_found") {
        dispatch({ type: "gone" });
      } else {
        dispatch({ type: "failed" });
      }
    });
  }, [id]);

  const rename = useCallback(
    async (
      name: string,
      campaignId: string | null,
    ): Promise<SelectionOutcome> => {
      const result = await updateShortlist(id, name, campaignId);
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return UNAVAILABLE;
      }
      if (result.kind === "failed") {
        return { kind: "refused", failure: selectionFailureOf(result) };
      }
      if (result.data.state === "shortlist") {
        dispatch({ type: "listChanged", list: result.data.shortlist });
        return { kind: "ok", listId: id };
      }
      dispatch({ type: "loaded", response: { state: result.data.state } });
      return UNAVAILABLE;
    },
    [id],
  );

  const note = useCallback(
    async (alias: string, text: string | null): Promise<SelectionOutcome> => {
      const result = await noteShortlistItem(id, alias, text);
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return UNAVAILABLE;
      }
      if (result.kind === "failed") {
        return { kind: "refused", failure: selectionFailureOf(result) };
      }
      if (result.data.state === "noted") {
        dispatch({ type: "noted", alias, note: text });
        return { kind: "ok", listId: id };
      }
      return UNAVAILABLE;
    },
    [id],
  );

  const remove = useCallback(
    async (alias: string): Promise<SelectionOutcome> => {
      const result = await removeFromShortlist(id, alias);
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return UNAVAILABLE;
      }
      if (result.kind === "failed") {
        return { kind: "refused", failure: selectionFailureOf(result) };
      }
      if (result.data.state === "removed") {
        dispatch({ type: "removed", alias });
        return { kind: "ok", listId: id };
      }
      return UNAVAILABLE;
    },
    [id],
  );

  const deleteList = useCallback(async (): Promise<SelectionOutcome> => {
    const result = await deleteShortlist(id);
    if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
      return UNAVAILABLE;
    }
    if (result.kind === "failed") {
      return { kind: "refused", failure: selectionFailureOf(result) };
    }
    return result.data.state === "deleted"
      ? { kind: "ok", listId: null }
      : UNAVAILABLE;
  }, [id]);

  return { state, rename, note, remove, deleteList };
}

"use client";

// The brand's lists, for the panel « Ma sélection », the buttons of the cards and « Mes sélections » (docs/mvp/10
// RG51, RG63; 17 §4.4, §4.9; D45; jalons/l3f, commit 11), outside the component (CLAUDE.md §5): the lists read once
// at the mount, the creators of the active list read once when it becomes active, then every gesture applied to the
// memory once the API has answered (nothing is shown before it did). The transitions are `selectionReducer`
// (shortlists-view.ts, tested alone). Nothing is decided here: the base says what a list holds, who may be added and
// how many lists a brand may have; a refusal comes back as a `SelectionFailure` the screen tells. Nothing a gesture
// does reaches the creator (D45, RG51).
import type { ShortlistSummary } from "@influx/contracts/shortlists";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  addToShortlist,
  createShortlist,
  deleteShortlist,
  readShortlist,
  readShortlists,
  removeFromShortlist,
  updateShortlist,
} from "./shortlists-api";
import {
  activeListIdOf,
  INITIAL_SELECTION,
  listOf,
  membersOf,
  selectionFailureOf,
  selectionReducer,
  type SelectionFailure,
  type SelectionState,
} from "./shortlists-view";

/** What a gesture came to: done (the list it touched), or refused for a reason a screen tells. */
export type SelectionOutcome =
  | { kind: "ok"; listId: string | null }
  | { kind: "refused"; failure: SelectionFailure };

export type Selection = {
  state: SelectionState;
  /** The list the panel shows: the address's when it is one of the brand's, else the newest, else none. */
  activeId: string | null;
  active: ShortlistSummary | null;
  /** The aliases of the active list; null until it has been read (the button waits for it). */
  aliases: readonly string[] | null;
  create: (
    name: string,
    campaignId: string | null,
  ) => Promise<SelectionOutcome>;
  update: (
    id: string,
    name: string,
    campaignId: string | null,
  ) => Promise<SelectionOutcome>;
  deleteList: (id: string) => Promise<SelectionOutcome>;
  /** Adds a creator to the active list, creating one named `defaultName` when the brand has none yet. */
  add: (alias: string, defaultName: string) => Promise<SelectionOutcome>;
  drop: (alias: string) => Promise<SelectionOutcome>;
  reload: () => void;
};

const UNAVAILABLE: SelectionOutcome = {
  kind: "refused",
  failure: "unavailable",
};

/** A write that answers a list, or the state that closes the door (D38, RG1). */
type ListAnswer = RelayResult<
  | { state: "closed" }
  | { state: "brand_not_published" }
  | { state: "shortlist"; shortlist: ShortlistSummary }
>;

export function useShortlists(options: {
  preferredId: string | null;
  /** Whether the creators of the active list are read (the panel and the buttons need them, « Mes sélections » does not). */
  readMembers?: boolean;
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
}): Selection {
  const { preferredId, readMembers = true } = options;
  const [state, dispatch] = useReducer(selectionReducer, INITIAL_SELECTION);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);
  const reading = useRef<Set<string>>(new Set());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const load = useCallback(() => {
    reading.current = new Set();
    void readShortlists().then((result) => {
      if (result.kind === "ok") {
        dispatch({ type: "loaded", response: result.data });
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      } else {
        dispatch({ type: "failed" });
      }
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const activeId = activeListIdOf(state, preferredId);
  const aliases = membersOf(state, activeId);
  useEffect(() => {
    if (
      !readMembers ||
      activeId === null ||
      aliases !== null ||
      reading.current.has(activeId)
    ) {
      return;
    }
    reading.current.add(activeId);
    void readShortlist(activeId).then((result) => {
      if (result.kind === "ok" && result.data.state === "shortlist") {
        dispatch({
          type: "members",
          listId: activeId,
          aliases: result.data.items.map((item) => item.creator.alias),
        });
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      }
    });
  }, [activeId, aliases, readMembers]);

  /** The outcome of a refused call (a refusal is told, the end of the session handed to the shell), null when it went through. */
  const refusalOf = useCallback(
    (result: RelayResult<unknown>): SelectionOutcome | null => {
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return UNAVAILABLE;
      }
      return result.kind === "failed"
        ? { kind: "refused", failure: selectionFailureOf(result) }
        : null;
    },
    [],
  );

  const write = useCallback(
    async (call: Promise<ListAnswer>): Promise<SelectionOutcome> => {
      const result = await call;
      const refused = refusalOf(result);
      if (refused !== null) {
        return refused;
      }
      if (result.kind !== "ok") {
        return UNAVAILABLE;
      }
      const { data } = result;
      if (data.state === "shortlist") {
        dispatch({ type: "upserted", list: data.shortlist });
        return { kind: "ok", listId: data.shortlist.id };
      }
      dispatch({ type: "loaded", response: { state: data.state } });
      return UNAVAILABLE;
    },
    [refusalOf],
  );

  const create = useCallback(
    (name: string, campaignId: string | null) =>
      write(createShortlist(name, campaignId)).then((outcome) => {
        if (outcome.kind === "ok" && outcome.listId !== null) {
          dispatch({ type: "members", listId: outcome.listId, aliases: [] });
        }
        return outcome;
      }),
    [write],
  );

  const update = useCallback(
    (id: string, name: string, campaignId: string | null) =>
      write(updateShortlist(id, name, campaignId)),
    [write],
  );

  const deleteList = useCallback(
    async (id: string): Promise<SelectionOutcome> => {
      const result = await deleteShortlist(id);
      const refused = refusalOf(result);
      if (refused !== null) {
        return refused;
      }
      if (result.kind === "ok" && result.data.state === "deleted") {
        dispatch({ type: "deleted", listId: id });
        return { kind: "ok", listId: null };
      }
      return UNAVAILABLE;
    },
    [refusalOf],
  );

  const add = useCallback(
    async (alias: string, defaultName: string): Promise<SelectionOutcome> => {
      let target = activeListIdOf(stateRef.current, preferredId);
      if (target === null) {
        const created = await create(defaultName, null);
        if (created.kind !== "ok" || created.listId === null) {
          return created;
        }
        target = created.listId;
      }
      const result = await addToShortlist(target, alias);
      const refused = refusalOf(result);
      if (refused !== null) {
        return refused;
      }
      if (result.kind === "ok" && result.data.state === "added") {
        dispatch({ type: "added", listId: target, alias });
        return { kind: "ok", listId: target };
      }
      return UNAVAILABLE;
    },
    [create, preferredId, refusalOf],
  );

  const drop = useCallback(
    async (alias: string): Promise<SelectionOutcome> => {
      const target = activeListIdOf(stateRef.current, preferredId);
      if (target === null) {
        return UNAVAILABLE;
      }
      const result = await removeFromShortlist(target, alias);
      const refused = refusalOf(result);
      if (refused !== null) {
        return refused;
      }
      if (result.kind === "ok" && result.data.state === "removed") {
        dispatch({ type: "removed", listId: target, alias });
        return { kind: "ok", listId: target };
      }
      return UNAVAILABLE;
    },
    [preferredId, refusalOf],
  );

  return {
    state,
    activeId,
    active: listOf(state, activeId),
    aliases,
    create,
    update,
    deleteList,
    add,
    drop,
    reload: () => {
      dispatch({ type: "loading" });
      load();
    },
  };
}

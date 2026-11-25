"use client";

// The state and the flow of block 6 of "mon profil" of a creator, the portfolio (docs/mvp/17 §5.2; 07
// RG77 to RG84, RG111; jalons/l2g, commit 13), outside the components (CLAUDE.md §5): the visuals as
// apps/api lists them, each one read as JSON and shown from a `data:` source (never an address), the
// deposit and the replacement, the order, the caption, the removal, and the file kept in memory after
// an unavailable service so that it is sent again without choosing it again (RG111). A preview shows
// only what the API stored after its re-encoding: nothing is drawn from the file before. The name of
// the file is never read, shown or sent; nothing is kept in the browser's storage (D37).
import type {
  PortfolioCaptionBody,
  PortfolioImageResponse,
  PortfolioItem,
} from "@influx/contracts/creator-portfolio";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  orderPortfolio,
  readPortfolio,
  readPortfolioImage,
  removePortfolioItem,
  savePortfolioCaption,
  uploadPortfolioItem,
} from "./creator-portfolio-api";
import {
  orderAfterMove,
  placedIdsOf,
  portfolioFailureOf,
  portfolioFileProblem,
  type PortfolioFailure,
} from "./creator-portfolio-view";

export type PortfolioPhase = "loading" | "ready" | "unavailable";

/** What the last gesture left: nothing, a deposit or a removal done, a caption saved, or a failure. */
export type PortfolioActivity =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "uploaded" }
  | { kind: "removed" }
  | { kind: "ordered" }
  | { kind: "captionApplied"; itemId: string }
  /** On a published profile a new caption waits for its review; the previous one stays shown (CA48). */
  | { kind: "captionPending"; itemId: string }
  | { kind: "failed"; failure: PortfolioFailure; itemId: string | null };

export type CreatorPortfolioState = {
  phase: PortfolioPhase;
  items: readonly PortfolioItem[];
  /** The count of RG4 and RG88 as the API gives it. */
  deposited: number;
  /** The bytes of the visuals read so far, by identifier; a visual not in it is still being read. */
  images: Readonly<Record<string, PortfolioImageResponse>>;
  activity: PortfolioActivity;
  /** A file waits in memory to be sent again: the service did not answer (RG111). */
  canRetry: boolean;
  busy: boolean;
  /** The file chosen by the creator; `replaces` names the approved visual it stands for (RG81). */
  choose: (file: Blob, replaces: string | null) => void;
  retry: () => void;
  move: (itemId: string, delta: -1 | 1) => void;
  saveCaption: (itemId: string, body: PortfolioCaptionBody) => void;
  remove: (itemId: string) => void;
  reload: () => void;
};

export function useCreatorPortfolio(options: {
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
  /** A gesture changed what the profile says (the count, the missing fields): read the profile again. */
  onChanged: () => void;
}): CreatorPortfolioState {
  const [phase, setPhase] = useState<PortfolioPhase>("loading");
  const [items, setItems] = useState<readonly PortfolioItem[]>([]);
  const [deposited, setDeposited] = useState(0);
  const [images, setImages] = useState<
    Readonly<Record<string, PortfolioImageResponse>>
  >({});
  const [activity, setActivity] = useState<PortfolioActivity>({ kind: "idle" });
  const [canRetry, setCanRetry] = useState(false);

  const busyRef = useRef(false);
  const pending = useRef<{ file: Blob; replaces: string | null } | null>(null);
  const asked = useRef<Set<string>>(new Set());
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const forget = useCallback(() => {
    pending.current = null;
    setCanRetry(false);
  }, []);

  /** Takes the list as the API says it. */
  const adopt = useCallback(
    (next: { items: readonly PortfolioItem[]; deposited: number }) => {
      setItems(next.items);
      setDeposited(next.deposited);
    },
    [],
  );

  /** Reads the list again after a gesture; a failure leaves the list as it was. */
  const refresh = useCallback(async (): Promise<void> => {
    const result = await readPortfolio();
    if (result.kind === "ok") {
      adopt(result.data);
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    }
  }, [adopt]);

  const failed = useCallback(
    (
      result: { kind: "failed"; code?: string; issues?: readonly string[] },
      itemId: string | null,
    ): PortfolioFailure => {
      const failure = portfolioFailureOf(result);
      setActivity({ kind: "failed", failure, itemId });
      return failure;
    },
    [],
  );

  const send = useCallback(
    async (file: Blob, replaces: string | null): Promise<void> => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setActivity({ kind: "busy" });
      const result = await uploadPortfolioItem(file, replaces);
      if (result.kind === "ok") {
        forget();
        await refresh();
        busyRef.current = false;
        setActivity({ kind: "uploaded" });
        callbacks.current.onChanged();
        return;
      }
      busyRef.current = false;
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return;
      }
      const failure = failed(result, replaces);
      // Only an unavailable service leaves the same file worth sending again; the others need
      // another file, another day, or nothing.
      if (failure === "unavailable") {
        pending.current = { file, replaces };
        setCanRetry(true);
      } else {
        forget();
        if (failure === "portfolio_full" || failure === "item_state") {
          await refresh();
        }
      }
    },
    [failed, forget, refresh],
  );

  const choose = useCallback(
    (file: Blob, replaces: string | null) => {
      if (busyRef.current) {
        return;
      }
      const problem = portfolioFileProblem(file.size);
      if (problem !== null) {
        forget();
        setActivity({ kind: "failed", failure: problem, itemId: replaces });
        return;
      }
      void send(file, replaces);
    },
    [forget, send],
  );

  const retry = useCallback(() => {
    const kept = pending.current;
    if (kept !== null) {
      void send(kept.file, kept.replaces);
    }
  }, [send]);

  /** One gesture at a time: the run, then the list read again whatever the answer, so that the screen never lies. */
  const gesture = useCallback(
    async (
      run: () => Promise<
        | { kind: "ok"; done: PortfolioActivity }
        | { kind: "unauthenticated" }
        | {
            kind: "failed";
            code?: string;
            issues?: readonly string[];
          }
      >,
      itemId: string,
    ): Promise<void> => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setActivity({ kind: "busy" });
      const result = await run();
      if (result.kind === "ok") {
        await refresh();
        busyRef.current = false;
        setActivity(result.done);
        callbacks.current.onChanged();
        return;
      }
      busyRef.current = false;
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return;
      }
      failed(result, itemId);
      await refresh();
    },
    [failed, refresh],
  );

  const move = useCallback(
    (itemId: string, delta: -1 | 1) => {
      const next = orderAfterMove(placedIdsOf(items), itemId, delta);
      if (next === null) {
        return;
      }
      void gesture(async () => {
        const result = await orderPortfolio(next);
        return result.kind === "ok"
          ? { kind: "ok", done: { kind: "ordered" } }
          : result;
      }, itemId);
    },
    [gesture, items],
  );

  const saveCaption = useCallback(
    (itemId: string, body: PortfolioCaptionBody) => {
      void gesture(async () => {
        const result = await savePortfolioCaption(itemId, body);
        if (result.kind !== "ok") {
          return result;
        }
        return {
          kind: "ok",
          done:
            result.data.revisionStatus === "pending_review"
              ? { kind: "captionPending", itemId }
              : { kind: "captionApplied", itemId },
        };
      }, itemId);
    },
    [gesture],
  );

  const remove = useCallback(
    (itemId: string) => {
      void gesture(async () => {
        const result = await removePortfolioItem(itemId);
        return result.kind === "ok"
          ? { kind: "ok", done: { kind: "removed" } }
          : result;
      }, itemId);
    },
    [gesture],
  );

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readPortfolio();
    if (result.kind === "ok") {
      adopt(result.data);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      setPhase("unavailable");
    }
  }, [adopt]);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the block.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // The bytes of each visual are read once, as they come into the list: the list is light, the
  // images are not, and a replacement is a visual of its own (its identifier is new).
  useEffect(() => {
    for (const item of items) {
      if (asked.current.has(item.id)) {
        continue;
      }
      asked.current.add(item.id);
      void readPortfolioImage(item.id).then((result) => {
        if (result.kind === "ok") {
          setImages((previous) => ({ ...previous, [item.id]: result.data }));
        } else if (result.kind === "unauthenticated") {
          callbacks.current.onSignedOut();
        } else {
          // Asked again at the next reading of the list, never in a loop.
          asked.current.delete(item.id);
        }
      });
    }
  }, [items]);

  return {
    phase,
    items,
    deposited,
    images,
    activity,
    canRetry,
    busy: activity.kind === "busy",
    choose,
    retry,
    move,
    saveCaption,
    remove,
    reload: () => void load(),
  };
}

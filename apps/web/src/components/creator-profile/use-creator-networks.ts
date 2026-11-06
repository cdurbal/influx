"use client";

// The state and the flow of block 3 of "mon profil" (creator; docs/mvp/07 RG41 to RG50, RG111,
// RG113 to RG116; jalons/l2d, commit 13), outside the components (CLAUDE.md §5): the lines as the API
// last said them, the draft each line holds, the autosave of a line (a pause after the last key, one
// call at a time for the whole block, what changed only), the new attempt 5 s after a failure with the
// entry kept in memory, the choice of the main account and "Confirmer mes chiffres". No rule is decided
// here: the patch and the checks come from creator-networks-view.ts, the bands, the score and the
// date of the figures from the API. Nothing is kept in the browser's storage (D37).
import type {
  CreatorNetworkLine,
  CreatorNetworksResponse,
} from "@influx/contracts/creator-profile";
import {
  RETRY_DELAY_MS,
  SAVE_DELAY_MS,
  type LoadPhase,
  type SaveState,
} from "@/components/brand-profile/use-brand-profile";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addCreatorNetwork,
  confirmCreatorNetworkFigures,
  readCreatorNetworks,
  removeCreatorNetwork,
  saveCreatorNetworkFields,
} from "./creator-profile-api";
import {
  PRIORITY_FIELD_KEYS,
  afterLineSave,
  lineDraftOf,
  lineErrorsOf,
  planConfirmation,
  planLinePatch,
  sameLineValue,
  singleLinePatch,
  type LineFieldErrors,
  type LineFieldKey,
  type NetworkLineDraft,
} from "./creator-networks-view";

/** The main account moved from one network to another: the screen says it (07 CA11). */
export type PrimaryMove = { from: string; to: string };

export type CreatorNetworksState = {
  phase: LoadPhase;
  lines: readonly CreatorNetworkLine[];
  drafts: Readonly<Record<string, NetworkLineDraft>>;
  errors: Readonly<Record<string, LineFieldErrors>>;
  /** The lines whose figures changed alone: the date has not been renewed (07 RG116). */
  toConfirm: ReadonlySet<string>;
  primaryMove: PrimaryMove | null;
  /** A line added, removed or confirmed that the service refused or could not reach. */
  actionFailed: boolean;
  /** The line a screen should focus after an addition. */
  addedLineId: string | null;
  change: (lineId: string, key: LineFieldKey, value: string) => void;
  add: (networkCode: string) => void;
  remove: (lineId: string) => void;
  makePrimary: (lineId: string) => void;
  confirm: (lineId: string) => void;
  reload: () => void;
};

export function useCreatorNetworks(options: {
  /** The session ended while the profile was open: the shell shows "signed out". */
  onSignedOut: () => void;
  /** The state of the block's saves, shown by the one status line of the page. */
  report: (save: SaveState) => void;
  /** The completeness and the missing fields, recomputed by every call (the summary and the score). */
  onProgress: (
    progress: Pick<CreatorNetworksResponse, "completeness" | "missingRequired">,
  ) => void;
}): CreatorNetworksState {
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [lines, setLines] = useState<readonly CreatorNetworkLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, NetworkLineDraft>>({});
  const [errors, setErrors] = useState<Record<string, LineFieldErrors>>({});
  const [toConfirm, setToConfirm] = useState<ReadonlySet<string>>(new Set());
  const [primaryMove, setPrimaryMove] = useState<PrimaryMove | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [addedLineId, setAddedLineId] = useState<string | null>(null);

  // What the asynchronous steps read: the latest values, never a stale closure.
  const linesRef = useRef<readonly CreatorNetworkLine[]>([]);
  const draftsRef = useRef<Record<string, NetworkLineDraft>>({});
  const savedRef = useRef<Record<string, NetworkLineDraft>>({});
  const errorsRef = useRef<Record<string, LineFieldErrors>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chain = useRef<Promise<void>>(Promise.resolve());
  const signedOutRef = useRef(options.onSignedOut);
  const reportRef = useRef(options.report);
  const progressRef = useRef(options.onProgress);
  useEffect(() => {
    signedOutRef.current = options.onSignedOut;
    reportRef.current = options.report;
    progressRef.current = options.onProgress;
  }, [options.onSignedOut, options.report, options.onProgress]);

  const writeErrors = useCallback(
    (
      update: (
        previous: Record<string, LineFieldErrors>,
      ) => typeof errorsRef.current,
    ) => {
      errorsRef.current = update(errorsRef.current);
      setErrors(errorsRef.current);
    },
    [],
  );

  /** Takes an answer: the lines as the API says them, a draft for each new one, none for a removed one. */
  const adopt = useCallback((answer: CreatorNetworksResponse) => {
    linesRef.current = answer.lines;
    setLines(answer.lines);
    const nextDrafts: Record<string, NetworkLineDraft> = {};
    const nextSaved: Record<string, NetworkLineDraft> = {};
    for (const line of answer.lines) {
      const fromApi = lineDraftOf(line);
      nextDrafts[line.id] = draftsRef.current[line.id] ?? fromApi;
      nextSaved[line.id] = savedRef.current[line.id] ?? fromApi;
    }
    draftsRef.current = nextDrafts;
    savedRef.current = nextSaved;
    setDrafts(nextDrafts);
    progressRef.current(answer);
  }, []);

  /** Puts a call after the ones already running: the block never has two writes at once. */
  const enqueue = useCallback((task: () => Promise<void>): Promise<void> => {
    const next = chain.current.then(task, task);
    chain.current = next.catch(() => undefined);
    return next;
  }, []);

  const clearTimer = useCallback((lineId: string) => {
    const timer = timers.current.get(lineId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(lineId);
    }
  }, []);

  const saveLineRef = useRef<(lineId: string) => Promise<void>>(() =>
    Promise.resolve(),
  );

  const retryLater = useCallback(
    (lineId: string) => {
      reportRef.current({ kind: "retrying" });
      clearTimer(lineId);
      timers.current.set(
        lineId,
        setTimeout(() => void saveLineRef.current(lineId), RETRY_DELAY_MS),
      );
    },
    [clearTimer],
  );

  const reloadLines = useCallback(async (): Promise<void> => {
    const result = await readCreatorNetworks();
    if (result.kind === "ok") {
      adopt(result.data);
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    }
  }, [adopt]);

  /** Takes an accepted save: the lines as the API says them, the fields sent as the new reference. */
  const accept = useCallback(
    (
      lineId: string,
      sent: NetworkLineDraft,
      keys: readonly LineFieldKey[],
      answer: CreatorNetworksResponse,
    ) => {
      adopt(answer);
      const reference = savedRef.current[lineId];
      if (reference !== undefined) {
        savedRef.current = {
          ...savedRef.current,
          [lineId]: afterLineSave(reference, sent, keys),
        };
      }
      if (answer.notices.length > 0) {
        setToConfirm((previous) => new Set(previous).add(lineId));
      }
      reportRef.current({ kind: "saved", at: new Date() });
    },
    [adopt],
  );

  /**
   * Tells the fields a save refused. A field the member has typed in since (it no longer holds what
   * was sent) is left alone: the refusal was about the old value, and the next pause saves the new one.
   */
  const showErrors = useCallback(
    (lineId: string, found: LineFieldErrors, sent: NetworkLineDraft) => {
      const current = draftsRef.current[lineId];
      const kept: LineFieldErrors = {};
      for (const [key, error] of Object.entries(found) as [
        LineFieldKey,
        NonNullable<LineFieldErrors[LineFieldKey]>,
      ][]) {
        if (current === undefined || sameLineValue(current, sent, key)) {
          kept[key] = error;
        }
      }
      if (Object.keys(kept).length > 0) {
        writeErrors((previous) => ({
          ...previous,
          [lineId]: { ...previous[lineId], ...kept },
        }));
      }
    },
    [writeErrors],
  );

  /** A patch the API refused as invalid: each field alone, so that one wrong field holds back none (RG14). */
  const localize = useCallback(
    async (
      lineId: string,
      sent: NetworkLineDraft,
      keys: readonly LineFieldKey[],
      first: RelayResult<unknown>,
    ): Promise<void> => {
      if (keys.length === 1) {
        showErrors(lineId, lineErrorsOf(first, keys), sent);
        reportRef.current({ kind: "idle" });
        return;
      }
      const refused: LineFieldErrors = {};
      for (const key of keys) {
        const body = singleLinePatch(key, sent);
        if (body === null) {
          continue;
        }
        const result = await saveCreatorNetworkFields(lineId, body);
        if (result.kind === "ok") {
          accept(lineId, sent, [key], result.data);
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
          return;
        } else if (result.code === "validation_failed") {
          Object.assign(refused, lineErrorsOf(result, [key]));
        } else if (result.code === "conflict" || result.code === "not_found") {
          await reloadLines();
          return;
        } else {
          retryLater(lineId);
          return;
        }
      }
      showErrors(lineId, refused, sent);
    },
    [accept, reloadLines, retryLater, showErrors],
  );

  const saveLine = useCallback(
    (lineId: string): Promise<void> =>
      enqueue(async () => {
        clearTimer(lineId);
        const current = draftsRef.current[lineId];
        const saved = savedRef.current[lineId];
        if (current === undefined || saved === undefined) {
          return;
        }
        const plan = planLinePatch(current, saved, errorsRef.current[lineId]);
        showErrors(lineId, plan.refused, current);
        if (plan.body === null) {
          return;
        }
        reportRef.current({ kind: "saving" });
        const result = await saveCreatorNetworkFields(lineId, plan.body);
        if (result.kind === "ok") {
          accept(lineId, current, plan.keys, result.data);
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
        } else if (result.code === "validation_failed") {
          await localize(lineId, current, plan.keys, result);
        } else if (result.code === "conflict" || result.code === "not_found") {
          // the line or the profile changed under the screen: read again, nothing typed is lost
          await reloadLines();
          reportRef.current({ kind: "idle" });
        } else {
          retryLater(lineId);
        }
      }),
    [
      accept,
      clearTimer,
      enqueue,
      localize,
      reloadLines,
      retryLater,
      showErrors,
    ],
  );
  useEffect(() => {
    saveLineRef.current = saveLine;
  }, [saveLine]);

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readCreatorNetworks();
    if (result.kind === "ok") {
      adopt(result.data);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    } else {
      setPhase(result.code === "not_found" ? "gone" : "unavailable");
    }
  }, [adopt]);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the block.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Leaving the page saves what the pause had not yet.
  useEffect(() => {
    const pending = timers.current;
    const flush = () => {
      for (const lineId of [...pending.keys()]) {
        void saveLineRef.current(lineId);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  const change = useCallback(
    (lineId: string, key: LineFieldKey, value: string) => {
      const current = draftsRef.current[lineId];
      if (current === undefined) {
        return;
      }
      draftsRef.current = {
        ...draftsRef.current,
        [lineId]: { ...current, [key]: value },
      };
      setDrafts(draftsRef.current);
      if (errorsRef.current[lineId]?.[key] !== undefined) {
        writeErrors((previous) => {
          const rest = { ...previous[lineId] };
          delete rest[key];
          return { ...previous, [lineId]: rest };
        });
      }
      clearTimer(lineId);
      timers.current.set(
        lineId,
        setTimeout(() => void saveLineRef.current(lineId), SAVE_DELAY_MS),
      );
    },
    [clearTimer, writeErrors],
  );

  /** A call that is not an autosave: its answer is adopted, a refusal is told by the block. */
  const act = useCallback(
    (
      call: () => Promise<Awaited<ReturnType<typeof readCreatorNetworks>>>,
      then?: (answer: CreatorNetworksResponse) => void,
    ) =>
      enqueue(async () => {
        setActionFailed(false);
        const result = await call();
        if (result.kind === "ok") {
          adopt(result.data);
          then?.(result.data);
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
        } else {
          setActionFailed(true);
          if (result.code === "conflict" || result.code === "not_found") {
            await reloadLines();
          }
        }
      }),
    [adopt, enqueue, reloadLines],
  );

  const add = useCallback(
    (networkCode: string) => {
      // The first line is the main account unless one already is (07 RG41: exactly one).
      const isPrimary = !linesRef.current.some((line) => line.isPrimary);
      void act(
        () => addCreatorNetwork({ networkCode, isPrimary }),
        (answer) => setAddedLineId(answer.lineId),
      );
    },
    [act],
  );

  const remove = useCallback(
    (lineId: string) => {
      clearTimer(lineId);
      void act(
        () => removeCreatorNetwork(lineId),
        () => {
          setToConfirm((previous) => {
            const rest = new Set(previous);
            rest.delete(lineId);
            return rest;
          });
          writeErrors((previous) => {
            const rest = { ...previous };
            delete rest[lineId];
            return rest;
          });
          setPrimaryMove(null);
        },
      );
    },
    [act, clearTimer, writeErrors],
  );

  const makePrimary = useCallback(
    (lineId: string) => {
      const previous = linesRef.current.find((line) => line.isPrimary);
      const target = linesRef.current.find((line) => line.id === lineId);
      if (target === undefined || target.isPrimary) {
        return;
      }
      void act(
        () => saveCreatorNetworkFields(lineId, { isPrimary: true }),
        () =>
          setPrimaryMove(
            previous === undefined
              ? null
              : { from: previous.networkCode, to: target.networkCode },
          ),
      );
    },
    [act],
  );

  const confirm = useCallback(
    (lineId: string) => {
      const current = draftsRef.current[lineId];
      if (current === undefined) {
        return;
      }
      const plan = planConfirmation(current);
      if (plan.body === null) {
        writeErrors((previous) => ({
          ...previous,
          [lineId]: { ...previous[lineId], ...plan.refused },
        }));
        return;
      }
      const body = plan.body;
      void act(
        () => confirmCreatorNetworkFigures(lineId, body),
        () => {
          const reference = savedRef.current[lineId];
          if (reference !== undefined) {
            savedRef.current = {
              ...savedRef.current,
              [lineId]: afterLineSave(reference, current, PRIORITY_FIELD_KEYS),
            };
          }
          setToConfirm((previous) => {
            const rest = new Set(previous);
            rest.delete(lineId);
            return rest;
          });
          reportRef.current({ kind: "saved", at: new Date() });
        },
      );
    },
    [act, writeErrors],
  );

  return {
    phase,
    lines,
    drafts,
    errors,
    toConfirm,
    primaryMove,
    actionFailed,
    addedLineId,
    change,
    add,
    remove,
    makePrimary,
    confirm,
    reload: () => void load(),
  };
}

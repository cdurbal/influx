"use client";

// The state and the flow of "mon profil" of a creator (docs/mvp/17 §5.2; 07 RG111), outside the
// components (CLAUDE.md §5): the profile as the API last said it, the draft the form holds, the
// autosave (a pause after the last key, one save at a time, what changed only), the new attempt 5 s
// after a failure with the entry kept in memory. No rule is decided here: the patch comes from
// creator-profile-view.ts, the score, the missing fields and the warnings from the API. There is no
// submission at L2D: since L2G it is the API's answer, read again by `refresh`. Nothing is kept in the browser's storage (D37): the draft lives in memory
// and in the database.
import type { CreatorProfileResponse } from "@influx/contracts/creator-profile";
import {
  RETRY_DELAY_MS,
  SAVE_DELAY_MS,
  type LoadPhase,
  type SaveState,
} from "@/components/brand-profile/use-brand-profile";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  readCreatorProfile,
  saveCreatorProfileFields,
} from "./creator-profile-api";
import {
  afterSave,
  draftOf,
  fieldErrorOf,
  isEditable,
  planPatch,
  singleFieldPatch,
  type CreatorDraft,
  type DraftKey,
  type FieldErrors,
} from "./creator-profile-view";

export type CreatorProfileState = {
  phase: LoadPhase;
  profile: CreatorProfileResponse | null;
  draft: CreatorDraft | null;
  /** The fields the API or the browser refused, until the member changes them. */
  fieldErrors: FieldErrors;
  save: SaveState;
  change: <Key extends DraftKey>(key: Key, value: CreatorDraft[Key]) => void;
  reload: () => void;
  /** Block 3 saves its own calls: the one status line of the page shows their state (commit 13). */
  reportSave: (save: SaveState) => void;
  /** Block 3 answers with the completeness and the missing fields, recomputed: the summary follows. */
  applyProgress: (
    progress: Pick<CreatorProfileResponse, "completeness" | "missingRequired">,
  ) => void;
  /**
   * Reads the profile again without touching the draft (L2G): after the portfolio changed, or a
   * submission, the state, the completeness, the missing fields and the revisions are the API's.
   */
  refresh: () => Promise<void>;
  /** The switch of RG8, as the API stored it. */
  applyVisibility: (isSearchable: boolean) => void;
};

export function useCreatorProfile(options: {
  /** The session ended while the profile was open: the shell shows "signed out". */
  onSignedOut: () => void;
}): CreatorProfileState {
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [profile, setProfile] = useState<CreatorProfileResponse | null>(null);
  const [draft, setDraft] = useState<CreatorDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // What the asynchronous steps read: the latest values, never a stale closure.
  const profileRef = useRef<CreatorProfileResponse | null>(null);
  const draftRef = useRef<CreatorDraft | null>(null);
  const savedRef = useRef<CreatorDraft | null>(null);
  const errorsRef = useRef<FieldErrors>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const signedOutRef = useRef(options.onSignedOut);
  useEffect(() => {
    signedOutRef.current = options.onSignedOut;
  }, [options.onSignedOut]);

  const writeErrors: Dispatch<SetStateAction<FieldErrors>> = useCallback(
    (update) => {
      const next =
        typeof update === "function" ? update(errorsRef.current) : update;
      errorsRef.current = next;
      setErrors(next);
    },
    [],
  );

  const clearTimer = useCallback(() => {
    if (saveTimer.current !== null) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  const adopt = useCallback((next: CreatorProfileResponse) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  /** Reads the profile again after a refusal that says it changed (409), keeping the draft. */
  const refreshProfile = useCallback(async () => {
    const result = await readCreatorProfile();
    if (result.kind === "ok") {
      adopt(result.data);
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    }
  }, [adopt]);

  /** The network or the service failed: the entry stays in memory, a new attempt in 5 s. */
  const retryLater = useCallback(
    (attempt: () => void) => {
      setSave({ kind: "retrying" });
      clearTimer();
      saveTimer.current = setTimeout(attempt, RETRY_DELAY_MS);
    },
    [clearTimer],
  );

  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  /** Takes an accepted answer: the profile as the API says it, the fields sent as the new reference. */
  const accept = useCallback(
    (
      answer: CreatorProfileResponse,
      sent: CreatorDraft,
      keys: readonly DraftKey[],
    ) => {
      adopt(answer);
      const current = draftRef.current;
      const saved = savedRef.current;
      if (current === null || saved === null) {
        return;
      }
      const next = afterSave(current, saved, sent, keys, answer);
      savedRef.current = next.saved;
      draftRef.current = next.draft;
      setDraft(next.draft);
      setSave({ kind: "saved", at: new Date() });
    },
    [adopt],
  );

  /** A patch the API refused as invalid: each field alone, to name the wrong one. */
  const localize = useCallback(
    async (sent: CreatorDraft, keys: readonly DraftKey[]): Promise<void> => {
      const refused: FieldErrors = {};
      for (const key of keys) {
        const body = singleFieldPatch(key, sent);
        if (body === null) {
          continue;
        }
        const result = await saveCreatorProfileFields(body);
        if (result.kind === "ok") {
          accept(result.data, sent, [key]);
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
          return;
        } else if (result.code === "validation_failed") {
          refused[key] = fieldErrorOf(result);
        } else if (result.code === "conflict") {
          await refreshProfile();
          return;
        } else {
          retryLater(() => void saveRef.current());
          return;
        }
      }
      writeErrors((previous) => ({ ...previous, ...refused }));
    },
    [accept, refreshProfile, retryLater, writeErrors],
  );

  const saveOnce = useCallback(async (): Promise<void> => {
    const current = draftRef.current;
    const saved = savedRef.current;
    const held = profileRef.current;
    if (
      current === null ||
      saved === null ||
      held === null ||
      !isEditable(held)
    ) {
      return;
    }
    const plan = planPatch(current, saved, errorsRef.current);
    if (Object.keys(plan.refused).length > 0) {
      writeErrors((previous) => ({ ...previous, ...plan.refused }));
    }
    if (plan.body === null) {
      return;
    }
    setSave({ kind: "saving" });
    const result = await saveCreatorProfileFields(plan.body);
    if (result.kind === "ok") {
      accept(result.data, current, plan.keys);
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    } else if (result.code === "validation_failed") {
      await localize(current, plan.keys);
    } else if (result.code === "conflict") {
      // The profile is no longer open to writing (EC-L2D-08-2): read it again, nothing is lost.
      await refreshProfile();
      setSave({ kind: "idle" });
    } else if (result.code === "not_found") {
      setPhase("gone");
    } else {
      retryLater(() => void saveRef.current());
    }
  }, [accept, localize, refreshProfile, retryLater, writeErrors]);

  /** One save at a time; a change made meanwhile makes the running one go round again. */
  const runSave = useCallback(async (): Promise<void> => {
    clearTimer();
    if (running.current !== null) {
      again.current = true;
      return running.current;
    }
    const job = (async () => {
      do {
        again.current = false;
        await saveOnce();
      } while (again.current);
    })();
    running.current = job;
    try {
      await job;
    } finally {
      running.current = null;
    }
  }, [clearTimer, saveOnce]);
  useEffect(() => {
    saveRef.current = runSave;
  }, [runSave]);

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readCreatorProfile();
    if (result.kind === "ok") {
      const first = draftOf(result.data);
      adopt(result.data);
      draftRef.current = first;
      savedRef.current = first;
      setDraft(first);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    } else {
      setPhase(result.code === "not_found" ? "gone" : "unavailable");
    }
  }, [adopt]);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Leaving the page (a link, the tab closed gently) saves what the pause had not yet.
  useEffect(() => {
    const flush = () => void saveRef.current();
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      clearTimer();
      flush();
    };
  }, [clearTimer]);

  const change = useCallback(
    <Key extends DraftKey>(key: Key, value: CreatorDraft[Key]) => {
      const current = draftRef.current;
      if (current === null) {
        return;
      }
      const next: CreatorDraft = { ...current, [key]: value };
      draftRef.current = next;
      setDraft(next);
      writeErrors((previous) => {
        if (previous[key] === undefined) {
          return previous;
        }
        const rest: FieldErrors = { ...previous };
        delete rest[key];
        return rest;
      });
      clearTimer();
      saveTimer.current = setTimeout(
        () => void saveRef.current(),
        SAVE_DELAY_MS,
      );
    },
    [clearTimer, writeErrors],
  );

  const applyProgress = useCallback(
    (
      progress: Pick<
        CreatorProfileResponse,
        "completeness" | "missingRequired"
      >,
    ) => {
      const held = profileRef.current;
      if (held !== null) {
        adopt({
          ...held,
          completeness: progress.completeness,
          missingRequired: progress.missingRequired,
        });
      }
    },
    [adopt],
  );

  const applyVisibility = useCallback(
    (isSearchable: boolean) => {
      const held = profileRef.current;
      if (held !== null) {
        adopt({ ...held, isSearchable });
      }
    },
    [adopt],
  );

  return {
    phase,
    profile,
    draft,
    fieldErrors: errors,
    save,
    change,
    reload: () => void load(),
    reportSave: setSave,
    applyProgress,
    refresh: refreshProfile,
    applyVisibility,
  };
}

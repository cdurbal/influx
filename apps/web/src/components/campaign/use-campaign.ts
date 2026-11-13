"use client";

// The state and the flow of the campaign form (docs/mvp/17 §4.3; 09 RG108; jalons/l3b, commit 09),
// outside the components (CLAUDE.md §5): the campaign as the API last said it, the draft the form
// holds, the autosave (a pause after the last key, one save at a time, what changed only), the new
// attempt 5 s after a failure with the entry kept in memory (a brand interrupted never starts over,
// even in the middle of the deliverables). No rule is decided here: the patch comes from
// campaign-view.ts, the missing fields from the API. Nothing is kept in the browser's storage (D37):
// the draft lives in memory and in the database.
import type { CampaignResponse } from "@influx/contracts/campaign";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { readCampaign, saveCampaignFields } from "./campaign-api";
import {
  afterSave,
  applyChange,
  DEPENDENT_KEYS,
  draftOf,
  fieldErrorOf,
  isEditable,
  planPatch,
  RELATED_ERROR_KEYS,
  singleFieldPatch,
  type CampaignDraft,
  type DraftKey,
  type FieldErrors,
} from "./campaign-view";

/** The pause after the last key before a save (RG108: the draft saves itself). */
export const SAVE_DELAY_MS = 600;
/** 17 §4.2: "Modifications non enregistrées — nouvelle tentative dans 5 s". */
export const RETRY_DELAY_MS = 5000;

export type LoadPhase = "loading" | "ready" | "unavailable" | "gone";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "retrying" };

export type CampaignState = {
  phase: LoadPhase;
  campaign: CampaignResponse | null;
  draft: CampaignDraft | null;
  /** The fields the API or the browser refused, each with its reason. */
  fieldErrors: FieldErrors;
  save: SaveState;
  change: <Key extends DraftKey>(key: Key, value: CampaignDraft[Key]) => void;
  /** "Réessayer maintenant" after a failed save: the entry kept in memory goes at once. */
  retryNow: () => void;
  reload: () => void;
};

export function useCampaign(
  id: string,
  options: {
    /** The session ended while the campaign was open: the shell shows "signed out". */
    onSignedOut: () => void;
  },
): CampaignState {
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  // What the asynchronous steps read: the latest values, never a stale closure.
  const campaignRef = useRef<CampaignResponse | null>(null);
  const draftRef = useRef<CampaignDraft | null>(null);
  const savedRef = useRef<CampaignDraft | null>(null);
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

  const adopt = useCallback((next: CampaignResponse) => {
    campaignRef.current = next;
    setCampaign(next);
  }, []);

  /** Reads the campaign again after a refusal that says it changed (409), keeping the draft. */
  const refreshCampaign = useCallback(async () => {
    const result = await readCampaign(id);
    if (result.kind === "ok") {
      adopt(result.data);
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    }
  }, [adopt, id]);

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

  /** Takes an accepted answer: the campaign as the API says it, the fields sent as the new reference. */
  const accept = useCallback(
    (
      answer: CampaignResponse,
      sent: CampaignDraft,
      keys: readonly DraftKey[],
    ) => {
      adopt(answer);
      const saved = savedRef.current;
      if (saved !== null) {
        savedRef.current = afterSave(saved, sent, keys);
      }
      setSave({ kind: "saved", at: new Date() });
    },
    [adopt],
  );

  /** A patch the API refused as invalid: each field alone, to name the wrong one (CA3). */
  const localize = useCallback(
    async (sent: CampaignDraft, keys: readonly DraftKey[]): Promise<void> => {
      const refused: FieldErrors = {};
      const handled = new Set<DraftKey>();
      for (const key of keys) {
        const saved = savedRef.current;
        if (handled.has(key) || saved === null) {
          continue;
        }
        const single = singleFieldPatch(key, sent, saved);
        if (single === null) {
          continue;
        }
        const result = await saveCampaignFields(id, single.body);
        if (result.kind === "ok") {
          accept(result.data, sent, single.keys);
          single.keys.forEach((member) => handled.add(member));
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
          return;
        } else if (result.code === "validation_failed") {
          refused[key] = fieldErrorOf(result);
        } else if (result.code === "conflict") {
          await refreshCampaign();
          return;
        } else {
          retryLater(() => void saveRef.current());
          return;
        }
      }
      writeErrors((previous) => ({ ...previous, ...refused }));
    },
    [accept, id, refreshCampaign, retryLater, writeErrors],
  );

  const saveOnce = useCallback(async (): Promise<void> => {
    const current = draftRef.current;
    const saved = savedRef.current;
    const status = campaignRef.current?.status;
    if (
      current === null ||
      saved === null ||
      status === undefined ||
      !isEditable(status)
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
    const result = await saveCampaignFields(id, plan.body);
    if (result.kind === "ok") {
      accept(result.data, current, plan.keys);
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    } else if (result.code === "validation_failed") {
      await localize(current, plan.keys);
    } else if (result.code === "conflict") {
      await refreshCampaign();
      setSave({ kind: "idle" });
    } else if (result.code === "not_found") {
      setPhase("gone");
    } else {
      // The network, the service or a limit: the entry stays, a new attempt follows.
      retryLater(() => void saveRef.current());
    }
  }, [accept, id, localize, refreshCampaign, retryLater, writeErrors]);

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
    const result = await readCampaign(id);
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
      // An identifier that is nobody's, another brand's, or not even one: the same page that does not exist.
      setPhase(
        result.code === "not_found" || result.code === "validation_failed"
          ? "gone"
          : "unavailable",
      );
    }
  }, [adopt, id]);

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
    <Key extends DraftKey>(key: Key, value: CampaignDraft[Key]) => {
      const current = draftRef.current;
      if (current === null) {
        return;
      }
      const next = applyChange(current, key, value);
      draftRef.current = next;
      setDraft(next);
      // An answer is a new try: its own error goes, with those of the fields it makes inapplicable
      // or that were refused for it.
      const settled = new Set<DraftKey>([
        key,
        ...(DEPENDENT_KEYS[key] ?? []),
        ...(RELATED_ERROR_KEYS[key] ?? []),
      ]);
      writeErrors((previous) => {
        const rest: FieldErrors = { ...previous };
        let changed = false;
        for (const member of settled) {
          if (rest[member] !== undefined) {
            delete rest[member];
            changed = true;
          }
        }
        return changed ? rest : previous;
      });
      clearTimer();
      saveTimer.current = setTimeout(
        () => void saveRef.current(),
        SAVE_DELAY_MS,
      );
    },
    [clearTimer, writeErrors],
  );

  return {
    phase,
    campaign,
    draft,
    fieldErrors: errors,
    save,
    change,
    retryNow: () => void runSave(),
    reload: () => void load(),
  };
}

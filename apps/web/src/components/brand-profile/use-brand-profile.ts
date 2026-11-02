"use client";

// The state and the flow of "mon profil de marque" (docs/mvp/17 §4.2; 06 RG5, RG82, RG83), outside
// the components (CLAUDE.md §5): the profile as the API last said it, the draft the form holds, the
// autosave (a pause after the last key, one save at a time, what changed only), the new attempt 5 s
// after a failure with the entry kept in memory, and the submission. No rule is decided here: the
// patch comes from brand-profile-view.ts, the score and the missing fields from the API.
// Nothing is kept in the browser's storage (D37): the draft lives in memory and in the database.
import type {
  BrandProfileCompletenessView,
  BrandProfileResponse,
} from "@influx/contracts/brand-profile";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  readBrandProfile,
  saveBrandProfileFields,
  submitBrandProfile,
} from "./brand-profile-api";
import {
  afterSave,
  draftOf,
  fieldErrorOf,
  isEditable,
  missingErrors,
  planPatch,
  singleFieldPatch,
  type BrandDraft,
  type DraftKey,
  type FieldErrors,
  type RequiredCode,
} from "./brand-profile-view";

/** The pause after the last key before a save (06 RG83: the draft saves itself). */
export const SAVE_DELAY_MS = 600;
/** 17 §4.2: "Modifications non enregistrées — nouvelle tentative dans 5 s". */
export const RETRY_DELAY_MS = 5000;

export type LoadPhase = "loading" | "ready" | "unavailable" | "gone";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "retrying" };

export type SubmitState =
  "idle" | "submitting" | "done" | "unavailable" | "unsaved" | "locked";

/** What a click on "Soumettre" led to; `missing` carries the first missing field, to focus it (CA7). */
export type SubmitOutcome =
  | { kind: "submitted" }
  | { kind: "missing"; first: RequiredCode | null }
  | { kind: "stopped" };

export type BrandProfileState = {
  phase: LoadPhase;
  profile: BrandProfileResponse | null;
  draft: BrandDraft | null;
  /** Errors to show: the fields the API or the browser refused, then the required ones after a click. */
  fieldErrors: FieldErrors;
  save: SaveState;
  submitState: SubmitState;
  /** The domain kept when the website typed was longer than a domain (CA4), until it is edited. */
  websiteDomain: string | null;
  change: <Key extends DraftKey>(key: Key, value: BrandDraft[Key]) => void;
  submit: () => Promise<SubmitOutcome>;
  /** The score as the API recomputed it after the logo (RG58): the rest of the profile is kept as is. */
  adoptCompleteness: (completeness: BrandProfileCompletenessView) => void;
  reload: () => void;
};

export function useBrandProfile(options: {
  /** The session ended while the profile was open: the shell shows "signed out". */
  onSignedOut: () => void;
}): BrandProfileState {
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [profile, setProfile] = useState<BrandProfileResponse | null>(null);
  const [draft, setDraft] = useState<BrandDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showMissing, setShowMissing] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [websiteDomain, setWebsiteDomain] = useState<string | null>(null);

  // What the asynchronous steps read: the latest values, never a stale closure.
  const profileRef = useRef<BrandProfileResponse | null>(null);
  const draftRef = useRef<BrandDraft | null>(null);
  const savedRef = useRef<BrandDraft | null>(null);
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

  const adopt = useCallback((next: BrandProfileResponse) => {
    profileRef.current = next;
    setProfile(next);
  }, []);

  const adoptCompleteness = useCallback(
    (completeness: BrandProfileCompletenessView) => {
      const current = profileRef.current;
      if (current !== null) {
        adopt({ ...current, completeness });
      }
    },
    [adopt],
  );

  /** Reads the profile again after a refusal that says it changed (409), keeping the draft. */
  const refreshProfile = useCallback(async () => {
    const result = await readBrandProfile();
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
      answer: BrandProfileResponse & { websiteNormalized?: boolean },
      sent: BrandDraft,
      keys: readonly DraftKey[],
    ) => {
      adopt(answer);
      const current = draftRef.current;
      const saved = savedRef.current;
      if (current === null || saved === null) {
        return;
      }
      const next = afterSave(current, saved, sent, keys, answer.website ?? "");
      savedRef.current = next.saved;
      draftRef.current = next.draft;
      setDraft(next.draft);
      if (
        keys.includes("website") &&
        next.draft.website === (answer.website ?? "")
      ) {
        setWebsiteDomain(
          answer.websiteNormalized === true ? (answer.website ?? null) : null,
        );
      }
      setSave({ kind: "saved", at: new Date() });
    },
    [adopt],
  );

  /** A patch the API refused as invalid: each field alone, to name the wrong one (RG85). */
  const localize = useCallback(
    async (sent: BrandDraft, keys: readonly DraftKey[]): Promise<void> => {
      const refused: FieldErrors = {};
      for (const key of keys) {
        const body = singleFieldPatch(key, sent);
        if (body === null) {
          continue;
        }
        const result = await saveBrandProfileFields(body);
        if (result.kind === "ok") {
          accept(result.data, sent, [key]);
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
          return;
        } else if (result.code === "validation_failed") {
          refused[key] = fieldErrorOf(key, result);
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
    const status = profileRef.current?.status;
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
    const result = await saveBrandProfileFields(plan.body);
    if (result.kind === "ok") {
      accept(result.data, current, plan.keys);
    } else if (result.kind === "unauthenticated") {
      signedOutRef.current();
    } else if (result.code === "validation_failed") {
      await localize(current, plan.keys);
    } else if (result.code === "conflict") {
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
    const result = await readBrandProfile();
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
    <Key extends DraftKey>(key: Key, value: BrandDraft[Key]) => {
      const current = draftRef.current;
      if (current === null) {
        return;
      }
      const next: BrandDraft = { ...current, [key]: value };
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
      if (key === "website") {
        setWebsiteDomain(null);
      }
      setSubmitState((state) => (state === "done" ? "idle" : state));
      clearTimer();
      saveTimer.current = setTimeout(
        () => void saveRef.current(),
        SAVE_DELAY_MS,
      );
    },
    [clearTimer, writeErrors],
  );

  const submit = useCallback(async (): Promise<SubmitOutcome> => {
    const current = profileRef.current;
    if (current === null || submitState === "submitting") {
      return { kind: "stopped" };
    }
    if (!isEditable(current.status)) {
      setSubmitState("locked");
      return { kind: "stopped" };
    }
    setSubmitState("submitting");
    await runSave();
    const draftNow = draftRef.current;
    const savedNow = savedRef.current;
    if (
      draftNow !== null &&
      savedNow !== null &&
      planPatch(draftNow, savedNow, errorsRef.current).body !== null
    ) {
      // A save is waiting for its new attempt: the profile the API holds is not the form's.
      setSubmitState("unsaved");
      return { kind: "stopped" };
    }
    const missing = profileRef.current?.missingRequired ?? [];
    if (missing.length > 0) {
      setShowMissing(true);
      setSubmitState("idle");
      return { kind: "missing", first: missing[0] ?? null };
    }
    const result = await submitBrandProfile();
    if (result.kind === "ok") {
      adopt(result.data);
      setShowMissing(false);
      setSubmitState("done");
      return { kind: "submitted" };
    }
    if (result.kind === "unauthenticated") {
      signedOutRef.current();
      return { kind: "stopped" };
    }
    if (result.code === "validation_failed") {
      // The API found something missing that the last answer did not: read it again, name it.
      await refreshProfile();
      setShowMissing(true);
      setSubmitState("idle");
      return {
        kind: "missing",
        first: profileRef.current?.missingRequired[0] ?? null,
      };
    }
    if (result.code === "conflict") {
      await refreshProfile();
      setSubmitState("locked");
      return { kind: "stopped" };
    }
    setSubmitState("unavailable");
    return { kind: "stopped" };
  }, [adopt, refreshProfile, runSave, submitState]);

  const fieldErrors: FieldErrors = showMissing
    ? { ...missingErrors(profile?.missingRequired ?? []), ...errors }
    : errors;

  return {
    phase,
    profile,
    draft,
    fieldErrors,
    save,
    submitState,
    websiteDomain,
    change,
    submit,
    adoptCompleteness,
    reload: () => void load(),
  };
}

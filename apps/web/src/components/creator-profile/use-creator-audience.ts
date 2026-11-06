"use client";

// The state and the flow of block 4 of "mon profil" (creator: the audience of each network line;
// docs/mvp/07 RG55 to RG61, RG111, CA26 to CA28; jalons/l2d, commit 14), outside the components
// (CLAUDE.md §5): the draft each line's audience holds, the autosave (a pause after the last key, the
// whole audience of the line replaced in one call, queued behind the other calls of the networks so
// that the block never has two writes at once), the new attempt 5 s after a failure with the entry
// kept in memory. The lines are the networks' (use-creator-networks.ts): an answer is adopted there,
// so the score, the summary and the "others" of each dimension follow. Nothing is decided here: the
// body and the checks come from creator-audience-view.ts, the remainders and the score from the API.
// Nothing is kept in the browser's storage (D37).
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import {
  RETRY_DELAY_MS,
  SAVE_DELAY_MS,
  type SaveState,
} from "@/components/brand-profile/use-brand-profile";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  audienceDraftOf,
  audienceIssueOf,
  planAudience,
  type AudienceDraft,
  type AudienceErrors,
} from "./creator-audience-view";
import { saveCreatorNetworkAudience } from "./creator-profile-api";
import type { CreatorNetworksState } from "./use-creator-networks";

export type CreatorAudienceState = {
  /** The draft a line's audience holds: what was typed, else what the API says. */
  draftOf: (line: CreatorNetworkLine) => AudienceDraft;
  errorsOf: (lineId: string) => AudienceErrors;
  /** Changes the draft of a line with a pure update, then saves after the pause. */
  change: (
    line: CreatorNetworkLine,
    update: (draft: AudienceDraft) => AudienceDraft,
  ) => void;
};

export function useCreatorAudience(options: {
  networks: CreatorNetworksState;
  /** The session ended while the profile was open: the shell shows "signed out". */
  onSignedOut: () => void;
  /** The state of the block's saves, shown by the one status line of the page. */
  report: (save: SaveState) => void;
}): CreatorAudienceState {
  const [drafts, setDrafts] = useState<Record<string, AudienceDraft>>({});
  const [errors, setErrors] = useState<Record<string, AudienceErrors>>({});

  // What the asynchronous steps read: the latest values, never a stale closure.
  const draftsRef = useRef<Record<string, AudienceDraft>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const networksRef = useRef(options.networks);
  const signedOutRef = useRef(options.onSignedOut);
  const reportRef = useRef(options.report);
  useEffect(() => {
    networksRef.current = options.networks;
    signedOutRef.current = options.onSignedOut;
    reportRef.current = options.report;
  }, [options.networks, options.onSignedOut, options.report]);

  const clearTimer = useCallback((lineId: string) => {
    const timer = timers.current.get(lineId);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(lineId);
    }
  }, []);

  const setLineErrors = useCallback(
    (lineId: string, next: AudienceErrors) =>
      setErrors((previous) => ({ ...previous, [lineId]: next })),
    [],
  );

  const saveRef = useRef<(lineId: string) => Promise<void>>(() =>
    Promise.resolve(),
  );

  const retryLater = useCallback(
    (lineId: string) => {
      reportRef.current({ kind: "retrying" });
      clearTimer(lineId);
      timers.current.set(
        lineId,
        setTimeout(() => void saveRef.current(lineId), RETRY_DELAY_MS),
      );
    },
    [clearTimer],
  );

  const save = useCallback(
    (lineId: string): Promise<void> =>
      networksRef.current.queue(async () => {
        clearTimer(lineId);
        const networks = networksRef.current;
        const line = networks.currentLines().find((item) => item.id === lineId);
        const draft = draftsRef.current[lineId];
        if (line === undefined || draft === undefined) {
          return;
        }
        const plan = planAudience(draft, audienceDraftOf(line.audience));
        setLineErrors(lineId, plan.errors);
        if (plan.body === null) {
          return;
        }
        reportRef.current({ kind: "saving" });
        const result = await saveCreatorNetworkAudience(lineId, plan.body);
        if (result.kind === "ok") {
          networks.takeAnswer(result.data);
          reportRef.current({ kind: "saved", at: new Date() });
        } else if (result.kind === "unauthenticated") {
          signedOutRef.current();
        } else if (result.code === "validation_failed") {
          setLineErrors(lineId, { form: audienceIssueOf(result) });
          reportRef.current({ kind: "idle" });
        } else if (result.code === "conflict" || result.code === "not_found") {
          // the line or the profile changed under the screen: read again, nothing typed is lost
          await networks.refresh();
          reportRef.current({ kind: "idle" });
        } else {
          retryLater(lineId);
        }
      }),
    [clearTimer, retryLater, setLineErrors],
  );
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Leaving the page saves what the pause had not yet.
  useEffect(() => {
    const pending = timers.current;
    const flush = () => {
      for (const lineId of [...pending.keys()]) {
        void saveRef.current(lineId);
      }
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  }, []);

  const draftOf = useCallback(
    (line: CreatorNetworkLine): AudienceDraft =>
      drafts[line.id] ?? audienceDraftOf(line.audience),
    [drafts],
  );

  const change = useCallback(
    (
      line: CreatorNetworkLine,
      update: (draft: AudienceDraft) => AudienceDraft,
    ) => {
      const current =
        draftsRef.current[line.id] ?? audienceDraftOf(line.audience);
      draftsRef.current = { ...draftsRef.current, [line.id]: update(current) };
      setDrafts(draftsRef.current);
      // A refusal is about the old entry: the next pause saves, and judges, the new one.
      setErrors((previous) =>
        previous[line.id] === undefined
          ? previous
          : { ...previous, [line.id]: {} },
      );
      clearTimer(line.id);
      timers.current.set(
        line.id,
        setTimeout(() => void saveRef.current(line.id), SAVE_DELAY_MS),
      );
    },
    [clearTimer],
  );

  const errorsOf = useCallback(
    (lineId: string): AudienceErrors => errors[lineId] ?? {},
    [errors],
  );

  return { draftOf, errorsOf, change };
}

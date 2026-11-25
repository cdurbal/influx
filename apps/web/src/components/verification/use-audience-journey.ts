"use client";

// The gestures of the audience journey of a creator (docs/mvp/08 RG12, RG34, RG35, RG85, RG95; jalons/l2e,
// commit 19), outside the components (CLAUDE.md §5): open the request of the audience, deposit its
// pieces one file per call, withdraw a piece, send the request, withdraw the request. The deposit is a
// queue: the files go one after the other, each with its own state, and a file that fails never costs
// the others already deposited nor the request (RG95, CA67): the pieces shown are the API's, read again
// after each answer. Only a file the service did not take for lack of an answer stays in memory, to be
// sent again without choosing it again; its name is never read, shown or sent. Nothing is decided here
// (the type is read in the bytes, the quotas and the cap are the database's) and nothing goes to the
// browser's storage (D37).
import { useCallback, useEffect, useRef, useState } from "react";
import { useGestureRunner } from "./use-gesture-runner";
import {
  cancelVerificationRequest,
  openVerificationRequest,
  removeVerificationEvidence,
  submitVerificationRequest,
  uploadVerificationEvidence,
} from "./verification-api";
import {
  evidenceFailureOf,
  evidenceFileProblem,
  type EvidenceFailure,
  type Failure,
} from "./verification-view";

export type AudienceGesture = "start" | "submit" | "cancel" | "remove";

/** One file of the queue of the deposit, as the screen lists it until the API holds the piece. */
export type DepositAttempt = {
  key: number;
  /** The size the member chose, for the line of the list; never the name. */
  size: number;
  state: "waiting" | "sending" | "failed";
  failure: EvidenceFailure | null;
};

export type AudienceJourneyGestures = {
  /** The gesture running, `upload` while the queue sends; null at rest: the buttons say it and refuse a second one. */
  busy: AudienceGesture | "upload" | null;
  /** What the last refused call means, null once another gesture starts. */
  failure: Failure | null;
  attempts: readonly DepositAttempt[];
  start: () => void;
  submit: (requestId: string) => void;
  cancel: (requestId: string) => void;
  removePiece: (requestId: string, evidenceId: string) => void;
  /** The files chosen by the member, sent one by one to the request. */
  choose: (requestId: string, files: readonly Blob[]) => void;
  /** Sends again a file the service did not take. */
  retry: (requestId: string, key: number) => void;
  /** Takes a failed file off the list. */
  dismiss: (key: number) => void;
};

export function useAudienceJourney(options: {
  networkCode: string;
  /** Reads the lines again, the screen untouched meanwhile. */
  reload: () => Promise<boolean>;
  onSignedOut: () => void;
}): AudienceJourneyGestures {
  const { networkCode, reload, onSignedOut } = options;
  const runner = useGestureRunner<AudienceGesture>({ reload, onSignedOut });
  const [attempts, setAttempts] = useState<readonly DepositAttempt[]>([]);
  const [uploading, setUploading] = useState(false);

  // The queue lives in refs (a loop of awaits must read what the gestures wrote meanwhile); the state
  // above only mirrors it for the screen.
  const queue = useRef<DepositAttempt[]>([]);
  const files = useRef(new Map<number, Blob>());
  const requestOf = useRef(new Map<number, string>());
  const pumping = useRef(false);
  const nextKey = useRef(1);
  const callbacks = useRef({ reload, onSignedOut });
  useEffect(() => {
    callbacks.current = { reload, onSignedOut };
  }, [reload, onSignedOut]);

  const publish = useCallback(() => {
    setAttempts([...queue.current]);
  }, []);

  const change = useCallback(
    (key: number, patch: Partial<DepositAttempt>) => {
      queue.current = queue.current.map((attempt) =>
        attempt.key === key ? { ...attempt, ...patch } : attempt,
      );
      publish();
    },
    [publish],
  );

  const drop = useCallback(
    (key: number) => {
      queue.current = queue.current.filter((attempt) => attempt.key !== key);
      files.current.delete(key);
      requestOf.current.delete(key);
      publish();
    },
    [publish],
  );

  const pump = useCallback(async (): Promise<void> => {
    if (pumping.current) {
      return;
    }
    pumping.current = true;
    setUploading(true);
    try {
      for (;;) {
        const next = queue.current.find(
          (attempt) => attempt.state === "waiting",
        );
        const file =
          next === undefined ? undefined : files.current.get(next.key);
        const requestId =
          next === undefined ? undefined : requestOf.current.get(next.key);
        if (next === undefined) {
          break;
        }
        if (file === undefined || requestId === undefined) {
          drop(next.key);
          continue;
        }
        change(next.key, { state: "sending", failure: null });
        const result = await uploadVerificationEvidence(requestId, file);
        if (result.kind === "ok") {
          // The piece is the API's now: the list shows it, not the attempt.
          await callbacks.current.reload();
          drop(next.key);
        } else if (result.kind === "unauthenticated") {
          queue.current = [];
          files.current.clear();
          requestOf.current.clear();
          publish();
          callbacks.current.onSignedOut();
          break;
        } else {
          const failure = evidenceFailureOf(result);
          if (!failure.retryable) {
            files.current.delete(next.key);
          }
          change(next.key, { state: "failed", failure });
          if (failure.reload) {
            await callbacks.current.reload();
          }
          if (failure.stopsQueue) {
            // None of the files waiting can succeed: they say the same thing and leave the queue.
            for (const waiting of queue.current.filter(
              (attempt) => attempt.state === "waiting",
            )) {
              files.current.delete(waiting.key);
              change(waiting.key, { state: "failed", failure });
            }
          }
        }
      }
    } finally {
      pumping.current = false;
      setUploading(false);
    }
  }, [change, drop, publish]);

  const choose = useCallback(
    (requestId: string, chosen: readonly Blob[]) => {
      if (pumping.current || runner.busy !== null) {
        return;
      }
      runner.clearFailure();
      for (const file of chosen) {
        const key = nextKey.current;
        nextKey.current += 1;
        const problem = evidenceFileProblem(file.size);
        queue.current = [
          ...queue.current,
          {
            key,
            size: file.size,
            state: problem === null ? "waiting" : "failed",
            failure: problem,
          },
        ];
        if (problem === null) {
          files.current.set(key, file);
          requestOf.current.set(key, requestId);
        }
      }
      publish();
      void pump();
    },
    [pump, publish, runner],
  );

  const retry = useCallback(
    (requestId: string, key: number) => {
      if (pumping.current || runner.busy !== null || !files.current.has(key)) {
        return;
      }
      requestOf.current.set(key, requestId);
      change(key, { state: "waiting", failure: null });
      void pump();
    },
    [change, pump, runner.busy],
  );

  const gesture = useCallback(
    (name: AudienceGesture, call: Parameters<typeof runner.run>[1]) => {
      if (pumping.current) {
        return;
      }
      void runner.run(name, call);
    },
    [runner],
  );

  return {
    busy: runner.busy ?? (uploading ? "upload" : null),
    failure: runner.failure,
    attempts,
    start: () =>
      gesture("start", () =>
        openVerificationRequest(networkCode, "audience_verified"),
      ),
    submit: (requestId) =>
      gesture("submit", () => submitVerificationRequest(requestId)),
    cancel: (requestId) =>
      gesture("cancel", async () => {
        const result = await cancelVerificationRequest(requestId);
        if (result.kind === "ok") {
          // The request is gone: what was still waiting to be sent has nowhere to go.
          for (const attempt of [...queue.current]) {
            drop(attempt.key);
          }
        }
        return result;
      }),
    removePiece: (requestId, evidenceId) =>
      gesture("remove", () =>
        removeVerificationEvidence(requestId, evidenceId),
      ),
    choose,
    retry,
    dismiss: drop,
  };
}

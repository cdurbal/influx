"use client";

// One gesture at a time on a verification request, shared by the ownership journey and the audience
// journey (docs/mvp/08 RG60, RG95; jalons/l2e, commits 18 and 19), outside the components (CLAUDE.md §5):
// the call runs, the lines are read again after its answer so that the screen shows what the API holds,
// and a refusal is told by `failureOf` (verification-view.ts), the delay left included. A second
// gesture while one runs is ignored. Nothing is decided here: apps/api and the database refuse or
// accept, and nothing goes to the browser's storage (D37).
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useCallback, useRef, useState } from "react";
import { failureOf, type Failure } from "./verification-view";

export type GestureRunner<Gesture extends string> = {
  /** The gesture running, null at rest: the buttons say it and refuse a second one. */
  busy: Gesture | null;
  /** What the last refused call means, null once another gesture starts. */
  failure: Failure | null;
  /** Runs one gesture; ignored while another one runs. */
  run: (
    gesture: Gesture,
    call: () => Promise<RelayResult<unknown>>,
  ) => Promise<void>;
  /** Forgets the last failure (a screen that starts a gesture of its own, such as a deposit). */
  clearFailure: () => void;
};

export function useGestureRunner<Gesture extends string>(options: {
  /** Reads the lines again, the screen untouched meanwhile. */
  reload: () => Promise<boolean>;
  onSignedOut: () => void;
}): GestureRunner<Gesture> {
  const { reload, onSignedOut } = options;
  const [busy, setBusy] = useState<Gesture | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (
      gesture: Gesture,
      call: () => Promise<RelayResult<unknown>>,
    ): Promise<void> => {
      if (running.current) {
        return;
      }
      running.current = true;
      setBusy(gesture);
      setFailure(null);
      try {
        const result = await call();
        if (result.kind === "ok") {
          await reload();
        } else if (result.kind === "unauthenticated") {
          onSignedOut();
        } else {
          const refused = failureOf(result);
          setFailure(refused);
          if (refused.reload) {
            await reload();
          }
        }
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [reload, onSignedOut],
  );

  const clearFailure = useCallback(() => setFailure(null), []);

  return { busy, failure, run, clearFailure };
}

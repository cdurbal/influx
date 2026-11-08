"use client";

// The gestures of the ownership journey of a creator (docs/mvp/08 RG21 to RG24, RG60; jalons/l2e,
// commit 18), outside the components (CLAUDE.md §5): open the request and take its code, ask for a
// new code, say that the code is pasted, withdraw the request. One call at a time. Nothing is decided
// here: apps/api and the database refuse or accept (the delay of RG60, the cap, a code that ran out),
// the lines are read again after each answer so that the screen shows what the API holds, and a
// refusal is told by `failureOf` (verification-view.ts), the delay left included. The code itself is
// the screen's to show and never to keep: nothing goes to the browser's storage (D37).
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useCallback, useRef, useState } from "react";
import {
  cancelVerificationRequest,
  openVerificationRequest,
  renewVerificationCode,
  submitVerificationRequest,
} from "./verification-api";
import { failureOf, type Failure } from "./verification-view";

export type JourneyGesture = "start" | "renew" | "submit" | "cancel";

export type OwnershipJourneyGestures = {
  /** The gesture running, null at rest: the buttons say it and refuse a second one. */
  busy: JourneyGesture | null;
  /** What the last refused call means, null once another gesture starts. */
  failure: Failure | null;
  start: () => void;
  renew: (requestId: string) => void;
  submit: (requestId: string) => void;
  cancel: (requestId: string) => void;
};

export function useOwnershipJourney(options: {
  networkCode: string;
  /** Reads the lines again, the screen untouched meanwhile. */
  reload: () => Promise<boolean>;
  onSignedOut: () => void;
}): OwnershipJourneyGestures {
  const { networkCode, reload, onSignedOut } = options;
  const [busy, setBusy] = useState<JourneyGesture | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (
      gesture: JourneyGesture,
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

  return {
    busy,
    failure,
    start: () =>
      void run("start", () =>
        openVerificationRequest(networkCode, "account_verified"),
      ),
    renew: (requestId) =>
      void run("renew", () => renewVerificationCode(requestId)),
    submit: (requestId) =>
      void run("submit", () => submitVerificationRequest(requestId)),
    cancel: (requestId) =>
      void run("cancel", () => cancelVerificationRequest(requestId)),
  };
}

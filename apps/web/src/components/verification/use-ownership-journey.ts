"use client";

// The gestures of the ownership journey of a creator (docs/mvp/08 RG21 to RG24, RG60; jalons/l2e,
// commit 18), outside the components (CLAUDE.md §5): open the request and take its code, ask for a
// new code, say that the code is pasted, withdraw the request. One call at a time, by the runner
// shared with the audience journey (use-gesture-runner.ts): the lines are read again after each
// answer and a refusal is told by `failureOf`, the delay left included. The code itself is the
// screen's to show and never to keep: nothing goes to the browser's storage (D37).
import { useGestureRunner } from "./use-gesture-runner";
import {
  cancelVerificationRequest,
  openVerificationRequest,
  renewVerificationCode,
  submitVerificationRequest,
} from "./verification-api";
import type { Failure } from "./verification-view";

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
  const { busy, failure, run } = useGestureRunner<JourneyGesture>({
    reload,
    onSignedOut,
  });

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

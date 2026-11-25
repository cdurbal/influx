"use client";

// The gestures of the verification journey of a brand (docs/mvp/06 RG46, RG47, RG51, CA26, CA27; jalons/l2e,
// commit 20), outside the components (CLAUDE.md §5): open the request and take its domain code, ask
// for a new code, send the request (the internal block first, when it changed), withdraw it. One call
// at a time, by the runner the creator's journeys share (use-gesture-runner.ts): the state is read
// again after each answer and a refusal is told by `failureOf`, the delay left included. The code is
// the screen's to show and never to keep: nothing goes to the browser's storage (D37).
import type { BrandInternalDetails } from "@influx/contracts/verification";
import { useGestureRunner } from "./use-gesture-runner";
import {
  cancelBrandRequest,
  openBrandRequest,
  renewBrandCode,
  saveBrandInternalDetails,
  submitBrandRequest,
} from "./verification-api";
import type { Failure } from "./verification-view";

export type BrandGesture = "start" | "renew" | "submit" | "cancel";

export type BrandJourneyGestures = {
  /** The gesture running, null at rest: the buttons say it and refuse a second one. */
  busy: BrandGesture | null;
  /** What the last refused call means, null once another gesture starts. */
  failure: Failure | null;
  start: () => void;
  renew: () => void;
  /** `details`: the internal block to store first (06 RG47), null when the API holds it already. */
  submit: (details: BrandInternalDetails | null) => void;
  cancel: () => void;
};

export function useBrandJourney(options: {
  /** Reads the state again, the screen untouched meanwhile. */
  reload: () => Promise<boolean>;
  onSignedOut: () => void;
}): BrandJourneyGestures {
  const { busy, failure, run } = useGestureRunner<BrandGesture>(options);

  return {
    busy,
    failure,
    start: () => void run("start", openBrandRequest),
    renew: () => void run("renew", renewBrandCode),
    submit: (details) =>
      void run("submit", async () => {
        if (details !== null) {
          const saved = await saveBrandInternalDetails(details);
          if (saved.kind !== "ok") {
            return saved;
          }
        }
        return submitBrandRequest();
      }),
    cancel: () => void run("cancel", cancelBrandRequest),
  };
}

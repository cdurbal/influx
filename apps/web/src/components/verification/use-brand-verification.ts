"use client";

// The read of the verification of a brand, as block 4 of its profile and its journey share it (docs/mvp/06
// RG46, RG53; jalons/l2e, commit 20): the badge, the one request and the internal block, as the API
// answers, and nothing else. The state is never guessed after a write, it is read again (a write
// answers its request alone). A read that fails after a first one keeps what is on screen, so that the
// block never loses its state to a blip. Nothing is kept in the browser's storage (D37).
import type { BrandVerificationResponse } from "@influx/contracts/verification";
import { useCallback, useEffect, useRef, useState } from "react";
import { readBrandVerification } from "./verification-api";

export type BrandVerificationState = {
  phase: "loading" | "ready" | "unavailable";
  data: BrandVerificationResponse | null;
  /** Reads the state again, the screen untouched meanwhile; true when the read answered. */
  reload: () => Promise<boolean>;
  /** "Réessayer" after a read that failed: the block says "loading" again. */
  retry: () => Promise<boolean>;
};

export function useBrandVerification(options: {
  /** The session ended while the page was open: the shell shows "signed out". */
  onSignedOut: () => void;
}): BrandVerificationState {
  const [phase, setPhase] =
    useState<BrandVerificationState["phase"]>("loading");
  const [data, setData] = useState<BrandVerificationResponse | null>(null);
  const answered = useRef(false);
  const signedOutRef = useRef(options.onSignedOut);
  useEffect(() => {
    signedOutRef.current = options.onSignedOut;
  }, [options.onSignedOut]);

  const reload = useCallback(async (): Promise<boolean> => {
    const result = await readBrandVerification();
    if (result.kind === "ok") {
      answered.current = true;
      setData(result.data);
      setPhase("ready");
      return true;
    }
    if (result.kind === "unauthenticated") {
      signedOutRef.current();
    } else if (!answered.current) {
      setPhase("unavailable");
    }
    return false;
  }, []);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the block.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const retry = useCallback(async (): Promise<boolean> => {
    setPhase("loading");
    return reload();
  }, [reload]);

  return { phase, data, reload, retry };
}

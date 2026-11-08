"use client";

// The read of the verification of a creator, as the lines of his network block and the ownership
// journey share it (docs/mvp/08 RG13; jalons/l2e, commit 18): the lines of the API, network by
// network, and nothing else. The API says who is verified and what is asked; the state is never
// guessed after a write, the lines are read again (a write answers its request alone). A read that
// fails after a first one keeps what is on screen, so that a line never loses its state to a blip.
// Nothing is kept in the browser's storage (D37).
import type { CreatorVerificationResponse } from "@influx/contracts/verification";
import { useCallback, useEffect, useRef, useState } from "react";
import { readCreatorVerification } from "./verification-api";

export type CreatorVerificationState = {
  phase: "loading" | "ready" | "unavailable";
  lines: CreatorVerificationResponse["lines"];
  /** Reads the lines again, the screen untouched meanwhile; true when the read answered. */
  reload: () => Promise<boolean>;
  /** "Réessayer" after a read that failed: the block says "loading" again. */
  retry: () => Promise<boolean>;
};

export function useCreatorVerification(options: {
  /** The session ended while the page was open: the shell shows "signed out". */
  onSignedOut: () => void;
}): CreatorVerificationState {
  const [phase, setPhase] =
    useState<CreatorVerificationState["phase"]>("loading");
  const [lines, setLines] = useState<CreatorVerificationResponse["lines"]>([]);
  const answered = useRef(false);
  const signedOutRef = useRef(options.onSignedOut);
  useEffect(() => {
    signedOutRef.current = options.onSignedOut;
  }, [options.onSignedOut]);

  const reload = useCallback(async (): Promise<boolean> => {
    const result = await readCreatorVerification();
    if (result.kind === "ok") {
      answered.current = true;
      setLines(result.data.lines);
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

  return { phase, lines, reload, retry };
}

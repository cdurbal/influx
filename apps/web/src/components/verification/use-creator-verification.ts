"use client";

// The read of the verification of a creator, as the lines of his network block and the journeys share
// it (docs/mvp/08 RG13, RG77; jalons/l2e, commit 18; jalons/l2f, commit 17): the lines of the API, network
// by network, and the decisions he may contest with his contests (`GET …/disputes`), and nothing else. The API says who is verified and what is asked; the state is never
// guessed after a write, the lines are read again (a write answers its request alone). A read that
// fails after a first one keeps what is on screen, so that a line never loses its state to a blip.
// Nothing is kept in the browser's storage (D37).
import type {
  CreatorVerificationResponse,
  OwnDisputesResponse,
} from "@influx/contracts/verification";
import { useCallback, useEffect, useRef, useState } from "react";
import { readCreatorVerification, readOwnDisputes } from "./verification-api";

export type CreatorVerificationState = {
  phase: "loading" | "ready" | "unavailable";
  lines: CreatorVerificationResponse["lines"];
  /**
   * The decisions he may still contest and his contests, or null while they are not read (a read that
   * failed leaves the lines usable: the block then offers no contest, and the contest screen says so).
   */
  disputes: OwnDisputesResponse | null;
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
  const [disputes, setDisputes] = useState<OwnDisputesResponse | null>(null);
  const answered = useRef(false);
  const signedOutRef = useRef(options.onSignedOut);
  useEffect(() => {
    signedOutRef.current = options.onSignedOut;
  }, [options.onSignedOut]);

  const reload = useCallback(async (): Promise<boolean> => {
    const [result, contests] = await Promise.all([
      readCreatorVerification(),
      readOwnDisputes(),
    ]);
    if (contests.kind === "ok") {
      setDisputes(contests.data);
    }
    if (result.kind === "ok") {
      answered.current = true;
      setLines(result.data.lines);
      setPhase("ready");
      return true;
    }
    if (
      result.kind === "unauthenticated" ||
      contests.kind === "unauthenticated"
    ) {
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

  return { phase, lines, disputes, reload, retry };
}

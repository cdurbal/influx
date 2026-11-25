"use client";

// The state and the flow of the logo of "mon profil de marque" (docs/mvp/06 RG15, cas limites 2 et
// 6, CA45; 17 §4.2; D80, jalons/l2b/stockage.md §3, §4), outside the components (CLAUDE.md §5):
// the logo as apps/api stored it (read as JSON, shown from a `data:` source, never a URL), the
// deposit, the replacement, the removal, and the file kept in memory after an unavailable service
// so that it is sent again without choosing it again. The preview is the server's output only:
// nothing is shown before the API has validated and re-encoded the image. The name of the file is
// never read, shown or sent; nothing is kept in the browser's storage (D37).
import type {
  BrandLogo,
  BrandProfileCompletenessView,
} from "@influx/contracts/brand-profile";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  readBrandLogo,
  removeBrandLogo,
  uploadBrandLogo,
} from "./brand-profile-api";
import {
  logoFailureOf,
  logoFileProblem,
  type LogoFailure,
} from "./brand-profile-view";

export type LogoPhase = "loading" | "ready" | "unavailable";

export type LogoActivity =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "removing" }
  | { kind: "uploaded" }
  /** On a published profile the deposit waits for the review (06 RG9); the logo in force stays. */
  | { kind: "uploadedInReview" }
  | { kind: "removed" }
  | { kind: "removedInReview" }
  | { kind: "failed"; failure: LogoFailure; during: "upload" | "removal" };

export type BrandLogoState = {
  phase: LogoPhase;
  logo: BrandLogo | null;
  /** A replacement waiting for review on a published profile, shown beside the logo in force. */
  pendingLogo: BrandLogo | null;
  activity: LogoActivity;
  /** A file waits in memory to be sent again: the service did not answer (cas limite 6). */
  canRetry: boolean;
  /** True while a deposit or a removal runs: no second one starts. */
  busy: boolean;
  /** The file chosen by the member; its name is never read. */
  choose: (file: Blob) => void;
  retry: () => void;
  remove: () => void;
  reload: () => void;
};

export function useBrandLogo(options: {
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
  /** The score as the API recomputed it after a deposit or a removal (RG58). */
  onCompleteness: (completeness: BrandProfileCompletenessView) => void;
  /** A deposit or a removal went to review: the profile says what waits (`pendingChanges`), read it again. */
  onReview: () => void;
}): BrandLogoState {
  const [phase, setPhase] = useState<LogoPhase>("loading");
  const [logo, setLogo] = useState<BrandLogo | null>(null);
  const [pendingLogo, setPendingLogo] = useState<BrandLogo | null>(null);
  const [activity, setActivity] = useState<LogoActivity>({ kind: "idle" });
  const [canRetry, setCanRetry] = useState(false);

  const busyRef = useRef(false);
  const pending = useRef<Blob | null>(null);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const forget = useCallback(() => {
    pending.current = null;
    setCanRetry(false);
  }, []);

  const send = useCallback(
    async (file: Blob): Promise<void> => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setActivity({ kind: "uploading" });
      const result = await uploadBrandLogo(file);
      busyRef.current = false;
      if (result.kind === "ok") {
        forget();
        callbacks.current.onCompleteness(result.data.completeness);
        if (result.data.state === "in_review") {
          setPendingLogo(result.data.logo);
          setActivity({ kind: "uploadedInReview" });
          callbacks.current.onReview();
          return;
        }
        setLogo(result.data.logo);
        setPendingLogo(null);
        setActivity({ kind: "uploaded" });
        return;
      }
      if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
        return;
      }
      const failure = logoFailureOf(result);
      // Only an unavailable service leaves the same file worth sending again; the others need
      // another file, another day, or nothing.
      if (failure === "unavailable") {
        pending.current = file;
        setCanRetry(true);
      } else {
        forget();
      }
      setActivity({ kind: "failed", failure, during: "upload" });
    },
    [forget],
  );

  const choose = useCallback(
    (file: Blob) => {
      if (busyRef.current) {
        return;
      }
      const problem = logoFileProblem(file.size);
      if (problem !== null) {
        forget();
        setActivity({ kind: "failed", failure: problem, during: "upload" });
        return;
      }
      void send(file);
    },
    [forget, send],
  );

  const retry = useCallback(() => {
    const file = pending.current;
    if (file !== null) {
      void send(file);
    }
  }, [send]);

  const remove = useCallback(async (): Promise<void> => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    setActivity({ kind: "removing" });
    const result = await removeBrandLogo();
    busyRef.current = false;
    if (result.kind === "ok") {
      forget();
      callbacks.current.onCompleteness(result.data.completeness);
      if (result.data.inReview) {
        // The logo in force stays served until the decision; a proposed replacement may be gone.
        setActivity({ kind: "removedInReview" });
        callbacks.current.onReview();
        const read = await readBrandLogo();
        if (read.kind === "ok") {
          setPendingLogo(read.data.pendingLogo ?? null);
        }
      } else {
        setLogo(null);
        setPendingLogo(null);
        setActivity({ kind: "removed" });
      }
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      setActivity({
        kind: "failed",
        failure: logoFailureOf(result),
        during: "removal",
      });
    }
  }, [forget]);

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readBrandLogo();
    if (result.kind === "ok") {
      setLogo(result.data.logo);
      setPendingLogo(result.data.pendingLogo ?? null);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      setPhase("unavailable");
    }
  }, []);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the field.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return {
    phase,
    logo,
    pendingLogo,
    activity,
    canRetry,
    busy: activity.kind === "uploading" || activity.kind === "removing",
    choose,
    retry,
    remove: () => void remove(),
    reload: () => void load(),
  };
}

"use client";

// The state of the brand profile as the shell holds it for the pages around the form (docs/mvp/17
// §2.3 "Bloc d'état du compte", §2.4; jalons/l2b, commit 13): the home and the column of the space
// write it. The shell reads the profile when the space opens and at each change of page (as it does
// the session), the profile screen tells it each save, so that nothing shown is older than the last
// answer of the API. Only the state, the date and the missing fields are kept (summaryOf): the form
// has its own hook. Nothing is stored in the browser (D37).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readBrandProfile } from "./brand-profile-api";
import { summaryOf, type BrandProfileSummary } from "./brand-profile-view";

export type BrandSummaryState =
  /** Not a brand: no profile to speak of. */
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; summary: BrandProfileSummary }
  | { kind: "unavailable" };

export type BrandSummary = {
  state: BrandSummaryState;
  /** The profile screen (or any caller) gives the profile the API has just answered. */
  adopt: (summary: BrandProfileSummary) => void;
  /** "Réessayer" after an unreadable profile. */
  reload: () => void;
};

/**
 * `enabled`: the member is a brand and the session is read. `readKey` changes at each page: the
 * profile is read again, the previous one stays on screen meanwhile (no flash of "loading").
 */
export function useBrandSummary(
  enabled: boolean,
  readKey: string,
): BrandSummary {
  const [read, setRead] = useState<BrandSummaryState>({ kind: "loading" });
  const current = useRef(true);
  // Counts the profiles the screen gave: a read that started before one is older than it.
  const adopted = useRef(0);

  useEffect(() => {
    current.current = true;
    return () => {
      current.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const mark = adopted.current;
    const result = await readBrandProfile();
    if (!current.current || adopted.current !== mark) {
      return;
    }
    setRead((previous) =>
      result.kind === "ok"
        ? { kind: "ready", summary: summaryOf(result.data) }
        : previous.kind === "ready"
          ? previous
          : { kind: "unavailable" },
    );
  }, []);

  useEffect(() => {
    if (enabled) {
      void load();
    }
  }, [enabled, readKey, load]);

  const adopt = useCallback((summary: BrandProfileSummary) => {
    adopted.current += 1;
    setRead({ kind: "ready", summary });
  }, []);

  const reload = useCallback(() => {
    setRead({ kind: "loading" });
    void load();
  }, [load]);

  return useMemo(
    () => ({
      state: enabled ? read : { kind: "none" as const },
      adopt,
      reload,
    }),
    [enabled, read, adopt, reload],
  );
}

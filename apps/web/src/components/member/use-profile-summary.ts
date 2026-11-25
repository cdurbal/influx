"use client";

// The state of a member's profile as the shell holds it for the pages around the form (docs/mvp/17
// §2.3 "Bloc d'état du compte", §2.4; jalons/l2b commit 13, jalons/l2d commit 15): the home and the
// column of the space write it. The shell reads the profile when the space opens and at each change
// of page (as it does the session), the profile screen tells it each save, so that nothing shown is
// older than the last answer of the API. Only a summary is kept: the form has its own hook. One hook
// for both roles; each gives the read that turns the API's answer into its summary. Nothing is
// stored in the browser (D37).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SummaryState<Summary> =
  /** Not a member of this role: no profile to speak of. */
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; summary: Summary }
  | { kind: "unavailable" };

export type ProfileSummary<Summary> = {
  state: SummaryState<Summary>;
  /** The profile screen (or any caller) gives the profile the API has just answered. */
  adopt: (summary: Summary) => void;
  /** "Réessayer" after an unreadable profile. */
  reload: () => void;
};

/**
 * `enabled`: the member has this role and the session is read. `readKey` changes at each page: the
 * profile is read again, the previous one stays on screen meanwhile (no flash of "loading"). `read`
 * answers the summary, or null when the profile cannot be read; it must be a stable function.
 */
export function useProfileSummary<Summary>(
  enabled: boolean,
  readKey: string,
  read: () => Promise<Summary | null>,
): ProfileSummary<Summary> {
  const [held, setHeld] = useState<SummaryState<Summary>>({ kind: "loading" });
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
    const summary = await read();
    if (!current.current || adopted.current !== mark) {
      return;
    }
    setHeld((previous) =>
      summary !== null
        ? { kind: "ready", summary }
        : previous.kind === "ready"
          ? previous
          : { kind: "unavailable" },
    );
  }, [read]);

  useEffect(() => {
    if (enabled) {
      void load();
    }
  }, [enabled, readKey, load]);

  const adopt = useCallback((summary: Summary) => {
    adopted.current += 1;
    setHeld({ kind: "ready", summary });
  }, []);

  const reload = useCallback(() => {
    setHeld({ kind: "loading" });
    void load();
  }, [load]);

  return useMemo(
    () => ({
      state: enabled ? held : { kind: "none" as const },
      adopt,
      reload,
    }),
    [enabled, held, adopt, reload],
  );
}

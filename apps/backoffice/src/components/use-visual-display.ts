"use client";

// What the decision screens of queues 2 and 3 remember about the visuals shown (L2GU-10, L2GU-21; D82 (7)):
// which visuals of the entry the agent has displayed, and the ticket ‹i› rings. The read itself is
// `CreatorVisual`'s (journaled, on demand); this only counts. Nothing is stored in the browser: the memory
// is the screen's, and starts again on every entry.
import { useCallback, useState } from "react";

export type VisualDisplay = {
  /** The visuals of the entry shown so far. */
  shownIds: readonly string[];
  markShown: (visualId: string) => void;
  /** Changes at each ‹i›. */
  ticket: number;
  requestShow: () => void;
};

export function useVisualDisplay(entryId: string): VisualDisplay {
  const [shown, setShown] = useState<{
    entryId: string;
    ids: readonly string[];
  }>({ entryId, ids: [] });
  const [ticket, setTicket] = useState(0);
  const markShown = useCallback(
    (visualId: string) =>
      setShown((previous) => {
        const ids = previous.entryId === entryId ? previous.ids : [];
        return ids.includes(visualId)
          ? previous
          : { entryId, ids: [...ids, visualId] };
      }),
    [entryId],
  );
  const requestShow = useCallback(() => setTicket((count) => count + 1), []);
  return {
    shownIds: shown.entryId === entryId ? shown.ids : [],
    markShown,
    ticket,
    requestShow,
  };
}

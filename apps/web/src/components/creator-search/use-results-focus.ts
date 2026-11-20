"use client";

// Where the focus goes when the search is applied from the opened block of filters below lg (docs/mvp/17 §4.4; WCAG
// 2.4.3; jalons/l3f, fix-1, L3FU-2). The block closes (`display: none`), the button pressed leaves the page and the
// focus would fall on <body>, the scroll staying at the old bottom of a long form. The focus goes to the count band
// once the results are shown, and, while they are being read or when no band is drawn, to the head of the results.
// The width of the screen is never read: the caller asks for it exactly when it closes an opened block.
import { useCallback, useEffect, useRef } from "react";

/** The focus has nowhere to be: nothing, the body, or an element no longer on the screen (the closed block). */
function focusIsLost(active: Element | null): boolean {
  return (
    active === null ||
    active === document.body ||
    !active.isConnected ||
    active.getClientRects().length === 0
  );
}

export function useResultsFocus(options: {
  /** The address the page shows now (criteria, campaign, sort, page), as the search keys it. */
  addressKey: string;
  /** The page has its answer (anything but « loading »). */
  settled: boolean;
}) {
  const { addressKey, settled } = options;
  const countRef = useRef<HTMLParagraphElement | null>(null);
  const startRef = useRef<HTMLDivElement | null>(null);
  const awaited = useRef<string | null>(null);

  /** The caller closed an opened block to show this address: the focus follows once it is the page's. */
  const expectFocusAt = useCallback((key: string) => {
    awaited.current = key;
  }, []);

  useEffect(() => {
    if (awaited.current === null || awaited.current !== addressKey) {
      return;
    }
    const active = document.activeElement;
    const head = startRef.current;
    const band = countRef.current;
    // the brand moved on by itself: its place is not taken from it
    if (!focusIsLost(active) && active !== head && active !== band) {
      awaited.current = null;
      return;
    }
    (settled ? (band ?? head) : head)?.focus();
    if (settled) {
      awaited.current = null;
    }
  });

  return { countRef, startRef, expectFocusAt };
}

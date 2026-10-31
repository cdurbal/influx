"use client";

import { useEffect } from "react";

// EC-PL-01-1: the end-to-end journeys wait for this attribute before they type, tab or click,
// since a page that is not yet hydrated drops those gestures. A client effect sets it, so no
// inline script is needed and the CSP nonce stays as it is. It carries no data and no behaviour.
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return null;
}

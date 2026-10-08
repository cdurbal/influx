"use client";

// Whether the browser says it is online (docs/mvp/17 §3.5, "Hors ligne"): the screens show a
// banner and keep the answers, and their buttons explain instead of sending. The server render and
// the first paint assume online; the browser's value follows at once.
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

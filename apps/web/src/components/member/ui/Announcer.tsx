"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ANNOUNCER_CLASSES } from "./announcer-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/** The pause between emptying the region and writing the message, so that a repeated text is read again. */
const ANNOUNCE_DELAY_MS = 50;

type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce | null>(null);

export type AnnouncerProps = {
  children: ReactNode;
};

/**
 * C29: the one live region of a page, `role="status"`, off screen (`data-announcer`), mounted by the
 * shell and by the state board. `announce()` empties it, then writes the message. A screen that
 * migrates drops its own region for `useAnnouncer()`; the regions a spec reads by `data-*` stay.
 */
export function AnnouncerProvider({
  children,
  ...rest
}: AnnouncerProps & PassThroughProps) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const announce = useCallback<Announce>((next) => {
    clearTimeout(timer.current);
    setMessage("");
    timer.current = setTimeout(() => setMessage(next), ANNOUNCE_DELAY_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div
        {...passThroughOf(rest)}
        role="status"
        aria-atomic="true"
        data-announcer=""
        className={ANNOUNCER_CLASSES}
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

/**
 * The function that speaks to the region. It throws outside the provider: a message lost in silence
 * would hide the mistake, which comes out at the first e2e instead.
 */
export function useAnnouncer(): Announce {
  const announce = useContext(AnnouncerContext);
  if (announce === null) {
    throw new Error("useAnnouncer is called outside an AnnouncerProvider");
  }
  return announce;
}

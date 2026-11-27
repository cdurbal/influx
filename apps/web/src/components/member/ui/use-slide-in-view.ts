"use client";

// The visual in view of a track that scrolls sideways one visual at a time (C31, C34): told by an observer of the
// track, never by a width read here; `show` brings another one in. How the scroll moves is the track's own class
// (smooth under `motion-safe:` only).
import { useEffect, useRef, useState } from "react";

/** `count` is the number of visuals: the observer starts again when it changes. */
export function useSlideInView(count: number) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const element = track.current;
    if (element === null || typeof IntersectionObserver === "undefined") {
      return;
    }
    const slides = [...element.children];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrent(slides.indexOf(entry.target));
          }
        }
      },
      { root: element, threshold: 0.6 },
    );
    for (const slide of slides) {
      observer.observe(slide);
    }
    return () => observer.disconnect();
  }, [count]);

  function show(index: number) {
    const slide = track.current?.children[index];
    if (track.current !== null && slide instanceof HTMLElement) {
      track.current.scrollTo({ left: slide.offsetLeft });
    }
  }

  return { track, current, show };
}

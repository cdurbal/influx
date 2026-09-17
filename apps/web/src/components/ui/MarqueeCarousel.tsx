"use client";

import { useState } from "react";
import { Button } from "./Button";
import { cn } from "./class-names";
import { PauseIcon, PlayIcon } from "./icons";

type MarqueeCarouselProps = {
  items: readonly string[];
  pauseLabel: string;
  /** Mention shown on the same line as the pause button (02 §3.7). */
  note: string;
};

// Three cyclic typographic variants give the text "logos" some variety (02 §3.7).
const LOGO_VARIANTS: readonly string[] = [
  cn("font-bold uppercase tracking-overline"),
  cn("font-extrabold tracking-display"),
  cn("font-bold tracking-display uppercase"),
];

// No white-space or font-size class here: the moving track and the static grid each add their own.
// cn() does not resolve conflicts, so a shared class must never be overridden (10 #3).
function logoClassName(index: number): string {
  return cn("text-text-tertiary", LOGO_VARIANTS[index % LOGO_VARIANTS.length]);
}

/**
 * Continuous logo marquee (section 5, 02 §2.5). Visible pause button (WCAG 2.2.2), also paused on
 * hover and when focus is inside the block (CSS in globals.css). With reduced motion, the marquee
 * is replaced by a static grid and the pause button is hidden.
 */
export function MarqueeCarousel({
  items,
  pauseLabel,
  note,
}: MarqueeCarouselProps) {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div
      data-marquee=""
      data-paused={isPaused ? "true" : "false"}
      className="flex flex-col gap-5"
    >
      <div className="overflow-hidden motion-reduce:hidden">
        <div
          data-marquee-track=""
          className="flex w-max animate-marquee motion-reduce:animate-none"
        >
          <ul className="flex shrink-0 items-center gap-9 pr-9">
            {items.map((name, index) => (
              <li
                key={name}
                className={cn(
                  logoClassName(index),
                  "text-heading-3 whitespace-nowrap",
                )}
              >
                {name}
              </li>
            ))}
          </ul>
          {/* Duplicate copy for the seamless loop, hidden from assistive technologies. */}
          <ul
            aria-hidden="true"
            className="flex shrink-0 items-center gap-9 pr-9"
          >
            {items.map((name, index) => (
              <li
                key={name}
                className={cn(
                  logoClassName(index),
                  "text-heading-3 whitespace-nowrap",
                )}
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="hidden grid-cols-2 gap-x-6 gap-y-4 motion-reduce:grid sm:grid-cols-3 lg:grid-cols-5">
        {items.map((name, index) => (
          <li
            key={name}
            className={cn(
              logoClassName(index),
              "min-w-0 text-md wrap-break-word sm:text-heading-3",
            )}
          >
            {name}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-tertiary">{note}</p>
        <Button
          variant="icon"
          aria-label={pauseLabel}
          aria-pressed={isPaused}
          onClick={() => setIsPaused((paused) => !paused)}
          className="motion-reduce:hidden"
        >
          {isPaused ? (
            <PlayIcon aria-hidden="true" className="size-(--size-icon-md)" />
          ) : (
            <PauseIcon aria-hidden="true" className="size-(--size-icon-md)" />
          )}
        </Button>
      </div>
    </div>
  );
}

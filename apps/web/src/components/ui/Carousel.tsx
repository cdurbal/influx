"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { cn } from "./class-names";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export type CarouselSlide = {
  id: string;
  content: ReactNode;
};

type CarouselProps = {
  /**
   * Also the accessible name of the carousel region: the enclosing section already carries the
   * h2 title, and two regions with the same name break axe landmark-unique (09 A5).
   */
  roleDescription: string;
  slideRoleDescription: string;
  /** One formatted label per slide, e.g. "2 sur 5" (also the visible counter). */
  slideLabels: readonly string[];
  previousLabel: string;
  nextLabel: string;
  slides: readonly CarouselSlide[];
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Manual carousel (section 6, 02 §2.5): native horizontal scrolling with snap points,
 * previous/next buttons (aria-disabled at the bounds, no loop), visible counter and a polite live
 * region updated only after a button press. No automatic movement.
 */
export function Carousel({
  roleDescription,
  slideRoleDescription,
  slideLabels,
  previousLabel,
  nextLabel,
  slides,
}: CarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const lastIndex = slides.length - 1;

  const updateIndexFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    slideRefs.current.forEach((slide, index) => {
      if (!slide) {
        return;
      }
      const distance = Math.abs(slide.offsetLeft - track.scrollLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    setCurrentIndex(nearestIndex);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }
    let frame = 0;
    function handleScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateIndexFromScroll);
    }
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", handleScroll);
    };
  }, [updateIndexFromScroll]);

  function goTo(index: number) {
    const track = trackRef.current;
    const slide = slideRefs.current[index];
    if (!track || !slide) {
      return;
    }
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    track.scrollTo({
      left: slide.offsetLeft,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setCurrentIndex(index);
    setAnnouncement(slideLabels[index] ?? "");
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === lastIndex;

  return (
    <div
      role="region"
      aria-roledescription={roleDescription}
      aria-label={roleDescription}
      className="flex flex-col gap-5"
    >
      <div className="order-last flex items-center justify-between gap-4 lg:order-first lg:justify-end">
        <Button
          variant="icon"
          aria-label={previousLabel}
          aria-disabled={isFirst}
          onClick={() => !isFirst && goTo(currentIndex - 1)}
          className="aria-disabled:border-border-subtle aria-disabled:text-text-disabled"
        >
          <ChevronLeftIcon
            aria-hidden="true"
            className="size-(--size-icon-md)"
          />
        </Button>
        <p
          aria-hidden="true"
          className="text-sm text-text-tertiary tabular-nums"
        >
          {slideLabels[currentIndex]}
        </p>
        <Button
          variant="icon"
          aria-label={nextLabel}
          aria-disabled={isLast}
          onClick={() => !isLast && goTo(currentIndex + 1)}
          className="aria-disabled:border-border-subtle aria-disabled:text-text-disabled"
        >
          <ChevronRightIcon
            aria-hidden="true"
            className="size-(--size-icon-md)"
          />
        </Button>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>

      <div
        ref={trackRef}
        className="relative flex snap-x snap-mandatory gap-grid-gap overflow-x-auto pb-2"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            ref={(element) => {
              slideRefs.current[index] = element;
            }}
            role="group"
            aria-roledescription={slideRoleDescription}
            aria-label={slideLabels[index]}
            className={cn("w-(--size-carousel-slide) shrink-0 snap-start")}
          >
            {slide.content}
          </div>
        ))}
      </div>
    </div>
  );
}

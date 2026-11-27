import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  READING_LAYOUT_CLASSES,
  READING_MAIN_CLASSES,
} from "./reading-layout-classes";
import { StickyAside } from "./StickyAside";

export type ReadingLayoutProps = {
  /** The content of the reading: its sections, in order. */
  main: ReactNode;
  /** What the box beside it holds; below 1 024 px the screen's bar takes its place. */
  aside: ReactNode;
  /** The name of the landmark of the box, already translated. */
  asideLabel: string;
  className?: string;
};

/**
 * The two columns of a reading page (C40): the content, then the sticky box (C39) in a column of its own from
 * 1 024 px. The content comes first in the page at every width.
 */
export function ReadingLayout({
  main,
  aside,
  asideLabel,
  className,
}: ReadingLayoutProps) {
  return (
    <div
      data-reading-layout=""
      className={cn(READING_LAYOUT_CLASSES, className)}
    >
      <div className={READING_MAIN_CLASSES}>{main}</div>
      <StickyAside label={asideLabel}>{aside}</StickyAside>
    </div>
  );
}

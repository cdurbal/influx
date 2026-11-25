import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  pageFrameClasses,
  type PageFrameGap,
  type PageFrameStickyBar,
  type PageFrameVariant,
} from "./page-frame-classes";

export type PageFrameProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  /** `wide` and `narrow` for the members; `bo` is the contract the backoffice twin renders (RUC). */
  variant: PageFrameVariant;
  /** The vertical gap: the page by default, `reading` for a reading, `stack` for a stacked page. */
  gap?: PageFrameGap;
  /** The sticky bar of the page, which gets its reserve under the content on a phone. */
  stickyBar?: PageFrameStickyBar;
  children: ReactNode;
};

/**
 * C01: the frame of a page, a `div`. `main#main` stays with the shell (E01a §7); the one `h1` is
 * the header's. The frame carries the header glow, so a page holds one frame and no other glow.
 */
export function PageFrame({
  variant,
  gap,
  stickyBar,
  className,
  children,
  ...rest
}: PageFrameProps) {
  return (
    <div
      {...rest}
      className={cn(pageFrameClasses(variant, { gap, stickyBar }), className)}
    >
      {children}
    </div>
  );
}

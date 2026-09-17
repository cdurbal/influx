import type { ReactNode } from "react";
import { cn } from "./class-names";

type PhoneFrameProps = {
  children: ReactNode;
  /**
   * Width, aspect ratio and rotation classes of the frame, e.g. "aspect-phone-frame w-full".
   * The frame sets no width or ratio itself: the caller owns it (mirrors ResponsiveImage, 10 #1).
   */
  className?: string;
};

/**
 * Generic smartphone device frame: black brushed-metal bezel with rim-light on both edges
 * (`bg-phone-metal`), notch and a clipped screen area for arbitrary content. `shadow-phone-frame`
 * adds two solid diagonal steps behind the frame so the body reads as a physical object with
 * visible thickness, not a flat card.
 */
export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border-(length:--border-width-thin) border-border-default bg-phone-metal p-3 shadow-phone-frame",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute top-3 left-1/2 z-(--z-raised) h-(--size-phone-notch-height) w-(--size-phone-notch-width) -translate-x-1/2 rounded-pill bg-text-inverse"
      />
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-surface-muted">
        {children}
      </div>
    </div>
  );
}

// A dense table scrolls in its own region (17b §1.7), never the page. The region is named and focusable
// so a keyboard reaches what overflows (axe scrollable-region-focusable); its head stays in view.
import type { ReactNode } from "react";
import { cn } from "./auth-classes";
import { DENSE_TABLE_WRAP_CLASSES } from "./bo-classes";

export function DenseTableRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn(DENSE_TABLE_WRAP_CLASSES, className)}
    >
      {children}
    </div>
  );
}

import type { ReactNode, Ref } from "react";
import { cn } from "@/components/ui/class-names";

/** The `h1` of a page of the connected spaces: Manrope 800, `text-title-page` (20 §11.5). */
export const PAGE_TITLE_CLASSES = cn(
  "font-display text-title-page font-extrabold tracking-heading text-text-primary",
);

type PageHeaderProps = {
  /** The one `h1` of the page; focused after a navigation, hence the ref (17 §2.5). */
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  /** A breadcrumb or a line above the title, from the second level on. */
  above?: ReactNode;
  /** The main action: to the right of the title on a wide screen, under it on a phone. */
  actions?: ReactNode;
  className?: string;
};

/**
 * The head of a page: the glow of F6 behind it (decorative, valued under KEO only), then the single
 * `h1`, then the action. The component renders exactly one `h1`, and nothing else is a heading.
 */
export function PageHeader({
  title,
  titleRef,
  above,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("relative isolate flex flex-col gap-3 py-4", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-(--z-behind) bg-header-glow"
      />
      {above === undefined ? null : (
        <div className="text-sm text-text-secondary">{above}</div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 ref={titleRef} tabIndex={-1} className={PAGE_TITLE_CLASSES}>
          {title}
        </h1>
        {actions === undefined ? null : (
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

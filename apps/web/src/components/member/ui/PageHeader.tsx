"use client";

import { createContext, useContext, type ReactNode, type Ref } from "react";
import { cn } from "@/components/ui/class-names";
import { PAGE_TITLE_CLASSES } from "./page-header-classes";

/**
 * The way back to the page-menu of a rubric, « ‹ Mon compte » (D74, sn-fiche "Retour"): given
 * once by the frame of the rubric's sub-pages (AccountShell), drawn above the `h1` of each of them
 * by the one header they all use. Null outside a sub-page.
 */
export const PageBackContext = createContext<ReactNode>(null);

type PageHeaderProps = {
  /** The one `h1` of the page; focused after a navigation, hence the ref (17 §2.5). */
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  /** A line above the title, from the second level on; the rubric's way back when absent. */
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
  const back = useContext(PageBackContext);
  const lead = above ?? back;
  return (
    <header
      className={cn("relative isolate flex flex-col gap-3 py-4", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-(--z-behind) bg-header-glow"
      />
      {lead === null || lead === undefined ? null : (
        <div className="text-sm text-text-secondary">{lead}</div>
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

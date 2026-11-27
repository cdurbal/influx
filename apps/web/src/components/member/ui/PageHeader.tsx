"use client";

import { createContext, useContext, type ReactNode, type Ref } from "react";
import { cn } from "@/components/ui/class-names";
import {
  PAGE_HEADER_ABOVE_CLASSES,
  PAGE_HEADER_ACTIONS_CLASSES,
  PAGE_HEADER_CLASSES,
  PAGE_HEADER_CRUMBS_CLASSES,
  PAGE_HEADER_LEAD_CLASSES,
  PAGE_HEADER_META_CLASSES,
  PAGE_HEADER_ROW_CLASSES,
  PAGE_HEADER_TITLE_ROW_CLASSES,
  PAGE_TITLE_CLASSES,
  SECTION_PAGE_TITLE_CLASSES,
} from "./page-header-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/**
 * The way back to the page-menu of a rubric, « ‹ Mon compte » (D74, sn-fiche "Retour"): given
 * once by the frame of the rubric's sub-pages (AccountShell), drawn above the `h1` of each of them
 * by the one header they all use. Null outside a sub-page.
 */
export const PageBackContext = createContext<ReactNode>(null);

/** One step of the crumbs: a link, or the page itself when it has no `href`. */
export type PageHeaderCrumb = { href?: string; label: string };

export type PageHeaderProps = {
  /** The one `h1` of the page; focused after a navigation, hence the ref (17 §2.5). */
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  /** `page` (28 px, 24 on a phone) or `section` (20 px: account, verifications, wizards; RU-17). */
  titleSize?: "page" | "section";
  /** A line above the title, from the second level on; the rubric's way back when absent. */
  above?: ReactNode;
  /** The crumbs above the title, instead of the way back; a plain list, never a `nav` (D74). */
  crumbs?: PageHeaderCrumb[];
  /** The sentence under the title. */
  lead?: ReactNode;
  /** Badges beside the title, which wrap under it on a narrow window. */
  badges?: ReactNode;
  /** The main action: to the right of the title on a wide screen, under it on a phone. */
  actions?: ReactNode;
  /** A line of facts under the lead (a date, a status already written). */
  meta?: ReactNode;
  className?: string;
};

/**
 * C02, the head of a page: the single `h1`, then the action (the glow of F6 is the ground of the
 * page frame, not a layer of the head). The component renders exactly one `h1`, and nothing else
 * is a heading. A header given none of the properties added by RUB renders as it always did.
 */
export function PageHeader({
  title,
  titleRef,
  titleSize = "page",
  above,
  crumbs,
  lead,
  badges,
  actions,
  meta,
  className,
  ...rest
}: PageHeaderProps & PassThroughProps) {
  const back = useContext(PageBackContext);
  const topLine = above ?? back;
  const heading = (
    <h1
      ref={titleRef}
      tabIndex={-1}
      className={
        titleSize === "section"
          ? SECTION_PAGE_TITLE_CLASSES
          : PAGE_TITLE_CLASSES
      }
    >
      {title}
    </h1>
  );
  return (
    <header
      {...passThroughOf(rest)}
      className={cn(PAGE_HEADER_CLASSES, className)}
    >
      {crumbs === undefined || crumbs.length === 0 ? (
        topLine === null || topLine === undefined ? null : (
          <div className={PAGE_HEADER_ABOVE_CLASSES}>{topLine}</div>
        )
      ) : (
        <ol className={PAGE_HEADER_CRUMBS_CLASSES}>
          {crumbs.map((crumb, index) => (
            <li key={`${index}-${crumb.label}`}>
              {crumb.href === undefined ? (
                crumb.label
              ) : (
                <a href={crumb.href} className="underline">
                  {crumb.label}
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className={PAGE_HEADER_ROW_CLASSES}>
        {badges === undefined ? (
          heading
        ) : (
          <div className={PAGE_HEADER_TITLE_ROW_CLASSES}>
            {heading}
            {badges}
          </div>
        )}
        {actions === undefined ? null : (
          <div className={PAGE_HEADER_ACTIONS_CLASSES}>{actions}</div>
        )}
      </div>
      {lead === undefined ? null : (
        <p className={PAGE_HEADER_LEAD_CLASSES}>{lead}</p>
      )}
      {meta === undefined ? null : (
        <div className={PAGE_HEADER_META_CLASSES}>{meta}</div>
      )}
    </header>
  );
}

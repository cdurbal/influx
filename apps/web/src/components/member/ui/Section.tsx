import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  SECTION_COUNT_CLASSES,
  SECTION_DESCRIPTION_CLASSES,
  SECTION_HEAD_CLASSES,
  sectionClasses,
  sectionTitleClasses,
  type SectionVariant,
} from "./section-classes";

export type SectionProps = {
  title: ReactNode;
  /** The heading level: `h2` by default, `h3` inside a section that has an `h2` (never an `h1`). */
  as?: "h2" | "h3";
  variant: SectionVariant;
  /** A number beside the title, already formatted. */
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** The hairline above the section: on by default, and never above the first section of its parent. */
  divider?: boolean;
  /** The content is being replaced (`aria-busy`). */
  busy?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * C03: a heading, its intro, its actions and its content, without a container. The `section` is
 * named by its heading (`aria-labelledby`), so that the page has a region per section.
 */
export function Section({
  title,
  as: Heading = "h2",
  variant,
  count,
  description,
  actions,
  divider = true,
  busy,
  className,
  children,
}: SectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy === true ? true : undefined}
      className={cn(sectionClasses(variant, divider), className)}
    >
      <div className={SECTION_HEAD_CLASSES}>
        <Heading id={headingId} className={sectionTitleClasses(variant)}>
          {title}
          {count === undefined ? null : (
            <>
              {" "}
              <span className={SECTION_COUNT_CLASSES}>{count}</span>
            </>
          )}
        </Heading>
        {actions}
      </div>
      {description === undefined ? null : (
        <p className={SECTION_DESCRIPTION_CLASSES}>{description}</p>
      )}
      {children}
    </section>
  );
}

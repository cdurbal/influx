import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { MEMBER_CARD_CLASSES } from "@/components/member/ui/card-classes";
import {
  OVERLINE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";

type BoardSectionProps = {
  /** The stable name of the component (`data-board-component`): the hook of the screenshots and tests. */
  component: string;
  title: string;
  /** What the section shows, and the states a still page cannot show (hover, focus, press). */
  note: string;
  children: ReactNode;
};

/** One component of the board: a title, its note, then one cell per state. */
export function BoardSection({
  component,
  title,
  note,
  children,
}: BoardSectionProps) {
  const headingId = `board-${component}`;
  return (
    <section
      data-board-component={component}
      aria-labelledby={headingId}
      className="flex flex-col gap-4"
    >
      <h2 id={headingId} className={SECTION_TITLE}>
        {title}
      </h2>
      <p className="text-sm text-text-secondary">{note}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

type BoardStateProps = {
  /** The stable name of the state (`data-board-state`), unique within its component. */
  state: string;
  label: string;
  className?: string;
  children: ReactNode;
};

/** One state of a component, on the surface of a card, its name above it. */
export function BoardState({
  state,
  label,
  className,
  children,
}: BoardStateProps) {
  return (
    <div data-board-state={state} className={MEMBER_CARD_CLASSES}>
      <p className={OVERLINE}>{label}</p>
      <div className={cn("flex flex-wrap items-start gap-3", className)}>
        {children}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { ActionLink } from "./ActionLink";
import { FieldMessage } from "./FieldMessage";
import { PropertyList } from "./PropertyList";
import {
  RECAP_CLASSES,
  RECAP_HEAD_CLASSES,
  RECAP_MISSING_CLASSES,
  RECAP_SECTION_CLASSES,
  RECAP_TITLE_CLASSES,
} from "./recap-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

/** One answer of a section: its label and its value, already written. */
type RecapItem = {
  label: string;
  value: ReactNode;
  /** No value yet: the line says `emptyLabel` in the tertiary text. */
  empty?: boolean;
};

/** One section of the recap: a step of the wizard, its answers and what is missing in it. */
type RecapSection = {
  /** Stable, unique in the page: it names the `h3` the section is labelled by. */
  id: string;
  title: string;
  /** Where the step is edited: the link « Edit », which names the section for a screen reader. */
  editHref: string;
  items: readonly RecapItem[];
  /** What is missing, one sentence each, already written (« To complete: the bio »): shown as a warning. */
  missing?: readonly string[];
};

/** What joins « Edit » to the title of its section, for the screen reader alone: the same in both languages. */
const EDIT_NAME_SEPARATOR = ": ";

export type RecapProps = {
  sections: readonly RecapSection[];
  /** « Edit », already translated; the title of the section follows it for a screen reader. */
  editLabel: string;
  /** What an empty answer says, already translated ("Not provided"). */
  emptyLabel?: string;
  className?: string;
};

/**
 * The recap (C42): what the member answered, step by step, to read before sending. Each section is a `section`
 * named by its `h3` (the page puts the `h2` of the step above), its link « Edit » leads back to the step, and what
 * is missing is a line of warning with its icon (never the colour alone). It sends nothing and blocks nothing.
 */
export function Recap({
  sections,
  editLabel,
  emptyLabel,
  className,
  ...rest
}: RecapProps & PassThroughProps) {
  return (
    <div {...passThroughOf(rest)} className={cn(RECAP_CLASSES, className)}>
      {sections.map((section) => {
        const titleId = `recap-${section.id}`;
        return (
          <section
            key={section.id}
            aria-labelledby={titleId}
            data-recap-section={section.id}
            className={RECAP_SECTION_CLASSES}
          >
            <div className={RECAP_HEAD_CLASSES}>
              <h3 id={titleId} className={RECAP_TITLE_CLASSES}>
                {section.title}
              </h3>
              <ActionLink href={section.editHref} dense>
                {editLabel}
                <span className="sr-only">
                  {EDIT_NAME_SEPARATOR}
                  {section.title}
                </span>
              </ActionLink>
            </div>
            <PropertyList
              items={section.items.map((item) => ({
                label: item.label,
                value: item.value,
                empty: item.empty,
              }))}
              labelWidth="summary"
              emptyLabel={emptyLabel}
            />
            {section.missing === undefined ||
            section.missing.length === 0 ? null : (
              <div className={RECAP_MISSING_CLASSES}>
                {section.missing.map((text) => (
                  <FieldMessage key={text} kind="warning">
                    {text}
                  </FieldMessage>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

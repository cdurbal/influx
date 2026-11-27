"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { CircleAlertIcon, TriangleAlertIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/class-names";
import {
  ERROR_SUMMARY_CLASSES,
  ERROR_SUMMARY_ICON_CLASSES,
  ERROR_SUMMARY_ITEM_CLASSES,
  ERROR_SUMMARY_LINK_CLASSES,
  ERROR_SUMMARY_LIST_CLASSES,
  ERROR_SUMMARY_REASON_CLASSES,
  ERROR_SUMMARY_TITLE_CLASSES,
  MISSING_ICON_CLASSES,
  MISSING_ITEM_CLASSES,
  MISSING_LABEL_CLASSES,
  MISSING_LINK_CLASSES,
  MISSING_LIST_CLASSES,
} from "./error-summary-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type ErrorSummaryItem = {
  /** The id of the control (of the first one for a group): the link focuses it. */
  fieldId: string;
  /** The label of the field, as the member reads it. */
  label: string;
  /** What is wrong with it, in words. */
  reason: string;
  /** Opens what hides the field (a step, a fold), called before the focus; the screen renders at once. */
  reveal?: () => void;
};

export type ErrorSummaryProps = {
  /** "2 fields need your attention", already translated. */
  title: string;
  items: readonly ErrorSummaryItem[];
  /** The focus goes to the summary when it appears: after a refusal of the form, never at the first render of a page. */
  autoFocus?: boolean;
  id?: string;
  className?: string;
};

/**
 * The summary of the errors of a form (C20): shown after a refusal, it takes the focus, and each link opens what
 * hides its field (`reveal`, rendered at once by `flushSync`) then focuses the field itself. Absent when there is
 * no error. Without script a link is the anchor of the field.
 */
export function ErrorSummary({
  title,
  items,
  autoFocus = false,
  id,
  className,
  ...rest
}: ErrorSummaryProps & PassThroughProps) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = `${id ?? "error-summary"}-title`;
  const hasItems = items.length > 0;
  useEffect(() => {
    if (autoFocus && hasItems) box.current?.focus();
  }, [autoFocus, hasItems]);
  if (!hasItems) return null;
  return (
    <div
      {...passThroughOf(rest)}
      ref={box}
      id={id}
      role="group"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={cn(ERROR_SUMMARY_CLASSES, className)}
    >
      <p id={titleId} className={ERROR_SUMMARY_TITLE_CLASSES}>
        <CircleAlertIcon
          aria-hidden="true"
          className={ERROR_SUMMARY_ICON_CLASSES}
        />
        {title}
      </p>
      <ul className={ERROR_SUMMARY_LIST_CLASSES}>
        {items.map((item) => (
          <li key={item.fieldId} className={ERROR_SUMMARY_ITEM_CLASSES}>
            <a
              href={`#${item.fieldId}`}
              className={ERROR_SUMMARY_LINK_CLASSES}
              onClick={(event) => {
                event.preventDefault();
                flushSync(() => item.reveal?.());
                document.getElementById(item.fieldId)?.focus();
              }}
            >
              {item.label}
            </a>
            <span className={ERROR_SUMMARY_REASON_CLASSES}>{item.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export type MissingListItem = {
  id: string;
  /** What is missing, as the member reads it. */
  label: string;
  /** Where to complete it: the step or the section. */
  href: string;
};

export type MissingListProps = {
  items: readonly MissingListItem[];
  /** The link, already translated: "Complete". */
  actionLabel: string;
  className?: string;
};

/** What is missing before a submission (C20): a line of alert and a link to complete it, one per missing thing; absent if none. */
export function MissingList({
  items,
  actionLabel,
  className,
  ...rest
}: MissingListProps & PassThroughProps) {
  if (items.length === 0) return null;
  return (
    <ul
      {...passThroughOf(rest)}
      className={cn(MISSING_LIST_CLASSES, className)}
    >
      {items.map((item) => (
        <li key={item.id} className={MISSING_ITEM_CLASSES}>
          <TriangleAlertIcon
            aria-hidden="true"
            className={MISSING_ICON_CLASSES}
          />
          <span className={MISSING_LABEL_CLASSES}>{item.label}</span>
          <a href={item.href} className={MISSING_LINK_CLASSES}>
            {actionLabel}
            <span className="sr-only"> {item.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icons";
import {
  DISCLOSURE_CHEVRON_CLASSES,
  DISCLOSURE_CHEVRON_DOWN_CLASSES,
  DISCLOSURE_CLASSES,
  DISCLOSURE_COUNT_CLASSES,
  DISCLOSURE_LABEL_CLASSES,
  disclosurePanelClasses,
  disclosureSummaryClasses,
  type DisclosureVariant,
} from "./disclosure-classes";

export type DisclosureProps = {
  /** `optional` "Optional, to complete later", `fold`, `danger` (the text of an error), `rare` (a pile of gestures, chevron down), `group` (a count), `change` (backoffice). */
  variant: DisclosureVariant;
  /** The text of the summary, already translated. */
  summary: string;
  /** `group`: how many things the panel holds, written after the summary. */
  count?: number;
  /** Open at the first draw; the member then closes it as any other. */
  defaultOpen?: boolean;
  /** An error inside the panel: it opens, and stays openable and closable after. */
  forceOpen?: boolean;
  id?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * A fold on the native `details` (C26): a summary of 44 px with its chevron, the content that rises in when it
 * opens. An error inside a closed fold opens it (`forceOpen`): a field in error is never hidden. The state is
 * the member's after that, so that the fold does not fight a click.
 */
export function Disclosure({
  variant,
  summary,
  count,
  defaultOpen = false,
  forceOpen = false,
  id,
  className,
  children,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen || forceOpen);
  // An error that comes while the fold is closed opens it: the change of `forceOpen` is read while rendering.
  const [forced, setForced] = useState(forceOpen);
  if (forceOpen !== forced) {
    setForced(forceOpen);
    if (forceOpen) {
      setOpen(true);
    }
  }
  const Chevron = variant === "rare" ? ChevronDownIcon : ChevronRightIcon;
  return (
    <details
      id={id}
      open={open}
      data-disclosure={variant}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn(DISCLOSURE_CLASSES, className)}
    >
      <summary className={disclosureSummaryClasses(variant)}>
        <Chevron
          aria-hidden="true"
          className={
            variant === "rare"
              ? DISCLOSURE_CHEVRON_DOWN_CLASSES
              : DISCLOSURE_CHEVRON_CLASSES
          }
        />
        <span className={DISCLOSURE_LABEL_CLASSES}>{summary}</span>
        {count === undefined ? null : (
          <span className={DISCLOSURE_COUNT_CLASSES}>{count}</span>
        )}
      </summary>
      <div className={disclosurePanelClasses(variant)}>{children}</div>
    </details>
  );
}

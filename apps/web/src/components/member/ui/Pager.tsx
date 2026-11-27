"use client";

import type { ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Button } from "./Button";
import {
  PAGER_CLASSES,
  PAGER_ICON_CLASSES,
  PAGER_NEXT_SIDE_CLASSES,
  PAGER_SIDE_CLASSES,
  PAGER_SUMMARY_CLASSES,
} from "./pager-classes";

export type PagerProps = {
  /** `pages`: numbered pages, the page is `page`; `cursor`: a list read forward and back, no page number. */
  kind: "pages" | "cursor";
  page?: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** The position, written: « Page 2 sur 5 ». Already translated. */
  summary?: string;
  /** The total at the foot of a list of the backoffice: « 128 créateurs ». Already translated. */
  total?: string;
  /** The name of the group, already translated: « Pages de résultats ». */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** The next page is being fetched: both buttons are unavailable, the width does not move. */
  busy?: boolean;
  className?: string;
};

/**
 * The foot of a list (C32): « Précédent » and « Suivant » with the position written between them (above them under
 * `form`). The last page has no « Suivant » (its place is kept) and a list whose results stop at a cap says why by
 * its screen's notice, not here. Nothing is drawn when there is nowhere to go. A group, not a `nav`: the shell owns
 * the only one (D74).
 */
export function Pager({
  kind,
  page,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  summary,
  total,
  label,
  previousLabel,
  nextLabel,
  busy = false,
  className,
}: PagerProps): ReactNode {
  if (!hasPrevious && !hasNext) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label={label}
      data-pager={kind}
      data-page={kind === "pages" ? page : undefined}
      className={
        className === undefined
          ? PAGER_CLASSES
          : `${PAGER_CLASSES} ${className}`
      }
    >
      <div className={PAGER_SIDE_CLASSES}>
        {hasPrevious ? (
          <Button
            variant="secondary"
            busy={busy}
            data-direction="previous"
            icon={<ChevronLeftIcon className={PAGER_ICON_CLASSES} />}
            onClick={onPrevious}
          >
            {previousLabel}
          </Button>
        ) : null}
      </div>
      {summary === undefined && total === undefined ? null : (
        <p className={PAGER_SUMMARY_CLASSES}>
          {summary === undefined ? null : <span>{summary}</span>}
          {total === undefined ? null : <span>{total}</span>}
        </p>
      )}
      <div className={PAGER_NEXT_SIDE_CLASSES}>
        {hasNext ? (
          <Button
            variant="secondary"
            busy={busy}
            data-direction="next"
            iconEnd={<ChevronRightIcon className={PAGER_ICON_CLASSES} />}
            onClick={onNext}
          >
            {nextLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { Button } from "./Button";
import {
  FILTERS_BODY_CLASSES,
  FILTERS_FOOT_CLASSES,
  FILTERS_GROUP_CLASSES,
  FILTERS_HEAD_CLASSES,
  FILTERS_SPACER_CLASSES,
  FILTERS_TITLE_CLASSES,
  filtersDialogClasses,
} from "./dialog-classes";
import { useModalDialog } from "./use-modal-dialog";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type FiltersDialogProps = {
  open: boolean;
  /** Asked by the cross, `Échap` and the backdrop: the draft is given up, nothing is applied. */
  onClose: () => void;
  /** The name of the dialog, already translated. */
  title: string;
  /** The groups of criteria, one node each; a hairline separates them. They hold the draft, never the result. */
  groups: ReactNode[];
  /** How many criteria the draft holds: « Tout effacer » has nothing to do at zero. */
  activeCount: number;
  /** The only gesture that applies: « Voir les 24 résultats ». The page then closes the dialog. */
  onApply: () => void;
  onClear: () => void;
  /** Already translated, with the count the page knows: « Voir les 24 résultats ». */
  applyLabel: string;
  clearLabel: string;
  /** The name of the cross. */
  closeLabel: string;
  id?: string;
};

/**
 * The dialog of all the criteria (C28), on the native `dialog`: a head and a foot that stay, a body that scrolls, the
 * whole screen under 768 px. Nothing applies before « Voir les … » (`onApply`): the cross, `Échap` and the backdrop give
 * the draft up. The groups are drawn anew at each opening, so that what a group keeps in itself does not outlive a
 * closing; the page owns the draft that its groups read and resets it in `onClose`.
 */
export function FiltersDialog({
  open,
  onClose,
  title,
  groups,
  activeCount,
  onApply,
  onClear,
  applyLabel,
  clearLabel,
  closeLabel,
  id,
  ...rest
}: FiltersDialogProps & PassThroughProps) {
  const { titleId, titleRef, dialogProps } = useModalDialog({
    open,
    onClose,
    dismissible: true,
  });
  // The opening is read while rendering: the body is keyed by the number of openings, so that each one starts clean.
  const [openings, setOpenings] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpenings(openings + 1);
    }
  }
  const nothingToClear = activeCount === 0;
  return (
    <dialog
      {...passThroughOf(rest)}
      id={id}
      data-dialog="filters"
      {...dialogProps}
      className={filtersDialogClasses()}
    >
      <div className={FILTERS_HEAD_CLASSES}>
        <Button
          variant="text"
          aria-label={closeLabel}
          onClick={onClose}
          icon={<CloseIcon className="size-(--size-icon-md)" />}
        />
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className={FILTERS_TITLE_CLASSES}
        >
          {title}
        </h2>
        <span aria-hidden="true" className={FILTERS_SPACER_CLASSES} />
      </div>
      <div key={openings} className={FILTERS_BODY_CLASSES}>
        {groups.map((group, index) => (
          <div key={index} className={FILTERS_GROUP_CLASSES}>
            {group}
          </div>
        ))}
      </div>
      <div className={FILTERS_FOOT_CLASSES}>
        <Button
          variant="text"
          aria-disabled={nothingToClear ? true : undefined}
          onClick={nothingToClear ? undefined : onClear}
        >
          {clearLabel}
        </Button>
        <Button onClick={onApply}>{applyLabel}</Button>
      </div>
    </dialog>
  );
}

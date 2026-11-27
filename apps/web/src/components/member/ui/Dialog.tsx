"use client";

import type { ReactNode, RefObject } from "react";
import {
  DIALOG_ACTIONS_CLASSES,
  DIALOG_BODY_CLASSES,
  DIALOG_CONTENT_CLASSES,
  DIALOG_TITLE_CLASSES,
  dialogClasses,
  type DialogSize,
} from "./dialog-classes";
import { useModalDialog } from "./use-modal-dialog";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type DialogProps = {
  /** The page owns it: the dialog is modal while it is true, and the focus goes back to the opener when it turns false. */
  open: boolean;
  /** Asked by `Échap` and by the click on the backdrop (never while `dismissible` is false); the page then turns `open` false. */
  onClose: () => void;
  /** The name of the dialog, already translated: its title, read when it opens. */
  title: string;
  /** `confirm` (30 rem) by default, `wide` (34 rem). */
  size?: DialogSize;
  children?: ReactNode;
  /** The buttons, already built: the primary action last. */
  actions?: ReactNode;
  /** The element that takes the focus at the opening; else an `autofocus` one inside; else the title. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** False while a request runs: neither `Échap` nor the backdrop closes the dialog. */
  dismissible?: boolean;
  id?: string;
};

/**
 * The dialog of confirmations, of identity and of help (C27), on the native `dialog`: modal, the focus held inside and
 * given back to the opener, `Échap` and the backdrop ask the page to close. It never acts by itself: what the
 * actions do is the page's. The content stays in the page while the dialog is closed (it is the page's state).
 */
export function Dialog({
  open,
  onClose,
  title,
  size = "confirm",
  children,
  actions,
  initialFocus,
  dismissible = true,
  id,
  ...rest
}: DialogProps & PassThroughProps) {
  const { titleId, titleRef, dialogProps } = useModalDialog({
    open,
    onClose,
    dismissible,
    initialFocus,
  });
  return (
    <dialog
      {...passThroughOf(rest)}
      id={id}
      data-dialog=""
      {...dialogProps}
      className={dialogClasses(size)}
    >
      <div className={DIALOG_BODY_CLASSES}>
        <h2
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className={DIALOG_TITLE_CLASSES}
        >
          {title}
        </h2>
        {children === undefined ? null : (
          <div className={DIALOG_CONTENT_CLASSES}>{children}</div>
        )}
        {actions === undefined ? null : (
          <div className={DIALOG_ACTIONS_CLASSES}>{actions}</div>
        )}
      </div>
    </dialog>
  );
}

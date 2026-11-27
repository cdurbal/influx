"use client";

// What the native `dialog` of C27 and C28 shares (docs/mvp/22-refonte-ux-ui/02a C27, 04 §4): the page owns `open`,
// the element shows it as a modal (`showModal`, which holds the focus inside and gives it back to the opener), the
// focus goes first to the element asked for, else to an `autofocus` one, else to the title; `Échap` and the click
// on the backdrop ask the page to close, which may refuse (`dismissible` false while a request runs).
// Chromium stops honouring `preventDefault` on `cancel` when no new user activation came since it last did, so a
// dialog that must stay refuses `Échap` at the `keydown`, and shows itself again if the element closes all the same.
import {
  useEffect,
  useId,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type SyntheticEvent,
} from "react";

type ModalDialogOptions = {
  open: boolean;
  onClose: () => void;
  /** False while a request runs: neither `Échap` nor the backdrop closes it. */
  dismissible: boolean;
  /** The element that takes the focus at the opening; else an `autofocus` one; else the title. */
  initialFocus?: RefObject<HTMLElement | null>;
};

export function useModalDialog({
  open,
  onClose,
  dismissible,
  initialFocus,
}: ModalDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  // The native `close` event comes after the page has closed the dialog itself: it must not ask the page again.
  const latest = useRef({ open, onClose, dismissible });
  // What had the focus inside: a native close has already given it away when it is heard.
  const lastFocus = useRef<HTMLElement | null>(null);
  // A press that began inside the dialog and ended on the backdrop (a text selection) is not a click on the backdrop.
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    latest.current = { open, onClose, dismissible };
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      const target =
        initialFocus?.current ??
        (dialog.querySelector("[autofocus]") === null
          ? titleRef.current
          : null);
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  // `Échap` never closes the element by itself: the page decides, so that a dialog that must stay stays, and the
  // one that closes does so through its own `open` (the focus then goes back to the opener).
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (dismissible) {
      onClose();
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape" && !latest.current.dismissible) {
      event.preventDefault();
    }
  };
  const onFocus = (event: FocusEvent<HTMLDialogElement>) => {
    lastFocus.current = event.target;
  };
  const onMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  };
  // The dialog has no padding of its own: what it holds fills it, so a click that lands on the element is a click
  // on its backdrop.
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (
      event.target === event.currentTarget &&
      pressedOnBackdrop.current &&
      dismissible
    ) {
      onClose();
    }
  };
  const onNativeClose = () => {
    if (!latest.current.open) {
      return;
    }
    if (latest.current.dismissible) {
      latest.current.onClose();
      return;
    }
    const dialog = dialogRef.current;
    if (dialog === null || dialog.open) {
      return;
    }
    // Read before `showModal`, whose own focusing steps move the focus.
    const held = lastFocus.current;
    dialog.showModal();
    (held !== null && dialog.contains(held) ? held : titleRef.current)?.focus();
  };

  return {
    titleId,
    dialogProps: {
      ref: dialogRef,
      "aria-labelledby": titleId,
      onCancel,
      onKeyDown,
      onFocus,
      onMouseDown,
      onClick,
      onClose: onNativeClose,
    },
    titleRef,
  };
}

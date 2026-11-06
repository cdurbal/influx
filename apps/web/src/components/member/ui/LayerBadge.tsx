"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { cn } from "@/components/ui/class-names";
import { EyeOffIcon, GlobeIcon, LockIcon } from "@/components/ui/icons";
import { layerBadgeClasses, type ProfileLayer } from "./layer-badge-classes";

const LAYER_ICONS = {
  public: GlobeIcon,
  revealed: LockIcon,
  internal: EyeOffIcon,
} as const;

/** The gutter of a phone (17 §1.7): the message stops there rather than leaving the screen. */
const VIEWPORT_MARGIN_PX = 16;

/** The hit area of the icon, wider than what it draws (`size-touch-target`). */
const ICON_TRIGGER_CLASSES = cn(
  "relative inline-flex cursor-help rounded-pill",
  "before:absolute before:top-1/2 before:left-1/2 before:size-(--size-touch-target)",
  "before:-translate-x-1/2 before:-translate-y-1/2",
);

const MESSAGE_CLASSES = cn(
  "absolute top-full left-0 z-(--z-overlay) w-max max-w-(--size-layer-badge-message) pt-1",
);

const MESSAGE_TEXT_CLASSES = cn(
  "block rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-raised",
  "px-3 py-2 text-sm font-regular text-text-primary shadow-md",
);

type LayerBadgeProps = {
  layer: ProfileLayer;
  /** The layer, written: `brandProfile.layer.<layer>` (06 RG84). */
  label: string;
  /** For the `aria-describedby` of the field it labels. */
  id?: string;
  className?: string;
};

function contentWidthOf(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    element.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight)
  );
}

/** The width of the text on one line, whether it is shown or clipped by the icon's box. */
function textWidthOf(badge: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(badge.lastChild as Node);
  return range.getBoundingClientRect().width;
}

/** True when the whole badge does not fit on one line of the width its parent gives it. */
function useTextOverflows(
  rootRef: RefObject<HTMLSpanElement | null>,
  badgeRef: RefObject<HTMLSpanElement | null>,
): boolean {
  const [overflows, setOverflows] = useState(false);
  const chromeWidth = useRef(0);

  // Before paint: a badge never shows on two lines, not even for one frame.
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement;
    const badge = badgeRef.current;
    if (!parent || !badge) {
      return;
    }
    // A measure late on the change of form would read the icon's box as the whole badge's.
    let current = true;
    const measure = () => {
      if (!current) {
        return;
      }
      const textWidth = textWidthOf(badge);
      if (!overflows) {
        // Icon, gap, padding and border: known only while the whole badge is drawn.
        chromeWidth.current = badge.getBoundingClientRect().width - textWidth;
      }
      setOverflows(textWidth + chromeWidth.current > contentWidthOf(parent));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    // The text changes width when the font arrives, which resizes nothing else.
    void document.fonts.ready.then(measure);
    return () => {
      current = false;
      observer.disconnect();
    };
  }, [rootRef, badgeRef, overflows]);

  return overflows;
}

/**
 * The message of the icon alone: on hover, on keyboard focus, on a tap. It stays while the pointer is
 * on it, and Escape or a tap elsewhere closes it (WCAG 1.4.13).
 */
function useMessage(rootRef: RefObject<HTMLSpanElement | null>) {
  const [open, setOpen] = useState(false);
  const hovered = useRef(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, rootRef]);

  const onMousePointer = (event: PointerEvent, next: boolean) => {
    // A finger "enters" just before its tap, which would then close what it has just opened.
    if (event.pointerType === "mouse") {
      hovered.current = next;
      setOpen(next);
    }
  };

  return {
    open,
    rootProps: {
      onPointerEnter: (event: PointerEvent) => onMousePointer(event, true),
      onPointerLeave: (event: PointerEvent) => onMousePointer(event, false),
    },
    triggerProps: {
      // A click under the mouse confirms what the hover has shown; a tap opens and closes.
      onClick: () => setOpen((current) => hovered.current || !current),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen((current) => !current);
        }
      },
      onFocus: (event: { target: Element }) => {
        // Not on a tap or a click: their own `click` opens the message, and would close it at once.
        if (event.target.matches(":focus-visible")) {
          setOpen(true);
        }
      },
      onBlur: () => setOpen(false),
    },
  };
}

/** Keeps the message on the screen: an icon at the end of a line would push it past the edge. */
function useMessageInsideViewport(
  messageRef: RefObject<HTMLSpanElement | null>,
  open: boolean,
): void {
  useLayoutEffect(() => {
    const message = messageRef.current;
    if (!open || !message) {
      return;
    }
    const limit = document.documentElement.clientWidth - VIEWPORT_MARGIN_PX;
    const excess = message.getBoundingClientRect().right - limit;
    if (excess > 0) {
      message.style.left = `${-excess}px`;
    }
  }, [messageRef, open]);
}

/**
 * Who sees a field of the profile (06 RG62, CA39): everyone, creators after an introduction, or the
 * INFLUX team only. An icon AND the text: the green of the middle layer never carries the information
 * alone (RG85, CA47). When the text does not fit on one line, the icon stays alone and the text comes
 * on hover, focus or tap (17 §4.2); it remains the name of the icon, so a screen reader always reads it.
 */
export function LayerBadge({ layer, label, id, className }: LayerBadgeProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const messageRef = useRef<HTMLSpanElement>(null);
  const iconOnly = useTextOverflows(rootRef, badgeRef);
  const { open, rootProps, triggerProps } = useMessage(rootRef);
  useMessageInsideViewport(messageRef, open && iconOnly);
  const Icon = LAYER_ICONS[layer];
  const badge = (
    <span ref={badgeRef} className={layerBadgeClasses(layer, iconOnly)}>
      <Icon aria-hidden="true" className="size-(--size-icon-sm) shrink-0" />
      {label}
    </span>
  );
  if (!iconOnly) {
    return (
      <span
        ref={rootRef}
        id={id}
        className={cn("inline-flex self-start", className)}
      >
        {badge}
      </span>
    );
  }
  return (
    <span
      ref={rootRef}
      id={id}
      data-layer-icon-only=""
      className={cn("relative inline-flex shrink-0 self-start", className)}
      {...rootProps}
    >
      {/* Not a <button>: a read-only form is a disabled fieldset, and who sees a field stays readable. */}
      <span
        role="button"
        tabIndex={0}
        className={ICON_TRIGGER_CLASSES}
        {...triggerProps}
      >
        {badge}
      </span>
      {open ? (
        // The text is already the name of the icon: read once by a screen reader.
        <span ref={messageRef} aria-hidden="true" className={MESSAGE_CLASSES}>
          <span className={MESSAGE_TEXT_CLASSES}>{label}</span>
        </span>
      ) : null}
    </span>
  );
}

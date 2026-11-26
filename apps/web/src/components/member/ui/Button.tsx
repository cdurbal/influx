"use client";

import type {
  ComponentPropsWithRef,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
} from "react";
import { cn } from "@/components/ui/class-names";
import { CheckIcon } from "@/components/ui/icons";
import {
  BUTTON_ADDED_ICON_CLASSES,
  BUTTON_ICON_CLASSES,
  BUTTON_LABEL_LAYER_CLASSES,
  BUTTON_LABEL_STACK_CLASSES,
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./button-classes";

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A decorative icon before the label. */
  icon?: ReactNode;
  /** A decorative icon after the label. */
  iconEnd?: ReactNode;
  /** The action runs: the button is unavailable, `aria-busy`, and keeps its width (`busyLabel` swaps the label). */
  busy?: boolean;
  /** The label while busy; the width is that of the wider of the two labels, in both states. */
  busyLabel?: string;
  /** The id of the text that says why the button is unavailable: it makes the button unavailable and describes it. */
  disabledReason?: string;
  /** A toggle: the state of `aria-pressed`. */
  pressed?: boolean;
  /** The result of the action is done: a check fades in, the contour of a secondary button calms down. */
  added?: boolean;
  /** Stretches the button to the width of its container (mobile stacks). */
  block?: boolean;
};

type ButtonAsButtonProps = ButtonOwnProps &
  Omit<ComponentPropsWithRef<"button">, "type" | keyof ButtonOwnProps> & {
    type?: "button" | "submit";
    href?: undefined;
  };

type ButtonAsLinkProps = ButtonOwnProps &
  Omit<ComponentPropsWithRef<"a">, keyof ButtonOwnProps> & { href: string };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

/** An unavailable control runs nothing, and a link goes nowhere (the button stays focusable, 17 §1.3 rule 4). */
function guarded<Element extends HTMLElement>(
  unavailable: boolean,
  handler: MouseEventHandler<Element> | undefined,
): MouseEventHandler<Element> | undefined {
  if (!unavailable) {
    return handler;
  }
  return (event: MouseEvent<Element>) => {
    event.preventDefault();
  };
}

type LabelProps = Pick<
  ButtonOwnProps,
  "icon" | "iconEnd" | "busy" | "busyLabel" | "added"
> & { children?: ReactNode };

/** Icon, label (two stacked layers when it changes while busy, so that the width never moves), icon. */
function ButtonContent({
  icon,
  iconEnd,
  busy = false,
  busyLabel,
  added = false,
  children,
}: LabelProps) {
  const lead = added ? (
    <CheckIcon aria-hidden="true" className={BUTTON_ADDED_ICON_CLASSES} />
  ) : icon ? (
    <span aria-hidden="true" className={BUTTON_ICON_CLASSES}>
      {icon}
    </span>
  ) : null;
  return (
    <>
      {lead}
      {busyLabel === undefined ? (
        children
      ) : (
        <span className={BUTTON_LABEL_STACK_CLASSES}>
          <span className={cn(BUTTON_LABEL_LAYER_CLASSES, busy && "invisible")}>
            {children}
          </span>
          <span
            aria-hidden={busy ? undefined : true}
            className={cn(BUTTON_LABEL_LAYER_CLASSES, !busy && "invisible")}
          >
            {busyLabel}
          </span>
        </span>
      )}
      {iconEnd ? (
        <span aria-hidden="true" className={BUTTON_ICON_CLASSES}>
          {iconEnd}
        </span>
      ) : null}
    </>
  );
}

/** The ids that describe a button: its own, then the one that says why it is unavailable. */
function describedBy(
  own: string | undefined,
  reason: string | undefined,
): string | undefined {
  const ids = [own, reason].filter(Boolean).join(" ");
  return ids === "" ? undefined : ids;
}

/**
 * The button of the connected spaces (20 §11.8, C10). Unavailable means `aria-disabled`, never
 * `disabled`: the button stays focusable and its explanation sits next to it (17 §1.3 rule 4). With
 * an `href` it is a link of the same look; `busy` and `disabledReason` make it unavailable.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    icon,
    iconEnd,
    busy = false,
    busyLabel,
    disabledReason,
    pressed,
    added = false,
    block = false,
    className,
    children,
    onClick,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    ...rest
  } = props;
  const unavailable = busy || disabledReason !== undefined;
  const common = {
    className: cn(
      buttonClasses(variant, size, added),
      block && "w-full",
      className,
    ),
    "aria-disabled": unavailable ? true : ariaDisabled,
    "aria-busy": busy ? true : undefined,
    "aria-describedby":
      disabledReason === undefined
        ? ariaDescribedBy
        : describedBy(ariaDescribedBy, disabledReason),
  };
  const content = (
    <ButtonContent
      icon={icon}
      iconEnd={iconEnd}
      busy={busy}
      busyLabel={busyLabel}
      added={added}
    >
      {children}
    </ButtonContent>
  );
  if (rest.href !== undefined) {
    return (
      <a
        {...rest}
        {...common}
        href={rest.href}
        onClick={guarded(
          unavailable,
          onClick as MouseEventHandler<HTMLAnchorElement> | undefined,
        )}
      >
        {content}
      </a>
    );
  }
  const { type = "button", ...buttonRest } = rest;
  return (
    <button
      {...buttonRest}
      {...common}
      type={type}
      aria-pressed={pressed}
      onClick={guarded(
        unavailable,
        onClick as MouseEventHandler<HTMLButtonElement> | undefined,
      )}
    >
      {content}
    </button>
  );
}

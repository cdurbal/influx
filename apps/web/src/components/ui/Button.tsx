import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "./class-names";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "secondaryInverse"
  | "text"
  | "textInverse"
  | "icon";

export type ButtonSize = "md" | "lg";

type ButtonProps = Omit<ComponentPropsWithRef<"button">, "type"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches the button to the width of its container (mobile stacks). */
  fullWidth?: boolean;
  /** Only "submit" is never needed in the mockup: every button is type="button" (02 §2.2). */
  type?: "button";
  children: ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: cn(
    "rounded-pill bg-action-primary-bg px-inset-button-x py-inset-button-y text-text-on-action",
    "hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active",
  ),
  secondary: cn(
    "rounded-pill border-(length:--border-width-thick) border-action-secondary-border bg-action-secondary-bg",
    "px-inset-button-x py-inset-button-y text-text-primary",
    "hover:bg-action-secondary-bg-hover active:bg-action-secondary-bg-active",
  ),
  secondaryInverse: cn(
    "rounded-pill border-(length:--border-width-thick) border-action-secondary-inverse-border bg-action-secondary-bg",
    "px-inset-button-x py-inset-button-y text-text-inverse",
    "hover:bg-action-inverse-bg hover:text-text-primary",
  ),
  text: cn(
    "min-h-(--size-touch-target) rounded-md px-3 text-text-primary",
    "hover:bg-action-secondary-bg-hover",
  ),
  textInverse: cn(
    "min-h-(--size-touch-target) rounded-md px-3 text-text-inverse",
    "hover:bg-surface-inverse-raised",
  ),
  icon: cn(
    "size-(--size-touch-target) shrink-0 rounded-pill border-(length:--border-width-thin) border-border-strong",
    "bg-surface-page text-text-primary hover:bg-action-secondary-bg-hover",
  ),
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: cn("min-h-(--size-button-md)"),
  lg: cn("min-h-(--size-button-lg)"),
};

/**
 * The only button of the page (01 §7). Always a <button type="button">: no link, no submit,
 * never disabled (01 §11 rule 4). Without onClick it has no effect (CA7).
 */
export function Button({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 text-center font-medium leading-snug transition-colors",
        VARIANT_CLASSES[variant],
        variant !== "icon" &&
          variant !== "text" &&
          variant !== "textInverse" &&
          SIZE_CLASSES[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

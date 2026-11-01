import type { ComponentPropsWithRef } from "react";
import { cn } from "@/components/ui/class-names";
import {
  memberButtonClasses,
  type MemberButtonSize,
  type MemberButtonVariant,
} from "./button-classes";

type MemberButtonProps = Omit<ComponentPropsWithRef<"button">, "type"> & {
  variant?: MemberButtonVariant;
  size?: MemberButtonSize;
  /** Stretches the button to the width of its container (mobile stacks). */
  fullWidth?: boolean;
  type?: "button" | "submit";
};

/**
 * The button of the connected spaces (20 §11.8). Unavailable means `aria-disabled`, never
 * `disabled`: the button stays focusable and its explanation sits next to it (17 §1.3 rule 4).
 */
export function MemberButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  type = "button",
  className,
  children,
  ...rest
}: MemberButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cn(
        memberButtonClasses(variant, size),
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}

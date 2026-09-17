import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import {
  BUTTON_BASE_CLASSES,
  SIZE_CLASSES,
  VARIANT_CLASSES,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
import { cn } from "./class-names";

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretches the link to the width of its container (mobile stacks). */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A `<Link>` (src/i18n/navigation.ts) styled exactly like `Button`, for real in-app navigation
 * (account creation, login) introduced alongside the marketing mockup (docs/landing-page/00-cadrage.md §6).
 */
export function LinkButton({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      {...rest}
      className={cn(
        BUTTON_BASE_CLASSES,
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
    </Link>
  );
}

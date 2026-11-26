import type { AriaAttributes, MouseEventHandler, ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { ChevronRightIcon, HeartIcon } from "@/components/ui/icons";
import {
  ACTION_LINK_HEART_CLASSES,
  actionLinkChevronClasses,
  actionLinkClasses,
  type ActionLinkVariant,
} from "./action-link-classes";

export type ActionLinkProps = AriaAttributes & {
  /** `inline` by default: underlined; `go`: a chevron; `save`: a heart and `aria-pressed`. */
  variant?: ActionLinkVariant;
  /** A link when given, a button otherwise. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  /** The state of a `save`, as `aria-pressed`. */
  pressed?: boolean;
  /** 14 px instead of 16 (a `go` in a dense row). */
  dense?: boolean;
  /** The text read after the label of a link that opens in a new tab (already translated): its presence opens it. */
  external?: string;
  id?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * A link of action (C11), alone on its line: the head and return links of a page, the meta of the
 * wizard. Its touch zone is 44 × 44 px by a transparent pseudo-element, the ring on the drawn element
 * (RUB-B §3). Never inside a sentence, where the exception of 2.5.8 applies and the text link of the
 * page serves.
 */
export function ActionLink({
  variant = "inline",
  href,
  onClick,
  pressed,
  dense = false,
  external,
  className,
  children,
  ...rest
}: ActionLinkProps) {
  const classes = cn(actionLinkClasses(variant, dense), className);
  const content = (
    <>
      {variant === "save" ? (
        <HeartIcon aria-hidden="true" className={ACTION_LINK_HEART_CLASSES} />
      ) : null}
      {children}
      {external === undefined ? null : (
        <span className="sr-only"> {external}</span>
      )}
      {variant === "go" ? (
        <ChevronRightIcon
          aria-hidden="true"
          className={actionLinkChevronClasses(dense)}
        />
      ) : null}
    </>
  );
  if (href !== undefined) {
    return (
      <a
        {...rest}
        href={href}
        className={classes}
        onClick={onClick}
        {...(external === undefined
          ? {}
          : { target: "_blank", rel: "noopener noreferrer" })}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      {...rest}
      type="button"
      className={classes}
      onClick={onClick}
      aria-pressed={pressed}
    >
      {content}
    </button>
  );
}

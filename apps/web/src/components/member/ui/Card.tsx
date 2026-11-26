import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  CARD_LINK_CLASSES,
  cardClasses,
  type CardVariant,
} from "./card-classes";
import { CARD_TITLE } from "./heading-classes";

type CardBaseProps = {
  /** The element of the card (a `li` in a list, a `section` or an `article` in a page): a `div` by default. */
  as?: "div" | "section" | "article" | "li";
  className?: string;
  children?: ReactNode;
};

type CardLinkProps = CardBaseProps & {
  variant: Extract<CardVariant, "link">;
  /** The one target of the card: the stretched link of its title. */
  href: string;
  title: string;
};

type CardPlainProps = CardBaseProps & {
  variant?: Exclude<CardVariant, "link">;
  href?: undefined;
  title?: undefined;
};

export type CardProps = CardLinkProps | CardPlainProps;

/**
 * A flat card (C04): surface, hairline, 16 px corners, no shadow at rest (20 §11.8). `compact` and
 * `box` are its two other paddings; `link` makes the whole card the click zone of one link, which
 * lifts on hover. Never inside another card, never for a single line of text.
 */
export function Card({
  variant = "default",
  as: Element = "div",
  href,
  title,
  className,
  children,
}: CardProps) {
  if (href !== undefined && title !== undefined) {
    return (
      <Element className={cn(cardClasses("link"), className)}>
        <p className={CARD_TITLE}>
          <a href={href} className={CARD_LINK_CLASSES}>
            {title}
          </a>
        </p>
        {children}
      </Element>
    );
  }
  return (
    <Element className={cn(cardClasses(variant), className)}>
      {children}
    </Element>
  );
}

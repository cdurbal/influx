import type { ComponentType } from "react";
import { cn } from "@/components/ui/class-names";
import { BadgeCheckIcon } from "@/components/ui/icons";
import {
  KEY_FIGURE_ICON_CLASSES,
  KEY_FIGURE_ICON_ROOM_CLASSES,
  KEY_FIGURE_VERIFIED_ICON_CLASSES,
  KEY_FIGURE_VERIFIED_TERM_CLASSES,
  KEY_FIGURE_VERIFIED_VALUE_CLASSES,
  keyFiguresClasses,
  type KeyFiguresVariant,
} from "./key-figures-classes";

/** What a lucide icon of `icons.ts` is, as far as a figure is concerned: it takes a class, it is decorative. */
type KeyFigureIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: "true";
}>;

type KeyFigureItem = {
  label: string;
  /** The value as the screen writes it: a range before the reveal, or « Not provided » when there is none. */
  value: string;
  /** A line under the value: a level, « per publication ». */
  sub?: string;
  /** An essential's own icon, of `icons.ts`. */
  icon?: KeyFigureIcon;
  /** In `figures`: the cell that says what INFLUX checked, with its own blue icon. */
  verified?: boolean;
};

export type KeyFiguresProps = {
  variant: KeyFiguresVariant;
  items: KeyFigureItem[];
  className?: string;
};

/**
 * The key figures of a reading (C35): pairs of a `dl` that holds nothing else (X9), in four columns, two by two or
 * three. The values arrive written: a range before the reveal, never an exact count computed here (D61), and the
 * words of a missing value are the screen's. The verified cell is told by its words, the blue icon beside them.
 */
export function KeyFigures({ variant, items, className }: KeyFiguresProps) {
  const classes = keyFiguresClasses(variant);
  return (
    <dl data-key-figures={variant} className={cn(classes.list, className)}>
      {items.map((item, index) => {
        const verified = variant === "figures" && item.verified === true;
        const Icon = variant === "essentials" ? item.icon : undefined;
        return (
          <div
            key={`${index}:${item.label}`}
            data-key-figure={verified ? "verified" : ""}
            className={cn(
              classes.cell,
              !verified && classes.pair,
              Icon !== undefined && KEY_FIGURE_ICON_ROOM_CLASSES,
            )}
          >
            <dt
              className={
                verified ? KEY_FIGURE_VERIFIED_TERM_CLASSES : classes.term
              }
            >
              {verified ? (
                <BadgeCheckIcon
                  aria-hidden="true"
                  className={KEY_FIGURE_VERIFIED_ICON_CLASSES}
                />
              ) : null}
              {Icon === undefined ? null : (
                <Icon aria-hidden="true" className={KEY_FIGURE_ICON_CLASSES} />
              )}
              {item.label}
            </dt>
            <dd
              className={
                verified ? KEY_FIGURE_VERIFIED_VALUE_CLASSES : classes.value
              }
            >
              {item.value}
              {item.sub === undefined ? null : (
                <span className={classes.sub}>{item.sub}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

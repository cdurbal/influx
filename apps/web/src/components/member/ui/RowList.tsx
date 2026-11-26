import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  ChevronRightIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import {
  ROW_LINK_CLASSES,
  ROW_TONE_ICON_CLASSES,
  rowHasChevron,
  rowListClasses,
  rowParts,
  type RowListVariant,
  type RowTone,
} from "./row-list-classes";

export type RowListItem = {
  /** Stable key of the row. */
  id: string;
  /** Where the row leads: the link of its title is stretched over the whole row. */
  href?: string;
  title: string;
  /** A sentence or the chips of the row, under the title. */
  sub?: ReactNode;
  /** The state or the facts of the row, already translated: the tone never says it alone. */
  meta?: ReactNode;
  /** Before the text: a logo, thumbnails, a decorative icon. */
  media?: ReactNode;
  /** The end of the row: a date. */
  end?: ReactNode;
  /** A button or a link inside the row; it stands above the stretched link. */
  action?: ReactNode;
  /** `done` or `attention`: a check or a warning sign before the title, beside the words of `meta`. */
  tone?: RowTone;
  /** The row the member is on: a ground and a contour (`aria-current`, never `page`: the shell holds it). */
  current?: boolean;
};

export type RowListProps = {
  /** The shape of the rows; the eight forms of the mockups are fields of these (RUB-B §4). */
  variant: RowListVariant;
  items: RowListItem[];
  /** The name of the list, already translated ("Your campaigns"). */
  label: string;
  id?: string;
  className?: string;
};

const TONE_ICONS = {
  done: CircleCheckIcon,
  attention: TriangleAlertIcon,
};

/** The title of a row: its tone sign, then the text, a link when the row leads somewhere. */
function RowTitle({
  item,
  className,
}: {
  item: RowListItem;
  className: string;
}) {
  const ToneIcon = item.tone === undefined ? null : TONE_ICONS[item.tone];
  const text =
    item.href === undefined ? (
      item.title
    ) : (
      <a
        href={item.href}
        aria-current={item.current ? "true" : undefined}
        className={ROW_LINK_CLASSES}
      >
        {item.title}
      </a>
    );
  return (
    <p
      className={cn(className, ToneIcon !== null && "flex items-center gap-2")}
    >
      {ToneIcon !== null && item.tone !== undefined ? (
        <ToneIcon
          aria-hidden="true"
          className={ROW_TONE_ICON_CLASSES[item.tone]}
        />
      ) : null}
      {text}
    </p>
  );
}

/**
 * A list of rows to manage and to go through (C06): the title of a row, its sub line, its state and its
 * end, a chevron when it leads somewhere. The link of the title covers the row and its ring is drawn
 * inside it; an action in the row stays reachable above the link. A `ul` of the page, never a `nav`
 * (the shell's is the one landmark of navigation).
 */
export function RowList({
  variant,
  items,
  label,
  id,
  className,
}: RowListProps) {
  return (
    <ul
      id={id}
      aria-label={label}
      className={cn(rowListClasses(variant), className)}
    >
      {items.map((item) => {
        const parts = rowParts(
          variant,
          {
            meta: item.meta !== undefined,
            end: item.end !== undefined,
            sub: item.sub !== undefined,
          },
          { linked: item.href !== undefined, current: item.current === true },
        );
        const hasTrail = item.meta !== undefined || item.end !== undefined;
        return (
          <li
            key={item.id}
            aria-current={
              item.current && item.href === undefined ? "true" : undefined
            }
            className={parts.row}
          >
            {item.media === undefined ? null : (
              <div className={parts.media}>{item.media}</div>
            )}
            <div className={parts.body}>
              <div className={parts.text}>
                <RowTitle item={item} className={parts.title} />
                {item.sub === undefined ? null : (
                  <div className={parts.sub}>{item.sub}</div>
                )}
              </div>
              {hasTrail ? (
                <div className={parts.trail}>
                  {item.meta === undefined ? null : (
                    <div className={parts.meta || undefined}>{item.meta}</div>
                  )}
                  {item.end === undefined ? null : (
                    <div className={parts.end || undefined}>{item.end}</div>
                  )}
                </div>
              ) : null}
            </div>
            {item.action === undefined ? null : (
              <div className={parts.action}>{item.action}</div>
            )}
            {item.href !== undefined && rowHasChevron(variant) ? (
              <ChevronRightIcon aria-hidden="true" className={parts.chevron} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

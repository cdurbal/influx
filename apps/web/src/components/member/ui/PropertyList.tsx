import { Fragment, type ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  PROPERTY_COLUMNS_CLASSES,
  PROPERTY_LABEL_CLASSES,
  PROPERTY_SUB_CLASSES,
  propertyListClasses,
  propertyValueClasses,
  type PropertyLabelWidth,
  type PropertySize,
} from "./property-list-classes";

export type PropertyListItem = {
  label: string;
  /** The value, already formatted and translated. */
  value: ReactNode;
  /** No value yet: the line shows `emptyLabel` (or the `value` as written) in the tertiary text. */
  empty?: boolean;
  /** A line under the value. */
  sub?: ReactNode;
  /** Beside the value: a badge or a word such as "Modified". */
  mark?: ReactNode;
};

export type PropertyListProps = {
  items: PropertyListItem[];
  /** 14 px by default (`sm`); `md`: 16 px, the reading sheet; `xs`: 12 px, the dense column of the backoffice. */
  size?: PropertySize;
  /** The width of the labels by role (03 §3.3); the standard width when absent. */
  labelWidth?: PropertyLabelWidth;
  /** `2`: from 1 280 px two lists side by side, the first half of the lines then the second. */
  columns?: 1 | 2;
  /** What an empty value says, already translated ("Not provided"). */
  emptyLabel?: string;
  id?: string;
  className?: string;
};

/** The lines of one `dl`: a label, then its value, in the order they are given. */
function PropertyLines({
  items,
  size,
  labelWidth,
  emptyLabel,
  id,
  className,
}: Pick<
  PropertyListProps,
  "items" | "size" | "labelWidth" | "emptyLabel" | "id" | "className"
>) {
  return (
    <dl
      id={id}
      className={cn(propertyListClasses(size, labelWidth), className)}
    >
      {items.map((item, index) => {
        const empty = item.empty === true;
        return (
          <Fragment key={`${index}:${item.label}`}>
            <dt className={PROPERTY_LABEL_CLASSES}>{item.label}</dt>
            <dd className={propertyValueClasses(empty)}>
              <span className="min-w-0">
                {empty && emptyLabel !== undefined ? emptyLabel : item.value}
              </span>
              {item.mark === undefined ? null : item.mark}
              {item.sub === undefined ? null : (
                <div className={PROPERTY_SUB_CLASSES}>{item.sub}</div>
              )}
            </dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

/**
 * A label beside its value (C07): the facts of an object, read and not edited. A real `dl`, its labels and
 * values its only children, so a screen reader announces the pairs. An empty value is written in the
 * tertiary text, never left blank. `columns={2}` splits the lines into two lists, side by side from 1 280 px.
 */
export function PropertyList({
  items,
  size,
  labelWidth,
  columns,
  emptyLabel,
  id,
  className,
}: PropertyListProps) {
  if (columns === 2) {
    const half = Math.ceil(items.length / 2);
    return (
      <div id={id} className={cn(PROPERTY_COLUMNS_CLASSES, className)}>
        <PropertyLines
          items={items.slice(0, half)}
          size={size}
          labelWidth={labelWidth}
          emptyLabel={emptyLabel}
        />
        <PropertyLines
          items={items.slice(half)}
          size={size}
          labelWidth={labelWidth}
          emptyLabel={emptyLabel}
        />
      </div>
    );
  }
  return (
    <PropertyLines
      items={items}
      size={size}
      labelWidth={labelWidth}
      emptyLabel={emptyLabel}
      id={id}
      className={className}
    />
  );
}

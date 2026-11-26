// Classes of the list of properties of the connected spaces (docs/mvp/22-refonte-ux-ui/02a C07): a `dl` of
// two columns, the label in `text-secondary` 600 over a width taken from the tokens of 03 §3.3, the value in
// `text-primary`, an empty value in `text-tertiary`. 8 px between the lines and 24 between the columns, 14 px;
// the reading sheet is 16 px and the column of the backoffice 12 px with 8 × 12. From 1 280 px `columns` puts
// two lists side by side. The sizes and the widths are the keys of their objects, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const PROPERTY_SIZE_CLASSES = {
  /** 14 px, 8 × 24: the list of a card or a summary. */
  sm: "gap-x-5 gap-y-2 text-sm",
  /** 16 px, 8 × 24: the reading sheet. */
  md: "gap-x-5 gap-y-2 text-md",
  /** 12 px, 8 × 12: the dense column of the backoffice. */
  xs: "gap-x-3 gap-y-2 text-xs",
};

export type PropertySize = keyof typeof PROPERTY_SIZE_CLASSES;

/** The width of the labels by role (RU-16): the default, then each reading of 03 §3.3. */
const PROPERTY_LABEL_WIDTH_CLASSES = {
  standard: "grid-cols-[minmax(0,var(--size-property-label))_minmax(0,1fr)]",
  summary:
    "grid-cols-[minmax(0,var(--size-property-label-summary))_minmax(0,1fr)]",
  reading:
    "grid-cols-[minmax(0,var(--size-property-label-reading))_minmax(0,1fr)]",
  compact:
    "grid-cols-[minmax(0,var(--size-property-label-reading-compact))_minmax(0,1fr)]",
  terms: "grid-cols-[minmax(0,var(--size-property-label-terms))_minmax(0,1fr)]",
};

export type PropertyLabelWidth = keyof typeof PROPERTY_LABEL_WIDTH_CLASSES;

/** The `dl`: two columns, the label then its value. */
export function propertyListClasses(
  size: PropertySize | undefined,
  labelWidth: PropertyLabelWidth | undefined,
): string {
  return cn(
    "grid",
    size === undefined ? PROPERTY_SIZE_CLASSES.sm : PROPERTY_SIZE_CLASSES[size],
    labelWidth === undefined
      ? PROPERTY_LABEL_WIDTH_CLASSES.standard
      : PROPERTY_LABEL_WIDTH_CLASSES[labelWidth],
  );
}

/** Two lists side by side from 1 280 px, one above the other before. */
export const PROPERTY_COLUMNS_CLASSES =
  "grid gap-y-2 xl:grid-cols-2 xl:gap-x-8";

export const PROPERTY_LABEL_CLASSES = "font-semibold text-text-secondary";

/** The value: it wraps anywhere rather than overflow, its mark beside it; an empty one is tertiary, as written. */
const PROPERTY_VALUE_CLASSES =
  "flex min-w-0 flex-wrap items-baseline gap-x-2 wrap-anywhere";

export function propertyValueClasses(empty: boolean): string {
  return cn(
    PROPERTY_VALUE_CLASSES,
    empty ? "text-text-tertiary" : "text-text-primary",
  );
}

/** The line under a value. */
export const PROPERTY_SUB_CLASSES = "basis-full text-text-secondary";

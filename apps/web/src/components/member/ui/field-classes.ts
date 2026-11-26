// Classes of the fields of the connected spaces (docs/mvp/20 §11.8, 22-refonte-ux-ui/02a C18): the outline
// reaches 3:1 on the page (`border-strong`), an error is a 2 px red outline with a message tied by
// aria-describedby, the focus is the ring of globals.css (never a green border, K18). The error does not
// move the text (RUB-B PT1): the control keeps its height and its padding grows back what the outline took,
// and only the colour of the outline transitions (R04 line 30). The sizes, the widths and the columns are the
// keys of their objects, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

/**
 * One field and its texts: label, control, help, message. Its width never depends on its layer badge. The
 * three sizes draw the same today: `bo` and `dense` are the common contract of the backoffice twin, whose
 * measures RUC settles (02a C18); each size has its own key to change there.
 */
const FIELD_SIZE_CLASSES = {
  md: "flex min-w-0 flex-col gap-2",
  bo: "flex min-w-0 flex-col gap-2",
  dense: "flex min-w-0 flex-col gap-2",
};

export type FieldSize = keyof typeof FIELD_SIZE_CLASSES;

/** The field as the screens that keep their own element draw it (`md`). */
export const MEMBER_FIELD_CLASSES = FIELD_SIZE_CLASSES.md;

/** The classes of a field of a size (`md` when none is given). */
export function fieldClasses(size?: FieldSize): string {
  return FIELD_SIZE_CLASSES[size === undefined ? "md" : size];
}

/** A field that shows when another answer asks for it enters by `rise-in` (R04 line 21); instant under reduced motion. */
export const MEMBER_FIELD_ENTERING_CLASSES = "animate-rise-in";

/**
 * The width of the control, not of the label: the full line, a short number of 128 px, or one of the five
 * widths the mockups give a field on its line. The full line has no wrapper.
 */
const FIELD_WIDTH_CLASSES = {
  full: "",
  number: "w-(--size-input-number)",
  xs: "w-full max-w-(--container-field-xs)",
  sm: "w-full max-w-(--container-field-sm)",
  md: "w-full max-w-(--container-field-md)",
  lg: "w-full max-w-(--container-field-lg)",
  xl: "w-full max-w-(--container-field-xl)",
};

export type FieldWidth = keyof typeof FIELD_WIDTH_CLASSES;

/** The classes of the wrapper of the control: empty for the full line, which needs none. */
export function fieldWidthClasses(width?: FieldWidth): string {
  return width === undefined ? "" : FIELD_WIDTH_CLASSES[width];
}

/** The row of a control and its unit: one line, the unit centred on the control. */
export const MEMBER_FIELD_CONTROL_ROW_CLASSES = "flex items-center gap-3";

/** The unit written after a short control (`suffix`): 16 px in secondary text, read with the field. */
export const MEMBER_FIELD_SUFFIX_CLASSES =
  "shrink-0 text-md text-text-secondary";

const FIELD_GRID_COLUMN_CLASSES = {
  1: "grid-cols-1",
  2: "grid-cols-1 form:grid-cols-2",
  3: "grid-cols-1 form:grid-cols-3",
  4: "grid-cols-1 form:grid-cols-4",
};

export type FieldGridColumns = keyof typeof FIELD_GRID_COLUMN_CLASSES;

/** The grid of fields (`fgrid`, RU-03): one column, then 2, 3 or 4 from 640 px, a gap of 24 px. */
export function fieldGridClasses(columns?: FieldGridColumns): string {
  return cn(
    "grid gap-5",
    FIELD_GRID_COLUMN_CLASSES[columns === undefined ? 1 : columns],
  );
}

export const MEMBER_FIELD_LABEL_CLASSES = "font-semibold text-text-primary";

/** The help sits 4 px under the label while the line of the field has an 8 px gap: a pull of 4 px, no wrapper. */
export const MEMBER_FIELD_HELP_CLASSES = "-mt-1 text-sm text-text-secondary";

/**
 * The label line of a field: the label, what it asks, and the layer badge beside it (06 RG62). A badge
 * reduced to its icon stays on the first line of the label, whatever the lines the label takes.
 */
export const MEMBER_FIELD_HEADER_CLASSES =
  "flex flex-wrap items-center gap-x-3 gap-y-1 has-[>[data-layer-icon-only]]:flex-nowrap has-[>[data-layer-icon-only]]:items-start";

/** What the label adds when the field is required, written (never a mark alone). */
export const MEMBER_FIELD_REQUIRED_CLASSES =
  "text-sm font-regular text-text-secondary";

/** The counter of a text area and the count of a capped list: read, not announced at each key. */
export const MEMBER_FIELD_COUNTER_CLASSES =
  "text-sm tabular-nums text-text-secondary";

/**
 * A checkbox or a radio whose whole label is the click zone (17 §3.6). `blocked`: a choice that
 * cannot be taken now (the cap of its list is reached) is dimmed and says so elsewhere, never only
 * dimmed.
 */
export function memberChoiceRowClasses(blocked = false): string {
  return cn(
    "flex min-h-(--size-touch-target) items-start gap-3 py-2 text-md",
    blocked
      ? "cursor-not-allowed text-text-disabled"
      : "cursor-pointer text-text-primary has-disabled:cursor-default",
  );
}

/**
 * The native control keeps `disabled` (it blocks every gesture and reads "checked, unavailable"); only
 * its drawing changes under `disabled:` (L3C-X3). The browser paints a disabled radio or box in its own
 * grey, which hides what is checked: it is redrawn as a `border-strong` outline (3:1 on the card) whose
 * checked state is a filled inner mark in `text-secondary`, a shape and not a tint, never green. One
 * drawing for both kinds (CA22 forbids the `[type=…]` variant that would tell a box from a radio).
 */
export function memberChoiceInputClasses(blocked = false): string {
  return cn(
    "mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg",
    blocked ? "cursor-not-allowed" : "cursor-pointer",
    "disabled:appearance-none disabled:border-(length:--border-width-thick) disabled:border-border-strong disabled:bg-transparent",
    "disabled:rounded-pill",
    "disabled:checked:border-text-secondary disabled:checked:bg-text-secondary disabled:checked:bg-clip-content disabled:checked:p-1",
  );
}

function outlineClasses(hasError: boolean): string {
  return cn(
    "bg-surface-page text-md text-text-primary transition-colors",
    "disabled:border-border-default disabled:bg-surface-raised disabled:text-text-secondary",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : "border-(length:--border-width-thin) border-border-strong",
  );
}

// What the thicker outline takes from the inside of a control is given back to its padding, so that the text
// does not move when the error comes (PT1). Plain strings: the lint forbids `[` inside `cn()` (CA22).
const ERROR_INSET_X =
  "px-[calc(var(--spacing-4)-var(--border-width-thick)+var(--border-width-thin))]";
const ERROR_INSET_Y =
  "py-[calc(var(--spacing-3)-var(--border-width-thick)+var(--border-width-thin))]";
const ERROR_INSET_BOTH = cn(ERROR_INSET_X, ERROR_INSET_Y);

/** A text field, a select: `surface-page`, `radius-md`, `size-input` tall (its height is fixed, in either state). */
export function memberControlClasses(hasError: boolean): string {
  return cn(
    "h-(--size-input) w-full rounded-md",
    hasError ? ERROR_INSET_X : "px-4",
    outlineClasses(hasError),
  );
}

/** A text area: the same outline, 120 px tall at least, its height then set by `rows`. */
export function memberTextAreaClasses(hasError: boolean): string {
  return cn(
    "min-h-(--size-textarea) w-full rounded-md",
    hasError ? ERROR_INSET_BOTH : "px-4 py-3",
    outlineClasses(hasError),
  );
}

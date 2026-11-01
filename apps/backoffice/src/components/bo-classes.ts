// Token-only classes of the backoffice screens (docs/mvp/17b §2, §4; skill design-system-influx,
// register "Backoffice"): dense tables rather than cards, a workstation width, states carried by a
// text and a border, never by the colour alone. Every value is a token of src/styles/tokens.css.
import { cn } from "./auth-classes";

export const SECTION_CLASSES = cn(
  "flex flex-col gap-3 rounded-card border-(length:--border-width-thin) border-border-default",
  "bg-surface-card p-inset-card",
);

/** The `h2` of a section: as the members' (20 §11.5; D75 RK-5, RK-6), Manrope at a fixed size, tightened. */
export const SECTION_TITLE =
  "font-display text-title-section font-bold tracking-heading text-text-primary";

/** The `h3` of a dense block: 14 px bold, left at its natural spacing (D75 RK-5). */
export const BLOCK_TITLE = "font-display text-sm font-bold text-text-primary";

/**
 * The dense table scrolls in its own region (17b §1.7), never the page; the region is focusable so a
 * keyboard reaches what overflows (axe scrollable-region-focusable). Its head stays in view.
 */
export const DENSE_TABLE_WRAP_CLASSES = cn(
  "max-h-dvh w-full overflow-auto rounded-md",
  "border-(length:--border-width-thin) border-border-default",
);

export const TABLE_CLASSES = "w-full border-collapse text-sm";

export const TH_CLASSES = cn(
  "sticky top-0 border-b-(length:--border-width-thin) border-border-strong bg-surface-hover",
  "px-(--spacing-bo-cell-x) py-(--spacing-bo-cell-y) text-left align-bottom",
  "font-display text-sm font-bold text-text-secondary",
);

export const TD_CLASSES = cn(
  "h-(--spacing-bo-row-h) border-b-(length:--border-width-thin) border-border-subtle",
  "px-(--spacing-bo-cell-x) py-(--spacing-bo-cell-y) align-top text-text-primary",
);

/**
 * A row of the dense table. Hovered or holding the keyboard focus (D75 RK-15): `surface-raised` and
 * the line of the brand green on its first cell, never on the `tr`. A selected row keeps its ground.
 */
export function rowClasses(selected: boolean): string {
  return selected
    ? "bg-surface-raised"
    : cn(
        "hover:bg-surface-raised focus-within:bg-surface-raised",
        "hover:*:first:shadow-(--effect-bo-row-indicator)",
        "focus-within:*:first:shadow-(--effect-bo-row-indicator)",
      );
}

export const FIELD_CLASSES = "flex flex-col gap-1";

export const SMALL_LABEL_CLASSES = "text-sm font-semibold text-text-primary";

export const SELECT_CLASSES = cn(
  "min-h-(--size-bo-control) rounded-md border-(length:--border-width-thin) border-border-strong",
  "bg-surface-page px-2 text-sm text-text-primary",
);

export const TEXTAREA_CLASSES = cn(
  "min-h-(--size-input) w-full rounded-md border-(length:--border-width-thin) border-border-strong",
  "bg-surface-page p-2 text-sm text-text-primary",
);

/**
 * The disabled look of a button, `aria-disabled` or `disabled` alike (20 §11.8, state D): the
 * disabled ground and text, the not-allowed cursor; hover and press change nothing (the hover and
 * press classes of each button are under `not-aria-disabled:not-disabled:`).
 */
const DISABLED_FILL_CLASSES = cn(
  "aria-disabled:cursor-not-allowed aria-disabled:bg-action-disabled-bg aria-disabled:text-text-disabled",
  "disabled:cursor-not-allowed disabled:bg-action-disabled-bg disabled:text-text-disabled",
);

/** Small buttons: sober, neither glow nor zoom (RK-4, TK1.4). */
export const SMALL_PRIMARY_CLASSES = cn(
  "inline-flex min-h-(--size-bo-control) items-center justify-center rounded-pill",
  "bg-action-primary-bg px-4 font-display text-sm font-action text-text-on-action",
  "not-aria-disabled:not-disabled:hover:bg-action-primary-bg-hover",
  "not-aria-disabled:not-disabled:active:bg-action-primary-bg-active",
  DISABLED_FILL_CLASSES,
);

export const SMALL_SECONDARY_CLASSES = cn(
  "inline-flex min-h-(--size-bo-control) items-center justify-center rounded-pill",
  "border-(length:--border-width-thin) border-action-secondary-border bg-action-secondary-bg",
  "px-4 font-display text-sm font-action-secondary text-text-primary",
  "not-aria-disabled:not-disabled:hover:bg-action-secondary-bg-hover",
  DISABLED_FILL_CLASSES,
  "aria-disabled:border-transparent disabled:border-transparent",
);

export const LINK_CLASSES = "text-text-primary underline";

export const ROW_GROUP_CLASSES = "flex flex-wrap items-end gap-3";

export const DL_CLASSES =
  "grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2";

export const DT_CLASSES = "font-semibold text-text-secondary";

export const DD_CLASSES = "text-text-primary";

/** A success, in teal (the brand green is an action, never a state). */
export const SUCCESS_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-success-border",
  "bg-feedback-success-bg px-4 py-3 text-sm text-feedback-success-text",
);

export const MONO_CLASSES = "font-mono text-sm break-all text-text-primary";

export const TABULAR_CLASSES = "tabular-nums";

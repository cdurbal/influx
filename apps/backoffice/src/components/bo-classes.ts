// Token-only classes of the backoffice screens (docs/mvp/17b §2, §4; skill design-system-influx,
// register "Backoffice"): dense tables rather than cards, a workstation width, states carried by a
// text and a border, never by the colour alone. Every value is a token of src/styles/tokens.css.
import { cn } from "./auth-classes";

export const PAGE_CLASSES = cn(
  "mx-auto flex min-h-screen w-full max-w-(--container-max) flex-col gap-6",
  "px-page-gutter py-6",
);

export const HEADER_CLASSES = cn(
  "flex flex-col gap-3 border-b-(length:--border-width-thin) border-border-subtle pb-4",
);

export const NAV_LIST_CLASSES = "flex flex-wrap gap-2";

export function navLinkClasses(current: boolean): string {
  return cn(
    "inline-flex min-h-(--size-button-md) items-center rounded-md px-3 text-sm",
    current
      ? "border-(length:--border-width-thick) border-border-selected font-semibold text-text-primary"
      : "text-text-secondary underline hover:bg-action-secondary-bg-hover",
  );
}

export const SECTION_CLASSES = cn(
  "flex flex-col gap-3 rounded-lg border-(length:--border-width-thin) border-border-default",
  "bg-surface-card p-4",
);

export const SECTION_TITLE_CLASSES =
  "text-lead font-semibold text-text-primary";

export const TABLE_WRAP_CLASSES = "w-full overflow-x-auto";

export const TABLE_CLASSES = "w-full border-collapse text-sm";

export const TH_CLASSES = cn(
  "border-b-(length:--border-width-thin) border-border-strong px-2 py-2 text-left align-bottom",
  "font-semibold text-text-secondary",
);

export const TD_CLASSES = cn(
  "border-b-(length:--border-width-thin) border-border-subtle px-2 py-2 align-top text-text-primary",
);

export function rowClasses(selected: boolean): string {
  return selected ? "bg-surface-raised" : "focus-within:bg-surface-hover";
}

export const FIELD_CLASSES = "flex flex-col gap-1";

export const SMALL_LABEL_CLASSES = "text-sm font-semibold text-text-primary";

export const SELECT_CLASSES = cn(
  "min-h-(--size-button-md) rounded-md border-(length:--border-width-thin) border-border-strong",
  "bg-surface-page px-2 text-sm text-text-primary",
);

export const TEXTAREA_CLASSES = cn(
  "min-h-(--size-input) w-full rounded-md border-(length:--border-width-thin) border-border-strong",
  "bg-surface-page p-2 text-sm text-text-primary",
);

export const SMALL_PRIMARY_CLASSES = cn(
  "inline-flex min-h-(--size-button-md) items-center justify-center rounded-pill",
  "bg-action-primary-bg px-4 text-sm font-medium text-text-on-action",
  "hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active",
);

export const SMALL_SECONDARY_CLASSES = cn(
  "inline-flex min-h-(--size-button-md) items-center justify-center rounded-pill",
  "border-(length:--border-width-thin) border-action-secondary-border bg-action-secondary-bg",
  "px-4 text-sm font-medium text-text-primary hover:bg-action-secondary-bg-hover",
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

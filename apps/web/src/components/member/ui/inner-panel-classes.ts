// Classes of the panel inside a card (C05; docs/mvp/22-refonte-ux-ui/02a §1): `surface-raised`, 12 px
// corners, no contour, entering with `rise-in` (R04 line 21; instant under reduced motion by the
// durations). The variants are the keys of their object, not quoted strings (TK7.2). `form`, the
// panel of the backoffice, holds the look of `default`: its cap of 52 rem has no token and is the
// business of the backoffice twin (RUC).
import { cn } from "@/components/ui/class-names";

const INNER_PANEL_BASE_CLASSES = "rounded-md bg-surface-raised animate-rise-in";

const INNER_PANEL_COLUMN_CLASSES = cn(
  INNER_PANEL_BASE_CLASSES,
  "flex flex-col gap-3 p-4",
);

const INNER_PANEL_VARIANT_CLASSES = {
  default: INNER_PANEL_COLUMN_CLASSES,
  readonly: cn(
    INNER_PANEL_BASE_CLASSES,
    "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3",
  ),
  preview: cn(INNER_PANEL_BASE_CLASSES, "flex flex-col gap-2 p-4"),
  form: INNER_PANEL_COLUMN_CLASSES,
};

export type InnerPanelVariant = keyof typeof INNER_PANEL_VARIANT_CLASSES;

/** The classes of the panel of a variant. */
export function innerPanelClasses(variant: InnerPanelVariant): string {
  return INNER_PANEL_VARIANT_CLASSES[variant];
}

/** The head of a panel: its title on one side, its action on the other. */
export const INNER_PANEL_HEAD_CLASSES =
  "flex flex-wrap items-center justify-between gap-3";

/** The cap of a `preview`: the icon and the title in 12 px capitals. */
export const INNER_PANEL_PREVIEW_HEAD_CLASSES = "flex items-center gap-2";

export const INNER_PANEL_ICON_CLASSES =
  "inline-flex size-(--size-icon-sm) shrink-0 text-text-secondary";

/**
 * The label of a `readonly` line, in secondary text; its value follows, then its action. The value asks for 12 rem
 * and breaks anywhere, so that the action goes to the next line rather than over a long address (RUB U-2).
 */
export const INNER_PANEL_LABEL_CLASSES = "text-sm text-text-secondary";

export const INNER_PANEL_VALUE_CLASSES =
  "min-w-0 flex-1 basis-(--size-note-min) wrap-anywhere text-md text-text-primary";

// Token-only classes of the member shell (docs/mvp/17 §2.2, §2.3; 20 §11.8 "Item de navigation";
// 02 §21.5 points 3 and 4). One frame, restyled by the lg breakpoint of tokens.css: a sticky header
// and a bottom bar below it, a side column from it. No width is detected in JavaScript.
// globals.css adds what has no utility class: the iOS gesture zone under the bar, and the room the
// content keeps clear of it (the `data-member-*` attributes).
import { cn } from "@/components/ui/class-names";

/** The frame: one column below lg; from lg, two tracks, the side column then the content. */
export const SHELL_CLASSES =
  "flex min-h-dvh flex-col lg:grid lg:grid-cols-(--grid-member-shell)";

/** "Aller au contenu": the first focusable element, out of sight until focused, then over all. */
export const SKIP_LINK_CLASSES = cn(
  "fixed left-4 top-2 z-(--z-overlay) rounded-pill bg-surface-raised px-4 py-2",
  "border-(length:--border-width-thin) border-border-strong text-sm font-semibold text-text-primary",
  "not-focus:sr-only",
);

/**
 * The side column from lg: sticky, full height, its own scroll (small height, zoom), a rule on its
 * right, no floating panel nor rounded corner (17 §2.3). Below lg it lays nothing out
 * (`contents`): the header sticks to the frame, the navigation to the bottom of the window.
 */
export const COLUMN_CLASSES = cn(
  "contents",
  "lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:bg-surface-page",
  "lg:border-r-(length:--border-width-thin) lg:border-border-default",
);

/** The header below lg (INFLUX, the role pill, then the language), the head of the column from lg. */
export const HEADER_CLASSES = cn(
  "sticky top-0 z-(--z-header) flex h-(--header-height) items-center justify-between gap-2",
  "bg-surface-page px-page-gutter max-lg:border-b-(length:--border-width-thin) max-lg:border-border-default",
  "lg:static lg:h-auto lg:flex-col lg:items-start lg:justify-start lg:px-4 lg:pb-4 lg:pt-5",
);

export const BRAND_LINK_CLASSES = cn(
  "inline-flex min-h-(--size-touch-target) items-center rounded-md",
  "font-display text-md font-bold text-text-primary",
);

/**
 * The name of the space in its role pill, at every width (17 §2.2, §2.3; L2AU-2): below lg, right
 * after INFLUX, the language pushed to the far end, its inset narrower so that the header holds on
 * one line at 320 px; from lg, under INFLUX in the column head.
 */
export const SPACE_NAME_CLASSES = "max-lg:mr-auto max-lg:px-2";

/** Below lg only: the language sits in the header; from lg, in the foot of the column. */
export const HEADER_ONLY_CLASSES = "lg:hidden";

/** The one main navigation: a bar fixed at the bottom below lg, the list of the column from lg. */
export const NAV_CLASSES = cn(
  "fixed inset-x-0 bottom-0 z-(--z-nav-bottom) bg-surface-page",
  "max-lg:border-t-(length:--border-width-thin) max-lg:border-border-default",
  "lg:static lg:z-auto lg:bg-transparent lg:px-2 lg:pb-0",
);

/** Five cells at most, capped on a tablet and centred (17 §2.2); a vertical list from lg. */
export const NAV_LIST_CLASSES = cn(
  "flex h-(--size-nav-bottom-height) justify-center",
  "lg:h-auto lg:flex-col lg:justify-start lg:gap-1",
);

export const NAV_CELL_CLASSES = "flex-1 max-w-(--spacing-11) lg:max-w-none";

/**
 * The state of an entry (D74): "current" on its own page, page-menu included; "ancestor" when the
 * current page is one of its sub-entries; "idle" otherwise.
 */
export type NavLinkState = "current" | "ancestor" | "idle";

/**
 * An entry (20 §11.8): icon over its label in a full-height cell of the bar, the focus ring inside
 * so that the edge of the screen never cuts it; icon and label on one line in the column. Current:
 * three carriers at once, `aria-current`, a heavier label in `text-primary`, and a 2 px line, on
 * top in the bar and on the left in the column (never the color alone, P7). Ancestor: in the
 * column, the heavier label alone, no surface, no line, no `aria-current` (the sub-entry carries
 * them); in the bar, which has no sub-entry, the look of the current cell without `aria-current`.
 */
export function navLinkClasses(state: NavLinkState): string {
  return cn(
    "relative flex h-full flex-col items-center justify-center gap-1 px-1 text-xs",
    "transition-colors hover:bg-nav-item-hover-bg hover:text-text-primary",
    "focus-visible:outline-offset-(--focus-ring-offset-inset)",
    "lg:min-h-(--size-touch-target) lg:flex-row lg:justify-start lg:gap-3 lg:rounded-md lg:px-3 lg:text-md",
    "lg:focus-visible:outline-offset-(--focus-ring-offset)",
    state === "current"
      ? cn(
          "bg-nav-item-active-bg font-semibold text-text-primary",
          "before:absolute before:left-3 before:right-3 before:top-0 before:h-(--border-width-thick) before:bg-nav-item-active-indicator",
          "lg:before:left-0 lg:before:right-auto lg:before:top-2 lg:before:bottom-2 lg:before:h-auto lg:before:w-(--border-width-thick)",
        )
      : state === "ancestor"
        ? cn(
            "font-semibold text-text-primary",
            // The bar shows no sub-entry: there the rubric keeps the look of the current cell.
            "max-lg:bg-nav-item-active-bg",
            "max-lg:before:absolute max-lg:before:left-3 max-lg:before:right-3 max-lg:before:top-0 max-lg:before:h-(--border-width-thick) max-lg:before:bg-nav-item-active-indicator",
          )
        : "text-text-secondary",
  );
}

/**
 * The sub-entries of the active rubric (D74; 20 §11.8 "Sous-entrée de navigation"), nested in its
 * item: from lg only. Below lg the CSS takes them out (`display: none`, out of the accessibility
 * tree too, SN-0): the bar never shows a sub-entry, and no width is read in JavaScript.
 */
export const SUB_NAV_LIST_CLASSES = "mt-1 flex flex-col gap-1 max-lg:hidden";

/**
 * A sub-entry: no icon, its label aligned on the rubric's (the link's inset, the icon and the
 * gap), `text-sm`. Current: surface, 2 px line and a heavier label, with `aria-current`.
 */
export function subNavLinkClasses(isCurrent: boolean): string {
  return cn(
    "relative flex min-h-(--size-touch-target) items-center rounded-md pr-3 text-sm",
    "pl-(--spacing-nav-sub-indent)",
    "transition-colors hover:bg-nav-item-hover-bg hover:text-text-primary",
    "focus-visible:outline-offset-(--focus-ring-offset)",
    isCurrent
      ? cn(
          "bg-nav-item-active-bg font-semibold text-text-primary",
          "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-(--border-width-thick) before:bg-nav-item-active-indicator",
        )
      : "text-text-secondary",
  );
}

export const NAV_ICON_CLASSES = "size-(--size-icon-md) shrink-0";

/** The foot of the column, from lg only: language, identity, sign-out, always visible (17 §2.3). */
export const FOOTER_CLASSES = cn(
  "hidden lg:mt-auto lg:flex lg:flex-col lg:items-start lg:gap-3 lg:px-4 lg:py-4",
  "lg:border-t-(length:--border-width-thin) lg:border-border-default",
);

export const IDENTITY_CLASSES = "break-words text-sm text-text-secondary";

/** The content: below lg, globals.css keeps it clear of the bar; from lg nothing lies under it. */
export const MAIN_CLASSES = "flex-1 lg:pb-0";

/** Where the loading bar stands until the entries are known: the bar's own height, no jump. */
export const NAV_PLACEHOLDER_CLASSES = cn(NAV_CLASSES, "lg:hidden");

export const NAV_PLACEHOLDER_LIST_CLASSES = "h-(--size-nav-bottom-height)";

/**
 * The state of the account in the column (17 §2.3 "Bloc d'état du compte"): under the items, above
 * the foot, from lg only; below lg the home carries it. A rule above, as the foot has.
 */
export const ACCOUNT_STATE_CLASSES = cn(
  "hidden lg:mt-4 lg:flex lg:flex-col lg:items-start lg:gap-2 lg:px-4 lg:py-4",
  "lg:border-t-(length:--border-width-thin) lg:border-border-default",
);

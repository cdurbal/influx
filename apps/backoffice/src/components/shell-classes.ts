// Token-only classes of the backoffice shell (docs/mvp/17b §1.4, §1.7; 20 §11.8 "Item de navigation",
// "Sous-entrée de navigation", "Liens de section" until SN-4; 02 §21.5 point 8). One frame, restyled
// by the breakpoints of tokens.css: from lg, the rail on the left at full height, the head band over
// the content; from md to lg, the same <nav> as a compact horizontal list under the band; under
// `bo-small:` (tokens-backoffice.css), the frame gives way to the "poste de travail" screen. No
// width is detected in JavaScript.
import { cn } from "./auth-classes";
import type { EntryState } from "./bo-nav";

/** The frame: one column below lg; from lg, the rail spans both rows, band and content beside it. */
export const FRAME_CLASSES = cn(
  "flex min-h-dvh flex-col bo-small:hidden",
  "lg:grid lg:grid-cols-(--grid-bo-shell) lg:grid-rows-(--grid-bo-shell-rows)",
);

/** "Aller au contenu": the first focusable element, out of sight until focused, then over all. */
export const SKIP_LINK_CLASSES = cn(
  "fixed left-4 top-2 z-(--z-overlay) rounded-pill bg-surface-raised px-4 py-2",
  "border-(length:--border-width-thin) border-border-strong text-sm font-semibold text-text-primary",
  "not-focus:sr-only",
);

/** The head band (17b §1.4): fixed over the content, never hidden by the scroll, never covered. */
export const BAND_CLASSES = cn(
  "sticky top-0 z-(--z-header) flex flex-col bg-surface-page",
  "border-b-(length:--border-width-thin) border-border-default",
  "lg:col-start-2 lg:row-start-1",
);

/**
 * Bar 1: the environment and the identity. Outside production the whole bar changes its ground AND
 * carries the word (16 RG118): the warning family, never the colour alone.
 */
export function envBarClasses(production: boolean): string {
  return cn(
    "flex min-h-(--spacing-bo-row-h) flex-wrap items-center justify-between gap-x-4 gap-y-1",
    "px-page-gutter py-2 text-sm",
    production
      ? "text-text-secondary"
      : "bg-feedback-warning-bg text-feedback-warning-text",
  );
}

export const ENV_NAME_CLASSES = "font-display font-bold tracking-overline";

/** Bars 2 and 3: the banners, under bar 1, inside the band. */
export const BANNERS_CLASSES = "flex flex-col gap-2 px-page-gutter pb-3";

/**
 * The rail from lg: sticky, full height, its own scroll, a rule on its right (17b §1.7). From md to
 * lg, a strip under the band: the entries in a row that wraps, sign-out at its end.
 */
export const RAIL_CLASSES = cn(
  "flex flex-wrap items-center gap-x-4 gap-y-2 border-border-default bg-surface-page px-page-gutter py-2",
  "max-lg:border-b-(length:--border-width-thin)",
  "lg:sticky lg:top-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:h-dvh lg:self-start",
  "lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-0 lg:overflow-y-auto lg:px-0 lg:py-0",
  "lg:border-r-(length:--border-width-thin)",
);

/** The head of the rail, from lg only: INFLUX and "Backoffice", a link to the dashboard. */
export const RAIL_HEAD_CLASSES = "hidden lg:flex lg:px-4 lg:pb-4 lg:pt-5";

export const BRAND_LINK_CLASSES = cn(
  "inline-flex flex-col rounded-md font-display text-md font-bold text-text-primary",
);

export const PRODUCT_CLASSES = "text-sm font-semibold text-text-secondary";

/**
 * The <nav> in the strip (md to lg) takes the room the sign-out leaves, so that the line of the
 * active entry spans it; in the rail, a block like before.
 */
export const NAV_CLASSES = "max-lg:min-w-0 max-lg:flex-1";

export const NAV_LIST_CLASSES = "flex flex-wrap gap-1 lg:flex-col lg:px-2";

/**
 * An item of the list. From md to lg, the active entry holding sub-entries takes a line of its own
 * at its place (sn-fiche "Backoffice de 768 à 1 023 px", SN-0): its link, then its sub-list, which
 * wrap; neither `display: contents` nor `order`, the visual order stays the DOM's and the keyboard's.
 */
export function navCellClasses(withSubEntries: boolean): string {
  return withSubEntries
    ? "max-lg:flex max-lg:basis-full max-lg:flex-wrap max-lg:items-center max-lg:gap-1"
    : "";
}

/**
 * An entry (20 §11.8): icon and label on one line, 36 px high. Current: `aria-current`, a heavier
 * label in `text-primary` and a 2 px line, at the bottom in the strip, on the left in the rail
 * (never the colour alone, P7). Ancestor (D74): the heavier label alone, no surface, no line, no
 * `aria-current`; the current sub-entry carries them.
 */
export function navLinkClasses(state: EntryState): string {
  return cn(
    "relative flex h-(--spacing-bo-row-h) items-center gap-2 rounded-md px-3 text-sm",
    "transition-colors hover:bg-nav-item-hover-bg hover:text-text-primary lg:gap-3",
    state === "current"
      ? cn(
          "bg-nav-item-active-bg font-semibold text-text-primary",
          "before:absolute before:bottom-0 before:left-3 before:right-3 before:h-(--border-width-thick) before:bg-nav-item-active-indicator",
          "lg:before:bottom-1 lg:before:left-0 lg:before:right-auto lg:before:top-1 lg:before:h-auto lg:before:w-(--border-width-thick)",
        )
      : state === "ancestor"
        ? "font-semibold text-text-primary"
        : "text-text-secondary",
  );
}

/**
 * The sub-entries of the active entry (D74; 20 §11.8 "Sous-entrée de navigation"), nested in its
 * item: a column under the entry in the rail, a row that wraps after it in the strip.
 */
export const SUB_NAV_LIST_CLASSES =
  "flex flex-wrap gap-1 lg:mt-1 lg:flex-col lg:flex-nowrap";

/**
 * A sub-entry: no icon, 36 px high, `text-sm`; in the rail its label aligned on the entry's (the
 * link's inset, the icon and the gap). Current: surface, 2 px line (at the bottom in the strip, on
 * the left in the rail) and a heavier label, with `aria-current`.
 */
export function subNavLinkClasses(isCurrent: boolean): string {
  return cn(
    "relative flex h-(--spacing-bo-row-h) items-center rounded-md px-3 text-sm",
    "lg:pl-(--spacing-nav-sub-indent)",
    "transition-colors hover:bg-nav-item-hover-bg hover:text-text-primary",
    isCurrent
      ? cn(
          "bg-nav-item-active-bg font-semibold text-text-primary",
          "before:absolute before:bottom-0 before:left-3 before:right-3 before:h-(--border-width-thick) before:bg-nav-item-active-indicator",
          "lg:before:bottom-1 lg:before:left-0 lg:before:right-auto lg:before:top-1 lg:before:h-auto lg:before:w-(--border-width-thick)",
        )
      : "text-text-secondary",
  );
}

export const NAV_ICON_CLASSES = "size-(--size-icon-md) shrink-0";

/** The foot of the rail (sign-out); at the end of the strip from md to lg. */
export const RAIL_FOOT_CLASSES = cn(
  "ml-auto flex items-center",
  "lg:ml-0 lg:mt-auto lg:border-t-(length:--border-width-thin) lg:border-border-default lg:p-4",
);

/**
 * The work page: its ground is the header glow (20 §11.8 "En-tête de page", D75 RK-9), like the
 * standalone screens' (`SCREEN_CLASSES`); the container is at least as high as the glow, so that the
 * gradient never stops dead, loading included. Not on `SMALL_SCREEN_CLASSES` (the frame is hidden
 * under `bo-small:`): one glow per page.
 */
export const MAIN_CLASSES = cn(
  "flex min-h-(--size-header-glow) w-full max-w-(--container-max) flex-col gap-6",
  "bg-header-glow bg-no-repeat px-page-gutter py-6",
  "lg:col-start-2 lg:row-start-2",
);

/** The "poste de travail" screen (17b §1.7, F7): shown under `bo-small:` only. */
export const SMALL_SCREEN_CLASSES = cn(
  "hidden min-h-dvh flex-col gap-6 pb-6 bo-small:flex",
);

export const SMALL_BODY_CLASSES =
  "flex flex-col items-start gap-6 px-page-gutter";

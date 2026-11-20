// Token-only classes of M4, the brand's anonymous creator search (docs/mvp/17 §4.4, §7.1; 20 §11.8; jalons/l3f,
// commit 10): the wide page of two columns from lg (the filters sticky on the left, the results on the right), the
// grid of cards, the chips of the active criteria, the block « Proposé car ». Every value is a token of
// src/styles/tokens.css (CA22, G3).
import { PROFILE_PAGE_CLASSES } from "@/components/brand-profile/brand-profile-classes";
import { cn } from "@/components/ui/class-names";

export const SEARCH_PAGE_CLASSES = PROFILE_PAGE_CLASSES;

/**
 * The page of M4 is ONE grid whose cells are the controls themselves, so that each control exists once and each
 * place is a question of CSS (17 §4.4; jalons/l3f, fix-1). Below lg: two columns, « Filtres » and « Tri » on one
 * line, then the opened block (the campaign, the form), the count, the criteria, the results, the bar « Ma sélection ».
 * From lg: twelve columns, the filters sticky on the left (rows 1 to 5), the count, the campaign and the sort, the
 * criteria, the results and the panel stacked on the right. The last row takes the room the filters need.
 */
export const SEARCH_LAYOUT_CLASSES = cn(
  "grid grid-cols-2 gap-x-3 gap-y-4",
  "lg:grid-cols-12 lg:grid-rows-(--grid-search-rows) lg:items-start lg:gap-x-8 lg:gap-y-0",
);

/** The column of the filters: a block that opens below lg, sticky on the left from lg. */
export const SEARCH_FILTERS_CLASSES = cn(
  "col-span-2 lg:col-span-4 lg:col-start-1 lg:row-span-5 lg:row-start-1",
  "lg:sticky lg:top-(--spacing-6) lg:max-h-screen lg:overflow-y-auto",
);

/** « Filtres »: only below lg, on the line of the sort, its bottom on the bottom of the select. */
export const SEARCH_FILTERS_BUTTON_CLASSES = "col-span-1 self-end lg:hidden";

/** The campaign, at the head of the opened block below lg, on the right from lg. */
export const SEARCH_CAMPAIGN_CLASSES = cn(
  "col-span-2 flex min-w-0 flex-col gap-1",
  "lg:col-span-4 lg:col-start-5 lg:row-start-2 lg:mb-3 lg:self-end",
);

/** The sort: beside « Filtres » below lg, on the right of the campaign from lg; the [i] is its corner. */
export const SEARCH_SORT_CLASSES = cn(
  "relative col-span-1 flex min-w-0 flex-col gap-1",
  "lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:mb-3 lg:self-end",
);

/** The line of the sort's label: its right is left to the [i], whose hit area rises above the line, never over the field. */
export const SEARCH_LABEL_ROW_CLASSES =
  "flex items-center pr-(--size-touch-target)";

/** The [i] of the sort: a native disclosure whose summary is the touch target, centred on the label line. */
export const SEARCH_INFO_TOGGLE_CLASSES = cn(
  "absolute -top-4 right-0 flex size-(--size-touch-target) cursor-pointer items-center justify-center",
  "rounded-md text-text-secondary hover:text-text-primary",
);

/** The count band and the results take the focus from the app, never from the keyboard: no ring (like the titles). */
export const SEARCH_FOCUS_TARGET_CLASSES = "focus-visible:outline-none";

export const SEARCH_COUNT_CELL_CLASSES =
  "col-span-2 lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:mb-3";

/** The results (and the states that stand for them): also the place the focus falls on when nothing else is shown. */
export const SEARCH_RESULTS_CELL_CLASSES = cn(
  "col-span-2 min-w-0",
  SEARCH_FOCUS_TARGET_CLASSES,
  "lg:col-span-8 lg:col-start-5 lg:row-start-4 lg:mb-4",
);

/** The panel is a cell of the grid itself: a sticky bar needs a parent taller than itself. */
export const SELECTION_PANEL_CELL_CLASSES =
  "col-span-2 lg:col-span-8 lg:col-start-5 lg:row-start-5";

export const SEARCH_COUNT_CLASSES =
  "font-display text-md font-bold text-text-primary";

/** The chips of the active criteria: a cell of the grid, under the campaign and the sort. */
export const SEARCH_CRITERIA_CLASSES = cn(
  "flex flex-wrap items-center gap-2",
  "col-span-2 lg:col-span-8 lg:col-start-5 lg:row-start-3 lg:mb-4",
);

/** The cards: one column, two from xl (a card is long, the column of results is the narrow one). */
export const SEARCH_RESULTS_CLASSES = "grid grid-cols-1 gap-4 xl:grid-cols-2";

export const SEARCH_SKELETON_CLASSES =
  "h-(--size-feed-skeleton) rounded-card border-(length:--border-width-thin) border-border-default bg-surface-card";

/** « Proposé car »: an affirmation of INFLUX, not a statement of the creator, so it sits on a raised ground. */
export const SEARCH_REASONS_CLASSES = cn(
  "flex flex-col gap-2 rounded-md bg-surface-raised p-4",
  "border-(length:--border-width-thin) border-border-default",
);

export const SEARCH_REASON_LIST_CLASSES =
  "m-0 flex list-none flex-col gap-1 p-0 text-sm text-text-primary";

export const SEARCH_PAGER_CLASSES =
  "flex flex-wrap items-center justify-between gap-3";

/** A group of criteria of the form: the native disclosure, its summary the touch target. */
export const FILTER_GROUP_CLASSES =
  "flex flex-col gap-1 border-b-(length:--border-width-thin) border-border-default pb-2";

export const FILTER_SUMMARY_CLASSES = cn(
  "flex min-h-(--size-touch-target) cursor-pointer items-center justify-between gap-3",
  "font-semibold text-text-primary",
);

export const FILTER_CHOICES_CLASSES = "flex flex-col";

export const FILTER_ACTIONS_CLASSES = "flex flex-col gap-2";

/**
 * The panel « Ma sélection » (17 §4.4): below lg a bar sticky above the bottom navigation (globals.css gives its offset
 * through `data-action-bar`), opened upward to at most half the screen; from lg a card at the end of the results.
 */
export const SELECTION_PANEL_CLASSES = cn(
  "sticky z-(--z-header) flex flex-col gap-3",
  "border-t-(length:--border-width-thin) border-border-default bg-surface-page",
  "-mx-(--spacing-page-gutter) px-page-gutter py-3",
  "lg:static lg:mx-0 lg:rounded-card lg:border-(length:--border-width-thin) lg:bg-surface-card lg:p-inset-card",
);

/** The body of the panel when opened: scrolls on its own below lg, never taller than half the screen. */
export const SELECTION_PANEL_BODY_CLASSES =
  "flex flex-col gap-3 max-lg:max-h-(--size-selection-panel-max) max-lg:overflow-y-auto";

export const SELECTION_ALIASES_CLASSES =
  "m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-md";

/** The actions under a card or a profile: the add button, the way to the profile or to the request. */
export const CARD_ACTIONS_CLASSES = "flex flex-col gap-3";

export const CARD_ACTION_ROW_CLASSES = "flex flex-wrap items-center gap-3";

/** The lists of « Mes sélections »: one card per list, in a grid from md. */
export const LISTS_GRID_CLASSES = "grid grid-cols-1 gap-4 md:grid-cols-2";

/** The creators of a list: one column, two from xl, like the grid of the search. */
export const LIST_ITEMS_CLASSES = "grid grid-cols-1 gap-4 xl:grid-cols-2";

/** A form of a screen of the lists: its fields stacked, its action under them. */
export const FORM_CLASSES = "flex flex-col gap-4";

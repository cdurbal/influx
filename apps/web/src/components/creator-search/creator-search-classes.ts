// Token-only classes of M4, the brand's anonymous creator search (docs/mvp/17 §4.4, §7.1; 20 §11.8; jalons/l3f,
// commit 10): the wide page of two columns from lg (the filters sticky on the left, the results on the right), the
// grid of cards, the chips of the active criteria, the block « Proposé car ». Every value is a token of
// src/styles/tokens.css (CA22, G3).
import { PROFILE_PAGE_CLASSES } from "@/components/brand-profile/brand-profile-classes";
import { cn } from "@/components/ui/class-names";

export const SEARCH_PAGE_CLASSES = PROFILE_PAGE_CLASSES;

/** The filters and the results: one column below lg, twelve from lg (17 §4.4). */
export const SEARCH_LAYOUT_CLASSES =
  "flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8";

/** The column of the filters: above the results on a phone, sticky on the left from lg. */
export const SEARCH_ASIDE_CLASSES = cn(
  "flex flex-col gap-4 lg:col-span-4",
  "lg:sticky lg:top-(--spacing-6) lg:max-h-screen lg:overflow-y-auto",
);

export const SEARCH_MAIN_CLASSES = "flex min-w-0 flex-col gap-4 lg:col-span-8";

/** The toolbar of the results: the count, then the link to a campaign and the sort. */
export const SEARCH_TOOLBAR_CLASSES = "flex flex-col gap-3";

export const SEARCH_CONTROLS_CLASSES =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end";

export const SEARCH_COUNT_CLASSES =
  "font-display text-md font-bold text-text-primary";

export const SEARCH_CRITERIA_CLASSES = "flex flex-wrap items-center gap-2";

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

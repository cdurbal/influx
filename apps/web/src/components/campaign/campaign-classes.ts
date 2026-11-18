// Token-only classes of the campaign screens (docs/mvp/17 §4.3; 20 §11.8): the page of two columns
// from lg (the steps in the sticky one), the cards of a step, the lines of the deliverables, the list
// of the campaigns. The page, the cards and the save line are those of "mon profil de marque"
// (same ground, same card, same column), re-exported under the names this feature reads; every value
// is a token of src/styles/tokens.css (CA22, G3).
import { cn } from "@/components/ui/class-names";
import {
  PROFILE_ASIDE_CLASSES,
  PROFILE_CARD_CLASSES,
  PROFILE_FORM_CLASSES,
  PROFILE_GRID_CLASSES,
  PROFILE_PAGE_CLASSES,
  SAVE_STATUS_CLASSES,
  SECTION_FIELDSET_CLASSES,
} from "@/components/brand-profile/brand-profile-classes";
import { MEMBER_FIELD_LABEL_CLASSES } from "@/components/member/ui/field-classes";

export const CAMPAIGN_PAGE_CLASSES = PROFILE_PAGE_CLASSES;
export const CAMPAIGN_GRID_CLASSES = PROFILE_GRID_CLASSES;
export const CAMPAIGN_FORM_CLASSES = PROFILE_FORM_CLASSES;
export const CAMPAIGN_ASIDE_CLASSES = PROFILE_ASIDE_CLASSES;
export const CAMPAIGN_CARD_CLASSES = PROFILE_CARD_CLASSES;
export const CAMPAIGN_SAVE_STATUS_CLASSES = SAVE_STATUS_CLASSES;
/** The fields of a step that is no longer editable are a disabled set, drawing no box of its own. */
export const CAMPAIGN_FIELDSET_CLASSES = SECTION_FIELDSET_CLASSES;

/** The list of the campaigns: one card per campaign, stacked. */
export const CAMPAIGN_LIST_CLASSES = "flex flex-col gap-4";

/** A line of the list: the title and the state, then the date and the action. */
export const CAMPAIGN_ROW_CLASSES =
  "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between";

/** The steps, as a list of links to a step of the same page: one block of text per step. */
export const STEP_LIST_CLASSES = "flex flex-col gap-1";

export function stepButtonClasses(current: boolean): string {
  return cn(
    "flex min-h-(--size-touch-target) w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left",
    "border-(length:--border-width-thin) text-text-primary",
    current
      ? "border-border-strong bg-surface-raised"
      : "border-transparent hover:bg-action-secondary-bg-hover",
  );
}

export const STEP_NAME_CLASSES = "font-display text-md font-bold leading-snug";

export const STEP_MISSING_CLASSES = "text-sm text-text-secondary";

/** The summary of the steps below lg: the whole line is the control, as an accordion's title. */
export const STEPS_SUMMARY_CLASSES = cn(
  "flex min-h-(--size-touch-target) cursor-pointer items-center justify-between gap-3 font-display text-md font-bold",
  "rounded-md text-text-primary",
);

/** A line of deliverables: the three choices side by side from sm, stacked on a phone. */
export const DELIVERABLE_ROW_CLASSES = cn(
  "flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-default p-3",
  "sm:flex-row sm:items-end",
);

export const DELIVERABLE_CELL_CLASSES = "flex min-w-0 flex-1 flex-col gap-1";

export const DELIVERABLE_LABEL_CLASSES = cn(
  MEMBER_FIELD_LABEL_CLASSES,
  "text-sm",
);

/** The buttons under a list of lines: told by words, never an icon alone. */
export const LIST_ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";

/** The previous and next step: the two ends of the bottom of a step. */
export const STEP_NAV_CLASSES =
  "flex flex-wrap items-center justify-between gap-3";

/** "What a creator sees": the logo of the brand as the profile draws it, and the rows of a name and its value. */
export const PREVIEW_LOGO_CLASSES =
  "size-11 shrink-0 rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised object-contain";
export const PREVIEW_ROW_LIST_CLASSES = "flex flex-col gap-2 text-md";
export const PREVIEW_LABEL_CLASSES = "text-sm text-text-secondary";
export const PREVIEW_VALUE_CLASSES = "text-md text-text-primary";

/** The feed of a creator (L3D, C5): the count and the sort above, the cards in one column, two from lg. */
export const FEED_TOOLBAR_CLASSES =
  "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between";

export const FEED_SORT_CLASSES = "flex min-w-0 flex-col gap-1 sm:w-72";

export const FEED_COUNT_CLASSES =
  "font-display text-md font-bold text-text-primary";

export const FEED_LIST_CLASSES = "grid grid-cols-1 gap-4 lg:grid-cols-2";

/** A card of the feed: its blocks stacked; a greyed one (applications closed) keeps the page's own ground. */
export const FEED_CARD_CLASSES = "h-full";

export const FEED_CARD_CLOSED_CLASSES = "bg-surface-page";

/** The brand at the head of a card: its logo when it has one, its name, then what is checked of it. */
export const FEED_BRAND_CLASSES = "flex items-start gap-3";

/** What the brand pays and the notice that follows it, set apart from the facts of the campaign. */
export const FEED_PAY_CLASSES =
  "flex flex-col gap-1 border-t-(length:--border-width-thin) border-border-default pt-3";

export const FEED_FACTS_CLASSES =
  "flex flex-col gap-1 text-sm text-text-secondary";

/** A skeleton of a card while the first page loads: a block of the card's own height. */
export const FEED_SKELETON_CLASSES =
  "h-64 rounded-card border-(length:--border-width-thin) border-border-default bg-surface-card";

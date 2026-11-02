// Token-only classes of "mon profil de marque" (docs/mvp/17 §4.2; 20 §11.8): the wide page of two
// columns from lg, the sticky column, the sections of the accordion below lg, the action bar that
// stays above the bottom navigation. Every value is a token of src/styles/tokens.css (CA22, G3).
import { cn } from "@/components/ui/class-names";
import { MEMBER_CARD_CLASSES } from "@/components/member/ui/card-classes";
import { SECTION_TITLE } from "@/components/member/ui/heading-classes";

/** The page: a wider container than the other screens of the space (the sticky column needs room). */
export const PROFILE_PAGE_CLASSES = cn(
  "mx-auto flex w-full max-w-(--container-max) flex-col gap-6",
  "min-h-(--size-header-glow) px-page-gutter py-section-header bg-header-glow bg-no-repeat",
);

/** The form and its column: one column below lg, twelve from lg (17 §2.3). */
export const PROFILE_GRID_CLASSES =
  "flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8";

export const PROFILE_FORM_CLASSES = "flex flex-col gap-6 lg:col-span-8";

/** The column of the score: above the form on a phone, sticky on the right from lg. */
export const PROFILE_ASIDE_CLASSES = cn(
  "flex flex-col gap-4 max-lg:order-first lg:col-span-4",
  "lg:sticky lg:top-(--spacing-6)",
);

export const PROFILE_CARD_CLASSES = MEMBER_CARD_CLASSES;

/** A section: a card; its title is a plain heading from lg and the button of an accordion below. */
export const SECTION_HEADER_CLASSES =
  "flex flex-wrap items-center justify-between gap-x-3 gap-y-2";

export const SECTION_TITLE_CLASSES = cn(SECTION_TITLE, "text-text-primary");

export const SECTION_PLAIN_TITLE_CLASSES = cn(
  SECTION_TITLE_CLASSES,
  "max-lg:hidden",
);

/** The title of the accordion below lg: the whole line is the button. */
export const SECTION_BUTTON_TITLE_CLASSES =
  "min-w-0 flex-1 font-display lg:hidden";

export const SECTION_BUTTON_CLASSES = cn(
  SECTION_TITLE_CLASSES,
  "flex min-h-(--size-touch-target) w-full items-center justify-between gap-3 rounded-md text-left",
);

export const SECTION_CHEVRON_CLASSES =
  "size-(--size-icon-md) shrink-0 text-text-secondary transition-transform";

export const SECTION_CHEVRON_OPEN_CLASSES = "rotate-180";

/** The body of a section: out of sight (and of the accessibility tree) when closed below lg only. */
export function sectionBodyClasses(open: boolean): string {
  return cn("flex flex-col gap-5", !open && "max-lg:hidden");
}

/** The fields of a section group or a disabled set must not draw a box of their own. */
export const SECTION_FIELDSET_CLASSES =
  "m-0 flex min-w-0 flex-col gap-5 border-0 p-0";

/** The bar of a phone: sticky above the bottom navigation (globals.css gives it its offset). */
export const ACTION_BAR_CLASSES = cn(
  "sticky z-(--z-header) flex items-center justify-between gap-3 lg:hidden",
  "border-t-(length:--border-width-thin) border-border-default bg-surface-page",
  "-mx-(--spacing-page-gutter) px-page-gutter py-3",
);

export const SAVE_STATUS_CLASSES =
  "flex items-center gap-2 text-sm text-text-secondary";

export const MISSING_LIST_CLASSES = "text-sm text-text-primary";

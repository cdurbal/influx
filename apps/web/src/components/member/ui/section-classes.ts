// Classes of the section of a page (C03; docs/mvp/22-refonte-ux-ui/02a §1): a title, its intro, its
// actions and its content, without a container. A hairline above it, but not above the first section
// of its parent (`first-of-type`, the sections being `section` elements). The keys are identifiers,
// not strings, so that the words of the variants are not read as classes (TK7.2).
import { cn } from "@/components/ui/class-names";
import { CARD_TITLE, OVERLINE, SECTION_TITLE } from "./heading-classes";

const SECTION_BASE_CLASSES = "flex flex-col";

/** The hairline above a section, and the padding that follows it; the first section has neither. */
const SECTION_DIVIDER_CLASSES =
  "border-t-(length:--border-width-thin) border-border-default first-of-type:border-t-0 first-of-type:pt-0";

/** The padding, the gap and the title of each variant (02a C03). */
const SECTION_VARIANT_CLASSES = {
  page: { box: "gap-5 pt-5", title: SECTION_TITLE },
  reading: { box: "gap-4 py-6", title: SECTION_TITLE },
  account: { box: "gap-4 pt-5", title: CARD_TITLE },
  bo: { box: "gap-3 pt-5", title: CARD_TITLE },
  overline: { box: "gap-3 pt-5", title: OVERLINE },
};

export type SectionVariant = keyof typeof SECTION_VARIANT_CLASSES;

/** The classes of the section element. */
export function sectionClasses(
  variant: SectionVariant,
  divider: boolean,
): string {
  return cn(
    SECTION_BASE_CLASSES,
    SECTION_VARIANT_CLASSES[variant].box,
    divider ? SECTION_DIVIDER_CLASSES : undefined,
  );
}

/** The classes of the title of a section. */
export function sectionTitleClasses(variant: SectionVariant): string {
  return SECTION_VARIANT_CLASSES[variant].title;
}

/** The head of a section: the title and its count on one side, the actions on the other. */
export const SECTION_HEAD_CLASSES =
  "flex flex-wrap items-center justify-between gap-3";

/** The count beside a title, in the secondary text and the regular weight. */
export const SECTION_COUNT_CLASSES = "font-regular text-text-secondary";

/** The intro under the title. */
export const SECTION_DESCRIPTION_CLASSES = "text-sm text-text-secondary";

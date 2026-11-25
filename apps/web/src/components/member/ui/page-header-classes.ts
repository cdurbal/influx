import { cn } from "@/components/ui/class-names";

/**
 * The `h1` of a page of the connected spaces: Manrope 800, `text-title-page` (20 §11.5). Apart from
 * PageHeader, a client module, so that the server components of the journey read it as a string.
 */
export const PAGE_TITLE_CLASSES = cn(
  "font-display text-title-page font-extrabold tracking-heading text-text-primary",
);

/**
 * The `h1` of the account, the verifications and the wizards: the same face at the 20 px of the
 * section title (RU-17, D88), Manrope 800. The size is fixed, never fluid.
 */
export const SECTION_PAGE_TITLE_CLASSES = cn(
  "font-display text-title-section font-extrabold tracking-heading text-text-primary",
);

/** The head of a page: the line above, the title and its action, then the lead and the line of facts. */
export const PAGE_HEADER_CLASSES = "flex flex-col gap-3 py-4";

/** The line above the title: the way back, or the crumbs. */
export const PAGE_HEADER_ABOVE_CLASSES = "text-sm text-text-secondary";

/** The crumbs: a plain list on one line, the last item being the page itself. */
export const PAGE_HEADER_CRUMBS_CLASSES =
  "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary";

/** The title and its title-side badges. */
export const PAGE_HEADER_TITLE_ROW_CLASSES =
  "flex flex-wrap items-center gap-3";

/** The title row and the action: side by side from md on, stacked below. */
export const PAGE_HEADER_ROW_CLASSES =
  "flex flex-col gap-3 md:flex-row md:items-center md:justify-between";

export const PAGE_HEADER_ACTIONS_CLASSES =
  "flex flex-col gap-2 md:flex-row md:items-center";

/** The lead under the title, then the line of facts under the lead. */
export const PAGE_HEADER_LEAD_CLASSES = "text-md text-text-secondary";
export const PAGE_HEADER_META_CLASSES = "text-sm text-text-secondary";

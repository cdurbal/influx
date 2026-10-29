import { cn } from "@/components/ui/class-names";

/**
 * The `h1` of a page of the connected spaces: Manrope 800, `text-title-page` (20 §11.5). Apart from
 * PageHeader, a client module, so that the server components of the journey read it as a string.
 */
export const PAGE_TITLE_CLASSES = cn(
  "font-display text-title-page font-extrabold tracking-heading text-text-primary",
);

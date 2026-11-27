// Classes of the card of the feed of campaigns (C48; docs/mvp/22-refonte-ux-ui/02b C48, R04 line 2): 16 px of padding,
// 16 px corners, 8 px between its lines, the hairline `border-default` that lightens on hover with a lift of 2 px over
// 120 ms on the curve `standard`, the lift under `motion-safe:` only (colours alone under reduced motion). The brand
// with its plate of 32 px, the title in Manrope 700 as the stretched link, the deadline with its icon (the warning
// colour and the alert icon when it is close: never the colour alone), the meta at 14 px. A closed card neither lifts
// nor links.
import { cn } from "@/components/ui/class-names";

const FEED_CARD_SHAPE_CLASSES = cn(
  "relative flex min-w-0 flex-col gap-2 rounded-card border-(length:--border-width-thin) border-border-default",
  "bg-surface-card p-4",
);

/** An open card: the whole card is the zone of its one link, and lifts on hover. */
export const FEED_CARD_CLASSES = cn(
  FEED_CARD_SHAPE_CLASSES,
  "transition-lift hover:border-border-hover motion-safe:hover:translate-y-(--translate-lift)",
);

/** A closed card: flat, its state in words. */
export const FEED_CARD_CLOSED_CLASSES = FEED_CARD_SHAPE_CLASSES;

/** The brand: its plate, its name at 14 px in secondary text. */
export const FEED_CARD_BRAND_CLASSES =
  "flex min-w-0 items-center gap-2 text-sm text-text-secondary";

/** The title: Manrope 700 at 16 px. */
export const FEED_CARD_TITLE_CLASSES =
  "font-display text-md font-bold leading-snug text-text-primary";

/** The link of the title, stretched over the card by its `after`: the ring is drawn around the card. */
export const FEED_CARD_LINK_CLASSES = cn(
  "after:absolute after:inset-0 after:rounded-card",
  "focus-visible:outline-hidden focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-solid focus-visible:after:outline-focus-ring",
  "focus-visible:after:outline-offset-(--focus-ring-offset)",
);

/** The deadline: 14 px, 600, its icon of 16 px; the warning colour when it is close. */
export function feedCardDueClasses(soon: boolean): string {
  return cn(
    "inline-flex items-center gap-1 text-sm font-semibold",
    soon ? "text-feedback-warning-text" : "text-text-primary",
  );
}

export const FEED_CARD_DUE_ICON_CLASSES = "size-(--size-icon-sm) shrink-0";

/** A line of meta: 14 px in secondary text. */
export const FEED_CARD_META_CLASSES = "text-sm text-text-secondary";

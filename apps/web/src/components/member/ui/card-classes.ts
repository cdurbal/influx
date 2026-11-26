// Classes of the card of the connected spaces (docs/mvp/20 §11.8): the surface of a card never
// stands out from the page alone (1.07:1), so the hairline `border-default` always comes with it.
// The variants of C04 are the keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const CARD_SHAPE_CLASSES =
  "flex flex-col gap-4 rounded-card border-(length:--border-width-thin)";

export const MEMBER_CARD_CLASSES = cn(
  CARD_SHAPE_CLASSES,
  "border-border-default bg-surface-card p-inset-card",
);

/**
 * A card that is a click zone (a door, a choice): `surface-raised` and a lighter border on hover
 * (`border-hover`; the resting `border-strong` is the only hint on a phone), and the lift of F6
 * under `motion-safe:` only. Flat at rest.
 */
export const MEMBER_CLICKABLE_CARD_CLASSES = cn(
  "flex flex-col gap-1 rounded-card border-(length:--border-width-thin) border-border-strong",
  "bg-surface-card p-inset-card text-left transition-lift hover:border-border-hover hover:bg-surface-raised",
  "motion-safe:hover:translate-y-(--translate-lift)",
);

/** The four variants of C04 (02a): 32 px of padding (24 on a phone), 16, 24 (the sticky box), and the click zone. */
const CARD_VARIANT_CLASSES = {
  default: MEMBER_CARD_CLASSES,
  compact: cn(CARD_SHAPE_CLASSES, "border-border-default bg-surface-card p-4"),
  box: cn(CARD_SHAPE_CLASSES, "border-border-default bg-surface-card p-5"),
  link: cn(
    "relative",
    CARD_SHAPE_CLASSES,
    "border-border-strong bg-surface-card p-inset-card transition-lift",
    "hover:border-border-hover hover:bg-surface-raised",
    "motion-safe:hover:translate-y-(--translate-lift)",
  ),
};

export type CardVariant = keyof typeof CARD_VARIANT_CLASSES;

/** The classes of the card of a variant. */
export function cardClasses(variant: CardVariant): string {
  return CARD_VARIANT_CLASSES[variant];
}

/**
 * The link of a `link` card, stretched over the whole card by its `after` (one target, no button to
 * the same place): the ring is drawn around the card, not around the title only.
 */
export const CARD_LINK_CLASSES = cn(
  "after:absolute after:inset-0 after:rounded-card",
  "focus-visible:outline-hidden focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-solid focus-visible:after:outline-focus-ring",
  "focus-visible:after:outline-offset-(--focus-ring-offset)",
);

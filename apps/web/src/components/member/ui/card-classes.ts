// Classes of the card of the connected spaces (docs/mvp/20 §11.8): the surface of a card never
// stands out from the page alone (1.07:1), so the hairline `border-default` always comes with it.
import { cn } from "@/components/ui/class-names";

export const MEMBER_CARD_CLASSES = cn(
  "flex flex-col gap-4 rounded-card border-(length:--border-width-thin) border-border-default",
  "bg-surface-card p-inset-card",
);

/**
 * A card that is a click zone (a door, a choice): `surface-raised` on hover, and the lift of F6
 * under `motion-safe:` only. Flat at rest.
 */
export const MEMBER_CLICKABLE_CARD_CLASSES = cn(
  "flex flex-col gap-1 rounded-card border-(length:--border-width-thin) border-border-strong",
  "bg-surface-card p-inset-card text-left transition-lift hover:bg-surface-raised",
  "motion-safe:hover:translate-y-(--translate-lift)",
);

// Classes of the head of a brand page (C68; docs/mvp/22-refonte-ux-ui/02b C68, RU-01, 20 §11.5): a card of 32 px of
// padding (24 below 640 px), the logo of 120 px (72 below 640 px) beside the identity, one column below 640 px. The
// title steps by `text-title-hero`, a members' role (KEO_HERO_ROLES); the ground is the plain one of a card, no
// effect of the landing (G8). Plain strings where a class holds `[` (CA22).
import { cn } from "@/components/ui/class-names";

export const BRAND_HERO_CLASSES = [
  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6 p-6",
  "max-form:grid-cols-1 max-form:gap-4 max-form:p-5",
  "rounded-card border-(length:--border-width-thin) border-border-default bg-surface-card",
].join(" ");

// Below 640 px the plate of 120 px (C33) comes down to 72 px, the sum of two steps of the spacing scale.
export const BRAND_HERO_LOGO_CLASSES = [
  "max-form:size-[calc(var(--spacing-9)+var(--spacing-2))] max-form:text-md",
].join(" ");

export const BRAND_HERO_IDENTITY_CLASSES = "flex min-w-0 flex-col gap-2";

export const BRAND_HERO_TITLE_CLASSES = cn(
  "min-w-0 break-words font-display text-title-hero font-extrabold tracking-heading",
  "focus:outline-hidden",
);

export const BRAND_HERO_META_CLASSES =
  "flex flex-wrap items-center gap-x-3 gap-y-2 text-text-secondary";

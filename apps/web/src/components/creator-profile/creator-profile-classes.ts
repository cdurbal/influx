// Classes shared by the cards of blocks 3 and 4 of "mon profil" (creator; jalons/l2d, commit 16,
// L2DU-1). Only the classes of the scale of the connected spaces: the titles of a line and of a group
// are bold and Manrope like the labels' own, never lighter than them (the old `text-lg` produced no
// rule: no such size exists in tokens.css).
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";

/** The name of a network, title of a card of block 3 or 4: 20 px bold. */
export const LINE_TITLE_CLASSES = cn(
  "font-display text-title-section font-bold leading-snug text-text-primary",
);

/** The title of a group inside a card ("Vos trois chiffres clés", "Pays de votre audience"): 16 px bold. */
export const GROUP_TITLE_CLASSES = cn(CARD_TITLE, "text-text-primary");

/** A native fold (`<details>`) that opens on a text button's worth of height: 44 px to touch. */
export const FOLD_SUMMARY_CLASSES =
  "flex min-h-(--size-touch-target) cursor-pointer items-center gap-2 rounded-md text-md font-semibold text-text-primary";

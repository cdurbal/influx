// The titles of the connected spaces below the `h1` (docs/mvp/20 §11.5; D75 RK-5, RK-6): Manrope at
// the fixed sizes of the KEO scale, never a fluid size of the vitrine. Plain strings, so that the
// server components of the journey read them as well as the client ones. The colour is the
// container's own (text-primary), set once by the member layout.

/** The `h2` of a section: 20 px bold, tightened as the `h1` (the approach is for 20 px and more). */
export const SECTION_TITLE =
  "font-display text-title-section font-bold tracking-heading";

/** The `h2` or `h3` of a card: 16 px bold, left at its natural spacing (a tight 16 px sticks letters). */
export const CARD_TITLE = "font-display text-md font-bold leading-snug";

/** A small label above a title: Manrope 700 capitals, secondary text, never green (20 §11.4). */
export const OVERLINE =
  "font-display text-xs font-bold uppercase tracking-overline text-text-secondary";

// Classes of the actions of a card (C12; docs/mvp/22-refonte-ux-ui/02a §3, U45): they wrap, 12 px
// apart; under 480 px they may stretch to the width of the card.

export const CARD_ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";

/** The children take the whole width below `sm` (480 px), and only there. */
export const CARD_ACTIONS_STRETCH_CLASSES = "max-sm:*:w-full";

// Classes of the layout of a reading page (C40; docs/mvp/22-refonte-ux-ui/02b C40): below 1 024 px one column, the
// box after the content; from 1 024 px the columns of `grid-reading` (7 / 4, 19 rem at least for the box), 64 px
// apart, the box at the top of its column so that it can stay in view. A paragraph of the content stops at
// `measure-text` (40 rem); the figures and the media take the whole column. A plain string where a class holds `[`
// (CA22).

export const READING_LAYOUT_CLASSES =
  "flex flex-col gap-6 lg:grid lg:grid-cols-(--grid-reading) lg:items-start lg:gap-9";

export const READING_MAIN_CLASSES =
  "flex min-w-0 flex-col [&_p]:max-w-(--measure-text)";

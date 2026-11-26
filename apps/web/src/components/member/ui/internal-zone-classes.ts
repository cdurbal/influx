// Classes of the internal zone (C24; docs/mvp/22-refonte-ux-ui/02a C24): the fields only INFLUX sees, on the page
// ground inside a dashed `border-strong` frame, 12 px corners, 16 px of padding, 24 px between its parts. The dash
// and the title with its crossed eye tell what the zone is: the frame is never the only sign.

/** The frame: the dashes are the line of a zone that no member reads. */
export const INTERNAL_ZONE_CLASSES =
  "flex flex-col gap-5 rounded-md border-(length:--border-width-thin) border-dashed border-border-strong bg-surface-page p-4";

/** The title: 14 px in 700, the crossed eye then the words. */
export const INTERNAL_ZONE_TITLE_CLASSES =
  "flex items-center gap-2 font-display text-sm font-bold text-text-secondary";

export const INTERNAL_ZONE_ICON_CLASSES = "size-(--size-icon-sm) shrink-0";

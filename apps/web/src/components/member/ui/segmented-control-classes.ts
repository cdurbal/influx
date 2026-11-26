// Classes of the segmented control (C22; docs/mvp/22-refonte-ux-ui/02a C22, R04 line 6): a `surface-raised` track,
// 4 px of padding and 4 px between the segments, segments of 36 px in 14 px 600, the active one on `surface-active` in
// `text-primary`, the inactive ones in `text-secondary` (their count too, X7). Never green (U34). The colour changes
// over 120 ms on the curve `standard` (the default transition of the theme), instantly under reduced motion.
//
// The active segment carries a contour that is transparent: under forced colours the fills fall away and the system
// draws the contour, so that the state stays told (AP1, RUB-B §5). The ring of the focus is drawn by a pseudo-element
// over the segment, so that the contour of the active one and the ring never fight for the same outline. The kinds
// and the keys are bare keys of their objects, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

/** The kinds: a choice (`radio`), tabs that show a panel (`tabs`), views that are links (`views`). */
const SEGMENTED_TRACK_CLASSES = {
  radio: "inline-flex max-w-full flex-wrap gap-1 rounded-pill p-1",
  tabs: "grid w-full grid-cols-2 gap-1 rounded-md p-1 form:inline-flex form:w-auto form:max-w-full form:flex-wrap form:rounded-pill",
  views: "inline-flex max-w-full flex-wrap gap-1 rounded-pill p-1",
};

export type SegmentedKind = keyof typeof SEGMENTED_TRACK_CLASSES;

/** The track: the raised ground the segments sit on. */
export function segmentedTrackClasses(kind: SegmentedKind): string {
  return cn("bg-surface-raised", SEGMENTED_TRACK_CLASSES[kind]);
}

/** The radius of a segment: a pill, but the tabs of a phone (two columns) keep the 12 px of their track. */
const SEGMENT_RADIUS_CLASSES = {
  radio: "rounded-pill after:rounded-pill",
  tabs: "rounded-md after:rounded-md form:rounded-pill form:after:rounded-pill",
  views: "rounded-pill after:rounded-pill",
};

const SEGMENT_BASE_CLASSES = cn(
  "relative inline-flex min-h-(--size-tag) cursor-pointer items-center justify-center gap-2 px-4",
  "text-sm font-semibold transition-colors",
  "after:pointer-events-none after:absolute after:inset-0",
  "focus-visible:outline-hidden",
);

const SEGMENT_REST_CLASSES = "text-text-secondary hover:text-text-primary";

const SEGMENT_ACTIVE_CLASSES = cn(
  "bg-surface-active text-text-primary",
  "outline-solid outline-(length:--border-width-thick) outline-transparent",
  "outline-offset-(--focus-ring-offset-inset)",
);

/** The ring of a segment whose real control is a hidden radio inside it: it shows with the focus of the keyboard. */
const SEGMENT_RADIO_RING_CLASSES = cn(
  "has-focus-visible:after:outline-solid has-focus-visible:after:outline-(length:--focus-ring-width)",
  "has-focus-visible:after:outline-focus-ring has-focus-visible:after:outline-offset-(--focus-ring-offset)",
);

/** The ring of a segment that is itself the control (a tab, a link). */
const SEGMENT_OWN_RING_CLASSES = cn(
  "focus-visible:after:outline-solid focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-focus-ring focus-visible:after:outline-offset-(--focus-ring-offset)",
);

const SEGMENT_RING_CLASSES = {
  radio: SEGMENT_RADIO_RING_CLASSES,
  tabs: SEGMENT_OWN_RING_CLASSES,
  views: SEGMENT_OWN_RING_CLASSES,
};

/** One segment: its radius by kind, its ground by state, its ring by what holds the focus. */
export function segmentClasses(kind: SegmentedKind, active: boolean): string {
  return cn(
    SEGMENT_BASE_CLASSES,
    SEGMENT_RADIUS_CLASSES[kind],
    active ? SEGMENT_ACTIVE_CLASSES : SEGMENT_REST_CLASSES,
    SEGMENT_RING_CLASSES[kind],
  );
}

/** The real radio of a segment: over the whole segment, invisible, it takes the click and the keyboard. */
export const SEGMENT_RADIO_CLASSES =
  "absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0";

/** The count of a segment: it takes the colour of its segment (secondary when the segment is inactive). */
export const SEGMENT_COUNT_CLASSES = "tabular-nums";

/** The legend of the radios: read, not seen (the screen shows what the control chooses). */
export const SEGMENT_LEGEND_CLASSES = "sr-only";

/** The list of the links of a `views` control: no bullet, no margin. */
export const SEGMENT_LIST_CLASSES = "m-0 list-none p-0";

/** The fieldset of the radios: no frame. */
export const SEGMENT_FIELDSET_CLASSES = "m-0 min-w-0 border-0 p-0";

/** The item of the list of a `views` control: the link inside it is the segment. */
export const SEGMENT_ITEM_CLASSES = "flex";

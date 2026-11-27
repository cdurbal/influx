// Classes of the photo card (C31; docs/mvp/22-refonte-ux-ui/02b C31, 02c, R04 lines 11 to 15 and 22, RUB-B §5 AP1 and
// AP2, 20 §11.8): a photo of 4 / 3 with 16 px corners on `surface-raised`, the lines under it 12 px below and 2 px
// apart. The one module of the member front that reads the four `effect-photo-*` tokens (G8, PHOTO_EFFECT_READERS):
// the dark badge on `effect-photo-scrim-strong`, the heart filled with `effect-photo-scrim-soft`, and the shadow of
// every glyph laid on the photo without a ground of its own (the heart, the dots). Every control laid on the photo (the
// heart, the arrows) has a double ring: the usual `focus-ring` over a halo of `surface-page` (AP2). The heart is never
// green: saved, it is filled with `text-primary`, and a transparent contour stands for its fill under forced colours
// (AP1). The badge tones are the bare keys of their object, not quoted strings (TK7.2). Plain strings where a class
// holds `[` or `opacity-0`: the lint forbids them inside `cn()` (CA22).
import { cn } from "@/components/ui/class-names";
import { TOUCH_ZONE_AREA_CLASSES } from "./touch-zone-classes";

/**
 * The card: a column, the photo then the lines. It leaves a selection (R04 line 22) by fading out and shrinking to
 * 0,96 over 200 ms on the curve `standard`; under reduced motion the duration is zero and nothing shrinks, the screen
 * removing it at once.
 */
export const PHOTO_CARD_CLASSES = [
  "relative flex min-w-0 flex-col gap-3",
  "transition-[opacity,scale] duration-(--duration-base) ease-(--ease-standard)",
  "data-leaving:opacity-0 motion-safe:data-leaving:scale-(--scale-leave)",
].join(" ");

/** The photo: its ground while a visual is missing or loading, its corners; the controls are laid on it. */
export const PHOTO_CARD_PHOTO_CLASSES =
  "group/photo relative rounded-card bg-surface-raised";

/**
 * The track of the visuals (R04 line 11): a region that scrolls sideways and snaps one visual at a time, smoothly
 * under `motion-safe:` only, without a scroll bar; above the stretched link, so that a finger swipes it. It takes
 * the focus (X8) and its ring stands outside the photo, on the page.
 */
export const PHOTO_CARD_TRACK_CLASSES = [
  "relative z-(--z-raised) flex aspect-photo snap-x snap-mandatory overflow-x-auto rounded-card",
  "motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
].join(" ");

/** The photo without a track: one visual (a selection, a card without a second visual). */
export const PHOTO_CARD_STILL_CLASSES =
  "aspect-photo overflow-hidden rounded-card";

/** One visual of the track: the whole width, snapped at its start. */
export const PHOTO_CARD_SLIDE_CLASSES =
  "size-full shrink-0 basis-full snap-start";

/** The picture of a visual: it covers its box. A missing source leaves the ground of the photo. */
export const PHOTO_CARD_IMAGE_CLASSES = "size-full object-cover";

/** The ring of a control on a photo: the usual one, over a halo of `surface-page` wide enough to frame it (AP2). */
export const PHOTO_CONTROL_RING_CLASSES = [
  "focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus-ring",
  "focus-visible:outline-offset-(--focus-ring-offset)",
  "focus-visible:shadow-[0_0_0_calc(var(--focus-ring-offset)+var(--focus-ring-width)+var(--border-width-thick))_var(--color-surface-page)]",
].join(" ");

/** The tones of the badge laid top left: the light pill, or the dark one on the scrim of 82 % (20 §11.5). */
const PHOTO_BADGE_TONE_CLASSES = {
  light: "bg-surface-inverse text-text-inverse shadow-sm",
  dark: "bg-(--effect-photo-scrim-strong) text-text-primary",
};

export type PhotoBadgeTone = keyof typeof PHOTO_BADGE_TONE_CLASSES;

/** The badge: 12 px, Manrope 700, in a pill, top left of the photo. */
export function photoBadgeClasses(tone: PhotoBadgeTone): string {
  return cn(
    "absolute left-3 top-3 z-(--z-raised) inline-flex items-center rounded-pill px-3 py-1",
    "font-display text-xs font-bold",
    PHOTO_BADGE_TONE_CLASSES[tone],
  );
}

/**
 * The heart (R04 lines 14 and 15): 44 px top right, its icon of 26 px. It grows to 1,03 on hover and shrinks to 0,9
 * on press over 120 ms, under `motion-safe:` and while it may be pressed; saved, its transparent contour is drawn by
 * forced colours, and the ring replaces it at focus.
 */
const PHOTO_HEART_BASE_CLASSES = [
  "absolute right-2 top-2 z-(--z-raised) inline-flex size-(--size-touch-target) items-center justify-center",
  "rounded-round text-text-primary transition-transform duration-(--duration-fast) ease-(--ease-standard)",
  "motion-safe:not-aria-disabled:hover:scale-(--scale-hover) motion-safe:not-aria-disabled:active:scale-(--scale-heart-press)",
  "aria-disabled:cursor-not-allowed",
  PHOTO_CONTROL_RING_CLASSES,
].join(" ");

const PHOTO_HEART_SAVED_CONTOUR_CLASSES = cn(
  "outline-solid outline-(length:--border-width-thick) outline-transparent",
  "outline-offset-(--focus-ring-offset-inset)",
);

export function photoHeartClasses(saved: boolean): string {
  return cn(
    PHOTO_HEART_BASE_CLASSES,
    saved && PHOTO_HEART_SAVED_CONTOUR_CLASSES,
  );
}

const PHOTO_HEART_ICON_BASE_CLASSES = [
  "size-(--size-icon-heart) stroke-text-primary filter-(--effect-photo-shadow)",
  "transition-[fill] duration-(--duration-base) ease-(--ease-standard)",
].join(" ");

/**
 * The icon of the heart: the stroke in `text-primary`, the fill on the soft scrim (3,15:1 on white), filled in
 * `text-primary` once saved over 200 ms, with a pop when it has just been (R04 line 15), and the shadow of a glyph on
 * a photo.
 */
export function photoHeartIconClasses(
  saved: boolean,
  popping: boolean,
): string {
  return cn(
    PHOTO_HEART_ICON_BASE_CLASSES,
    saved ? "fill-text-primary" : "fill-(--effect-photo-scrim-soft)",
    popping && "animate-pop",
  );
}

/**
 * An arrow (R04 line 12): 32 px, inverse, at the middle of a side; it fades in over 120 ms on the hover of the photo or
 * at its own focus, and its touch zone reaches 44 px. There is none on a screen without hover; at an end of the track
 * it is hidden.
 */
export const PHOTO_ARROW_CLASSES = [
  "absolute top-1/2 z-(--z-raised) inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-round",
  "bg-surface-inverse text-text-inverse shadow-sm",
  "transition-opacity duration-(--duration-fast) ease-(--ease-standard)",
  "not-group-hover/photo:not-focus-visible:opacity-0 disabled:invisible [@media(hover:none)]:hidden",
  TOUCH_ZONE_AREA_CLASSES,
  PHOTO_CONTROL_RING_CLASSES,
].join(" ");

export const PHOTO_ARROW_PREVIOUS_CLASSES = "left-2";
export const PHOTO_ARROW_NEXT_CLASSES = "right-2";

export const PHOTO_ARROW_ICON_CLASSES = "size-(--size-icon-sm)";

/** The dots: under the middle of the photo, inert, with the shadow of a glyph on a photo. */
export const PHOTO_DOTS_CLASSES = [
  "pointer-events-none absolute bottom-3 left-1/2 z-(--z-raised) flex -translate-x-1/2 gap-1",
  "filter-(--effect-photo-shadow)",
].join(" ");

const PHOTO_DOT_BASE_CLASSES = [
  "h-(--size-segment-bar) rounded-pill",
  "transition-[width,background-color] duration-(--duration-fast) ease-(--ease-standard)",
].join(" ");

/**
 * A dot of 6 px (R04 line 13; RU-09): `text-secondary`, the current one `text-primary` and 16 px wide, its width and
 * its colour changing over 120 ms on the curve `standard`, at once under reduced motion. Never an opacity.
 */
export function photoDotClasses(current: boolean): string {
  return cn(
    PHOTO_DOT_BASE_CLASSES,
    current
      ? "w-4 bg-text-primary"
      : "w-(--size-segment-bar) bg-text-secondary",
  );
}

/** The lines under the photo: 2 px apart. */
export const PHOTO_CARD_BODY_CLASSES = "flex flex-col gap-(--size-nudge)";

/** The first line: the alias on the left, the verified mark on the right, never glued to the name (D88). */
export const PHOTO_CARD_HEAD_CLASSES =
  "flex items-center justify-between gap-2";

/**
 * The alias: Manrope 700, the one link of the card, stretched over it by its `after`; the ring is drawn around the
 * whole card, under the controls laid on the photo.
 */
export const PHOTO_CARD_LINK_CLASSES = cn(
  "font-display font-bold text-text-primary",
  "after:absolute after:inset-0 after:rounded-card",
  "focus-visible:outline-hidden focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-solid focus-visible:after:outline-focus-ring",
  "focus-visible:after:outline-offset-(--focus-ring-offset)",
);

/** The verified mark of the card (RU-02, D88): the blue icon of 20 px, its words for the screen reader. */
export const PHOTO_CARD_VERIFIED_CLASSES = "shrink-0 text-verified-text";
export const PHOTO_CARD_VERIFIED_ICON_CLASSES = "size-(--size-icon-md)";

/** A line: 14 px on one line, the first in primary text, the others in secondary text. */
export function photoCardLineClasses(first: boolean): string {
  return cn(
    "line-clamp-1 text-sm",
    first ? "text-text-primary" : "text-text-secondary",
  );
}

/** « Suggested because »: 12 px on one line, tertiary text, its bold words in secondary text. */
export const PHOTO_CARD_WHY_CLASSES =
  "mt-1 line-clamp-1 text-xs text-text-tertiary [&_b]:font-semibold [&_b]:text-text-secondary";

/** A refusal of the heart (a full list, a creator no longer shown): its sentence under the lines, in words. */
export const PHOTO_CARD_REFUSAL_CLASSES = "text-sm text-feedback-warning-text";

/** The note of a selection: under the lines, after a hairline. */
export const PHOTO_CARD_NOTE_CLASSES = cn(
  "flex flex-col gap-2 border-t-(length:--border-width-thin) border-border-subtle pt-2 text-sm",
);

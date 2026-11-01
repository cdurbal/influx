// Token-only classes of the "mon compte" screens (docs/mvp/17 §6), beside those of the journey
// (src/components/auth/auth-classes.ts) they share. Members' register, dark theme, mobile first
// (skill design-system-influx); every value is a token of src/styles/tokens.css (CA22, G3).
import { cn } from "@/components/ui/class-names";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { SECTION_TITLE } from "@/components/member/ui/heading-classes";
import { noticeClasses } from "@/components/member/ui/notice-classes";
import { statusBadgeClasses } from "@/components/member/ui/status-badge-classes";

/**
 * A destructive action: a solid red button, light text, INFLUX pill (zone-de-danger fiche §5).
 * Its label says what it does (17 §6.3, never an icon alone); offline (`aria-disabled`) it is grey.
 */
export const DESTRUCTIVE_BUTTON_CLASSES = memberButtonClasses("danger", "md");

/**
 * The danger notice: the container's own background, a full 1 px red border and red text, with an
 * icon beside it (never the color alone, P7). No tinted fill (zone-de-danger fiche §5).
 */
export const DANGER_NOTICE_CLASSES = cn(
  "flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-feedback-error-border",
  "px-4 py-3 text-sm text-feedback-error-text",
);

/** A success: teal, a family distinct from the brand green (skill design-system-influx). */
export const SUCCESS_CLASSES = noticeClasses("success");

/** "Cet appareil": a tag in words, never a color alone (WCAG AA). */
export const TAG_CLASSES = statusBadgeClasses("neutral");

/** The two lists of the deletion, side by side from md, of the same weight (17 §6.3). */
export const TWO_LISTS_CLASSES = "grid gap-4 md:grid-cols-2";

export const LIST_CLASSES =
  "flex list-disc flex-col gap-2 pl-5 text-md text-text-primary";

/** A line of facts under a title (dates, status). */
export const META_CLASSES = "text-sm text-text-secondary";

export const SECTION_TITLE_CLASSES = cn(SECTION_TITLE, "text-text-primary");

/** Actions side by side when they fit, stacked otherwise; labels wrap, never truncated. */
export const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";

/**
 * « ‹ Mon compte » above the h1 of a sub-page (D74): a link of its own, the chevron beside the
 * word, a full touch target.
 */
export const BACK_LINK_CLASSES = cn(
  "inline-flex min-h-(--size-touch-target) items-center gap-1 rounded-md",
  "text-sm font-medium text-text-secondary hover:text-text-primary",
);

export const BACK_ICON_CLASSES = "size-(--size-icon-sm) shrink-0";

/** A link inside a text: underlined, so that it is not told by its color alone. */
export const INLINE_LINK_CLASSES =
  "font-medium text-text-primary underline underline-offset-2 hover:text-text-brand";

/**
 * The page-menu of "mon compte" (17 §6.0; 20 page-menu): full-width rows split by a subtle line.
 * The row is `relative` so that the label's link, stretched by its `after`, covers it whole; the
 * focus ring is drawn by that `after` around the row (the link's own outline would ring its label
 * only), and the row lights up on hover.
 */
export const HUB_LIST_CLASSES = cn(
  "flex flex-col border-t-(length:--border-width-thin) border-border-subtle",
);

export const HUB_ROW_CLASSES = cn(
  "relative flex min-h-(--size-touch-target) items-center gap-3 rounded-md px-3 py-3",
  "border-b-(length:--border-width-thin) border-border-subtle",
  "transition-colors hover:bg-surface-raised",
);

export const HUB_LINK_CLASSES = cn(
  "text-md font-semibold text-text-primary",
  "after:absolute after:inset-0 after:rounded-md",
  "focus-visible:outline-hidden focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-solid focus-visible:after:outline-focus-ring",
  "focus-visible:after:outline-offset-(--focus-ring-offset-inset)",
);

export const HUB_SENTENCE_CLASSES = "text-sm text-text-secondary";

export const HUB_ICON_CLASSES =
  "size-(--size-icon-md) shrink-0 text-text-secondary";

export const HUB_CHEVRON_CLASSES =
  "size-(--size-icon-md) shrink-0 text-text-secondary";

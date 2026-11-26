// Classes of the notices of the connected spaces (docs/mvp/20 §11.8; 22-refonte-ux-ui/02a C17): success,
// warning and information keep an opaque tinted fill (DZ-6). The error notice is ErrorNotice, the one place
// of the error fill (D72, T15), so it is not a tone of this file. The icon is 16 px, a 12 px gap follows it
// (it was 20 px and 8 px before RUB). The sizes are the keys of their object: `md` aligns the icon with the
// first line of its text; `strip` is a band whose icon, text and action share one line and wrap together.
import { cn } from "@/components/ui/class-names";

export type NoticeTone = "success" | "warning" | "info";

const NOTICE_BASE_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) px-4 py-3 text-sm",
);

/** The row of a notice that holds an icon: the 12 px gap, then the size's own alignment. */
const NOTICE_ROW_CLASSES = "flex gap-3";

const NOTICE_SIZES = {
  md: {
    box: "items-start",
    icon: "mt-(--size-nudge)",
    body: "min-w-0",
  },
  strip: {
    box: "flex-wrap items-center",
    icon: "",
    body: "min-w-(--size-note-min) grow",
  },
};

export type NoticeSize = keyof typeof NOTICE_SIZES;

const NOTICE_TONE_CLASSES: Record<NoticeTone, string> = {
  success:
    "border-feedback-success-border bg-feedback-success-bg text-feedback-success-text",
  warning:
    "border-feedback-warning-border bg-feedback-warning-bg text-feedback-warning-text",
  // The information notice reads in the primary text; its icon carries the blue (20 §11.8).
  info: "border-feedback-info-border bg-feedback-info-bg text-text-primary",
};

/** The `md` size when none is given: the notice as it has always been drawn. */
function sizeOf(size: NoticeSize | undefined) {
  return size === undefined ? NOTICE_SIZES.md : NOTICE_SIZES[size];
}

/** The box and the tone alone: the text blocks of the forms and of the account (no icon, no row). */
export function noticeClasses(tone: NoticeTone): string {
  return cn(NOTICE_BASE_CLASSES, NOTICE_TONE_CLASSES[tone]);
}

/** The box, the tone, and the row of the icon, the text and the action. */
export function noticeRowClasses(tone: NoticeTone, size?: NoticeSize): string {
  return cn(noticeClasses(tone), NOTICE_ROW_CLASSES, sizeOf(size).box);
}

/** The icon: 16 px, nudged to the first line of an `md` notice, centred on a strip. */
export function noticeIconClasses(size?: NoticeSize): string {
  return cn("size-(--size-icon-sm) shrink-0", sizeOf(size).icon);
}

/** The body: the text and its title, which a strip lets grow and wrap before its action. */
export function noticeBodyClasses(size?: NoticeSize): string {
  return sizeOf(size).body;
}

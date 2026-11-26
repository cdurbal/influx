// Classes of the summary of the errors of a form and of the list of what is missing (C20;
// docs/mvp/22-refonte-ux-ui/02a C20): the summary has the outline of the errors (`feedback-error-border`), 12 px
// corners, 16 px of padding, a title in Manrope 700 with a 20 px icon and links of 14 px. It is not the notice of
// an error (ErrorNotice, the one place of the error fill): it has no fill, and it takes the focus.

/** The box of the summary: an outline, no fill; the focus lands on it, its ring is that of `globals.css`. */
export const ERROR_SUMMARY_CLASSES =
  "flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-feedback-error-border p-4";

/** The title: the icon and Manrope 700, on one line that may wrap. */
export const ERROR_SUMMARY_TITLE_CLASSES =
  "flex items-start gap-2 font-display text-md font-bold leading-snug text-text-primary";

export const ERROR_SUMMARY_ICON_CLASSES =
  "size-(--size-icon-md) shrink-0 text-feedback-error-icon";

export const ERROR_SUMMARY_LIST_CLASSES = "flex flex-col";

/** One item: the link, then the reason, on a line of 44 px at least. */
export const ERROR_SUMMARY_ITEM_CLASSES =
  "flex min-h-(--size-touch-target) flex-wrap items-center gap-x-3";

/** The link to a field: 14 px, underlined at rest (1.4.1), the ring of the system. */
export const ERROR_SUMMARY_LINK_CLASSES =
  "rounded-sm text-sm font-semibold text-text-primary underline underline-offset-(--offset-link) hover:text-text-brand";

export const ERROR_SUMMARY_REASON_CLASSES = "text-sm text-text-secondary";

/** The list of what is missing: lines of alert, one per missing thing. */
export const MISSING_LIST_CLASSES = "flex flex-col";

export const MISSING_ITEM_CLASSES =
  "flex min-h-(--size-touch-target) flex-wrap items-center gap-x-3 gap-y-1";

export const MISSING_ICON_CLASSES =
  "size-(--size-icon-sm) shrink-0 text-feedback-warning-icon";

export const MISSING_LABEL_CLASSES = "min-w-0 text-sm text-text-primary";

export const MISSING_LINK_CLASSES = ERROR_SUMMARY_LINK_CLASSES;

// Classes of the state message of the connected spaces (docs/mvp/22-refonte-ux-ui/02a C08): no frame, a
// 24 px icon in `text-tertiary`, a title in the style of a section title, a sentence, one action at most;
// 32 px of padding above and below, 12 px between the parts, 40 rem wide at most. The `inline` kind is one
// line: a check in the success teal and a sentence. The six kinds are the keys of their object, not quoted
// strings (TK7.2); the one difference between them is the shape, the icon and the words are the caller's.
import { SECTION_TITLE } from "./heading-classes";

const EMPTY_STATE_BLOCK_CLASSES =
  "flex max-w-(--measure-text) flex-col items-start gap-3 py-6";

const EMPTY_STATE_KIND_CLASSES = {
  empty: EMPTY_STATE_BLOCK_CLASSES,
  filtered: EMPTY_STATE_BLOCK_CLASSES,
  error: EMPTY_STATE_BLOCK_CLASSES,
  closed: EMPTY_STATE_BLOCK_CLASSES,
  sent: EMPTY_STATE_BLOCK_CLASSES,
  inline: "flex max-w-(--measure-text) items-center gap-2 py-2",
};

export type EmptyStateKind = keyof typeof EMPTY_STATE_KIND_CLASSES;

export function emptyStateClasses(kind: EmptyStateKind): string {
  return EMPTY_STATE_KIND_CLASSES[kind];
}

/** The icon of the block kinds: 24 px, tertiary, decorative. */
export const EMPTY_STATE_ICON_CLASSES =
  "size-(--size-icon-lg) shrink-0 text-text-tertiary";

/** The check of the `inline` kind: 20 px, in the teal of the success (never green: it is not a brand action). */
export const EMPTY_STATE_INLINE_ICON_CLASSES =
  "size-(--size-icon-md) shrink-0 text-feedback-success-icon";

/** The title is a paragraph in the style of a section title, never a level of heading (RUB-B PT5, RU-12). */
export const EMPTY_STATE_TITLE_CLASSES = SECTION_TITLE;

export const EMPTY_STATE_BODY_CLASSES = "text-md text-text-secondary";

export const EMPTY_STATE_INLINE_TEXT_CLASSES = "text-md text-text-secondary";

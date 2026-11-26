// Classes of the group of choices (C21; docs/mvp/22-refonte-ux-ui/02a C21): the rows, the boxes and the radios are
// those of the fields (`field-classes`); here are the help and the reason of one option, written under its label
// and drawn in line with the label rather than with the box.

/** One option that has a help or a reason: the row, then its notes, in a column. */
export const CHOICE_OPTION_COLUMN_CLASSES = "flex flex-col";

// The box (24 px) and the gap that follows it (12 px): the notes line up with the label. A plain string: the lint
// forbids `[` inside `cn()` (CA22).
const CHOICE_NOTE_INDENT_CLASSES =
  "pl-[calc(var(--size-checkbox)+var(--spacing-3))]";

/** The help and the reason of an option: 14 px in secondary text under its label, never inside the label. */
export const CHOICE_OPTION_NOTE_CLASSES = `-mt-1 pb-2 text-sm text-text-secondary ${CHOICE_NOTE_INDENT_CLASSES}`;

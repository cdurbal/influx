// The cap of a multiple choice, as the screen applies it before the database arbitrates (06 RG15,
// RG27: secondary sectors 2, topics 3, markets 5, ...). A choice over the cap is refused, never
// silently replaced: the list is returned as it was.

/** The list after the member ticks or unticks `code`; unchanged when the cap would be exceeded. */
export function toggleChoice(
  selected: readonly string[],
  code: string,
  max: number,
): string[] {
  if (selected.includes(code)) {
    return selected.filter((chosen) => chosen !== code);
  }
  if (selected.length >= max) {
    return [...selected];
  }
  return [...selected, code];
}

/** True when `code` cannot be ticked now: not chosen, and the cap is reached. */
export function isChoiceBlocked(
  selected: readonly string[],
  code: string,
  max: number,
): boolean {
  return !selected.includes(code) && selected.length >= max;
}

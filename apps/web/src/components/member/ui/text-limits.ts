// The length of a text, counted as the API and the database count it: in characters (code points),
// not in UTF-16 units (packages/contracts brand-profile.ts `codeCount`).

export function countCharacters(value: string): number {
  return [...value].length;
}

/** The text cut to `max` characters: what exceeds is refused, a paste included. */
export function limitCharacters(value: string, max: number): string {
  const characters = [...value];
  return characters.length <= max ? value : characters.slice(0, max).join("");
}

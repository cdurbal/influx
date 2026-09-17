/**
 * Joins class names and skips falsy values. Named `cn` on purpose: the Tailwind ESLint plugin
 * checks every class passed to `cn(...)`, so variant maps stay token-checked (CA22).
 */
export function cn(
  ...classes: ReadonlyArray<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

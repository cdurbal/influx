// The counter of the navigation entries (docs/mvp/17 §2.2): "9+" above nine, nothing at zero.

/** The visible text of a counter pill, or null when there is nothing to show. */
export function counterText(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  return count > 9 ? "9+" : String(Math.trunc(count));
}

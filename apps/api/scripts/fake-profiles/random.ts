// Deterministic pseudo-random helpers of the fake-profile seeder: the same seed always draws the
// same 100 creators and 50 brands, so a re-run recreates the same people and skips the ones that
// already exist.

export type Rng = () => number;

/** mulberry32: a small, fast, seedable generator of floats in [0, 1). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function int(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("pick() of an empty list");
  }
  return item;
}

/** `[value, weight]` pairs. */
export function weighted<T>(
  rng: Rng,
  entries: readonly (readonly [T, number])[],
): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let ticket = rng() * total;
  for (const [value, weight] of entries) {
    ticket -= weight;
    if (ticket < 0) {
      return value;
    }
  }
  const last = entries[entries.length - 1];
  if (last === undefined) {
    throw new Error("weighted() of an empty list");
  }
  return last[0];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    const held = copy[index] as T;
    copy[index] = copy[other] as T;
    copy[other] = held;
  }
  return copy;
}

/** `count` distinct items. */
export function sample<T>(rng: Rng, items: readonly T[], count: number): T[] {
  return shuffle(rng, items).slice(0, count);
}

/** A log-uniform integer between `min` and `max`: how follower counts really spread. */
export function logUniform(rng: Rng, min: number, max: number): number {
  return Math.round(
    Math.exp(Math.log(min) + rng() * (Math.log(max) - Math.log(min))),
  );
}

/** Removes accents and anything a handle or an e-mail local part cannot carry. */
export function slug(value: string, separator = "."): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "");
}

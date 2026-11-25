// The comparators of the visual acceptance (docs/mvp/22-refonte-ux-ui/05 §3; RUA-03): pure functions
// over what capture.ts reads in the browser, tested alone by tests/visual-compare.test.ts. Each one
// returns the differences it finds, one line each; an empty list is "0 écart". N3 (the captures) is
// Playwright's toHaveScreenshot, with the options below.

/** A color as sRGB channels (0 to 255) and its alpha (0 to 1), as `rgbaOf` (rendering.ts) reads it. */
export type VisualColor = { r: number; g: number; b: number; a: number };

/**
 * The tolerances of N2 (05 §3): 0 on colors, family, weight, size, radius, widths, line height,
 * spacings; 1 px on a position, a width and a height (sub-pixel rounding); the stacking and the
 * sticky or fixed position identical. A text block of the same number of lines has the same height
 * within that pixel: a line more or less is a multiple of the line height, far beyond it.
 */
export const N2_TOLERANCES = { geometryPx: 1 } as const;

/**
 * N3 (05 §3): at most 0.5 % of the pixels of a zone differ, a pixel differs beyond a distance of 0.1;
 * anti-aliasing is excluded (Playwright's default). Animations are already off (reduced motion).
 */
export const N3_SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.005,
  threshold: 0.1,
  animations: "disabled",
  caret: "hide",
  scale: "css",
} as const;

/** The masks 05 §3 allows, and only them (a closed list). */
export const MASK_KINDS = [
  "photo",
  "logo",
  "current-time",
  "account-email",
  "environment-banner",
] as const;

export type MaskKind = (typeof MASK_KINDS)[number];

/** Whether a string names a mask that 05 §3 allows. */
export function isMaskKind(kind: string): kind is MaskKind {
  return (MASK_KINDS as readonly string[]).includes(kind);
}

/** The value written in place of a `{variable}` of a wording (N1 excludes them). */
export const VARIABLE_MARK = "{variable}";

/** The lines of an ARIA snapshot, each trimmed at the end, the `{variable}` values replaced. */
export function normalizedAria(
  snapshot: string,
  variables: readonly RegExp[] = [],
): string[] {
  return snapshot
    .split("\n")
    .map((line) =>
      variables
        .reduce(
          (text, variable) =>
            text.replace(
              new RegExp(
                variable.source,
                variable.flags.includes("g")
                  ? variable.flags
                  : `${variable.flags}g`,
              ),
              VARIABLE_MARK,
            ),
          line,
        )
        .trimEnd(),
    )
    .filter((line) => line.trim() !== "");
}

/** The landmarks of an ARIA snapshot, in order, with their names: the order of the zones. */
export function zonesOf(lines: readonly string[]): string[] {
  return lines.flatMap((line) => {
    const zone =
      /^\s*- (banner|navigation|main|complementary|contentinfo|region|form|search)\b(.*?):?$/.exec(
        line,
      );
    return zone === null ? [] : [`${zone[1]}${zone[2] ?? ""}`.trim()];
  });
}

/**
 * N1, structure and texts (05 §3): the same zones in the same order, the same roles, names and
 * wordings line by line (`{variable}` values excluded), the same icons in the same order.
 */
export function compareStructure(
  reference: { aria: string; icons: readonly string[] },
  candidate: { aria: string; icons: readonly string[] },
  variables: readonly RegExp[] = [],
): string[] {
  const before = normalizedAria(reference.aria, variables);
  const after = normalizedAria(candidate.aria, variables);
  const differences: string[] = [];
  const zonesBefore = zonesOf(before);
  const zonesAfter = zonesOf(after);
  if (zonesBefore.join(" | ") !== zonesAfter.join(" | ")) {
    differences.push(
      `zones: ${zonesBefore.join(" | ")} → ${zonesAfter.join(" | ")}`,
    );
  }
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    if (before[index] !== after[index]) {
      differences.push(
        `aria line ${index + 1}: ${JSON.stringify(before[index] ?? null)} → ${JSON.stringify(after[index] ?? null)}`,
      );
    }
  }
  if (reference.icons.join(",") !== candidate.icons.join(",")) {
    differences.push(
      `icons: ${reference.icons.join(",")} → ${candidate.icons.join(",")}`,
    );
  }
  return differences;
}

/** What N2 reads of one element: colors, exact values, rendered family, box, stacking. */
export type StyleRecord = {
  /** The line of the matrix and the rank of the element among those it selects. */
  probe: string;
  rank: number;
  tag: string;
  /** Colors normalized by `rgbaOf`; null for a value that is not a color (`currentcolor` resolved). */
  colors: Record<string, VisualColor | null>;
  /** Values compared as text, with no tolerance (weight, size, radius, widths, spacings, line height). */
  exact: Record<string, string>;
  /** The first family, canonical, and whether a face of it is loaded in the document. */
  family: string;
  familyLoaded: boolean;
  /** `position` and `z-index`: identical (05 §3). */
  stacking: { position: string; zIndex: string };
  box: { x: number; y: number; width: number; height: number };
};

/**
 * The canonical name of a font family: next/font writes `__Manrope_3c2a1b` or `Manrope Fallback`,
 * the mockups `Manrope`; both read `manrope`. A fallback face keeps its suffix, never confused with
 * the face it stands for.
 */
export function canonicalFamily(family: string): string {
  const name = family
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^_+/, "")
    .replace(/_[0-9a-f]{6,}$/i, "")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
  return name;
}

/** Two colors equal at 8 bits per channel and 8 bits of alpha (`color-mix` and `rgba` alike). */
export function sameColor(
  first: VisualColor | null,
  second: VisualColor | null,
): boolean {
  if (first === null || second === null) return first === second;
  return (
    Math.round(first.r) === Math.round(second.r) &&
    Math.round(first.g) === Math.round(second.g) &&
    Math.round(first.b) === Math.round(second.b) &&
    Math.round(first.a * 255) === Math.round(second.a * 255)
  );
}

function colorText(color: VisualColor | null): string {
  if (color === null) return "none";
  const channel = (value: number) => Math.round(value);
  return `rgba(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)}, ${Math.round(color.a * 255) / 255})`;
}

/** N2 on one pair of elements: every difference beyond the tolerances of 05 §3. */
export function compareStyleRecord(
  reference: StyleRecord,
  candidate: StyleRecord,
): string[] {
  const label = `${reference.probe}[${reference.rank}] <${reference.tag}>`;
  const differences: string[] = [];
  if (reference.tag !== candidate.tag) {
    differences.push(`${label} tag: ${reference.tag} → ${candidate.tag}`);
  }
  for (const property of new Set([
    ...Object.keys(reference.colors),
    ...Object.keys(candidate.colors),
  ])) {
    const before = reference.colors[property] ?? null;
    const after = candidate.colors[property] ?? null;
    if (!sameColor(before, after)) {
      differences.push(
        `${label} ${property}: ${colorText(before)} → ${colorText(after)}`,
      );
    }
  }
  for (const property of new Set([
    ...Object.keys(reference.exact),
    ...Object.keys(candidate.exact),
  ])) {
    if (reference.exact[property] !== candidate.exact[property]) {
      differences.push(
        `${label} ${property}: ${reference.exact[property] ?? "absent"} → ${candidate.exact[property] ?? "absent"}`,
      );
    }
  }
  if (reference.family !== candidate.family) {
    differences.push(
      `${label} font family: ${reference.family} → ${candidate.family}`,
    );
  }
  if (reference.familyLoaded !== candidate.familyLoaded) {
    differences.push(
      `${label} font loaded: ${reference.familyLoaded} → ${candidate.familyLoaded}`,
    );
  }
  if (
    reference.stacking.position !== candidate.stacking.position ||
    reference.stacking.zIndex !== candidate.stacking.zIndex
  ) {
    differences.push(
      `${label} stacking: ${reference.stacking.position}/${reference.stacking.zIndex} → ${candidate.stacking.position}/${candidate.stacking.zIndex}`,
    );
  }
  for (const side of ["x", "y", "width", "height"] as const) {
    const delta = Math.abs(reference.box[side] - candidate.box[side]);
    if (delta > N2_TOLERANCES.geometryPx) {
      differences.push(
        `${label} ${side}: ${reference.box[side]} → ${candidate.box[side]} (${delta.toFixed(2)} px > ${N2_TOLERANCES.geometryPx} px)`,
      );
    }
  }
  return differences;
}

/**
 * N2 on a matrix: the elements of each line paired by rank; an element present on one side only is a
 * difference of its own.
 */
export function compareStyles(
  reference: readonly StyleRecord[],
  candidate: readonly StyleRecord[],
): string[] {
  const key = (record: StyleRecord) => `${record.probe}[${record.rank}]`;
  const after = new Map(candidate.map((record) => [key(record), record]));
  const differences = reference.flatMap((record) => {
    const pair = after.get(key(record));
    after.delete(key(record));
    return pair === undefined
      ? [`${key(record)} <${record.tag}>: missing from the candidate`]
      : compareStyleRecord(record, pair);
  });
  for (const record of after.values()) {
    differences.push(
      `${key(record)} <${record.tag}>: missing from the reference`,
    );
  }
  return differences;
}

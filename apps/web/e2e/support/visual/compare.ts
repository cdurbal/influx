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

const UNNAMED_IMAGE = /^\s*- img$/;
const NAMED_LINE = /^(\s*)- [a-z]+ "((?:[^"\\]|\\.)*)"/;
const TEXT_LINE = /^(\s*)- text: (.*)$/;

/**
 * What a snapshot shows twice or not at all, dropped (RUB-11): an image without a name (a mockup draws
 * its icons as `<svg>` left in the tree, the application hides them, `aria-hidden`; the icons are
 * compared by `icons`), and a text that repeats the name of the element holding it (Playwright writes
 * it once the element has another child, such an image).
 */
function withoutRepeats(lines: readonly string[]): string[] {
  const kept: string[] = [];
  const holders: { indent: number; name: string }[] = [];
  for (const line of lines) {
    if (UNNAMED_IMAGE.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    while (holders.length > 0 && (holders.at(-1)?.indent ?? 0) >= indent) {
      holders.pop();
    }
    const text = TEXT_LINE.exec(line);
    if (text !== null && holders.at(-1)?.name === text[2]) continue;
    const named = NAMED_LINE.exec(line);
    if (named !== null) holders.push({ indent, name: named[2] ?? "" });
    kept.push(line);
  }
  // An element whose children were all dropped is written as one with none: no colon.
  return kept.map((line, index) => {
    const next = kept[index + 1];
    const indent = (text: string) => text.length - text.trimStart().length;
    return line.endsWith(":") &&
      !/^\s*- \/url:/.test(line) &&
      (next === undefined || indent(next) <= indent(line))
      ? line.slice(0, -1)
      : line;
  });
}

/**
 * The lines of `before` and `after` that differ, by a longest common subsequence: a line added or
 * removed is one difference, it does not shift every line after it. Consecutive removed and added
 * lines are paired, `before → after`; an unpaired one reads `null` on its missing side. The number is
 * the line of `before` (where an addition would sit).
 */
function lineDifferences(
  before: readonly string[],
  after: readonly string[],
): string[] {
  const common: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      const row = common[i] ?? [];
      row[j] =
        before[i] === after[j]
          ? (common[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(common[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const differences: string[] = [];
  let removed: { line: number; text: string }[] = [];
  let added: string[] = [];
  const flush = (line: number) => {
    const count = Math.max(removed.length, added.length);
    for (let k = 0; k < count; k += 1) {
      differences.push(
        `aria line ${removed[k]?.line ?? line}: ${JSON.stringify(removed[k]?.text ?? null)} → ${JSON.stringify(added[k] ?? null)}`,
      );
    }
    removed = [];
    added = [];
  };
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      flush(i + 1);
      i += 1;
      j += 1;
    } else if (
      j >= after.length ||
      (i < before.length &&
        (common[i + 1]?.[j] ?? 0) >= (common[i]?.[j + 1] ?? 0))
    ) {
      removed.push({ line: i + 1, text: before[i] ?? "" });
      i += 1;
    } else {
      added.push(after[j] ?? "");
      j += 1;
    }
  }
  flush(before.length + 1);
  return differences;
}

/**
 * The lines of an ARIA snapshot, each trimmed at the end, the `{variable}` values replaced, an unnamed
 * image and a text repeating its holder's name dropped.
 */
export function normalizedAria(
  snapshot: string,
  variables: readonly RegExp[] = [],
): string[] {
  const lines = snapshot
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
  return withoutRepeats(lines);
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
 * wordings line by line (`{variable}` values excluded; a line added or removed counted once), the
 * same icons in the same order.
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
  differences.push(...lineDifferences(before, after));
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
  return FAMILY_OF_FACE[name] ?? name;
}

/**
 * next/font names a family after its constant (packages/ui/src/styles/fonts.ts: `SOURCE_SANS_LATIN`
 * loads `source-sans-3-latin-wght-normal.woff2`), the mockups after the typeface (assets/fonts.css,
 * generated from the same files): each constant read as its typeface, a closed list (RUB-11). A
 * fallback face is never one of them.
 */
const FAMILY_OF_FACE: Readonly<Record<string, string>> = {
  "manrope latin": "manrope",
  "manrope latin ext": "manrope",
  "source sans latin": "source sans 3",
  "source sans latin ext": "source sans 3",
};

/**
 * A border of no width draws nothing whatever its style and color: Tailwind's base writes `solid` and
 * the default border color on every element, a mockup leaves `none` and `currentcolor`. Its style reads
 * `none` and its color none (RUB-11); a border of any width keeps both.
 */
export function withoutBorderOfNoWidth<
  T extends Pick<StyleRecord, "exact" | "colors">,
>(record: T): T {
  const exact = { ...record.exact };
  const colors = { ...record.colors };
  for (const side of ["top", "right", "bottom", "left"]) {
    if (exact[`border-${side}-width`] === "0px") {
      exact[`border-${side}-style`] = "none";
      if (`border-${side}-color` in colors)
        colors[`border-${side}-color`] = null;
    }
  }
  return { ...record, exact, colors };
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

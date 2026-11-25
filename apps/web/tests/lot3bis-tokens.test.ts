// RUA-T1 (D88, jalon RUA, line 01): the tokens of the Lot 3bis, one per value of the mockups, equal to
// the table of jalons/rua/modele-ux.md (names and values prime over R03 §3.3) and to 20 §11.5. The
// table is the contract: a token of the Lot 3bis that is not in it is an orphan, a value that moved
// fails. File reading only: deterministic, no browser.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  keoBlocks,
  vitrineDeclarations,
  type CssDeclaration,
} from "@influx/test-kit/guards";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const TOKENS = readFileSync(
  path.join(
    WEB_ROOT,
    "..",
    "..",
    "packages",
    "ui",
    "src",
    "styles",
    "tokens.css",
  ),
  "utf8",
);
const TOKENS_BACKOFFICE = readFileSync(
  path.join(
    WEB_ROOT,
    "..",
    "backoffice",
    "src",
    "styles",
    "tokens-backoffice.css",
  ),
  "utf8",
);
/** Every "scope name" of the two files just before the Lot 3bis (RUA-01, taken from HEAD of RUA-00). */
const BEFORE = JSON.parse(
  readFileSync(
    path.join(WEB_ROOT, "tests", "fixtures", "tokens-before-lot3bis.json"),
    "utf8",
  ),
) as Record<"tokens.css" | "tokens-backoffice.css", string[]>;

const THEME = "@theme static";
const ROOT = ":root";
const FROM_480 = "@media (width >= 480px) > :root";
const FROM_768 = "@media (width >= 768px) > :root";
const FROM_1024 = "@media (width >= 1024px) > :root";
const REDUCED = "@media (prefers-reduced-motion: reduce) > :root";

/** [scope, name, value] of tokens.css outside the KEO block. */
const SHARED: ReadonlyArray<readonly [string, string, string]> = [
  // Roles (aliases, no new color).
  [THEME, "--color-logo-plate", "var(--color-surface-inverse)"],
  [THEME, "--color-skeleton-base", "var(--color-surface-raised)"],
  [THEME, "--color-skeleton-sheen", "var(--color-surface-hover)"],
  [THEME, "--color-network-primary", "var(--color-data-3)"],
  // Effects: neutral in the vitrine, valued under KEO for the four on a photo.
  [THEME, "--effect-media-hover", "brightness(0.85)"],
  [THEME, "--effect-photo-scrim-strong", "transparent"],
  [THEME, "--effect-photo-scrim", "transparent"],
  [THEME, "--effect-photo-scrim-soft", "transparent"],
  [THEME, "--effect-photo-shadow", "none"],
  [THEME, "--scale-heart-press", "0.9"],
  [THEME, "--scale-leave", "0.96"],
  // Letter-spacing and proportions.
  [THEME, "--tracking-code", "0.06em"],
  [THEME, "--tracking-code-entry", "0.3em"],
  [THEME, "--tracking-phrase", "0.02em"],
  [THEME, "--aspect-photo", "4 / 3"],
  [THEME, "--aspect-mosaic", "2 / 1"],
  [THEME, "--aspect-otp", "5 / 6"],
  // The four fixed sizes in three steps (RU-01).
  [THEME, "--text-title-detail", "1.625rem"],
  [THEME, "--text-title-detail--line-height", "var(--leading-heading)"],
  [THEME, "--text-title-hero", "1.75rem"],
  [THEME, "--text-title-hero--line-height", "var(--leading-heading)"],
  [THEME, "--text-key-figure", "1.125rem"],
  [THEME, "--text-key-figure--line-height", "var(--leading-tight)"],
  [THEME, "--text-aside-figure", "1.25rem"],
  [THEME, "--text-aside-figure--line-height", "var(--leading-tight)"],
  [FROM_768, "--text-title-detail", "1.875rem"],
  [FROM_768, "--text-title-hero", "2rem"],
  [FROM_768, "--text-key-figure", "1.1875rem"],
  [FROM_768, "--text-aside-figure", "1.375rem"],
  [FROM_1024, "--text-title-detail", "2.125rem"],
  [FROM_1024, "--text-title-hero", "2.25rem"],
  [FROM_1024, "--text-key-figure", "1.25rem"],
  [FROM_1024, "--text-aside-figure", "1.5rem"],
  // Durations.
  [ROOT, "--duration-celebrate", "900ms"],
  [ROOT, "--duration-spin", "1s"],
  [ROOT, "--duration-skeleton", "1.2s"],
  [REDUCED, "--duration-celebrate", "var(--duration-instant)"],
  [REDUCED, "--duration-spin", "var(--duration-instant)"],
  // Pills, markers, icons.
  [ROOT, "--size-pill", "var(--spacing-7)"],
  [ROOT, "--size-chip", "var(--spacing-6)"],
  [ROOT, "--size-tag", "2.25rem"],
  [ROOT, "--size-step-marker", "1.75rem"],
  [ROOT, "--size-segment-bar", "0.375rem"],
  [ROOT, "--inset-segment-hit", "-0.625rem"],
  [ROOT, "--size-icon-xs", "0.75rem"],
  [ROOT, "--size-icon-dense", "0.875rem"],
  [ROOT, "--size-icon-star", "1.375rem"],
  [ROOT, "--size-icon-heart", "1.625rem"],
  [ROOT, "--size-skeleton-line", "var(--text-sm)"],
  [ROOT, "--size-logo-hero", "7.5rem"],
  [ROOT, "--size-thumb", "3.5rem"],
  [ROOT, "--size-nudge", "0.125rem"],
  [ROOT, "--size-nudge-icon", "0.1875rem"],
  [ROOT, "--size-nudge-hair", "0.0625rem"],
  [ROOT, "--offset-link", "0.2em"],
  [ROOT, "--offset-icon-baseline", "-0.15em"],
  [ROOT, "--offset-icon-baseline-xs", "-0.2em"],
  // Fields.
  [ROOT, "--size-textarea", "7.5rem"],
  [ROOT, "--size-input-number", "8rem"],
  [ROOT, "--size-select-add", "13rem"],
  [ROOT, "--size-select-add-max", "20rem"],
  [ROOT, "--size-sort", "14rem"],
  [ROOT, "--size-search", "15rem"],
  [ROOT, "--size-date", "12rem"],
  [ROOT, "--size-otp", "22rem"],
  [ROOT, "--size-note-min", "12rem"],
  [ROOT, "--size-note-max", "16rem"],
  // Phones and dialogs.
  [ROOT, "--size-mobile-space-search", "3.75rem"],
  [ROOT, "--size-mobile-space-reading", "4.25rem"],
  [ROOT, "--size-mobile-space-wizard", "4.5rem"],
  [ROOT, "--size-overlay-max", "85dvh"],
  // Labels of a list of properties, by role (RU-16).
  [ROOT, "--size-property-label", "13rem"],
  [ROOT, "--size-property-label-summary", "11rem"],
  [ROOT, "--size-property-label-reading", "12rem"],
  [ROOT, "--size-property-label-reading-compact", "8.5rem"],
  [ROOT, "--size-property-label-terms", "9rem"],
  // Measures and containers.
  [ROOT, "--measure-wide", "46rem"],
  [ROOT, "--container-form", "28rem"],
  [ROOT, "--container-form-wide", "36rem"],
  [ROOT, "--container-dialog", "30rem"],
  [ROOT, "--container-filters", "42rem"],
  [ROOT, "--container-confirm", "34rem"],
  [ROOT, "--container-gallery", "56rem"],
  [ROOT, "--container-feed-card", "26rem"],
  [ROOT, "--container-brand-card", "34rem"],
  [ROOT, "--container-danger", "32rem"],
  [ROOT, "--container-field-xs", "16rem"],
  [ROOT, "--container-field-sm", "18rem"],
  [ROOT, "--container-field-md", "20rem"],
  [ROOT, "--container-field-lg", "22rem"],
  [ROOT, "--container-field-xl", "26rem"],
  // Grids.
  [ROOT, "--grid-reading", "minmax(0, 7fr) minmax(19rem, 4fr)"],
  [ROOT, "--grid-home", "minmax(0, 2fr) minmax(0, 1fr)"],
  [ROOT, "--grid-mosaic", "2fr 1fr 1fr"],
  [ROOT, "--grid-photo-cards", "repeat(auto-fill, minmax(18rem, 1fr))"],
  [ROOT, "--grid-photo-cards-narrow", "repeat(auto-fill, minmax(17rem, 1fr))"],
  [
    ROOT,
    "--grid-campaign-row",
    "minmax(0, 1fr) 15rem 5.5rem var(--size-icon-md)",
  ],
  [ROOT, "--grid-timeline", "8rem minmax(0, 1fr)"],
  [ROOT, "--grid-verification-row", "7rem minmax(0, 1fr)"],
  [ROOT, "--grid-range", "6.5rem minmax(0, 1fr) 5.5rem"],
  [FROM_480, "--grid-range", "9rem minmax(0, 1fr) 6.5rem"],
  // Breakpoint of the forms (RU-03), then the animations of the Lot 3bis (RU-06; 04 §2) and their keyframes.
  [THEME, "--breakpoint-form", "640px"],
  [
    THEME,
    "--animate-fade-in",
    "fade-in var(--duration-fast) var(--ease-standard)",
  ],
  [
    THEME,
    "--animate-rise-in",
    "rise-in var(--duration-base) var(--ease-standard)",
  ],
  [THEME, "--animate-flash", "flash var(--duration-slow) var(--ease-standard)"],
  [
    THEME,
    "--animate-flash-strong",
    "flash-strong var(--duration-slow) var(--ease-standard)",
  ],
  [THEME, "--animate-pop", "pop var(--duration-base) var(--ease-standard)"],
  [
    THEME,
    "--animate-pop-in",
    "pop-in var(--duration-slow) var(--ease-standard)",
  ],
  [
    THEME,
    "--animate-done-flash",
    "done-flash var(--duration-celebrate) var(--ease-standard)",
  ],
  [THEME, "--animate-spin", "turn var(--duration-spin) linear infinite"],
  [
    THEME,
    "--animate-skeleton",
    "skeleton var(--duration-skeleton) linear infinite",
  ],
  [REDUCED, "--animate-skeleton", "none"],
  [`${THEME} > @keyframes fade-in > from`, "opacity", "0"],
  [`${THEME} > @keyframes fade-in > to`, "opacity", "1"],
  [`${THEME} > @keyframes rise-in > from`, "opacity", "0"],
  [
    `${THEME} > @keyframes rise-in > from`,
    "translate",
    "0 calc(var(--spacing-1) * -1)",
  ],
  [`${THEME} > @keyframes rise-in > to`, "opacity", "1"],
  [`${THEME} > @keyframes rise-in > to`, "translate", "0 0"],
  [
    `${THEME} > @keyframes flash > from`,
    "background-color",
    "var(--color-surface-raised)",
  ],
  [`${THEME} > @keyframes flash > to`, "background-color", "transparent"],
  [
    `${THEME} > @keyframes flash-strong > from`,
    "background-color",
    "var(--color-surface-active)",
  ],
  [
    `${THEME} > @keyframes flash-strong > to`,
    "background-color",
    "transparent",
  ],
  [`${THEME} > @keyframes pop > 0%, 100%`, "scale", "1"],
  [`${THEME} > @keyframes pop > 50%`, "scale", "1.2"],
  [`${THEME} > @keyframes pop-in > from`, "scale", "0.6"],
  [`${THEME} > @keyframes pop-in > from`, "opacity", "0"],
  [`${THEME} > @keyframes pop-in > 60%`, "scale", "1.15"],
  [`${THEME} > @keyframes pop-in > 60%`, "opacity", "1"],
  [`${THEME} > @keyframes pop-in > to`, "scale", "1"],
  [`${THEME} > @keyframes pop-in > to`, "opacity", "1"],
  [
    `${THEME} > @keyframes done-flash > from`,
    "background-color",
    "var(--color-feedback-success-bg)",
  ],
  [`${THEME} > @keyframes done-flash > to`, "background-color", "transparent"],
  [`${THEME} > @keyframes turn > from`, "rotate", "0deg"],
  [`${THEME} > @keyframes turn > to`, "rotate", "360deg"],
  [`${THEME} > @keyframes skeleton > from`, "translate", "-100% 0"],
  [`${THEME} > @keyframes skeleton > to`, "translate", "100% 0"],
];

/** [name, value] the KEO block carries for the Lot 3bis, and nothing else of it. */
const KEO: ReadonlyArray<readonly [string, string]> = [
  ["--color-logo-plate", "var(--color-surface-inverse)"],
  ["--color-skeleton-base", "var(--color-surface-raised)"],
  ["--color-skeleton-sheen", "var(--color-surface-hover)"],
  [
    "--effect-photo-scrim-strong",
    "color-mix(in srgb, var(--color-surface-page) 82%, transparent)",
  ],
  [
    "--effect-photo-scrim",
    "color-mix(in srgb, var(--color-surface-page) 75%, transparent)",
  ],
  [
    "--effect-photo-scrim-soft",
    "color-mix(in srgb, var(--color-surface-page) 45%, transparent)",
  ],
  [
    "--effect-photo-shadow",
    "drop-shadow(0 1px 2px color-mix(in srgb, #000000 50%, transparent))",
  ],
];

/** [scope, name, value] of tokens-backoffice.css for the Lot 3bis (`-bo-` names only, G3f). */
const BACKOFFICE: ReadonlyArray<readonly [string, string, string]> = [
  [THEME, "--spacing-bo-panel-w", "22rem"],
  [THEME, "--grid-bo-panel", "minmax(0, 1fr) var(--spacing-bo-panel-w)"],
  [THEME, "--grid-bo-check", "9.5rem minmax(0, 1fr) 12rem"],
  [THEME, "--grid-bo-timeline", "7.5rem minmax(0, 1fr)"],
  [THEME, "--grid-bo-sync", "4rem minmax(0, 1fr)"],
  [THEME, "--size-bo-choice-dense", "1.125rem"],
  [THEME, "--size-bo-alert-code", "3.25rem"],
  [THEME, "--size-bo-kbd", "1.375rem"],
  [THEME, "--size-bo-thumb-min", "7rem"],
  [THEME, "--size-bo-label-identified", "6rem"],
  [THEME, "--size-bo-label-compact", "7rem"],
  [THEME, "--size-bo-label-side", "7.5rem"],
  [THEME, "--size-bo-label-decision", "8rem"],
  [THEME, "--size-bo-label-dual-control", "10rem"],
  [ROOT, "--container-bo-form", "52rem"],
  [ROOT, "--container-bo-page", "60rem"],
];

/** A value with the spaces inside parentheses folded, so that a mix split over lines reads the same. */
function folded(value: string): string {
  return value
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/,\s*\)/g, ")");
}

function scoped(css: string): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.entries(vitrineDeclarations(css)).map(([scope, declarations]) => [
      scope,
      Object.fromEntries(
        Object.entries(declarations).map(([name, value]) => [
          name,
          folded(value),
        ]),
      ),
    ]),
  );
}

describe("RUA-T1: the tokens of the Lot 3bis equal the values of the mockups (D88, modele-ux.md §1, §2)", () => {
  it("declares, in tokens.css outside the KEO block, every token of the table with its value", () => {
    expect(SHARED.length).toBeGreaterThan(100);
    const declared = scoped(TOKENS);
    const wrong = SHARED.flatMap(([scope, name, value]) => {
      const found = declared[scope]?.[name];
      return found === value
        ? []
        : [`${scope} ${name}: expected "${value}", found "${found}"`];
    });
    expect(wrong).toEqual([]);
  });

  it("carries in the KEO block the roles and the four effects on a photo of the table, and no other token of the Lot 3bis", () => {
    const block = keoBlocks(TOKENS)[0];
    expect(block).toBeDefined();
    const declared = new Map<string, string>(
      (block?.declarations ?? []).map(({ name, value }: CssDeclaration) => [
        name,
        folded(value),
      ]),
    );
    const wrong = KEO.flatMap(([name, value]) =>
      declared.get(name) === value
        ? []
        : [`${name}: expected "${value}", found "${declared.get(name)}"`],
    );
    expect(wrong).toEqual([]);
    // Nothing else of the table is redefined under KEO (modele-ux.md: "rien n'est redéfini sous KEO sauf mention").
    const redefined = SHARED.map(([, name]) => name)
      .filter((name) => declared.has(name))
      .filter((name) => !KEO.some(([keoName]) => keoName === name));
    expect([...new Set(redefined)]).toEqual([]);
  });

  it("declares, in tokens-backoffice.css, the -bo- tokens of the table with their value", () => {
    const declared = scoped(TOKENS_BACKOFFICE);
    const wrong = BACKOFFICE.flatMap(([scope, name, value]) => {
      const found = declared[scope]?.[name];
      return found === value
        ? []
        : [`${scope} ${name}: expected "${value}", found "${found}"`];
    });
    expect(wrong).toEqual([]);
    expect(BACKOFFICE.every(([, name]) => name.includes("-bo-"))).toBe(true);
    // None of them in tokens.css (G3f).
    const shared = new Set(SHARED.map(([, name]) => name));
    expect(BACKOFFICE.filter(([, name]) => shared.has(name))).toEqual([]);
  });

  it("holds no orphan: every declaration added to the two files by the Lot 3bis is in the table", () => {
    const names = (css: string) =>
      Object.entries(vitrineDeclarations(css)).flatMap(
        ([scope, declarations]) =>
          Object.keys(declarations).map((name) => `${scope} ${name}`),
      );
    const known = new Set<string>([
      ...BEFORE["tokens.css"],
      ...SHARED.map(([scope, name]) => `${scope} ${name}`),
    ]);
    expect(names(TOKENS).filter((entry) => !known.has(entry))).toEqual([]);
    const boKnown = new Set<string>([
      ...BEFORE["tokens-backoffice.css"],
      ...BACKOFFICE.map(([scope, name]) => `${scope} ${name}`),
    ]);
    expect(
      names(TOKENS_BACKOFFICE).filter((entry) => !boKnown.has(entry)),
    ).toEqual([]);
    // The table lists none that was already there: a moved value is the other cases' to see.
    expect(
      SHARED.filter(([scope, name]) =>
        BEFORE["tokens.css"].includes(`${scope} ${name}`),
      ),
    ).toEqual([]);
  });
});

// RUA-T4 (D88, jalon RUA, line 02; 22-refonte-ux-ui/04 §1, §2; AN-3, AN-4): the animations are declared as
// tokens, each from a duration and a curve of the scale, over keyframes that exist, and none animates a
// height or reads `all`. The rendering under reduced motion is RUA-T5 (charter-rendering).
describe("RUA-T4: the --animate-* tokens of the Lot 3bis (D88, 04 §2)", () => {
  const THEMED = scoped(TOKENS)[THEME] ?? {};
  const NAMES = [
    "fade-in",
    "rise-in",
    "flash",
    "flash-strong",
    "pop",
    "pop-in",
    "done-flash",
    "spin",
    "skeleton",
  ] as const;
  const keyframeNames = [...TOKENS.matchAll(/@keyframes ([\w-]+)/g)].map(
    (match) => match[1],
  );

  it("names the nine animations, each by a duration token and a curve token, over keyframes declared once", () => {
    const wrong = NAMES.flatMap((name) => {
      const value = THEMED[`--animate-${name}`] ?? "";
      const parts = value.split(" ");
      const frames = parts[0] ?? "";
      const looping = /^(?:turn|skeleton)$/.test(frames);
      return [
        ...(/^var\(--duration-(?:fast|base|slow|celebrate|spin|skeleton)\)$/.test(
          parts[1] ?? "",
        )
          ? []
          : [`${name}: duration not a --duration-* token (${value})`]),
        ...((
          looping
            ? parts[2] === "linear" && parts[3] === "infinite"
            : parts[2] === "var(--ease-standard)" && parts.length === 3
        )
          ? []
          : [`${name}: curve or repetition (${value})`]),
        ...(keyframeNames.filter((declared) => declared === frames).length === 1
          ? []
          : [`${name}: keyframes "${frames}" not declared exactly once`]),
      ];
    });
    expect(wrong).toEqual([]);
    expect(
      Object.keys(THEMED).filter((name) => name.startsWith("--animate-")),
    ).toEqual([
      "--animate-marquee",
      ...NAMES.map((name) => `--animate-${name}`),
    ]);
  });

  it("animates opacity, translate, scale, rotate and background color only: no height, no `all`, no literal color (AN-4)", () => {
    const declared = scoped(TOKENS);
    const properties = Object.entries(declared)
      .filter(
        ([scope]) =>
          scope.includes("@keyframes") && !scope.includes("@keyframes marquee"),
      )
      .flatMap(([, declarations]) => Object.entries(declarations));
    expect(properties.length).toBeGreaterThan(20);
    expect(
      [...new Set(properties.map(([property]) => property))].sort(),
    ).toEqual(["background-color", "opacity", "rotate", "scale", "translate"]);
    expect(
      properties.filter(([, value]) =>
        /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(value),
      ),
    ).toEqual([]);
    expect(
      Object.keys(THEMED)
        .filter((name) => name.startsWith("--animate-"))
        .map((name) => THEMED[name])
        .filter((value) => /\ball\b|height/.test(value ?? "")),
    ).toEqual([]);
  });

  it("removes only the repeating skeleton sweep under reduced motion, the others going to zero by their durations", () => {
    const reduced = scoped(TOKENS)[REDUCED] ?? {};
    expect(reduced["--animate-skeleton"]).toBe("none");
    expect(
      Object.keys(reduced).filter((name) => name.startsWith("--animate-")),
    ).toEqual(["--animate-skeleton"]);
    for (const name of ["fast", "base", "slow", "celebrate", "spin"]) {
      expect(reduced[`--duration-${name}`]).toBe("var(--duration-instant)");
    }
    // The skeleton sweep is the one duration left alone: its animation is removed instead.
    expect(reduced["--duration-skeleton"]).toBeUndefined();
  });
});

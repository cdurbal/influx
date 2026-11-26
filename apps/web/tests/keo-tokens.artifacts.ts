// G3i (b) on the build of apps/web, run by `test:artifacts` after `next build` (D75; 02 §21.3 point 3;
// 18 §5.1, TK7.1): the stylesheets the front serves read every token that the KEO block redefines
// through `var(--name)`. Tailwind v4 inscribes the @theme value of some namespaces where it is used
// (`.shadow-action-glow{--tw-shadow:none}`, constat C1): the redefinition is then never read, and the
// sources alone do not show it. The negative cases of the guard are in packages/test-kit.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readBuiltStylesheets } from "@influx/test-kit/artifacts";
import {
  classLiteralsOf,
  findClassesWithoutRule,
  findInscribedKeoTokens,
  findUnreadKeoTokens,
  listFiles,
} from "@influx/test-kit/guards";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtCss = readBuiltStylesheets(path.join(ROOT, ".next"));
// The tokens of both fronts are the one file of packages/ui (arbitration PL-07).
const tokens = readFileSync(
  path.join(ROOT, "..", "..", "packages", "ui", "src", "styles", "tokens.css"),
  "utf8",
);

// A token redefined under KEO that no utility of this front reads through var(), one line each.
const UNREAD_JUSTIFIED: readonly string[] = [
  // Roles of the palette (20 §11.3) that no class of this front names yet.
  "--color-brand-accent",
  "--color-text-muted",
  "--color-text-on-accent",
  "--color-surface-accent",
  // Chart series (20 §11.4): no chart is drawn in this front yet.
  "--color-data-1",
  "--color-data-2",
  // Roles and effects of the Lot 3bis (D88, RUA-01), redefined under KEO and read by no class before the
  // screens of RUB; each entry goes when its reader arrives (a stale entry fails this very test).
  "--color-skeleton-base",
  "--color-skeleton-sheen",
  "--effect-photo-scrim-strong",
  "--effect-photo-scrim",
  "--effect-photo-scrim-soft",
  "--effect-photo-shadow",
];

// A word of a module of classes that the build names no rule for, one line each. None is a class: the
// words are the variants and sizes passed as arguments to the builders of classes
// (`buttonClasses("danger", "md")`, `statusBadgeClasses("neutral")`, `noticeClasses("info")`, the layer names keying `layer-badge-classes`).
const CLASSES_JUSTIFIED: readonly string[] = [
  "danger",
  "md",
  "success",
  "neutral",
  "primary",
  "lg",
  "secondary",
  "text",
  "info",
  "warning",
  "current",
  "ancestor",
  "idle",
  "public",
  "revealed",
  "internal",
];

describe("G3i (b): the built CSS reads every KEO token through var()", () => {
  it("has no utility of a redefined token that holds the vitrine value instead", () => {
    expect(findInscribedKeoTokens(builtCss, tokens)).toEqual([]);
  });

  it("reads every token redefined under KEO, or justifies it", () => {
    expect(findUnreadKeoTokens(builtCss, tokens, UNREAD_JUSTIFIED)).toEqual([]);
  });

  // TK7.2 (D75 RK-5): a class of a module of classes that no rule of the build names does nothing
  // (`tracking-wide` without a token, constat C3). The negative case is in packages/test-kit.
  it("has a compiled rule for every class literal of the modules of classes (TK7.2)", () => {
    const classes = listFiles(path.join(ROOT, "src"))
      .filter((file) => file.endsWith("-classes.ts"))
      .flatMap((file) => classLiteralsOf(readFileSync(file, "utf8")));
    expect(classes.length).toBeGreaterThan(100);
    expect(
      findClassesWithoutRule(classes, builtCss, CLASSES_JUSTIFIED),
    ).toEqual([]);
  });

  it("sees an inscribed value once added to the built CSS, CRLF included (R4)", () => {
    // The shape of constat C1 (.shadow-action-glow{--tw-shadow:none}) on a token still redefined.
    const faulty = ".rounded-card{border-radius:.75rem}";
    const sheet = [builtCss, faulty].join("\n");
    for (const css of [sheet, sheet.replaceAll("\n", "\r\n")]) {
      expect(findInscribedKeoTokens(css, tokens)).toEqual([
        ".rounded-card: a utility of --radius-card that does not read var(--radius-card) {border-radius:.75rem}",
      ]);
    }
  });
});

// RUA-T4 (D88, jalon RUA, line 02; 22-refonte-ux-ui/04 §1, §2; AN-4): the build serves the nine animations, each
// over its keyframes (`@theme static`: emitted whether a class names them or not), the breakpoint of the forms,
// and no keyframes that moves anything but opacity, translate, scale, rotate and background color.
describe("RUA-T4: the built CSS serves the animation tokens of the Lot 3bis", () => {
  const NAMES: ReadonlyArray<readonly [string, string]> = [
    ["fade-in", "fade-in"],
    ["rise-in", "rise-in"],
    ["flash", "flash"],
    ["flash-strong", "flash-strong"],
    ["pop", "pop"],
    ["pop-in", "pop-in"],
    ["done-flash", "done-flash"],
    ["spin", "turn"],
    ["skeleton", "skeleton"],
  ];
  const blockOf = (frames: string): string =>
    new RegExp(String.raw`@keyframes ${frames}\{(?:[^{}]|\{[^{}]*\})*\}`).exec(
      builtCss,
    )?.[0] ?? "";

  it("declares every --animate-* over keyframes that exist, and --breakpoint-form at 640 px", () => {
    for (const [name, frames] of NAMES) {
      expect(builtCss, `--animate-${name}`).toMatch(
        new RegExp(String.raw`--animate-${name}:\s*${frames}\s`),
      );
      expect(blockOf(frames), `@keyframes ${frames}`).not.toBe("");
    }
    expect(builtCss).toMatch(/--breakpoint-form:\s*640px/);
  });

  it("animates no height, no width, no `all` and no literal color in them (AN-4)", () => {
    const properties = NAMES.flatMap(([, frames]) =>
      [...blockOf(frames).matchAll(/([a-z-]+):/g)].map((match) => match[1]),
    );
    expect(properties.length).toBeGreaterThan(15);
    expect([...new Set(properties)].sort()).toEqual([
      "background-color",
      "opacity",
      "rotate",
      "scale",
      "translate",
    ]);
  });
});

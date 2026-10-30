// G3i (b) on the build of apps/backoffice, run by `test:artifacts` after `next build` (D75; 02 §21.3 point 3;
// 18 §5.1, TK7.1): the stylesheets the front serves read every token that the KEO block redefines
// through `var(--name)`. Tailwind v4 inscribes the @theme value of some namespaces where it is used
// (`.shadow-action-glow{--tw-shadow:none}`, constat C1): the redefinition is then never read, and the
// sources alone do not show it. The negative cases of the guard are in packages/test-kit.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readBuiltStylesheets } from "@influx/test-kit/artifacts";
import {
  findInscribedKeoTokens,
  findUnreadKeoTokens,
} from "@influx/test-kit/guards";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtCss = readBuiltStylesheets(path.join(ROOT, ".next"));
const tokens = readFileSync(
  path.join(ROOT, "src", "styles", "tokens.css"),
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
  // Same tokens.css as apps/web (byte for byte): roles of the member spaces that this front never names.
  "--color-text-brand",
  "--color-text-brand-strong",
  "--color-text-on-danger",
  "--color-surface-muted",
  "--color-border-selected",
  "--color-feedback-success-icon",
  "--color-feedback-warning-icon",
  "--color-feedback-info-icon",
  "--color-counter-bg",
  "--color-counter-text",
  "--translate-lift",
  // The border of a clickable card on hover (RK-10): the backoffice has no clickable card.
  "--color-border-hover",
];

describe("G3i (b): the built CSS reads every KEO token through var()", () => {
  it("has no utility of a redefined token that holds the vitrine value instead", () => {
    expect(findInscribedKeoTokens(builtCss, tokens)).toEqual([]);
  });

  it("reads every token redefined under KEO, or justifies it", () => {
    expect(findUnreadKeoTokens(builtCss, tokens, UNREAD_JUSTIFIED)).toEqual([]);
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

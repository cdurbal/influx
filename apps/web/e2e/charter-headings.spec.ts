// TK3.1 (D75 RK-5; docs/mvp/18 §12.6): every visible h1–h4 of the KEO screens has the first family
// of `--font-display` (Manrope), a size among the fixed `--text-*` of KEO, the same token at 375 and
// 1 440 px; at least one title per screen. Grafted on the axe passes of 18 §12.2, without a
// navigation of its own: support/axe.ts records each screen it checks, and this file, the project
// "charter-headings" that depends on "chromium" (playwright.config.ts), reads them once every pass
// ran. Run alone, it runs the whole suite first.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  HEADING_SURVEYS,
  KEO_FIXED_TEXT_TOKENS,
  type HeadingSurvey,
} from "./support/rendering";
import { expect, test } from "@playwright/test";
import { BACKOFFICE_ORIGIN, WEB_ORIGIN } from "./support/servers";

/** Fewer distinct paths than this, and the passes did not all run: the check would prove nothing. */
const MIN_PATHS = { members: 12, backoffice: 10 } as const;

function surveys(): HeadingSurvey[] {
  const directory = path.join(test.info().project.outputDir, HEADING_SURVEYS);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).map(
    (file) =>
      JSON.parse(
        readFileSync(path.join(directory, file), "utf8"),
      ) as HeadingSurvey,
  );
}

function of(origin: string): HeadingSurvey[] {
  return surveys().filter((survey) => survey.origin === origin);
}

/** What breaks TK3.1 on a set of surveys, each finding once. */
function headingProblems(list: readonly HeadingSurvey[]): string[] {
  const problems = new Set<string>();
  for (const survey of list) {
    const where = `${survey.path} (${survey.screen}, ${survey.width} px)`;
    if (survey.headings.length === 0) {
      problems.add(`${where}: no visible title`);
    }
    for (const heading of survey.headings) {
      const title = `h${heading.level} « ${heading.text} »`;
      if (heading.family !== survey.display) {
        problems.add(
          `${survey.path}: ${title} in ${heading.family}, not ${survey.display}`,
        );
      }
      if (heading.tokens.length === 0) {
        problems.add(
          `${survey.path}: ${title} at ${heading.size} px at ${survey.width} px, no fixed --text-* of KEO`,
        );
      }
    }
  }
  // The same title at 375 and 1 440 px: the same token (text-title-page steps at lg, by design).
  for (const narrow of list.filter((survey) => survey.width === 375)) {
    for (const wide of list.filter(
      (survey) => survey.width === 1440 && survey.path === narrow.path,
    )) {
      for (const heading of narrow.headings) {
        const twin = wide.headings.find(
          (other) =>
            other.level === heading.level && other.text === heading.text,
        );
        if (
          twin !== undefined &&
          !heading.tokens.some((token) => twin.tokens.includes(token))
        ) {
          problems.add(
            `${narrow.path}: h${heading.level} « ${heading.text} » at ${heading.size} px at 375 px, ${twin.size} px at 1 440 px`,
          );
        }
      }
    }
  }
  return [...problems];
}

test("TK3.1: the axe passes of 18 §12.2 recorded the titles of every screen, members and backoffice", () => {
  expect(KEO_FIXED_TEXT_TOKENS).toContain("--text-title-page");
  const paths = (origin: string) =>
    new Set(of(origin).map((survey) => survey.path)).size;
  expect(paths(WEB_ORIGIN)).toBeGreaterThanOrEqual(MIN_PATHS.members);
  expect(paths(BACKOFFICE_ORIGIN)).toBeGreaterThanOrEqual(MIN_PATHS.backoffice);
  expect(of(WEB_ORIGIN).some((survey) => survey.width === 375)).toBe(true);
  expect(of(WEB_ORIGIN).some((survey) => survey.width === 1440)).toBe(true);
});

test("TK3.1, every title of the member screens in Manrope, at a fixed KEO size, the same at 375 and 1 440 px", () => {
  expect(headingProblems(of(WEB_ORIGIN))).toEqual([]);
});

test.fail(
  "RK-5b: TK3.1, every title of the backoffice screens in Manrope, at a fixed KEO size, the same at 375 and 1 440 px",
  () => {
    expect(headingProblems(of(BACKOFFICE_ORIGIN))).toEqual([]);
  },
);

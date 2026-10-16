// The automated accessibility check of the browser journeys (J7T-4; docs/mvp/18 risk 8: automated
// on the key screens, blocking on what it finds; the rest is a visual check). axe-core runs in the
// page, on the rules of WCAG 2.1 A and AA only, and the journey fails on ANY violation: each one is
// named with its rule and the elements it found.
import type { Page } from "@playwright/test";
import axe from "axe-core";
import { expect } from "./journey";

type Violation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
};

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

export async function expectNoAxeViolation(
  page: Page,
  screen: string,
): Promise<void> {
  if (!(await page.evaluate(() => "axe" in window))) {
    await page.addScriptTag({ content: axe.source });
  }
  const violations = await page.evaluate(async (tags) => {
    const runner = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: object,
          ) => Promise<{ violations: Violation[] }>;
        };
      }
    ).axe;
    const result = await runner.run(document, {
      runOnly: { type: "tag", values: tags },
      resultTypes: ["violations"],
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({ target: node.target })),
    }));
  }, WCAG_AA_TAGS);
  expect(
    violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "?"}): ${violation.help} — ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(", ")}`,
    ),
    `axe, WCAG 2.1 AA, ${screen}`,
  ).toEqual([]);
}

// The primitives of the connected spaces in a real browser (DS-5; docs/mvp/18 §12.1 TD5.4 on the
// journey, and axe in the error state): the sign-in page, which wears the buttons, the fields and
// the notices of components/member/ui. No code is requested: the error is the client's own (format
// of the address), so no mail and no database are involved.
import type { Page } from "@playwright/test";
import { expectNoAxeViolation } from "./support/axe";
import { AUTH_LABELS, expect, open, test } from "./support/journey";

const T = AUTH_LABELS.fr;

type Focus = {
  description: string;
  outlineWidth: number;
  outlineStyle: string;
  covered: boolean;
} | null;

/** The focused element: what it is, its ring, and whether something else is painted over it. */
function focusedElement(page: Page): Promise<Focus> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) return null;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const top = document.elementFromPoint(
      box.x + box.width / 2,
      box.y + box.height / 2,
    );
    return {
      description: `${element.tagName.toLowerCase()} ${(element.textContent ?? "").trim().slice(0, 40)} ${element.getAttribute("name") ?? ""}`,
      outlineWidth: parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      covered: top === null || !(top === element || element.contains(top)),
    };
  });
}

test("TD5.4: every focusable element of the sign-in journey shows a ring of 2 px at least and is never covered, at 375 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/fr/connexion");
  await expect(page.locator("h1")).toContainText(T.step1.title);

  const seen: string[] = [];
  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press("Tab");
    const focus = await focusedElement(page);
    if (focus === null) break;
    if (seen.includes(focus.description)) break;
    seen.push(focus.description);
    expect(focus.outlineStyle, focus.description).not.toBe("none");
    expect(focus.outlineWidth, focus.description).toBeGreaterThanOrEqual(2);
    expect(focus.covered, `${focus.description} is covered`).toBe(false);
  }
  // The language link, the address field and the submit button at least.
  expect(seen.length).toBeGreaterThanOrEqual(3);
});

for (const width of [375, 1440]) {
  test(`axe finds nothing on the sign-in page in its error state, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/fr/connexion");
    await page.getByLabel(T.step1.emailLabel).fill("not-an-address");
    await page.getByRole("button", { name: T.step1.submit }).click();
    await expect(page.getByText(T.emailErrors.format)).toBeVisible();
    await expectNoAxeViolation(page, `connexion en erreur à ${width} px`);
  });
}

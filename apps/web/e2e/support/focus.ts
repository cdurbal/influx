// The focused element of a page and how it shows (docs/mvp/18 §12.1 TD5.4; WCAG 2.4.7, 2.4.11):
// what it is, its ring, and whether something else is painted over its centre (a sticky header, a
// bottom bar). Shared by the journeys of the primitives and of the member shell.
import type { Page } from "@playwright/test";

export type Focus = {
  description: string;
  outlineWidth: number;
  outlineStyle: string;
  covered: boolean;
} | null;

/** The focused element, or null when the focus is on the page itself. */
export function focusedElement(page: Page): Promise<Focus> {
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

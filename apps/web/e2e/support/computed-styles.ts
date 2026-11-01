// The computed-style fingerprint of the vitrine (18 §9.3 A-9, §12.1 TD4.2 and TD4.3): a few key
// elements of the landing, read by getComputedStyle on the production build. A JSON file, never an
// image (G4); properties that do not depend on the metrics of a font (no width, no height, no
// position): colors, the DECLARED family, sizes, radii, spacings, shadows, outlines. It sees what
// G3e cannot: a shared component or globals.css that changes the landing.
import type { Page } from "@playwright/test";

/** A fingerprint: element name → property → computed value. */
export type Fingerprint = Record<string, Record<string, string>>;

/** The key elements: header, h1, the two call-to-action buttons, a card, a section, the footer. */
export const FINGERPRINT_ELEMENTS: Readonly<Record<string, string>> = {
  html: "html",
  body: "body",
  header: "body header",
  h1: "h1",
  primaryCta: '[aria-describedby="hero-advertiser-audience"]',
  secondaryCta: '[aria-describedby="hero-creator-audience"]',
  card: 'section[aria-labelledby="pricing-title"] .shadow-metal-card',
  section: 'section[aria-labelledby="pricing-title"]',
  footer: "body footer",
};

export const FINGERPRINT_PROPERTIES: readonly string[] = [
  "display",
  "color",
  "background-color",
  "background-image",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-decoration-line",
  ...["top", "right", "bottom", "left"].flatMap((side) => [
    `border-${side}-width`,
    `border-${side}-style`,
    `border-${side}-color`,
    `padding-${side}`,
  ]),
  ...["top-left", "top-right", "bottom-right", "bottom-left"].map(
    (corner) => `border-${corner}-radius`,
  ),
  "row-gap",
  "column-gap",
  "box-shadow",
  "outline-width",
  "outline-style",
  "outline-color",
  "outline-offset",
  "opacity",
];

/**
 * The elements whose classes are recorded too (TD4.3). Elsewhere a class may change while the
 * rendering stays (a primitive shared with the member pages, DS-5): only computed values count.
 */
export const DOCUMENT_ELEMENTS: readonly string[] = ["html", "body"];

/** The fingerprint of the page on screen; an element that is not there is written "absent". */
export async function fingerprintOf(page: Page): Promise<Fingerprint> {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(
    ({ elements, properties, documentElements }) =>
      Object.fromEntries(
        Object.entries(elements).map(([name, selector]) => {
          const element = document.querySelector(selector);
          if (element === null) return [name, { absent: "true" }];
          const style = getComputedStyle(element);
          return [
            name,
            {
              ...(documentElements.includes(name)
                ? { class: element.getAttribute("class") ?? "" }
                : {}),
              ...Object.fromEntries(
                properties.map((property) => [
                  property,
                  style.getPropertyValue(property),
                ]),
              ),
            },
          ];
        }),
      ),
    {
      elements: FINGERPRINT_ELEMENTS,
      properties: FINGERPRINT_PROPERTIES,
      documentElements: DOCUMENT_ELEMENTS,
    },
  );
}

/** Every property that differs between two fingerprints, as "element property: before → after". */
export function fingerprintDifferences(
  expected: Fingerprint,
  actual: Fingerprint,
): string[] {
  const names = [
    ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
  ];
  return names.flatMap((name) => {
    const before = expected[name] ?? {};
    const after = actual[name] ?? {};
    const properties = [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ];
    return properties.flatMap((property) =>
      before[property] === after[property]
        ? []
        : [
            `${name} ${property}: ${JSON.stringify(before[property])} → ${JSON.stringify(after[property])}`,
          ],
    );
  });
}

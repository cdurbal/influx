// RUA-T8 (docs/mvp/jalons/rua/modele-archi.md §6): the component state board, served by the e2e
// build alone (INFLUX_ENV=development and INFLUX_STATE_BOARD=on at build time: playwright.config.ts
// locally, the "Build both fronts" step of ci.yml). One case: at 375 and at 1 440 px the page answers within 4 s,
// shows one section per component with its cells, exactly one `h1` outside the page-header cells and one
// in each of them, no sideways overflow of a section, and axe (WCAG 2.1 AA) finds nothing; at 375 px
// nothing overflows sideways (05-recette-visuelle §6, RUAU-J1). The absence of the page
// from a deployed build is the other half, proved on the artifact (tests/build.artifacts.ts).
import type { Locator } from "@playwright/test";
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, test } from "./support/journey";
import { settled } from "./support/rendering";

/** The sections the board holds today, one per component of RUA-05 and per family of RUB (RUB adds its own). */
const COMPONENTS = [
  "structure",
  "announcer",
  "button",
  "surface",
  "notice",
  "status-badge",
  "layer-badge",
  "role-badge",
  "counter-badge",
  "logo-plate",
  "chip-list",
  "field",
  "field-message",
  "error-summary",
  "choice-group",
  "segmented-control",
  "tag-picker",
  "internal-zone",
  "save-status",
  "disclosure",
  "date-field",
  "dialog",
  "filters-dialog",
  "filter-bar",
  "pager",
  "wizard",
  "recap",
  "otp-field",
  "numbered-steps",
  "row-list",
  "property-list",
  "empty-state",
  "skeleton",
  "photo-card",
  "feed-card",
  "media-gallery",
  "key-figures",
  "reason-list",
  "range-bar",
  "sticky-aside",
  "reading-layout",
  "preview-frame",
  "brand-hero",
] as const;

/** A cell that holds its own `h1`: the page header (C02) is shown in its states, one `h1` each. */
const HEADER_CELL = '[data-board-state^="page-header"]';

const SERVED_WITHIN_MS = 4_000;

/** The two widths 05-recette-visuelle §6 asks of the board. */
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
] as const;

test("RUA-T8: the state board is served in the e2e environment at 375 and 1 440 px, with a section per component, within 4 s, without a sideways overflow and without an axe violation", async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width} px`;
    await page.setViewportSize(viewport);
    const started = Date.now();
    await open(page, "/fr/state-board");
    const board = page.locator("[data-state-board]");
    await expect(board).toBeVisible();
    expect(Date.now() - started, label).toBeLessThanOrEqual(SERVED_WITHIN_MS);

    // RUB-AX, the `h1` guard (RUB-A §4): exactly one `h1` outside the page-header cells, and one in each.
    const headings = await board.evaluate((element, cell) => {
      const all = [...element.querySelectorAll("h1")];
      return {
        outside: all.filter((heading) => heading.closest(cell) === null).length,
        perCell: [...element.querySelectorAll(cell)].map(
          (header) => header.querySelectorAll("h1").length,
        ),
      };
    }, HEADER_CELL);
    expect(headings.outside, `${label}: h1 outside the header cells`).toBe(1);
    expect(headings.perCell.length, `${label}: header cells`).toBeGreaterThan(
      0,
    );
    expect(
      headings.perCell.every((count) => count === 1),
      `${label}: one h1 per header cell (${headings.perCell.join(", ")})`,
    ).toBe(true);
    for (const component of COMPONENTS) {
      const section = board.locator(`[data-board-component="${component}"]`);
      await expect(section, `${label}: ${component}`).toHaveCount(1);
      expect(
        await section.locator("[data-board-state]").count(),
        `${label}: ${component}: at least one state`,
      ).toBeGreaterThan(0);
      // RUB-AX: no section overflows sideways, at 375 and at 1 440 px.
      const sectionOverflow = await section.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(
        sectionOverflow,
        `${label}: ${component}: overflow`,
      ).toBeLessThanOrEqual(0);
    }
    if (viewport.width === 375) {
      const overflow = await board.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(overflow, "board overflow at 375 px").toBeLessThanOrEqual(0);
    }
    await expectNoAxeViolation(page, `planche des états à ${label}`);
  }
});

// RUB-AN2, line 02 (R04 lines 2, 3, 16 and 21; docs/mvp/jalons/rub/modele-ux.md §3): at 1 440 px the card
// of a link lifts 2 px and lights its border over 120 ms on the curve `standard`, the chevron of a `go` link
// nudges 2 px, the check of an added button fades in over 120 ms and the inner panel rises in over 200 ms;
// under reduced motion the lift, the nudge and the durations are gone (AN-1). RUB-AX: the two small buttons
// reach 44 px by their pseudo-element, the busy button keeps its width, the inline link is underlined (L2AT-2).
test("RUB-AN2 02: the surfaces and the actions, their motion and its absence under reduced motion, their touch zones and their underline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";

  const cardLink = board.locator('[data-board-state="card-link"] a');
  const readCard = () =>
    cardLink.evaluate((link) => {
      const card = link.parentElement!.parentElement!;
      const style = getComputedStyle(card);
      return {
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        properties: style.transitionProperty,
        translate: style.translate,
        border: style.borderTopColor,
      };
    });
  const chevron = board
    .locator('[data-board-state="action-link-go"] a svg')
    .first();
  const readChevron = () =>
    chevron.evaluate((icon) => {
      const style = getComputedStyle(icon);
      return {
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        translate: style.translate,
      };
    });
  const check = board.locator('[data-board-state="added"] button svg').first();
  const panel = board.locator(
    '[data-board-state="inner-panel"] > div > div > div',
  );
  const readAnimation = (target: typeof check) =>
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return { name: style.animationName, duration: style.animationDuration };
    });

  // Motion allowed.
  const resting = await readCard();
  expect(resting.duration).toBe("0.12s");
  expect(resting.timing).toBe(STANDARD);
  expect(resting.properties).toContain("translate");
  expect(resting.properties).toContain("border-color");
  expect(resting.translate).toBe("none");
  await cardLink.hover();
  await expect.poll(async () => (await readCard()).translate).toBe("0px -2px");
  expect((await readCard()).border).not.toBe(resting.border);
  await chevron.evaluate((icon) => icon.scrollIntoView());
  expect((await readChevron()).translate).toBe("none");
  await chevron.hover();
  await expect.poll(async () => (await readChevron()).translate).toBe("2px");
  expect(await readChevron()).toMatchObject({
    duration: "0.12s",
    timing: STANDARD,
  });
  expect(await readAnimation(check)).toEqual({
    name: "fade-in",
    duration: "0.12s",
  });
  expect(await readAnimation(panel)).toEqual({
    name: "rise-in",
    duration: "0.2s",
  });

  // Reduced motion: colors alone, nothing moves, every duration is zero (AN-1).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(0, 0);
  await cardLink.evaluate((link) => link.scrollIntoView());
  await cardLink.hover();
  await expect.poll(async () => (await readCard()).duration).toBe("0s");
  expect((await readCard()).translate).toBe("none");
  await chevron.evaluate((icon) => icon.scrollIntoView());
  await chevron.hover();
  expect((await readChevron()).translate).toBe("none");
  expect((await readAnimation(check)).duration).toBe("0s");
  expect((await readAnimation(panel)).duration).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // RUB-AX: the 36 and 40 px buttons are reached over 44 px of height; the zone is theirs, never a neighbour's.
  for (const [name, size] of [
    ["Petit", 36],
    ["Barre", 40],
  ] as const) {
    const button = board
      .locator('[data-board-state="secondary"]')
      .getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(Math.round(box.height), name).toBe(size);
    const above = Math.floor((44 - size) / 2) - 1;
    for (const y of [box.y - above, box.y + box.height + above]) {
      const hit = await page.evaluate(
        ([x, top]) =>
          document.elementFromPoint(x, top)?.closest("button")?.textContent,
        [box.x + box.width / 2, y] as const,
      );
      expect(hit, `${name} at ${y}`).toBe(name);
    }
  }

  // The busy button keeps the width of the idle one with the same labels.
  const [busyBox, idleBox] = await Promise.all(
    [0, 1].map((index) =>
      board
        .locator('[data-board-state="busy"] button')
        .nth(index)
        .boundingBox(),
    ),
  );
  expect(busyBox!.width).toBe(idleBox!.width);

  // L2AT-2: the inline link and the label of the save link are underlined.
  for (const selector of [
    '[data-board-state="action-link-inline"] a',
    '[data-board-state="action-link-save"] button',
  ]) {
    expect(
      await board
        .locator(selector)
        .first()
        .evaluate((element) => getComputedStyle(element).textDecorationLine),
      selector,
    ).toBe("underline");
  }

  // U-2: at 375 px the value of a `readonly` line keeps a box that holds its text; « Modifier » wraps, never over it.
  await page.setViewportSize({ width: 375, height: 812 });
  const readonlyFaults = await board
    .locator('[data-board-state="inner-panel-readonly"]')
    .evaluate((cell) => {
      const action = cell.querySelector("button")!;
      const button = action.getBoundingClientRect();
      const value = action.previousElementSibling!;
      const box = value.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(value);
      return [...range.getClientRects()].flatMap((text) => [
        ...(text.left < box.left - 0.5 || text.right > box.right + 0.5
          ? [`text of ${text.width} px out of its box of ${box.width} px`]
          : []),
        ...(text.left < button.right &&
        text.right > button.left &&
        text.top < button.bottom &&
        text.bottom > button.top
          ? ["text under the button"]
          : []),
      ]);
    });
  expect(readonlyFaults, "inner-panel-readonly at 375 px").toEqual([]);
});

// RUB-AN2, line 17 (R04 line 17: the counter, C16), and RUB-AX for line 03 (docs/mvp/jalons/rub/modele-ux.md §5):
// at 1 440 px a counter whose value changes flashes its container once, 320 ms on the curve `standard`, and
// not before the change; under reduced motion the duration is zero (AN-1). The badges keep the measures of
// `02a` (8 px between an icon and its word, 4 px in the `text` form, 12 px and 16 px in a notice), the role
// badge never inherits the weight of its parent (RU-15), the counter has its contour (AP1) that the system
// draws under forced colours, a plate shows its initials when the picture is absent or fails, and a strip
// keeps its action on the line of its text, then under it at 375 px.
test("RUB-AN2 17: the counter flashes when its value changes, and not under reduced motion; RUB-AX: the measures of the badges, the notices and the plates", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const style = (target: ReturnType<typeof cell>, property: string) =>
    target.evaluate(
      (element, name) =>
        getComputedStyle(element).getPropertyValue(name as string),
      property,
    );

  // The counter: no flash on the first draw, one after a change, none under reduced motion.
  const changed = cell("counter-badge", "changed");
  const container = changed.locator(".animate-flash-strong");
  await expect(container).toHaveCount(0);
  await changed.getByRole("button").click();
  await expect(container).toHaveCount(1);
  expect(
    await container.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        name: computed.animationName,
        duration: computed.animationDuration,
        timing: computed.animationTimingFunction,
      };
    }),
  ).toEqual({
    name: "flash-strong",
    duration: "0.32s",
    timing: "cubic-bezier(0.2, 0, 0, 1)",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await changed.getByRole("button").click();
  expect(
    await changed
      .locator(".animate-flash-strong")
      .evaluate((element) => getComputedStyle(element).animationDuration),
  ).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // The counter: 24 px at least, its contour transparent at rest and drawn by the system under forced colours (AP1).
  const pill = cell("counter-badge", "pill")
    .locator("span.rounded-pill > span")
    .first();
  expect(Math.round((await pill.boundingBox())!.width)).toBeGreaterThanOrEqual(
    24,
  );
  expect(await style(pill, "outline-style")).toBe("solid");
  expect(await style(pill, "outline-color")).toBe("rgba(0, 0, 0, 0)");
  await page.emulateMedia({ forcedColors: "active" });
  expect(await style(pill, "outline-color")).not.toBe("rgba(0, 0, 0, 0)");
  await page.emulateMedia({ forcedColors: "none" });

  // The badges and the notices: the gaps and the icon of `02a`.
  const withIcon = cell("status-badge", "with-icon").locator("span").first();
  expect(await style(withIcon, "column-gap")).toBe("8px");
  expect(
    await withIcon
      .locator("svg")
      .evaluate((icon) => icon.getBoundingClientRect().width),
  ).toBe(16);
  expect(
    await style(
      cell("status-badge", "text").locator("span").first(),
      "column-gap",
    ),
  ).toBe("4px");
  expect(
    await style(
      cell("layer-badge", "layers").locator("span > span").first(),
      "column-gap",
    ),
  ).toBe("8px");
  expect(
    await style(
      cell("layer-badge", "wrap").locator("span > span").first(),
      "border-top-left-radius",
    ),
  ).toBe("12px");
  const notice = cell("notice", "titled").locator("[role=status]");
  expect(await style(notice, "column-gap")).toBe("12px");
  expect(
    await notice
      .locator("svg")
      .evaluate((icon) => icon.getBoundingClientRect().width),
  ).toBe(16);

  // RU-15: the role badge under a parent of weight 800 keeps its own.
  expect(
    await style(
      cell("role-badge", "inherited-weight")
        .locator("span.rounded-pill")
        .first(),
      "font-weight",
    ),
  ).toBe("400");

  // The plates: six sizes of picture, initials without one, initials after a failure, a dashed square.
  const sizes = await cell("logo-plate", "plate-image")
    .locator("img")
    .evaluateAll((images) =>
      images.map((image) => [
        Math.round(image.parentElement!.getBoundingClientRect().width),
        (image as HTMLImageElement).naturalWidth,
      ]),
    );
  expect(sizes).toEqual([32, 40, 48, 56, 64, 120].map((size) => [size, 8]));
  const initials = cell("logo-plate", "plate-initials").getByRole("img", {
    name: "Atelier Exemple",
  });
  await expect(initials).toHaveCount(6);
  await expect(initials.first()).toHaveText("AE");
  const failed = cell("logo-plate", "failed");
  await expect(failed.locator("img")).toHaveCount(0);
  await expect(failed.getByRole("img", { name: "Atelier Exemple" })).toHaveText(
    "AE",
  );
  expect(
    await style(
      cell("logo-plate", "dashed").getByRole("img"),
      "border-top-style",
    ),
  ).toBe("dashed");

  // The strip: the action stays on the line of the text at 1 440 px, and drops under it at 375 px. The icon
  // is never left alone: the body begins on its line, to its right.
  const centres = (state: string) =>
    cell("notice", state)
      .locator("[role=status]")
      .evaluate((element) => {
        const [icon, body, action] = [...element.children].map((child) =>
          child.getBoundingClientRect(),
        );
        return {
          bodyBelowIcon: body!.top - icon!.bottom,
          bodyAfterIcon: body!.left - icon!.right,
          iconMiddle: icon!.top + icon!.height / 2,
          actionMiddle: action!.top + action!.height / 2,
          bodyBottom: body!.bottom,
          actionTop: action!.top,
        };
      });
  const besideIcon = (
    strip: Awaited<ReturnType<typeof centres>>,
    where: string,
  ) => {
    expect(strip.bodyBelowIcon, where).toBeLessThan(0);
    expect(strip.bodyAfterIcon, where).toBeGreaterThanOrEqual(0);
  };
  const wide = await centres("strip");
  expect(Math.abs(wide.iconMiddle - wide.actionMiddle)).toBeLessThanOrEqual(2);
  besideIcon(await centres("strip-long"), "strip-long at 1 440");
  await page.setViewportSize({ width: 375, height: 812 });
  await cell("notice", "strip-long").scrollIntoViewIfNeeded();
  const narrow = await centres("strip-long");
  expect(narrow.actionTop).toBeGreaterThanOrEqual(narrow.bodyBottom - 1);
  besideIcon(narrow, "strip-long at 375");
  besideIcon(await centres("strip"), "strip at 375");
});

// RUB-AN2, lines 04 and 32 (R04 lines 4 and 32: the row, C06; the skeleton, C09), and RUB-AX for line 04
// (docs/mvp/jalons/rub/modele-ux.md §5): at 1 440 px a linked row lights its ground over 120 ms on the curve
// `standard` and the sheen of a skeleton crosses it in 1,2 s, linear and infinite; under reduced motion the
// durations are zero and the sheen is gone (AN-1). A row is 60 px at least, the ring of its link is drawn
// inside it, the current row has its contour (drawn by the system under forced colours, AP1), the list of
// properties is a `dl` with its label column and its two lists, a state message announces itself when it is
// `live`, and at 375 px the campaign row stacks its state under its title.
test("RUB-AN2 04 and 32: the row lights its ground and the skeleton shows its sheen, and not under reduced motion; RUB-AX: the measures of the lists, the properties and the states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const style = (target: ReturnType<typeof cell>, property: string) =>
    target.evaluate(
      (element, name) =>
        getComputedStyle(element).getPropertyValue(name as string),
      property,
    );

  // The row: 60 px at least, the ground on hover over 120 ms on `standard`, instant under reduced motion.
  const row = cell("row-list", "campaign").locator("li").first();
  await row.scrollIntoViewIfNeeded();
  expect(
    (await row.boundingBox())!.height,
    "row height",
  ).toBeGreaterThanOrEqual(60);
  const readRow = () =>
    row.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        duration: computed.transitionDuration,
        timing: computed.transitionTimingFunction,
        properties: computed.transitionProperty,
      };
    });
  const resting = await readRow();
  expect(resting).toMatchObject({
    duration: "0.12s",
    timing: "cubic-bezier(0.2, 0, 0, 1)",
  });
  expect(resting.properties).toContain("background-color");
  await row.hover();
  await expect
    .poll(async () => (await readRow()).background)
    .not.toBe(resting.background);

  // With a sentence alone there is no grid: the chevron still ends at the right edge of the row, inside its padding.
  const chevronGap = await cell("row-list", "campaign-sub")
    .locator("li")
    .first()
    .evaluate((element) => {
      const chevron = element.querySelector(":scope > svg")!;
      return (
        element.getBoundingClientRect().right -
        parseFloat(getComputedStyle(element).paddingRight) -
        chevron.getBoundingClientRect().right
      );
    });
  expect(Math.abs(chevronGap), "campaign-sub chevron").toBeLessThanOrEqual(2);

  // The ring of the link is inside the row, on its stretched link.
  await page.mouse.move(0, 0);
  await row.locator("a").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const ring = await row.locator("a").evaluate((link) => {
    const computed = getComputedStyle(link, "::after");
    return {
      style: computed.outlineStyle,
      width: computed.outlineWidth,
      offset: computed.outlineOffset,
    };
  });
  expect(ring).toEqual({ style: "solid", width: "3px", offset: "-3px" });

  // The current row: a contour that is transparent at rest and drawn by the system under forced colours (AP1).
  const current = cell("row-list", "current").locator("li").first();
  expect(await style(current, "outline-style")).toBe("solid");
  expect(await style(current, "outline-color")).toBe("rgba(0, 0, 0, 0)");
  await page.emulateMedia({ forcedColors: "active" });
  expect(await style(current, "outline-color")).not.toBe("rgba(0, 0, 0, 0)");
  await page.emulateMedia({ forcedColors: "none" });

  // The list of properties: a `dl`, the label column at 13 rem, two lists side by side at 1 440 px.
  const label = cell("property-list", "standard").locator("dt").first();
  expect(Math.round((await label.boundingBox())!.width)).toBe(208);
  expect(await cell("property-list", "standard").locator("dl").count()).toBe(1);
  const lists = cell("property-list", "two-columns").locator("dl");
  await expect(lists).toHaveCount(2);
  const [left, right] = await Promise.all(
    [0, 1].map((index) => lists.nth(index).boundingBox()),
  );
  expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(1);
  expect(right!.x).toBeGreaterThan(left!.x + left!.width - 1);

  // A state message that is `live` speaks its title in the announcer.
  await expect(page.locator("[data-announcer]")).toHaveText(
    "La liste n'a pas pu être rechargée",
  );

  // The skeleton: the shapes show after a second, with a sheen of 1,2 s, linear, infinite; none under reduced motion.
  const shape = cell("skeleton", "line").locator("[aria-hidden] > div").first();
  await shape.scrollIntoViewIfNeeded();
  await expect(shape).toBeVisible({ timeout: 3_000 });
  const readSheen = () =>
    shape.evaluate((element) => {
      const computed = getComputedStyle(element, "::after");
      return {
        name: computed.animationName,
        duration: computed.animationDuration,
        timing: computed.animationTimingFunction,
        iterations: computed.animationIterationCount,
      };
    });
  expect(await readSheen()).toEqual({
    name: "skeleton",
    duration: "1.2s",
    timing: "linear",
    iterations: "infinite",
  });
  expect(await style(shape, "border-top-left-radius")).toBe("6px");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await readSheen()).name).toBe("none");
  await row.hover();
  await expect.poll(async () => (await readRow()).duration).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // At 375 px the campaign row stacks its state under its title.
  await page.setViewportSize({ width: 375, height: 812 });
  const stacked = cell("row-list", "campaign").locator("li").first();
  await stacked.scrollIntoViewIfNeeded();
  const [title, state] = await Promise.all([
    stacked.locator("a").boundingBox(),
    stacked.getByText("Brouillon").boundingBox(),
  ]);
  expect(state!.y).toBeGreaterThanOrEqual(title!.y + title!.height - 1);
});

// RUB-AN2, line 05 (R04 lines 21 and 30: the field, C18, enters by `rise-in` when it is conditional, and its outline
// goes from 1 to 2 px by its colour alone), RUB-AX for C18 to C21 and the keyboard of the summary
// (docs/mvp/jalons/rub/modele-ux.md §5, PT1): at 1 440 px an error does not move the text of a field (the padding
// grows back the outline, the height stays), a text area keeps its height, the unit sits after a control of 128 px,
// the grid has four columns at 1 440 px and one at 375, a link of the summary opens the field that a closed step
// hides and focuses it, and a group of boxes refuses a choice over its cap without unticking another one.
test("RUB-AN2 05: the field enters by rise-in and its error moves nothing, and not under reduced motion; RUB-AX: the grid, the unit, the summary to the field by the keyboard, the cap of a group", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const control = (component: string, state: string, tag = "input") =>
    cell(component, state).locator(tag).first();
  const measures = (target: ReturnType<typeof control>) =>
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        border: style.borderTopWidth,
        textStart:
          parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        textEnd:
          parseFloat(style.borderRightWidth) + parseFloat(style.paddingRight),
        textTop:
          parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        properties: style.transitionProperty,
      };
    });

  // The error: 2 px instead of 1, the same height, the text where it was; only the colour transitions.
  const resting = await measures(control("field", "filled"));
  const failing = await measures(control("field", "error-filled"));
  expect(resting.border).toBe("1px");
  expect(failing.border).toBe("2px");
  expect(failing.height).toBe(resting.height);
  expect(failing.textStart).toBe(resting.textStart);
  expect(failing.textEnd).toBe(resting.textEnd);
  expect(failing).toMatchObject({
    duration: "0.12s",
    timing: "cubic-bezier(0.2, 0, 0, 1)",
  });
  expect(failing.properties).toContain("border-color");
  expect(failing.properties).not.toContain("all");
  expect(failing.properties).not.toContain("width");
  const area = await measures(control("field", "area", "textarea"));
  const areaFailing = await measures(
    control("field", "area-error", "textarea"),
  );
  expect(areaFailing.height).toBe(area.height);
  expect(areaFailing.textStart).toBe(area.textStart);
  expect(areaFailing.textTop).toBe(area.textTop);
  expect(area.height).toBeGreaterThanOrEqual(120);

  // The conditional field enters by rise-in over 200 ms, and not under reduced motion (AN-1).
  const conditional = cell("field", "conditional")
    .locator("label")
    .locator("xpath=../..");
  const readEntering = () =>
    conditional.evaluate((element) => {
      const style = getComputedStyle(element);
      return { name: style.animationName, duration: style.animationDuration };
    });
  expect(await readEntering()).toEqual({ name: "rise-in", duration: "0.2s" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await readEntering()).duration).toBe("0s");
  expect((await measures(control("field", "error-filled"))).duration).toBe(
    "0s",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // The control of a number is 128 px, its unit follows it on the same line; the grid has four columns.
  const number = await control("field", "unit").boundingBox();
  const unit = await cell("field", "unit").getByText("jours").boundingBox();
  expect(Math.round(number!.width)).toBe(128);
  expect(unit!.x).toBeGreaterThan(number!.x + number!.width);
  expect(
    Math.abs(unit!.y + unit!.height / 2 - (number!.y + number!.height / 2)),
  ).toBeLessThanOrEqual(2);
  const gridTops = async () =>
    Promise.all(
      [0, 1, 2, 3].map(async (index) =>
        Math.round(
          (await cell("field", "grid")
            .locator("input")
            .nth(index)
            .boundingBox())!.y,
        ),
      ),
    );
  expect(new Set(await gridTops()).size).toBe(1);

  // The summary: the first link opens the field a closed step hides, then focuses it; the second focuses a visible one.
  const summary = cell("error-summary", "summary");
  await expect(summary.locator("#board-summary-hidden")).toHaveCount(0);
  await summary.getByRole("link", { name: "Site web" }).focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("#board-summary-hidden")).toBeFocused();
  await summary.getByRole("link", { name: "Nom de la marque" }).focus();
  await page.keyboard.press("Enter");
  await expect(summary.locator("#board-summary-visible")).toBeFocused();
  await expect(cell("error-summary", "empty").getByRole("group")).toHaveCount(
    0,
  );
  await expect(
    cell("error-summary", "missing").getByRole("listitem"),
  ).toHaveCount(2);

  // The group of boxes at its cap refuses a fourth choice and unticks nothing; ticking one frees the others.
  const cap = cell("choice-group", "cap");
  const box = (name: string) => cap.getByRole("checkbox", { name });
  await expect(cap.getByRole("status")).toContainText("Plafond atteint");
  await expect(box("Sport")).toHaveAttribute("aria-disabled", "true");
  await box("Sport").click({ force: true });
  await expect(box("Sport")).not.toBeChecked();
  for (const name of ["Beauté", "Cuisine", "Voyage"]) {
    await expect(box(name)).toBeChecked();
  }
  await expect(cap).toContainText("3 / 3");
  await box("Voyage").click();
  await expect(box("Voyage")).not.toBeChecked();
  await expect(cap.getByRole("status")).toBeEmpty();
  await box("Sport").click();
  await expect(box("Sport")).toBeChecked();
  const rowHeight = (await cap.locator("label").first().boundingBox())!.height;
  expect(rowHeight).toBeGreaterThanOrEqual(44);

  // A choice that is unavailable says why, a locked group keeps its answer readable, the radios answer to the arrows.
  const reason = cell("choice-group", "reason");
  await expect(reason.getByRole("checkbox", { name: "Direct" })).toBeDisabled();
  await expect(reason).toContainText("Les directs ne sont pas ouverts");
  const locked = cell("choice-group", "locked").getByRole("radio");
  await expect(locked.first()).toBeDisabled();
  await expect(locked.first()).toBeChecked();
  const radios = cell("choice-group", "radios").getByRole("radio");
  await radios.nth(1).focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(2)).toBeChecked();
});

// RUB-AN2, line 06 (R04 lines 6, 19, 20 and 29: the segment changes its ground over 120 ms, the fold shows its content
// by `rise-in` over 200 ms and turns its chevron over 200 ms (the panel of the rare gestures, 120 ms), the save status
// turns its icon for 1 s; AN-1 under reduced motion) and RUB-AX for C22 to C26 and C47 (docs/mvp/jalons/rub/
// modele-ux.md §3, §5, §6): the contour of the active segment is drawn by forced colours and by them alone, the ring is
// on a pseudo-element, the radios answer to the arrows, the tabs loop and take Home and End, the cross of a tag has a
// zone of 44 px and the focus goes to the next tag, then to the list, a failure is announced once, a fold opens on an
// error, and a date is written back in the order of the language when it is left.
test("RUB-AN2 06: the segments, the tags, the save status, the fold and the date, their motion and its absence under reduced motion, their keyboard and their forced colours", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const style = (target: ReturnType<typeof cell>, property: string) =>
    target.evaluate(
      (element, name) =>
        getComputedStyle(element).getPropertyValue(name as string),
      property,
    );
  const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";

  // The radios: the active segment is on its surface with a transparent contour, and the arrows choose.
  const radio = cell("segmented-control", "radio");
  const segment = (name: string) =>
    radio.locator("label").filter({ hasText: name });
  expect(await style(segment("Liste"), "outline-style")).toBe("solid");
  expect(await style(segment("Liste"), "outline-color")).toBe(
    "rgba(0, 0, 0, 0)",
  );
  expect(await style(segment("Grille"), "outline-style")).toBe("none");
  expect(await style(segment("Liste"), "transition-duration")).toBe("0.12s");
  expect(await style(segment("Liste"), "transition-timing-function")).toBe(
    STANDARD,
  );
  expect(await style(segment("Grille"), "transition-property")).toContain(
    "background-color",
  );
  expect(Math.round((await segment("Liste").boundingBox())!.height)).toBe(36);
  const radios = radio.getByRole("radio");
  await radios.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(1)).toBeChecked();
  const ring = await segment("Grille").evaluate((label) => {
    const computed = getComputedStyle(label, "::after");
    return { style: computed.outlineStyle, width: computed.outlineWidth };
  });
  expect(ring).toEqual({ style: "solid", width: "3px" });
  await expect(segment("Grille")).toHaveCSS("outline-style", "solid");
  expect(await style(segment("Liste"), "outline-style")).toBe("none");

  // Forced colours draw the contour of the active segment and of the active one alone (AP1).
  await page.emulateMedia({ forcedColors: "active" });
  expect(await style(segment("Grille"), "outline-style")).toBe("solid");
  expect(await style(segment("Liste"), "outline-style")).toBe("none");
  expect(await style(segment("Grille"), "outline-color")).not.toBe(
    "rgba(0, 0, 0, 0)",
  );
  await page.emulateMedia({ forcedColors: "none" });

  // The tabs: one tab stop, the arrows loop and choose at once, Home and End reach the ends.
  const tabs = cell("segmented-control", "tabs").getByRole("tab");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");
  await tabs.first().focus();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(
    cell("segmented-control", "tabs").getByRole("tabpanel", {
      name: "Identité",
    }),
  ).toBeVisible();

  // The views are links, the current one `true`: the shell alone holds a `page`.
  const views = cell("segmented-control", "views");
  await expect(views.locator('a[aria-current="true"]')).toHaveText(
    /Les miennes/,
  );
  await expect(board.locator('[aria-current="page"]')).toHaveCount(0);

  // The tags: the cross has a zone of 44 by 44 px, the focus goes to the next tag, then to the list, the removal is said.
  const picker = cell("tag-picker", "filled");
  const cross = picker.getByRole("button", { name: "Retirer France" });
  const zone = await cross.evaluate((button) => {
    const computed = getComputedStyle(button, "::before");
    return { width: computed.width, height: computed.height };
  });
  expect(zone).toEqual({ width: "44px", height: "44px" });
  expect(Math.round((await cross.boundingBox())!.width)).toBe(24);
  await cross.click();
  await expect(
    picker.getByRole("button", { name: "Retirer Belgique" }),
  ).toBeFocused();
  await expect(picker.getByRole("status")).toHaveText("France retiré");
  await picker.getByRole("button", { name: "Retirer Belgique" }).click();
  await expect(picker.getByRole("combobox")).toBeFocused();
  await expect(picker.getByRole("status")).toHaveText("Belgique retiré");
  expect(
    await cell("tag-picker", "cap")
      .getByRole("combobox")
      .locator("option")
      .count(),
  ).toBe(1);

  // The save status: its icon turns for 1 s, and stands still under reduced motion; a failure is announced once.
  const spinner = cell("save-status", "saving").locator("svg").first();
  const readSpin = () =>
    spinner.evaluate((icon) => {
      const computed = getComputedStyle(icon);
      return {
        name: computed.animationName,
        duration: computed.animationDuration,
        timing: computed.animationTimingFunction,
      };
    });
  expect(await readSpin()).toEqual({
    name: "turn",
    duration: "1s",
    timing: "linear",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await readSpin()).duration).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const failing = cell("save-status", "failing");
  await failing.getByRole("button", { name: "Provoquer l'échec" }).click();
  await expect(page.locator("[data-announcer]")).toHaveText(
    "Non enregistré : vos modifications sont conservées ici.",
  );
  await failing.getByRole("button", { name: "Réessayer" }).click();
  await expect(failing.locator('[data-save-state="saving"]')).toHaveCount(1);
  await expect(cell("save-status", "saved").getByRole("status")).toHaveCount(0);

  // A failure keeps its icon left of its text, on its first line: only the delay and the retry wrap.
  const iconBesideText = async (
    line: ReturnType<typeof cell>,
    where: string,
  ) => {
    await line.scrollIntoViewIfNeeded();
    const measured = await line.evaluate((element) => {
      const icon = element.querySelector("svg")!.getBoundingClientRect();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      range.selectNodeContents(walker.nextNode()!);
      const first = range.getClientRects()[0]!;
      const middle = icon.top + icon.height / 2;
      return {
        gap: first.left - icon.right,
        onFirstLine: middle > first.top && middle < first.bottom,
      };
    });
    expect(measured.gap, where).toBeGreaterThanOrEqual(0);
    expect(measured.onFirstLine, where).toBe(true);
  };
  await page.setViewportSize({ width: 375, height: 812 });
  await iconBesideText(
    cell("save-status", "failed").locator("[data-save-state]"),
    "save-status failed at 375",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await iconBesideText(
    cell("wizard", "page-header-wizard-busy").locator(
      "[data-save-state]:visible",
    ),
    "wizard foot at 1 440",
  );

  // The fold: the content rises in over 200 ms, the chevron turns over 200 ms (120 ms for the rare gestures).
  const fold = cell("disclosure", "fold").locator("details");
  const readFold = () =>
    fold.evaluate((details) => {
      const content = details.querySelector("summary + div")!;
      const chevron = details.querySelector("summary svg")!;
      const animation = getComputedStyle(content);
      const turn = getComputedStyle(chevron);
      return {
        name: animation.animationName,
        duration: animation.animationDuration,
        rotate: turn.rotate,
        turnDuration: turn.transitionDuration,
        turnTiming: turn.transitionTimingFunction,
      };
    });
  expect(await readFold()).toMatchObject({
    name: "rise-in",
    duration: "0.2s",
    rotate: "none",
    turnDuration: "0.2s",
    turnTiming: STANDARD,
  });
  expect(
    Math.round((await fold.locator("summary").boundingBox())!.height),
  ).toBe(44);
  await fold.locator("summary").click();
  await expect(fold).toHaveAttribute("open", "");
  await expect.poll(async () => (await readFold()).rotate).toBe("90deg");
  const rare = cell("disclosure", "rare").locator("details");
  await rare.locator("summary").click();
  await expect
    .poll(() =>
      rare
        .locator("summary svg")
        .evaluate((icon) => getComputedStyle(icon).rotate),
    )
    .toBe("180deg");
  expect(
    await rare
      .locator("summary svg")
      .evaluate((icon) => getComputedStyle(icon).transitionDuration),
  ).toBe("0.12s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await readFold()).duration).toBe("0s");
  expect((await readFold()).turnDuration).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // An error inside a closed fold opens it; the member then closes it as any other.
  const forced = cell("disclosure", "force-open");
  await expect(forced.locator("details")).not.toHaveAttribute("open", "");
  await forced.getByRole("button", { name: "Provoquer l'erreur" }).click();
  await expect(forced.locator("details")).toHaveAttribute("open", "");
  await expect(forced.getByText("Ce champ est obligatoire.")).toBeVisible();
  await forced.locator("summary").click();
  await expect(forced.locator("details")).not.toHaveAttribute("open", "");

  // The date: written back in the order of the language when it is left; a text that is no date is refused in words.
  const dateCell = cell("date-field", "empty");
  const date = dateCell.getByRole("textbox");
  const refusal = dateCell.getByText(
    "Écrivez la date sous la forme jj/mm/aaaa.",
  );
  await date.fill("15.01.2027");
  await expect(date).toHaveValue("15.01.2027");
  await date.blur();
  await expect(date).toHaveValue("15/01/2027");
  await date.fill("31/02/2027");
  await expect(refusal).toHaveCount(0);
  await date.blur();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(refusal).toBeVisible();
  await date.fill("15012026");
  await date.blur();
  await expect(
    dateCell.getByText("Choisissez une date à partir du 01/01/2027."),
  ).toBeVisible();
  await date.fill("20012027");
  await date.blur();
  await expect(date).toHaveValue("20/01/2027");
  await expect(date).not.toHaveAttribute("aria-invalid", "true");
  expect(Math.round((await date.boundingBox())!.width)).toBe(192);
  await expect(cell("date-field", "us").getByRole("textbox")).toHaveValue(
    "01/15/2027",
  );

  // RUBT-3: a bound that moves reads the typed text again and keeps it; the refusal and the value sent out follow.
  const bounded = cell("date-field", "bounds");
  const kept = bounded.getByRole("textbox");
  const outOfBounds = bounded.getByText(
    "Choisissez une date à partir de la borne.",
  );
  const move = bounded.getByRole("button", { name: "Déplacer la borne" });
  const sent = bounded.locator("[data-board-value]");
  await kept.fill("01/01/2027");
  await kept.blur();
  await expect(outOfBounds).toBeVisible();
  await move.click();
  await expect(sent).toHaveText("Valeur reçue : 2027-01-01");
  await expect(kept).toHaveValue("01/01/2027");
  await expect(kept).not.toHaveAttribute("aria-invalid", "true");
  await expect(outOfBounds).toHaveCount(0);
  await move.click();
  await expect(sent).toHaveText("Valeur reçue : aucune");
  await expect(kept).toHaveValue("01/01/2027");
  await expect(kept).toHaveAttribute("aria-invalid", "true");
  await expect(outOfBounds).toBeVisible();
});

/**
 * The end state of an open dialog, to await before an axe pass: it fades in, and axe measures a text still half
 * transparent as a lack of contrast. Its content has transitions of its own (the buttons of the filters).
 */
async function fullyShown(dialog: Locator): Promise<void> {
  await settled(dialog, { subtree: true });
  await expect(dialog).toHaveCSS("opacity", "1");
}

/**
 * U-1: in a cell of the pager, no button lies over the written position, and each button stays inside its side.
 * Boxes against boxes: an overflow to the left, as on the side of « Suivant », does not show in `scrollWidth`.
 */
async function expectPagerClear(cell: Locator, label: string): Promise<void> {
  const faults = await cell.locator("[data-pager]").evaluate((group) => {
    const position = group.querySelector("p")!.getBoundingClientRect();
    return [...group.querySelectorAll("button")].flatMap((button) => {
      const box = button.getBoundingClientRect();
      const side = button.parentElement!.getBoundingClientRect();
      const name = button.dataset.direction;
      return [
        ...(box.left < position.right - 0.5 &&
        box.right > position.left + 0.5 &&
        box.top < position.bottom - 0.5 &&
        box.bottom > position.top + 0.5
          ? [`${name}: over the position`]
          : []),
        ...(box.left < side.left - 0.5 || box.right > side.right + 0.5
          ? [`${name}: ${box.width} px in a side of ${side.width} px`]
          : []),
      ];
    });
  });
  expect.soft(faults, label).toEqual([]);
}

// RUB-T7 (docs/mvp/jalons/rub/annexe.md; 02a C27, C28, C30, C32), with the axe check of the open dialog: the dialog is
// modal, names itself, puts the focus on the title or on the element asked for and gives it back to its opener; `Échap`
// and the backdrop ask it to close, unless a request runs; the dialog of the filters gives its draft up when it is
// closed without « Voir les … » and keeps what was applied; it fills the screen at 375 px; the bar toggles, opens and
// retires its criteria; the pager draws no `nav`.
test("RUB-T7: the dialogs keep and give back the focus, close by Échap and by the backdrop unless a request runs, the filters give their draft up, and axe finds nothing in an open dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );

  // The confirmation: the focus lands on the title, a modal axe pass is clean, `Échap` closes and gives the focus back.
  const confirm = cell("dialog", "confirm");
  const opener = confirm.getByRole("button", {
    name: "Ouvrir la confirmation",
  });
  await opener.click();
  const dialog = page.getByRole("dialog", {
    name: "Retirer cette sélection ?",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Retirer cette sélection ?" }),
  ).toBeFocused();
  expect(
    await dialog.evaluate((element) =>
      parseFloat(getComputedStyle(element).width),
    ),
  ).toBe(480);
  await fullyShown(dialog);
  await expectNoAxeViolation(page, "dialogue ouvert (confirmation)");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // The click on the backdrop closes it too; a click inside does not.
  await opener.click();
  await expect(dialog).toBeVisible();
  await dialog.getByText("Les créateurs qu'elle contient").click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // The large one is 34 rem; the one that asks for its focus puts it on the safe gesture.
  await cell("dialog", "wide")
    .getByRole("button", { name: "Ouvrir le dialogue large" })
    .click();
  const wide = page.getByRole("dialog", {
    name: "Comment lire un profil anonymisé",
  });
  expect(
    await wide.evaluate((element) =>
      parseFloat(getComputedStyle(element).width),
    ),
  ).toBe(544);
  await page.keyboard.press("Escape");
  await expect(wide).toBeHidden();
  await cell("dialog", "focus")
    .getByRole("button", { name: "Ouvrir le dialogue au focus demandé" })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Supprimer ce brouillon ?" })
      .getByRole("button", { name: "Garder" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");

  // A request runs: neither `Échap` nor the backdrop closes the dialog, its own button does.
  const sending = cell("dialog", "busy").getByRole("button", {
    name: "Ouvrir le dialogue en cours",
  });
  await sending.click();
  const busy = page.getByRole("dialog", { name: "Envoi de la demande" });
  await expect(busy).toBeVisible();
  // Three in a row, with no click between them: with no new activation, Chromium stops letting `cancel` be refused.
  // Refused at the key, so the element never closes, not even to show itself again.
  await busy.evaluate((element) =>
    element.addEventListener(
      "close",
      () => element.setAttribute("data-heard-close", ""),
      { once: true },
    ),
  );
  for (let press = 0; press < 3; press += 1) {
    await page.keyboard.press("Escape");
  }
  await expect(busy).toBeVisible();
  await expect(busy).toHaveAttribute("open", "");
  await expect(busy).not.toHaveAttribute("data-heard-close");
  await page.mouse.click(5, 5);
  await expect(busy).toBeVisible();
  // A close that no key asked for: the element shows itself again, the focus back on what had it.
  const held = busy.getByRole("button", { name: "Envoi…" });
  await held.focus();
  await busy.evaluate(async (element: HTMLDialogElement) => {
    const closed = new Promise((done) =>
      element.addEventListener("close", done, { once: true }),
    );
    element.close();
    await closed;
  });
  await expect(busy).toHaveAttribute("open", "");
  await expect(held).toBeFocused();
  await busy.getByRole("button", { name: "Terminer l'envoi" }).click();
  await expect(busy).toBeHidden();
  await expect(sending).toBeFocused();

  // The error dialog is clean for axe as well.
  await cell("dialog", "error")
    .getByRole("button", { name: "Ouvrir le dialogue d'erreur" })
    .click();
  const failed = page.getByRole("dialog", {
    name: "La demande n'est pas partie",
  });
  await expect(failed.getByRole("alert")).toContainText("L'envoi a échoué");
  await fullyShown(failed);
  await expectNoAxeViolation(page, "dialogue ouvert (erreur)");
  await page.keyboard.press("Escape");

  // The filters: nothing applies before « Voir les … »; the draft is given up by the cross, by `Échap` and by the backdrop.
  const filters = cell("filters-dialog", "closed");
  const applied = filters.locator("[data-board-applied]");
  const opening = filters.getByRole("button", { name: "Ouvrir les filtres" });
  const panel = page.getByRole("dialog", { name: "Filtres" });
  const keyword = panel.getByRole("searchbox", {
    name: "Mot-clé de la recherche",
  });
  await opening.click();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Filtres" })).toBeFocused();
  expect(
    await panel.evaluate((element) =>
      parseFloat(getComputedStyle(element).width),
    ),
  ).toBe(672);
  const clear = panel.getByRole("button", { name: "Tout effacer" });
  await expect(clear).toHaveAttribute("aria-disabled", "true");
  await panel.getByRole("checkbox", { name: "TikTok" }).check();
  await keyword.fill("cuisine");
  await expect(clear).not.toHaveAttribute("aria-disabled", "true");
  await expect(applied).toHaveText("Critères appliqués : 0");
  await fullyShown(panel);
  await expectNoAxeViolation(page, "dialogue des filtres ouvert");
  await panel.getByRole("button", { name: "Fermer les filtres" }).click();
  await expect(panel).toBeHidden();
  await expect(opening).toBeFocused();
  await expect(applied).toHaveText("Critères appliqués : 0");
  await opening.click();
  await expect(
    panel.getByRole("checkbox", { name: "TikTok" }),
  ).not.toBeChecked();
  await expect(keyword).toHaveValue("");
  await panel.getByRole("checkbox", { name: "TikTok" }).check();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await opening.click();
  await expect(
    panel.getByRole("checkbox", { name: "TikTok" }),
  ).not.toBeChecked();
  await page.mouse.click(5, 5);
  await expect(panel).toBeHidden();
  // Applied: the draft becomes the criteria, which the next opening starts from; « Tout effacer » empties the draft only.
  await opening.click();
  await panel.getByRole("checkbox", { name: "YouTube" }).check();
  await panel.getByRole("button", { name: "Voir le résultat" }).click();
  await expect(panel).toBeHidden();
  await expect(applied).toHaveText("Critères appliqués : 1");
  await opening.click();
  await expect(panel.getByRole("checkbox", { name: "YouTube" })).toBeChecked();
  await panel.getByRole("button", { name: "Tout effacer" }).click();
  await expect(
    panel.getByRole("checkbox", { name: "YouTube" }),
  ).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(applied).toHaveText("Critères appliqués : 1");

  // The bar: a toggle says its state, the menu pill opens and closes, the cross retires its own criterion only.
  const members = cell("filter-bar", "members");
  const available = members.getByRole("button", {
    name: "Disponible cette semaine",
  });
  await expect(available).toHaveAttribute("aria-pressed", "false");
  await available.click();
  await expect(available).toHaveAttribute("aria-pressed", "true");
  const menu = cell("filter-bar", "menu").getByRole("button", {
    name: "Thématique",
  });
  await expect(menu).toHaveAttribute("aria-haspopup", "dialog");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(members.getByText("Pays d'audience : Belgique")).toBeVisible();
  await members
    .getByRole("button", {
      name: "Retirer le critère : Pays d'audience : Belgique",
    })
    .click();
  await expect(members.getByText("Pays d'audience : Belgique")).toHaveCount(0);
  await expect(
    members.getByRole("button", { name: "Compte vérifié", exact: true }),
  ).toBeVisible();

  // The line scrolls under a narrow width and the keyboard reaches what is out of sight.
  await page.setViewportSize({ width: 375, height: 812 });
  const overflowing = cell("filter-bar", "overflow").locator(
    "[data-filter-bar]",
  );
  expect(
    await overflowing.evaluate((bar) => bar.scrollWidth > bar.clientWidth),
  ).toBe(true);
  await overflowing.getByRole("button").last().focus();
  expect(await overflowing.evaluate((bar) => bar.scrollLeft)).toBeGreaterThan(
    0,
  );

  // Under 768 px the dialog of the filters is the whole screen.
  await opening.click();
  // the sizes of the layout: the dialog may still be scaling in
  expect(
    await panel.evaluate((element) => [
      parseFloat(getComputedStyle(element).width),
      parseFloat(getComputedStyle(element).height),
    ]),
  ).toEqual([375, 812]);
  expect(
    await panel.evaluate((element) => getComputedStyle(element).borderRadius),
  ).toBe("0px");
  await fullyShown(panel);
  await expectNoAxeViolation(page, "dialogue des filtres à 375 px");
  await page.keyboard.press("Escape");

  // The pager is a group, never a nav; the last page keeps its place.
  await page.setViewportSize({ width: 1440, height: 900 });
  const pages = cell("pager", "pages").getByRole("group", {
    name: /Pages de résultats/,
  });
  await expect(
    pages.getByRole("button", { name: "Page précédente" }),
  ).toBeVisible();
  await expect(
    pages.getByRole("button", { name: "Page suivante" }),
  ).toBeVisible();
  await expect(board.locator("nav")).toHaveCount(0);
  await expect(
    cell("pager", "last").getByRole("button", { name: "Page suivante" }),
  ).toHaveCount(0);
  await expect(
    cell("pager", "busy").getByRole("button", { name: "Page suivante" }),
  ).toHaveAttribute("aria-disabled", "true");

  // U-1: no text under a button, with the long summaries (cap, cursor) at 1 440 px and in every cell at 375 px.
  for (const state of ["cap", "cursor"]) {
    await expectPagerClear(cell("pager", state), `pager ${state} at 1 440 px`);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  for (const state of ["pages", "first", "last", "cap", "busy", "cursor"]) {
    await expectPagerClear(cell("pager", state), `pager ${state} at 375 px`);
  }
});

// RUB-AN2, lines 06 (C30), 07 and 08 (R04 lines 6, 7 and 8: the pill changes its contour and its ground over 120 ms on
// the curve `standard`; the dialog comes in over 200 ms on the same curve, by `opacity` and by a `scale` of 0.98 to 1,
// and goes out over 120 ms on the curve `exit`; the scrim fades with it; under reduced motion the fade is instant and
// nothing scales: AN-1) and RUB-AX for C27 to C32 (docs/mvp/jalons/rub/modele-ux.md §5 PT4: the chevron of a pill with a
// menu turns over by 180 degrees; AP1: the active pill keeps its contour under forced colours).
test("RUB-AN2 07: the pills, the dialog and its scrim, their motion and its absence under reduced motion, the chevron that turns over and the contour under forced colours", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
  const EXIT = "cubic-bezier(0.4, 0, 1, 1)";

  // The pill: the contour and the ground change over 120 ms on `standard`; the active one is told by more than colour.
  const pill = cell("filter-bar", "members").locator('[data-pill="verified"]');
  const readPill = () =>
    pill.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        properties: style.transitionProperty,
        weight: style.fontWeight,
      };
    });
  const active = await readPill();
  expect(active).toMatchObject({
    duration: "0.12s",
    timing: STANDARD,
    weight: "600",
  });
  expect(active.properties).toContain("border-color");
  expect(active.properties).toContain("background-color");
  const rest = await cell("filter-bar", "members")
    .locator('[data-pill="available"]')
    .evaluate((element) => getComputedStyle(element).fontWeight);
  expect(rest).toBe("400");
  expect(Math.round((await pill.boundingBox())!.height)).toBe(40);
  expect(
    Math.round(
      (await cell("filter-bar", "bo")
        .locator('[data-pill="late"]')
        .boundingBox())!.height,
    ),
  ).toBe(36);

  // The chevron of the menu pill turns over by 180 degrees over 120 ms when it opens.
  const menu = cell("filter-bar", "menu").getByRole("button", {
    name: "Thématique",
  });
  const chevron = menu.locator("svg");
  const readTurn = () =>
    chevron.evaluate((icon) => {
      const style = getComputedStyle(icon);
      return {
        rotate: style.rotate,
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
      };
    });
  expect(await readTurn()).toMatchObject({
    rotate: "none",
    duration: "0.12s",
    timing: STANDARD,
  });
  await menu.click();
  await expect.poll(async () => (await readTurn()).rotate).toBe("180deg");

  // Forced colours: the active pill keeps its contour, it is drawn by the system.
  await page.emulateMedia({ forcedColors: "active" });
  expect(
    await pill.evaluate((element) => getComputedStyle(element).borderTopStyle),
  ).toBe("solid");
  expect(
    parseFloat(
      await pill.evaluate(
        (element) => getComputedStyle(element).borderTopWidth,
      ),
    ),
  ).toBeGreaterThan(0);
  await page.emulateMedia({ forcedColors: "none" });

  // The dialog, closed then open: its exit is read on the closed element, its entry on the open one.
  const element = cell("dialog", "confirm").locator("dialog");
  const readDialog = () =>
    element.evaluate((dialog) => {
      const style = getComputedStyle(dialog);
      const backdrop = getComputedStyle(dialog, "::backdrop");
      return {
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        properties: style.transitionProperty,
        behavior: style.transitionBehavior,
        opacity: style.opacity,
        scale: style.scale,
        scrim: backdrop.backgroundColor,
        scrimDuration: backdrop.transitionDuration,
        scrimTiming: backdrop.transitionTimingFunction,
        scrimOpacity: backdrop.opacity,
      };
    });
  const closed = await readDialog();
  expect(closed).toMatchObject({
    duration: "0.12s",
    timing: EXIT,
    opacity: "0",
    scale: "0.98",
    scrimDuration: "0.12s",
    scrimTiming: EXIT,
    scrimOpacity: "0",
  });
  for (const name of ["opacity", "scale", "display", "overlay"]) {
    expect(closed.properties, `transition of ${name}`).toContain(name);
  }
  expect(closed.properties).not.toBe("all");
  expect(closed.behavior).toContain("allow-discrete");
  const opening = cell("dialog", "confirm").getByRole("button", {
    name: "Ouvrir la confirmation",
  });
  await opening.click();
  const dialog = page.getByRole("dialog", {
    name: "Retirer cette sélection ?",
  });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => (await readDialog()).opacity).toBe("1");
  const shown = await readDialog();
  expect(shown).toMatchObject({
    duration: "0.2s",
    timing: STANDARD,
    scrimDuration: "0.2s",
    scrimTiming: STANDARD,
    scrimOpacity: "1",
  });
  expect(["none", "1"]).toContain(shown.scale);
  expect(shown.scrim).not.toBe("rgba(0, 0, 0, 0)");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Reduced motion: the fade is instant and nothing scales, whatever the state.
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await readDialog()).toMatchObject({
    duration: "0s",
    scrimDuration: "0s",
    scale: "none",
  });
  await opening.click();
  await expect(dialog).toBeVisible();
  expect(await readDialog()).toMatchObject({
    duration: "0s",
    scale: "none",
    opacity: "1",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect((await readTurn()).duration).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

// RUB-T8 (docs/mvp/jalons/rub/annexe.md; 02b C41, C42, C49, C51; RUB-B §2): the segments of the wizard are links that the
// keyboard goes through and follows, whatever their state; « Continue » and « Previous » change the step and the focus
// goes to the `h2` of the new one, which draws no ring; « Continue » is never unavailable; the touch zone of a segment is
// 26 px; under 480 px « Previous » is its chevron, 44 px wide and still named; the save status shows once, in the foot
// from 768 px and in the meta under; nothing overflows at 320 px. The code is ONE field: a paste with separators fills the
// six boxes, letters are refused, the next box takes the ring colour, the error draws the six, the blocked one is
// disabled. RUB-AX on the numbered steps and the recap.
test("RUB-T8: the wizard follows its segments by the keyboard, moves the focus to the title of the step and never blocks, the code is one field that takes a paste, and nothing overflows at 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const start = cell("wizard", "page-header-wizard-start");
  const segments = start
    .getByRole("list", { name: "Étapes" })
    .getByRole("link");
  await expect(segments).toHaveCount(5);
  await expect(segments.nth(1)).toHaveAttribute("aria-current", "step");
  await expect(segments.nth(1)).toHaveAccessibleName(
    "Étape 2 sur 5 : Votre ligne éditoriale, en cours",
  );
  await expect(segments.nth(3)).toHaveAccessibleName(
    "Étape 4 sur 5 : Votre audience, à compléter",
  );
  await expect(start.locator("[aria-current]")).toHaveCount(1);

  // The keyboard goes from segment to segment and `Entrée` follows the one it is on, whatever its state.
  await segments.first().focus();
  await page.keyboard.press("Tab");
  await expect(segments.nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(segments.nth(3)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#step-4$/);

  // The zone of a segment is 26 px around a bar of 6 px (2.5.8 holds at 24).
  const zone = await segments.first().evaluate((element) => ({
    bar: parseFloat(getComputedStyle(element).height),
    zone: parseFloat(getComputedStyle(element, "::before").height),
  }));
  expect(zone).toEqual({ bar: 6, zone: 26 });

  // « Continue » moves the step and the focus goes to its `h2`, without a ring; « Previous » does the same backwards.
  const next = start.getByRole("button", { name: /^Continuer : / });
  await expect(next).not.toHaveAttribute("aria-disabled", "true");
  await next.click();
  const heading = start.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText("Vos réseaux");
  await expect(heading).toBeFocused();
  expect(
    await heading.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("none");
  await expect(start.getByText("Étape 3 sur 5", { exact: true })).toBeVisible();
  await expect(segments.nth(2)).toHaveAttribute("aria-current", "step");
  // a step with a gap after it, and « Continue » still free
  await expect(next).toHaveText("Continuer : Votre audience");
  await expect(next).not.toHaveAttribute("aria-disabled", "true");
  await start.getByRole("button", { name: "Précédent" }).click();
  await expect(heading).toHaveText("Votre ligne éditoriale");
  await expect(heading).toBeFocused();

  // The save status is shown once: in the foot from 768 px, in the meta under.
  const foot = next.locator("xpath=..");
  await expect(start.locator("[data-save-state]:visible")).toHaveCount(1);
  await expect(foot.locator("[data-save-state]:visible")).toHaveCount(1);
  expect(
    await foot.evaluate((element) => getComputedStyle(element).position),
  ).toBe("static");
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(start.locator("[data-save-state]:visible")).toHaveCount(1);
  await expect(foot.locator("[data-save-state]:visible")).toHaveCount(0);
  expect(
    await foot.evaluate((element) => getComputedStyle(element).position),
  ).toBe("fixed");

  // Under 480 px « Previous » is its chevron, 44 px wide, its name kept for the screen reader.
  const previous = start.getByRole("button", { name: "Précédent" });
  const label = previous.locator("span").last();
  expect((await label.boundingBox())!.width).toBeGreaterThan(8);
  await page.setViewportSize({ width: 375, height: 812 });
  expect((await previous.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect((await label.boundingBox())!.width).toBeLessThanOrEqual(1);
  await expect(previous).toBeVisible();

  // Nothing overflows sideways at 320 px, the wizards included.
  await page.setViewportSize({ width: 320, height: 800 });
  for (const component of ["wizard", "recap", "otp-field", "numbered-steps"]) {
    expect(
      await board
        .locator(`[data-board-component="${component}"]`)
        .evaluate((element) => element.scrollWidth - element.clientWidth),
      `${component} at 320 px`,
    ).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // The code: one field, a paste with separators fills the boxes, letters are refused, the ring colour follows the typing.
  const typed = cell("otp-field", "empty");
  await expect(typed.getByRole("textbox")).toHaveCount(1);
  const code = typed.getByRole("textbox", { name: /Code à 6 chiffres/ });
  const boxes = typed.locator("[data-otp-box]");
  await expect(boxes).toHaveCount(6);
  await code.focus();
  await expect(boxes.first()).toHaveAttribute("data-otp-box", "current");
  await page.keyboard.insertText("123 456");
  await expect(code).toHaveValue("123456");
  expect(await boxes.allTextContents()).toEqual(["1", "2", "3", "4", "5", "6"]);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await expect(code).toHaveValue("");
  await page.keyboard.type("a1b2");
  await expect(code).toHaveValue("12");
  await expect(boxes.nth(2)).toHaveAttribute("data-otp-box", "current");
  await page.keyboard.type("3456789");
  await expect(code).toHaveValue("123456");
  // the box that waits wears 2 px, the others 1 px, and none changes its size
  const widthOf = (target: typeof boxes) =>
    target.evaluate((element) => getComputedStyle(element).borderTopWidth);
  expect(await widthOf(boxes.first())).toBe("1px");
  expect(await widthOf(boxes.nth(5))).toBe("2px");
  const rest = await boxes.first().boundingBox();
  expect((await boxes.nth(5).boundingBox())!.height).toBe(rest!.height);

  // The error draws the six boxes alike and ties the field to its message; the box keeps its size.
  const failing = cell("otp-field", "error");
  const failingBoxes = failing.locator("[data-otp-box]");
  for (let index = 0; index < 6; index += 1) {
    await expect(failingBoxes.nth(index)).toHaveAttribute(
      "data-otp-box",
      "invalid",
    );
    expect(await widthOf(failingBoxes.nth(index))).toBe("2px");
  }
  const failingBox = await failingBoxes.first().boundingBox();
  expect(Math.round(failingBox!.width)).toBe(Math.round(rest!.width));
  expect(Math.round(failingBox!.height)).toBe(Math.round(rest!.height));
  const failingField = failing.getByRole("textbox");
  await expect(failingField).toHaveAttribute("aria-invalid", "true");
  await expect(failingField).toHaveAccessibleDescription(
    /Ce code est incorrect\. Il vous reste 4 essais\./,
  );
  await expect(
    cell("otp-field", "blocked").getByRole("textbox"),
  ).toBeDisabled();
  await expect(cell("otp-field", "busy").getByRole("textbox")).toHaveAttribute(
    "readonly",
    "",
  );
  const line = cell("otp-field", "line").getByRole("textbox");
  await expect(line).toHaveValue("123");
  expect(
    await line.evaluate((element) => getComputedStyle(element).opacity),
  ).toBe("1");
  expect((await line.boundingBox())!.width).toBeLessThanOrEqual(192);

  // The recap and the numbered steps: a link to edit named by its section, a state read before the label.
  const recap = cell("recap", "missing");
  await expect(
    recap.getByRole("link", { name: "Modifier : 1. Vous présenter" }),
  ).toBeVisible();
  await expect(
    recap.getByRole("region", { name: "3. Vos réseaux et vos chiffres" }),
  ).toBeVisible();
  const steps = cell("numbered-steps", "process").getByRole("list", {
    name: "Étapes du changement d'adresse",
  });
  await expect(steps.getByRole("listitem")).toHaveCount(3);
  await expect(steps.locator('[aria-current="step"]')).toContainText(
    "En cours : Confirmer que c'est bien vous",
  );
});

// RUB-AN2, lines 23, 24 and 31 (R04: the step comes in by `fade-in` over 120 ms on the curve `standard`; a segment of
// the progress changes its colour over 320 ms on the same curve; the box of the code changes its outline over 120 ms;
// under reduced motion the durations are zero: AN-1) and RUB-AX, AP1 (RUB-B §5): the contour of a segment is transparent,
// thin on all and thick on the done and the current one, and forced colours draw it; so does the current marker of the
// numbered steps, and the other ones keep none.
test("RUB-AN2 08: the step fades in, the segments and the boxes of the code change their colour over their durations, and not under reduced motion, and forced colours draw the contours of the segments and of the current step", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (component: string, state: string) =>
    board.locator(
      `[data-board-component="${component}"] [data-board-state="${state}"]`,
    );
  const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
  const start = cell("wizard", "page-header-wizard-start");
  const step = start.locator("section");
  const segment = start.getByRole("list", { name: "Étapes" }).getByRole("link");
  const box = cell("otp-field", "empty").locator("[data-otp-box]").first();
  const readAnimation = () =>
    step.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        timing: style.animationTimingFunction,
      };
    });
  const readTransition = (target: typeof box) =>
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        properties: style.transitionProperty,
      };
    });

  // Motion allowed.
  expect(await readAnimation()).toEqual({
    name: "fade-in",
    duration: "0.12s",
    timing: STANDARD,
  });
  const bar = await readTransition(segment.first());
  expect(bar).toMatchObject({ duration: "0.32s", timing: STANDARD });
  expect(bar.properties).toContain("background-color");
  expect(bar.properties).not.toBe("all");
  const outline = await readTransition(box);
  expect(outline).toMatchObject({ duration: "0.12s", timing: STANDARD });
  expect(outline.properties).toContain("border-color");
  expect(outline.properties).not.toBe("all");

  // The colour of a segment: done and current are the brand green, a step to complete the warning colour, the others calm.
  const ground = (index: number) =>
    segment
      .nth(index)
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  const [done, current, todo, gap] = await Promise.all([
    ground(0),
    ground(1),
    ground(2),
    ground(3),
  ]);
  expect(done).toBe(current);
  expect(new Set([done, todo, gap]).size).toBe(3);

  // Forced colours: the contour is transparent at rest, drawn by the system, thin on all and thick on done and current.
  const contour = (index: number) =>
    segment.nth(index).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        style: style.outlineStyle,
        width: style.outlineWidth,
        color: style.outlineColor,
      };
    });
  expect(await contour(0)).toEqual({
    style: "solid",
    width: "2px",
    color: "rgba(0, 0, 0, 0)",
  });
  expect(await contour(1)).toMatchObject({ style: "solid", width: "2px" });
  expect(await contour(2)).toMatchObject({ style: "solid", width: "1px" });
  expect(await contour(3)).toMatchObject({ style: "solid", width: "1px" });
  const marker = (state: string) =>
    cell("numbered-steps", "process")
      .locator(`[data-step-state="${state}"] > span`)
      .first();
  const markerStyle = (state: string) =>
    marker(state).evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, color: style.outlineColor };
    });
  expect(await markerStyle("current")).toEqual({
    style: "solid",
    color: "rgba(0, 0, 0, 0)",
  });
  expect((await markerStyle("todo")).style).toBe("none");
  await page.emulateMedia({ forcedColors: "active" });
  expect((await contour(0)).color).not.toBe("rgba(0, 0, 0, 0)");
  expect((await markerStyle("current")).color).not.toBe("rgba(0, 0, 0, 0)");
  expect((await markerStyle("todo")).style).toBe("none");
  await page.emulateMedia({ forcedColors: "none" });

  // Reduced motion: every duration is zero.
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await readAnimation()).duration).toBe("0s");
  expect((await readTransition(segment.first())).duration).toBe("0s");
  expect((await readTransition(box)).duration).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

// RUB-T9 (docs/mvp/jalons/rub/annexe.md; 02b C31, C48): the track of a photo card is reached and scrolled by the
// keyboard, one visual at a time, the dots following; the arrows show on the hover of the photo and move it too; the
// heart is pressed by the mouse and by the keyboard, named by the screen, and takes the double ring at focus (RUB-B §5,
// AP2); a heart whose request runs is not pressed again; no amount is written on a card.
test("RUB-T9: the photo card scrolls its visuals by the keyboard and by its arrows, the dots following, its heart is pressed by the mouse and the keyboard with a double ring, and no card writes an amount", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const card = board
    .locator(
      '[data-board-component="photo-card"] [data-board-state="search"] article',
    )
    .first();
  const track = card.getByRole("region", {
    name: "Visuels du portfolio de Profil 93JMS4",
  });
  // by their hook, not their role: an arrow at an end of the track is hidden, out of the tree
  const previous = card.locator('[data-photo-arrow="previous"]');
  const next = card.locator('[data-photo-arrow="next"]');
  const currentDot = () =>
    card
      .locator("[data-photo-dots] span")
      .evaluateAll((dots) =>
        dots.findIndex((dot) => dot.hasAttribute("data-current")),
      );
  await track.scrollIntoViewIfNeeded();
  expect(await currentDot()).toBe(0);
  await expect(previous).toBeDisabled();

  // The keyboard: the region takes the focus and the arrow key moves it to the next visual.
  await track.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(currentDot).toBe(1);
  await expect(previous).toBeEnabled();

  // The arrows: shown on the hover of the photo, « next » to the last visual, where it hides. They lie on the photo,
  // at the middle of its sides (RUB-09b: a class string that held `relative` left them under it).
  await track.hover();
  const photo = (await track.boundingBox())!;
  for (const arrow of [previous, next]) {
    const box = (await arrow.boundingBox())!;
    expect(
      Math.abs(box.y + box.height / 2 - (photo.y + photo.height / 2)),
    ).toBeLessThanOrEqual(1);
    expect(box.x).toBeGreaterThanOrEqual(photo.x);
    expect(box.x + box.width).toBeLessThanOrEqual(photo.x + photo.width);
  }
  await expect
    .poll(() => next.evaluate((arrow) => getComputedStyle(arrow).opacity))
    .toBe("1");
  await next.click();
  await expect.poll(currentDot).toBe(2);
  await expect(next).toBeDisabled();
  expect(
    await next.evaluate((arrow) => getComputedStyle(arrow).visibility),
  ).toBe("hidden");

  // The heart: by the mouse, then by the keyboard, its name given by the screen for its state.
  const heart = card.locator("[data-photo-heart]");
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  await expect(heart).toHaveAccessibleName(
    "Ajouter Profil 93JMS4 à Ma sélection",
  );
  await heart.click();
  await expect(heart).toHaveAttribute("aria-pressed", "true");
  await expect(heart).toHaveAccessibleName(
    "Retirer Profil 93JMS4 de Ma sélection",
  );
  await card.getByRole("link", { name: "Profil 93JMS4" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(heart).toBeFocused();
  await page.keyboard.press("Space");
  await expect(heart).toHaveAttribute("aria-pressed", "false");
  const ring = await heart.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outline: style.outlineStyle,
      width: style.outlineWidth,
      halo: style.boxShadow,
    };
  });
  expect(ring.outline).toBe("solid");
  expect(ring.width).toBe("3px");
  // the halo: a spread of offset, ring and thick border (2 + 3 + 2 px), never blurred
  expect(ring.halo).toMatch(/0px 0px 0px 7px/);

  // A heart whose request runs is not pressed again.
  const saving = board.locator(
    '[data-board-state="saving"] [data-photo-heart]',
  );
  // forced: aria-disabled is not « enabled » for the actionability of Playwright, the press must still be ignored
  await expect(saving).toHaveAttribute("aria-disabled", "true");
  await saving.click({ force: true });
  await expect(saving).toHaveAttribute("aria-pressed", "false");

  // No amount, on any card of the two sections.
  for (const component of ["photo-card", "feed-card"]) {
    const text = await board
      .locator(`[data-board-component="${component}"]`)
      .innerText();
    expect(text, component).not.toMatch(/[€$£]|\bEUR\b|\bUSD\b/);
  }
});

// RUB-AN2, lines 02 (C48), 11 to 15 and 22 (R04: the card of the feed lifts 2 px and lights its contour over 120 ms; the
// track scrolls smoothly; an arrow fades in over 120 ms; the current dot widens from 6 to 16 px over 120 ms; the heart
// grows to 1,03 on hover over 120 ms and pops over 200 ms when it fills; a card that leaves a selection fades out and
// shrinks to 0,96 over 200 ms; all on the curve `standard`; under reduced motion nothing moves and the durations are zero:
// AN-1) and RUB-AX, AP1 (RUB-B §5): the saved heart carries a transparent contour that forced colours draw.
test("RUB-AN2 09a: the feed card lifts, the track scrolls smoothly, the arrows fade in, the dots widen, the heart grows and pops, the card leaves, and not under reduced motion; forced colours draw the contour of a saved heart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
  const search = board.locator(
    '[data-board-component="photo-card"] [data-board-state="search"] article',
  );
  const card = search.first();
  const savedHeart = search.nth(1).locator("[data-photo-heart]");
  const track = card.locator("[data-photo-track]");
  const next = card.locator('[data-photo-arrow="next"]');
  const heart = card.locator("[data-photo-heart]");
  const feed = board
    .locator(
      '[data-board-component="feed-card"] [data-board-state="open"] article',
    )
    .first();
  const shortlistCell = board.locator('[data-board-state="shortlist"]');
  const shortlist = shortlistCell.locator("article");
  const restore = shortlistCell.getByRole("button", {
    name: "Remettre la carte",
  });
  const style = (target: typeof card) =>
    target.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        duration: computed.transitionDuration,
        timing: computed.transitionTimingFunction,
        properties: computed.transitionProperty,
        translate: computed.translate,
        scale: computed.scale,
        opacity: computed.opacity,
        width: computed.width,
        scroll: computed.scrollBehavior,
      };
    });
  const dot = (index: number) =>
    card.locator("[data-photo-dots] span").nth(index);
  /** Clicks the heart and reads its icon two frames later, while the pop runs (200 ms). */
  const pressAndReadPop = () =>
    heart.evaluate(async (button) => {
      (button as HTMLButtonElement).click();
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const icon = getComputedStyle(button.querySelector("svg")!);
      return { name: icon.animationName, duration: icon.animationDuration };
    });
  const contour = (target: typeof heart) =>
    target.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        style: computed.outlineStyle,
        color: computed.outlineColor,
        width: computed.outlineWidth,
      };
    });

  // Motion allowed. The card of the feed (line 2).
  await feed.scrollIntoViewIfNeeded();
  const feedRest = await style(feed);
  expect(feedRest).toMatchObject({
    duration: "0.12s",
    timing: STANDARD,
    translate: "none",
  });
  expect(feedRest.properties).toContain("translate");
  expect(feedRest.properties).toContain("border-color");
  await feed.hover();
  await expect.poll(async () => (await style(feed)).translate).toBe("0px -2px");

  // The track (line 11) and an arrow (line 12).
  await track.scrollIntoViewIfNeeded();
  expect((await style(track)).scroll).toBe("smooth");
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await style(next)).opacity).toBe("0");
  const arrow = await style(next);
  expect(arrow).toMatchObject({
    duration: "0.12s",
    timing: STANDARD,
    opacity: "0",
  });
  expect(arrow.properties).toBe("opacity");
  await track.hover();
  await expect.poll(async () => (await style(next)).opacity).toBe("1");

  // The dots (line 13): the current one widens from 6 to 16 px, by its width and its colour alone.
  const firstDot = await style(dot(0));
  expect(firstDot).toMatchObject({
    duration: "0.12s",
    timing: STANDARD,
    width: "16px",
  });
  expect(firstDot.properties).toContain("width");
  expect((await style(dot(1))).width).toBe("6px");
  await next.click();
  await expect.poll(async () => (await style(dot(1))).width).toBe("16px");
  await expect.poll(async () => (await style(dot(0))).width).toBe("6px");

  // The heart (lines 14 and 15): it grows on hover, and pops when it fills, never when it empties.
  const heartRest = await style(heart);
  expect(heartRest).toMatchObject({ duration: "0.12s", timing: STANDARD });
  expect(heartRest.properties).toContain("scale");
  await heart.hover();
  await expect.poll(async () => (await style(heart)).scale).toBe("1.03");
  expect(await pressAndReadPop()).toEqual({ name: "pop", duration: "0.2s" });
  expect((await pressAndReadPop()).name).toBe("none");

  // AP1: the saved heart carries a transparent contour, drawn by forced colours; the empty one none.
  await page.mouse.move(0, 0);
  expect(await contour(savedHeart)).toEqual({
    style: "solid",
    color: "rgba(0, 0, 0, 0)",
    width: "2px",
  });
  expect((await contour(heart)).style).toBe("none");
  await page.emulateMedia({ forcedColors: "active" });
  expect((await contour(savedHeart)).color).not.toBe("rgba(0, 0, 0, 0)");
  expect((await contour(heart)).style).toBe("none");
  await page.emulateMedia({ forcedColors: "none" });

  // The card that leaves a selection (line 22).
  await shortlist.scrollIntoViewIfNeeded();
  await shortlist.locator("[data-photo-heart]").click();
  await expect.poll(async () => (await style(shortlist)).opacity).toBe("0");
  const leaving = await style(shortlist);
  expect(leaving).toMatchObject({
    duration: "0.2s",
    timing: STANDARD,
    scale: "0.96",
  });
  expect(leaving.properties).toContain("opacity");
  expect(leaving.properties).toContain("scale");
  await restore.click();
  await expect.poll(async () => (await style(shortlist)).opacity).toBe("1");

  // Reduced motion: nothing lifts, grows nor shrinks, the track jumps, every duration is zero (AN-1).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await feed.scrollIntoViewIfNeeded();
  await feed.hover();
  await expect.poll(async () => (await style(feed)).duration).toBe("0s");
  expect((await style(feed)).translate).toBe("none");
  expect((await style(track)).scroll).toBe("auto");
  expect((await style(next)).duration).toBe("0s");
  expect((await style(dot(0))).duration).toBe("0s");
  await heart.scrollIntoViewIfNeeded();
  await heart.hover();
  expect((await style(heart)).scale).toBe("none");
  expect((await pressAndReadPop()).duration).toBe("0s");
  await shortlist.scrollIntoViewIfNeeded();
  await shortlist.locator("[data-photo-heart]").click();
  await expect.poll(async () => (await style(shortlist)).opacity).toBe("0");
  expect(await style(shortlist)).toMatchObject({
    duration: "0s",
    scale: "none",
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

// RUB-T9, line 09b (docs/mvp/jalons/rub/annexe.md; 22-refonte-ux-ui/02b C34 to C40, C66, C68, 02c; RUB-B §4): at
// 1 440 px the mosaic alone, without an empty cell from one visual to five; each visual and « see them all » open the
// whole-screen dialog on the visual asked for, the focus on the chevron, the body reached by the keyboard, `Échap` and
// the chevron closing and giving the focus back; axe finds nothing in the open dialog. At 375 px the carousel alone,
// its counter following the keyboard, and a lone visual without one. An inert action of a preview does nothing, and
// no reading component writes an amount or a score (D11, D48, D78).
test("RUB-T9 09b: the mosaic or the carousel, their dialog by the keyboard with its focus given back, axe in the open dialog, an inert action of a preview, and no amount nor score", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const cell = (state: string) =>
    board.locator(
      `[data-board-component="media-gallery"] [data-board-state="${state}"]`,
    );

  // The frame of 2 / 1 is held whole: each of its six places lies under a visual.
  for (const [state, shown] of [
    ["six", 5],
    ["four", 4],
    ["three", 3],
    ["two", 2],
    ["one", 1],
  ] as const) {
    await expect(cell(state).locator("[data-gallery-carousel]")).toBeHidden();
    const frame = await cell(state)
      .locator("[data-gallery-mosaic] > div")
      .evaluate((grid) => {
        const box = grid.getBoundingClientRect();
        const visuals = [...grid.children].map((visual) =>
          visual.getBoundingClientRect(),
        );
        const places = [0.25, 0.625, 0.875].flatMap((x) =>
          [0.25, 0.75].map((y) => ({
            x: box.left + x * box.width,
            y: box.top + y * box.height,
          })),
        );
        return {
          ratio: box.width / box.height,
          shown: visuals.length,
          held: places.filter((place) =>
            visuals.some(
              (visual) =>
                place.x >= visual.left &&
                place.x <= visual.right &&
                place.y >= visual.top &&
                place.y <= visual.bottom,
            ),
          ).length,
        };
      });
    expect(frame.shown, state).toBe(shown);
    expect(frame.held, state).toBe(6);
    expect(Math.abs(frame.ratio - 2), state).toBeLessThan(0.05);
  }
  await expect(cell("one").locator("[data-gallery-all]")).toHaveCount(0);
  await expect(cell("none").getByRole("button")).toHaveCount(0);
  await expect(
    cell("none").getByText("Ce profil n'a pas encore de visuel."),
  ).toBeVisible();

  // By the keyboard: a visual takes its double ring inside its cell, and opens the dialog on itself.
  const dialog = cell("six").locator('[data-dialog="gallery"]');
  const body = dialog.locator("[data-gallery-body]");
  const chevron = dialog.getByRole("button", { name: "Fermer la galerie" });
  const fourth = cell("six").locator(
    '[data-gallery-mosaic] [data-gallery-visual="3"]',
  );
  await cell("six").locator('[data-gallery-visual="2"]').first().focus();
  await page.keyboard.press("Tab");
  await expect(fourth).toBeFocused();
  const ring = await fourth.evaluate((element) => {
    const style = getComputedStyle(element, "::after");
    return {
      outline: style.outlineStyle,
      width: style.outlineWidth,
      offset: style.outlineOffset,
      halo: style.boxShadow,
    };
  });
  expect(ring).toMatchObject({
    outline: "solid",
    width: "3px",
    offset: "-3px",
  });
  expect(ring.halo).toMatch(/0px 0px 0px 5px inset/);
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveAttribute("open", "");
  await expect(dialog).toHaveAccessibleName("Portfolio · Profil 93JMS4");
  await expect(chevron).toBeFocused();
  await expect(dialog.locator("figure")).toHaveCount(6);
  await expect
    .poll(() => body.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(body).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(fourth).toBeFocused();

  // « Voir les 6 visuels » opens on the first one; the chevron closes and the focus comes back to the button.
  const all = cell("six").getByRole("button", { name: "Voir les 6 visuels" });
  await all.click();
  await fullyShown(dialog);
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
  await expectNoAxeViolation(page, "planche des états, galerie ouverte");
  await chevron.click();
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(all).toBeFocused();

  // An inert action of a preview: unavailable, explained, and nothing happens.
  const inert = board.locator(
    '[data-board-component="preview-frame"] [data-board-state="zone"] button',
  );
  await expect(inert).toHaveAttribute("aria-disabled", "true");
  await expect(inert).toHaveAccessibleDescription(
    "Dans un aperçu, ce bouton ne fait rien.",
  );

  // An essential's icon stands beside its words, 12 px before them, never on them.
  const essential = board
    .locator('[data-key-figures="essentials"] > div')
    .first();
  const icon = (await essential.locator("svg").boundingBox())!;
  const words = (await essential.locator("dd").boundingBox())!;
  expect(words.x - (icon.x + icon.width)).toBeCloseTo(12, 0);

  // No amount and no score on a reading component.
  for (const component of [
    "media-gallery",
    "key-figures",
    "reason-list",
    "range-bar",
    "sticky-aside",
    "reading-layout",
    "preview-frame",
    "brand-hero",
  ]) {
    const text = await board
      .locator(`[data-board-component="${component}"]`)
      .innerText();
    expect(text, component).not.toMatch(/[€$£]|\bEUR\b|\bUSD\b|\/\s?100\b/);
  }

  // At 375 px: the carousel alone; the arrow key of the keyboard moves it and the counter follows.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(cell("six").locator("[data-gallery-mosaic]")).toBeHidden();
  const track = cell("six").getByRole("region", {
    name: "Portfolio · Profil 93JMS4",
  });
  const count = cell("six").locator("[data-gallery-count]");
  await track.scrollIntoViewIfNeeded();
  await expect(count).toHaveText("1 / 6");
  await track.focus();
  await page.keyboard.press("ArrowRight");
  await expect(count).toHaveText("2 / 6");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveAttribute("open", "");
  await fullyShown(dialog);
  expect(await dialog.boundingBox()).toMatchObject({ x: 0, width: 375 });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toHaveAttribute("open", "");
  await expect(cell("one").locator("[data-gallery-count]")).toHaveCount(0);
  await expect(cell("one").getByRole("region")).toHaveCount(0);
});

// RUB-AN2, lines 9, 10 and 33 (R04: the gallery opens by a fade of 200 ms on the curve `standard`, without a scale, and
// closes over 120 ms on the curve `exit`; a visual of the mosaic dims on hover over 120 ms; the box stays in view from
// 1 024 px, by its computed position, and the bar is fixed over the bottom bar below it); under reduced motion the
// durations are zero (AN-1). RUB-AX: the measures of the reading components at 1 440 and 375 px.
test("RUB-AN2 09b: the gallery fades without a scale, a visual of the mosaic dims, the box sticks or its bar is fixed, and nothing moves under reduced motion; the measures of the reading components at both widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  const STANDARD = "cubic-bezier(0.2, 0, 0, 1)";
  const gallery = board.locator(
    '[data-board-component="media-gallery"] [data-board-state="two"]',
  );
  const dialog = gallery.locator('[data-dialog="gallery"]');
  const picture = gallery.locator("[data-gallery-mosaic] img").first();
  const motion = (target: Locator) =>
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        duration: style.transitionDuration,
        timing: style.transitionTimingFunction,
        properties: style.transitionProperty,
        scale: style.scale,
        filter: style.filter,
      };
    });
  const component = (name: string) =>
    board.locator(`[data-board-component="${name}"]`);
  const aside = component("sticky-aside").locator("[data-sticky-aside]");
  const bar = component("sticky-aside").locator("[data-mobile-action-bar]");
  const placed = (target: Locator) =>
    target.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        display: style.display,
        position: style.position,
        top: style.top,
        bottom: style.bottom,
        shadow: style.boxShadow !== "none",
      };
    });

  // The measures that the width changes.
  const measures = async () => {
    const columns = (target: Locator) =>
      target.evaluate(
        (element) =>
          getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
    const figures = component("key-figures");
    const hero = component("brand-hero").locator(
      '[data-board-state="page-header-brand-hero-logo"]',
    );
    return {
      figures: await columns(figures.locator('[data-key-figures="figures"]')),
      essentials: await columns(
        figures.locator('[data-key-figures="essentials"]'),
      ),
      thirdFilet: await figures
        .locator('[data-key-figures="figures"] > div')
        .nth(2)
        .evaluate((element) => getComputedStyle(element).borderLeftWidth),
      figureSize: await figures
        .locator('[data-key-figures="figures"] dd')
        .nth(1)
        .evaluate((element) => getComputedStyle(element).fontSize),
      rangeLabel: await component("range-bar")
        .locator("li")
        .first()
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ")[0],
        ),
      logo: Math.round(
        (await hero.getByRole("img").locator("xpath=..").boundingBox())!.width,
      ),
      title: await hero
        .locator("h1")
        .evaluate((element) => getComputedStyle(element).fontSize),
    };
  };
  expect(await measures()).toEqual({
    figures: 4,
    essentials: 2,
    thirdFilet: "1px",
    figureSize: "20px",
    rangeLabel: "144px",
    logo: 120,
    title: "36px",
  });

  // The reading layout: the box beside the content, 19 rem at least.
  const layout = component("reading-layout").locator("[data-reading-layout]");
  const main = (await layout.locator(":scope > div").boundingBox())!;
  const box = (await layout.locator(":scope > aside").boundingBox())!;
  expect(box.x - (main.x + main.width)).toBeCloseTo(64, 0);
  expect(box.width).toBeGreaterThanOrEqual(304);

  // Line 33: the box sticks 32 px under the top, with its shadow; its bar is away.
  expect(await placed(aside)).toMatchObject({
    position: "sticky",
    top: "32px",
    shadow: true,
  });
  expect((await placed(bar)).display).toBe("none");

  // Line 10: a visual of the mosaic dims on hover.
  await picture.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  expect(await motion(picture)).toMatchObject({
    duration: "0.12s",
    timing: STANDARD,
    properties: "filter",
    filter: "none",
  });
  await picture.hover();
  await expect
    .poll(async () => (await motion(picture)).filter)
    .toBe("brightness(0.85)");

  // Line 9: closed, the dialog leaves over 120 ms on `exit`; open, it came over 200 ms, by its opacity, unscaled.
  const EXIT = "cubic-bezier(0.4, 0, 1, 1)";
  const closed = await motion(dialog);
  expect(closed.duration.split(", ")[0]).toBe("0.12s");
  expect(closed.timing.startsWith(EXIT)).toBe(true);
  await gallery.locator("[data-gallery-all]").click();
  const opened = await motion(dialog);
  expect(opened.duration.split(", ")[0]).toBe("0.2s");
  expect(opened.timing.startsWith(STANDARD)).toBe(true);
  expect(opened.properties).toContain("opacity");
  expect(opened.scale).toBe("none");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Reduced motion: every duration is zero (AN-1).
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await motion(picture)).duration).toBe("0s");
  expect((await motion(dialog)).duration.split(", ")[0]).toBe("0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // At 375 px: two columns and one, the smaller steps, and the bar fixed over the bottom bar in place of the box.
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await measures()).toEqual({
    figures: 2,
    essentials: 1,
    thirdFilet: "0px",
    figureSize: "18px",
    rangeLabel: "104px",
    logo: 72,
    title: "28px",
  });
  expect((await placed(aside)).display).toBe("none");
  expect(await placed(bar)).toMatchObject({
    display: "flex",
    position: "fixed",
    bottom: "56px",
    shadow: false,
  });
  await expect(
    board.getByRole("region", { name: "Ajout à ma sélection" }),
  ).toBeVisible();
});

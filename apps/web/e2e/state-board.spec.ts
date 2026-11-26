// RUA-T8 (docs/mvp/jalons/rua/modele-archi.md §6): the component state board, served by the e2e
// build alone (INFLUX_ENV=development and INFLUX_STATE_BOARD=on at build time: playwright.config.ts
// locally, the "Build both fronts" step of ci.yml). One case: at 375 and at 1 440 px the page answers within 4 s,
// shows one section per component with its cells, exactly one `h1` outside the page-header cells and one
// in each of them, no sideways overflow of a section, and axe (WCAG 2.1 AA) finds nothing; at 375 px
// nothing overflows sideways (05-recette-visuelle §6, RUAU-J1). The absence of the page
// from a deployed build is the other half, proved on the artifact (tests/build.artifacts.ts).
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, test } from "./support/journey";

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
  "row-list",
  "property-list",
  "empty-state",
  "skeleton",
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

  // The strip: the action stays on the line of the text at 1 440 px, and drops under it at 375 px.
  const centres = (state: string) =>
    cell("notice", state)
      .locator("[role=status]")
      .evaluate((element) => {
        const [icon, body, action] = [...element.children].map((child) =>
          child.getBoundingClientRect(),
        );
        return {
          iconMiddle: icon!.top + icon!.height / 2,
          actionMiddle: action!.top + action!.height / 2,
          bodyBottom: body!.bottom,
          actionTop: action!.top,
        };
      });
  const wide = await centres("strip");
  expect(Math.abs(wide.iconMiddle - wide.actionMiddle)).toBeLessThanOrEqual(2);
  await page.setViewportSize({ width: 375, height: 812 });
  await cell("notice", "strip-long").scrollIntoViewIfNeeded();
  const narrow = await centres("strip-long");
  expect(narrow.actionTop).toBeGreaterThanOrEqual(narrow.bodyBottom - 1);
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
});

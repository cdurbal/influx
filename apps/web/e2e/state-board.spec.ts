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

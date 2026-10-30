// The rendered state of the KEO charter in the member spaces (D75; docs/mvp/18 §12.6, TK1 to TK5;
// jalons/rk-fiche.md R1 to R4): each visual decision of the RK milestone read as a computed style on
// the real element, in the state it concerns, on the production build, with a seeded session. A
// case that the code before the milestone fails is a `test.fail()` named after the commit that
// frees it (RK-n), which turns it into a plain test; an absence (no glow when unavailable, no zoom
// under reduced motion…) is a case of its own (R2). The backoffice's cases are in
// backoffice.spec.ts, TK3.1 in charter-headings.spec.ts, TK8 in vitrine-unchanged.spec.ts.
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Locator, Page } from "@playwright/test";
import frAccount from "@/locales/fr/account.json" with { type: "json" };
import frMember from "@/locales/fr/member.json" with { type: "json" };
import { seedMember } from "./support/account";
import { focusedElement } from "./support/focus";
import {
  AUTH_LABELS,
  enterCode,
  expect,
  mailboxAddress,
  matchingPhrase,
  open,
  requestCode,
  test,
  title,
} from "./support/journey";
import {
  brandGreen,
  computed,
  contrast,
  displayFamily,
  expectGreenGlow,
  expectKeoTypefaces,
  expectHeadingTracking,
  expectNoGlow,
  expectSoftGlow,
  expectStill,
  expectWholeGlow,
  expectZoomAndPress,
  firstFamily,
  glowFacts,
  glowProbe,
  hovered,
  KEO_CONTAINER,
  luminance,
  rgbaOf,
  sameColor,
  sidewaysFacts,
  tokenColor,
  WEB_ROOT,
} from "./support/rendering";

const T = AUTH_LABELS.fr;
const ACCOUNT = frAccount;
const SHELL = frMember.shell;
const SIGN_IN = "/fr/connexion";

/** A seeded creator on a page of their space, the frame drawn. */
async function openAs(
  page: Page,
  pathname: string,
  heading: string,
): Promise<void> {
  await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows", "firefox.macos"],
  });
  await open(page, pathname);
  await expect(title(page)).toHaveText(heading);
}

function openHome(page: Page): Promise<void> {
  return openAs(page, "/fr/createur", T.home.creator.title);
}

/** A standalone page of the journey, the session of an earlier step of the case closed first. */
async function openSignedOut(page: Page, pathname: string): Promise<void> {
  await page.context().clearCookies();
  await open(page, pathname);
  await expect(title(page)).toBeVisible();
}

function signInButton(page: Page): Locator {
  return page.getByRole("button", { name: T.step1.submit });
}

/** The primary button of « Mes informations », unavailable offline (aria-disabled, 17 §1.3 rule 4). */
async function unavailablePrimary(page: Page): Promise<Locator> {
  await openAs(page, "/fr/compte/informations", ACCOUNT.details.title);
  const save = page.getByRole("button", { name: ACCOUNT.details.save });
  await page.context().setOffline(true);
  await expect(save).toHaveAttribute("aria-disabled", "true");
  return save;
}

function homeCard(page: Page): Locator {
  return page.locator("section", {
    has: page.getByRole("heading", { name: T.home.howItWorks }),
  });
}

// ---------------------------------------------------------------------------------------------
// TK1: the buttons (RK-1 to RK-4 of the fiche; 20 §11.5, §11.8)
// ---------------------------------------------------------------------------------------------

test("TK1.1: the primary button glows in the brand green at rest, wider on hover", async ({
  page,
}) => {
  await open(page, SIGN_IN);
  await expectGreenGlow(page, signInButton(page));
});

test("TK1.1: no glow on an unavailable primary button, at rest nor on hover", async ({
  page,
}) => {
  await expectNoGlow(await unavailablePrimary(page));
});

test("TK1.2: the primary button grows to 1.03 on hover and shrinks to 0.98 while pressed", async ({
  page,
}) => {
  await open(page, SIGN_IN);
  await expectZoomAndPress(page, signInButton(page));
});

test("TK1.2: a full-width button hovered at 103 % does not scroll sideways at 320 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, SIGN_IN);
  const button = signInButton(page);
  await hovered(button);
  expect(
    (await button.boundingBox())?.width,
    "the button is wider than the viewport",
  ).toBeLessThanOrEqual(320);
  expect(
    (await sidewaysFacts(page)).overflow,
    "sideways overflow",
  ).toBeLessThanOrEqual(0);
});

test("TK1.2: neither zoom nor press under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, SIGN_IN);
  await expectStill(page, signInButton(page));
});

test("TK1.2: neither zoom nor press on an unavailable button", async ({
  page,
}) => {
  await expectStill(page, await unavailablePrimary(page));
});

test("TK1.3: the primary button in 700", async ({ page }) => {
  await open(page, SIGN_IN);
  expect(await computed(signInButton(page), "font-weight")).toBe("700");
});

test("TK1.3: the secondary button and the text button in 600", async ({
  page,
}) => {
  await openHome(page);
  const secondary = page.getByRole("button", { name: T.logout.action });
  const text = page.getByRole("link", { name: ACCOUNT.homeLink });
  expect(await computed(secondary, "font-weight"), "secondary").toBe("600");
  expect(await computed(text, "font-weight"), "text button").toBe("600");
});

test("UX-1: a member page drawn in the KEO typefaces, Manrope loaded", async ({
  page,
}) => {
  await openAs(page, "/fr/compte/informations", ACCOUNT.details.title);
  await expectKeoTypefaces(
    page,
    title(page),
    page.getByRole("button", { name: ACCOUNT.details.save }),
  );
});

test("TK1.5: a card is rounded at 16 px under KEO", async ({ page }) => {
  await openHome(page);
  const card = homeCard(page);
  for (const corner of [
    "top-left",
    "top-right",
    "bottom-right",
    "bottom-left",
  ]) {
    expect(await computed(card, `border-${corner}-radius`), corner).toBe(
      "16px",
    );
  }
});

// ---------------------------------------------------------------------------------------------
// TK2: the header glow, on the ground of the screen container (RK-9 of the fiche; 20 §11.5)
// ---------------------------------------------------------------------------------------------

test("TK2.1, the screen container carries the glow, whole, the only one of the page", async ({
  page,
}) => {
  await openHome(page);
  const inShell = await glowFacts(page);
  await openSignedOut(page, SIGN_IN);
  const standalone = await glowFacts(page);
  expectWholeGlow("home", inShell);
  expectWholeGlow("sign-in", standalone);
});

test("TK2.2, the glow without an edge, 16 to 25/255 over the page under the centre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openHome(page);
  const home = await glowProbe(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSignedOut(page, SIGN_IN);
  const signIn = await glowProbe(page);
  expectSoftGlow("home at 375 px", home);
  expectSoftGlow("sign-in at 1440 px", signIn);
});

test("TK2.3: no sideways scroll at 320, 375 and 768 px, the glow drawn", async ({
  page,
}) => {
  await openHome(page);
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 800 });
    const facts = await sidewaysFacts(page);
    expect(facts.glows, `${width} px: the glow drawn`).toBeGreaterThan(0);
    expect(facts.overflow, `${width} px`).toBeLessThanOrEqual(0);
  }
});

// ---------------------------------------------------------------------------------------------
// TK3: the typography (RK-5 to RK-7 of the fiche; 20 §11.5). TK3.1 is grafted on the axe passes.
// ---------------------------------------------------------------------------------------------

test("TK3.2, the overline in Manrope 700, in capitals, 12 px at least, never green", async ({
  page,
}) => {
  // The class of the overline, created by RK-5a (rk-fiche, RK-5): drawn on a probe inside the KEO
  // container, so that what the browser computes is the build's own rule for it.
  const classes = (await import(
    pathToFileURL(
      path.join(WEB_ROOT, "src/components/member/ui/heading-classes.ts"),
    ).href
  )) as { OVERLINE?: unknown };
  expect(typeof classes.OVERLINE, "OVERLINE in heading-classes.ts").toBe(
    "string",
  );
  await open(page, SIGN_IN);
  const facts = await page.evaluate(
    ({ selector, className }) => {
      const overline = document.createElement("p");
      overline.className = className;
      overline.textContent = "Surtitre";
      document.querySelector(selector)?.append(overline);
      const style = getComputedStyle(overline);
      const read = {
        family: style.fontFamily,
        weight: style.fontWeight,
        transform: style.textTransform,
        size: parseFloat(style.fontSize),
        color: style.color,
      };
      overline.remove();
      return read;
    },
    { selector: KEO_CONTAINER, className: String(classes.OVERLINE) },
  );
  expect(firstFamily(facts.family)).toBe(await displayFamily(page));
  expect(facts.weight).toBe("700");
  expect(facts.transform).toBe("uppercase");
  expect(facts.size).toBeGreaterThanOrEqual(12);
  const color = rgbaOf(facts.color);
  if (color === null) throw new Error(`unread color ${facts.color}`);
  expect(sameColor(color, await brandGreen(page)), "never green").toBe(false);
});

test("TK3.3: the h1 tightened by --tracking-heading, a negative token", async ({
  page,
}) => {
  await openAs(page, "/fr/compte/donnees", ACCOUNT.data.title);
  await expectHeadingTracking(page, title(page));
});

test("TK3.3, a section title (h2) tightened by --tracking-heading, a negative token", async ({
  page,
}) => {
  await openAs(page, "/fr/compte/donnees", ACCOUNT.data.title);
  await expectHeadingTracking(
    page,
    page.getByRole("heading", { level: 2 }).first(),
  );
});

test("TK3.3: a block title (h3) in 700", async ({ page }) => {
  await openAs(page, "/fr/compte/donnees", ACCOUNT.data.title);
  const heading = page.getByRole("heading", { level: 3 }).first();
  await expect(heading).toBeVisible();
  expect(await computed(heading, "font-weight")).toBe("700");
});

test("TK3.3, the key figure of the code step, its phrase, in Manrope 800", async ({
  page,
}) => {
  await open(page, SIGN_IN);
  await requestCode(page, T, mailboxAddress("rendering-key-figure"));
  const phrase = matchingPhrase(page, T);
  await expect(phrase).toBeVisible();
  expect(firstFamily(await computed(phrase, "font-family"))).toBe(
    await displayFamily(page),
  );
  expect(await computed(phrase, "font-weight")).toBe("800");
});

test("TK3.4, the KEO container smoothed (antialiased)", async ({ page }) => {
  await openHome(page);
  expect(
    await computed(page.locator(KEO_CONTAINER), "-webkit-font-smoothing"),
  ).toBe("antialiased");
});

test("TK3.4, the terms dialog smoothed (antialiased)", async ({ page }) => {
  const address = mailboxAddress("rendering-dialog-smoothing");
  await open(page, "/fr/inscription/createur");
  await requestCode(page, T, address);
  await enterCode(page, T, address);
  await expect(title(page)).toContainText(T.signup.title.creator);
  await page.getByRole("button", { name: T.signup.terms.read }).click();
  const dialog = page.getByRole("dialog", { name: T.signup.terms.title });
  await expect(dialog).toBeVisible();
  expect(await computed(dialog, "-webkit-font-smoothing")).toBe("antialiased");
});

// ---------------------------------------------------------------------------------------------
// TK4: the cards and the badges (RK-10, RK-11 of the fiche; 20 §11.8)
// ---------------------------------------------------------------------------------------------

test.fail(
  "RK-8: TK4.1, a clickable card lights its border up on hover, to --color-border-hover",
  async ({ page }) => {
    await open(page, "/fr/inscription");
    const door = page.getByRole("button", { name: T.door.creator.action });
    await expect(door).toBeVisible();
    const rest = rgbaOf(await computed(door, "border-top-color"));
    await hovered(door);
    const hover = rgbaOf(await computed(door, "border-top-color"));
    if (rest === null || hover === null) throw new Error("no border color");
    expect(luminance(hover), "lighter on hover").toBeGreaterThan(
      luminance(rest),
    );
    const token = await tokenColor(page, "--color-border-hover");
    expect(token, "--color-border-hover").not.toBeNull();
    expect(sameColor(hover, token ?? rest), "the border is the token").toBe(
      true,
    );
  },
);

test("TK4.1: a card that is not clickable stays still on hover", async ({
  page,
}) => {
  await openHome(page);
  const card = homeCard(page);
  const properties = [
    "border-top-color",
    "background-color",
    "box-shadow",
    "translate",
    "scale",
    "transform",
  ];
  const read = async () =>
    Object.fromEntries(
      await Promise.all(
        properties.map(
          async (property) =>
            [property, await computed(card, property)] as const,
        ),
      ),
    );
  const rest = await read();
  await hovered(card);
  expect(await read()).toEqual(rest);
});

test.fail(
  "RK-8: TK4.2, a badge filled with an opaque token, in Manrope 700 at least, its text at 4.5:1",
  async ({ page }) => {
    await openAs(page, "/fr/compte/sessions", ACCOUNT.sessions.title);
    const badge = page.getByText(ACCOUNT.sessions.current, { exact: true });
    await expect(badge).toBeVisible();
    expect((await badge.textContent())?.trim()).toBe(ACCOUNT.sessions.current);
    const ground = rgbaOf(await computed(badge, "background-color"));
    const text = rgbaOf(await computed(badge, "color"));
    if (ground === null || text === null) throw new Error("no badge colors");
    expect(ground.a, "an opaque ground").toBe(1);
    const grounds = await Promise.all(
      [
        "--color-surface-raised",
        "--color-feedback-success-bg",
        "--color-feedback-warning-bg",
        "--color-feedback-info-bg",
        "--color-verified-bg",
        "--color-badge-error-bg",
      ].map((name) => tokenColor(page, name)),
    );
    expect(
      grounds.some((token) => token !== null && sameColor(token, ground)),
      "the ground is a token",
    ).toBe(true);
    expect(firstFamily(await computed(badge, "font-family"))).toBe(
      await displayFamily(page),
    );
    expect(Number(await computed(badge, "font-weight"))).toBeGreaterThanOrEqual(
      700,
    );
    expect(contrast(text, ground)).toBeGreaterThanOrEqual(4.5);
  },
);

// ---------------------------------------------------------------------------------------------
// TK5: no ring on a title or main focused by the app (RK-13, RK-C of the fiche; 20 §11.8). The ring
// of every interactive element (TK5.2) is TD5.4, member-shell.spec and member-primitives.spec.
// ---------------------------------------------------------------------------------------------

/** The element the app focused (its tag) and its outline style. */
async function appFocus(
  page: Page,
): Promise<{ element: string; outline: string }> {
  const focus = await focusedElement(page);
  return {
    element: focus?.description.split(" ")[0] ?? "none",
    outline: focus?.outlineStyle ?? "none",
  };
}

function accountEntry(page: Page): Locator {
  return page
    .getByRole("navigation", { name: SHELL.nav.label, exact: true })
    .getByRole("link", { name: SHELL.nav.entries.account, exact: true });
}

test.fail(
  "RK-7: TK5.1, on arrival on a page, the h1 focused without a ring",
  async ({ page }) => {
    await open(page, SIGN_IN);
    await expect(title(page)).toBeFocused();
    expect(await appFocus(page)).toEqual({ element: "h1", outline: "none" });
  },
);

// Green before the milestone: after a pointer, Chromium does not match :focus-visible on the h1.
test("TK5.1: after a click in the navigation, the h1 focused without a ring", async ({
  page,
}) => {
  await openHome(page);
  await accountEntry(page).click();
  await expect(title(page)).toHaveText(ACCOUNT.hub.title);
  await expect(title(page)).toBeFocused();
  expect(await appFocus(page)).toEqual({ element: "h1", outline: "none" });
});

test.fail(
  "RK-7: TK5.1, after Enter on a link of the navigation, the h1 focused without a ring",
  async ({ page }) => {
    await openHome(page);
    await accountEntry(page).focus();
    await page.keyboard.press("Enter");
    await expect(title(page)).toHaveText(ACCOUNT.hub.title);
    await expect(title(page)).toBeFocused();
    expect(await appFocus(page)).toEqual({ element: "h1", outline: "none" });
  },
);

test.fail(
  "RK-7: TK5.1, after the skip link, main or the h1 focused without a ring",
  async ({ page }) => {
    await openHome(page);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: SHELL.skipToContent }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    const focus = await appFocus(page);
    expect(["main", "h1"]).toContain(focus.element);
    expect(focus.outline).toBe("none");
  },
);

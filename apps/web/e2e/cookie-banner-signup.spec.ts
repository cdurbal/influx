// The open cookie banner never covers the end of screen 3 (WCAG 2.4.11): once scrolled to the
// bottom, the consent box and the submit button sit above the banner and take a real click.
// After "Reject all", the page gives back the room it made for the banner.
import type { Locator, Page } from "@playwright/test";
import {
  AUTH_LABELS,
  consentBox,
  cookieBanner,
  enterCode,
  expect,
  mailboxAddress,
  openWithBanner,
  rejectCookies,
  requestCode,
  test,
  title,
} from "./support/journey";
import type { Mailbox } from "./support/mailboxes";

const VIEWPORTS: {
  name: string;
  mailbox: Mailbox;
  width: number;
  height: number;
}[] = [
  { name: "mobile", mailbox: "banner-open-mobile", width: 390, height: 844 },
  { name: "desktop", mailbox: "banner-open-desktop", width: 1280, height: 800 },
];

async function bottomOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return (box?.y ?? 0) + (box?.height ?? 0);
}

async function bannerTop(page: Page): Promise<number> {
  const box = await page.locator("section[data-cookie-banner]").boundingBox();
  expect(box).not.toBeNull();
  return box?.y ?? 0;
}

for (const viewport of VIEWPORTS) {
  test(`the open cookie banner leaves screen 3 usable (${viewport.name}, WCAG 2.4.11)`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const t = AUTH_LABELS.fr;
    const address = mailboxAddress(viewport.mailbox);

    await openWithBanner(page, "/fr/inscription/marque");
    await expect(cookieBanner(page)).toBeVisible();
    await requestCode(page, t, address);
    await enterCode(page, t, address);
    await expect(title(page)).toContainText(t.signup.title.advertiser);
    await expect(page.locator("html")).toHaveAttribute(
      "data-cookie-banner",
      "open",
    );

    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    // The banner has finished its entry transition before it is measured.
    await expect(cookieBanner(page)).toBeInViewport();
    const consent = consentBox(page, t, "advertiser");
    const submit = page.getByRole("button", { name: t.signup.submit });
    const top = await bannerTop(page);
    expect(await bottomOf(consent)).toBeLessThanOrEqual(top);
    expect(await bottomOf(submit)).toBeLessThanOrEqual(top);

    await consent.check();
    await expect(consent).toBeChecked();
    // An incomplete form: the click must land, not reach the success screen.
    await submit.click();

    await rejectCookies(page);
    await expect(page.locator("section[data-cookie-banner]")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-cookie-banner",
    );
    expect(
      await page.evaluate(() => getComputedStyle(document.body).paddingBottom),
    ).toBe("0px");
  });
}

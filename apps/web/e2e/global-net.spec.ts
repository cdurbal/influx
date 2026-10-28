// The self-check of the global net of the journeys (18 §9.3 A-7, §12.1 TD8.1; G7): a request of a
// page outside the two fronts and a CSP violation are caught, in the test's context and in a
// context opened from the browser, and they fail the test unless it says `foreignTrafficMode:
// "record"`. The requests of the test runner itself are not the page's.
import { expect, foreignRequest, open, test } from "./support/journey";
import {
  BACKOFFICE_ORIGIN,
  DOUBLE_ORIGIN,
  WEB_ORIGIN,
} from "./support/servers";

const FOREIGN_URL = `${DOUBLE_ORIGIN}/messages`;

test("classifies the two fronts and the local schemes as clean, any other origin as foreign", () => {
  expect(foreignRequest(`${WEB_ORIGIN}/fr`)).toBeNull();
  expect(foreignRequest(`${BACKOFFICE_ORIGIN}/accueil`)).toBeNull();
  expect(foreignRequest("data:image/png;base64,AAAA")).toBeNull();
  expect(foreignRequest(`blob:${WEB_ORIGIN}/0f3c`)).toBeNull();
  expect(foreignRequest(FOREIGN_URL)).toBe(`request ${FOREIGN_URL}`);
  // Another port of the loopback is another origin.
  expect(foreignRequest("http://127.0.0.1:3110/health")).toBe(
    "request http://127.0.0.1:3110/health",
  );
});

test.describe(() => {
  test.use({ foreignTrafficMode: "record" });

  test("records a foreign request and a CSP violation, not the runner's own requests", async ({
    page,
    foreignTraffic,
  }) => {
    await open(page, "/fr");
    await page.request.get(FOREIGN_URL);
    expect(foreignTraffic.findings()).toEqual([]);
    // Injected markup, as an XSS would write it: the CSP refuses the inline handler.
    await page.evaluate(() => {
      const holder = document.createElement("div");
      holder.innerHTML =
        '<img alt="" src="/absente-a7.png" onerror="window.__a7 = true">';
      document.body.append(holder);
    });
    await expect
      .poll(() => foreignTraffic.findings())
      .toEqual(["csp script-src-attr inline"]);
    await page.goto(FOREIGN_URL);
    expect(foreignTraffic.findings()).toEqual([
      "csp script-src-attr inline",
      `request ${FOREIGN_URL}`,
    ]);
  });

  test("watches a context opened from the browser during the test", async ({
    browser,
    foreignTraffic,
  }) => {
    const context = await browser.newContext();
    try {
      const other = await context.newPage();
      await other.goto(FOREIGN_URL);
    } finally {
      await context.close();
    }
    expect(foreignTraffic.findings()).toEqual([`request ${FOREIGN_URL}`]);
  });
});

test("fails a journey that leaves the fronts (the default mode)", async ({
  page,
}) => {
  // Expected to fail: the net's own assertion, at the end of the test, is the failure.
  test.fail();
  await page.goto(FOREIGN_URL);
});

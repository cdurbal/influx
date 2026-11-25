// The neutralization of a mockup (docs/mvp/22-refonte-ux-ui/05 §1; RUA-03): the settings of the
// survey of 2026-11-24. The prototype's band (`.demo`) is removed, which gives the columns their
// 100 dvh back (keo.css, `body:has(> .demo)`); reduced motion and the fr-FR locale are the project's
// (playwright.config.ts, E2E_VISUAL); the browser is Playwright's Chromium. The mockup is opened from
// the disk (`file:`): a request to `http(s)` and a WebSocket (`ws(s):`) are refused and counted, a
// script error is collected, and all fail the comparison. The page's clock is paused at a fixed
// instant before any document, then run for a fixed delay once the page is loaded: the timers of zero
// delay (a scroll into view, a section opened) fire, the countdowns of a second never do, and both
// renderings of a state are the same (05 §3 masks the current dates and times; a frozen clock makes
// them equal instead).
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { Page } from "@playwright/test";
import { MOCKUP_DIRECTORY } from "./mockups";

/** The instant the mockups are rendered at (a weekday morning, Paris time). */
export const MOCKUP_INSTANT = new Date("2026-11-24T09:00:00+01:00");

/** The instant the clock is paused at, before any document of the page. */
const PAUSED_INSTANT = MOCKUP_INSTANT.getTime() + 60_000;

/** The delay the frozen clock runs for once the page is loaded: zero-delay timers, an announce. */
export const SETTLE_DELAY_MS = 250;

/** What a mockup page did that it must not: requests to the network, script errors. */
export type MockupFindings = {
  networkRequests: string[];
  scriptErrors: string[];
};

/** The `file:` address of a state of a mockup (its anchor, 05 §1). */
export function mockupUrl(file: string, state: string): string {
  return `${pathToFileURL(path.join(MOCKUP_DIRECTORY, file)).href}#${state}`;
}

/**
 * Refuses every `http(s)` request and every WebSocket of the page and collects its script errors, from
 * now on (RUAS-5: a socket is no `route`, `routeWebSocket` closes it unconnected, with no server
 * behind it). Call it once per page, before the first navigation.
 */
export async function watchMockupPage(page: Page): Promise<MockupFindings> {
  const findings: MockupFindings = { networkRequests: [], scriptErrors: [] };
  await page.route(/^https?:\/\//, async (route) => {
    findings.networkRequests.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  await page.routeWebSocket(/^wss?:\/\//, (socket) => {
    findings.networkRequests.push(socket.url());
    void socket.close();
  });
  page.on("pageerror", (error) => {
    findings.scriptErrors.push(error.message);
  });
  // Installed and paused before any document: each new document starts paused at the same instant
  // (Playwright replays the clock on navigation), and no timer fires before `runFor`.
  await page.clock.install({ time: MOCKUP_INSTANT });
  await page.clock.pauseAt(PAUSED_INSTANT);
  return findings;
}

/**
 * Opens a state of a mockup, neutralized: loaded, fonts ready, band removed, clock frozen then run
 * for SETTLE_DELAY_MS, the state applied by proto.js (`body[data-state]`).
 */
export async function openMockupState(
  page: Page,
  file: string,
  state: string,
): Promise<void> {
  // A new document each time: proto.js reads the anchor once loaded, and a change of the anchor
  // alone would not run the page's own scripts again.
  await page.goto("about:blank");
  await page.goto(mockupUrl(file, state), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    document.querySelector("body > .demo")?.remove();
  });
  const loadedAt = await page.evaluate(() => Date.now());
  await page.clock.runFor(SETTLE_DELAY_MS);
  const { applied, now } = await page.evaluate(() => ({
    applied: document.body.getAttribute("data-state"),
    now: Date.now(),
  }));
  // The clock is paused: it moved by the settling delay and nothing else, real time did not count.
  if (now - loadedAt !== SETTLE_DELAY_MS) {
    throw new Error(
      `${file}#${state}: the page's clock moved by ${now - loadedAt} ms, not ${SETTLE_DELAY_MS}`,
    );
  }
  if (applied !== state) {
    throw new Error(
      `${file}#${state}: proto.js applied the state "${applied ?? ""}"`,
    );
  }
  await page.evaluate(() => document.fonts.ready);
}

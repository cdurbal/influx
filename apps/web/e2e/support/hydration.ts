// The one barrier for "the page is hydrated" (EC-PL-01-1). Each front sets `data-hydrated` on
// <html> from a client effect of its root layout (HydrationMarker); a gesture made before that
// moment is lost, which made the journeys and DS-11 intermittent in CI. Waiting here replaces
// any fixed delay: no `waitForTimeout`, no longer timeout, no retry.
import { expect, type Page } from "@playwright/test";

/** Resolves once the page on screen is hydrated. */
export async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
}

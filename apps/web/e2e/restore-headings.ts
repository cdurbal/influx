// Global setup of the merge job of ci.yml (L2C-14a), in place of e2e/global-setup.ts: TK3.1 reads the
// surveys the axe passes of both shards recorded (support/rendering.ts), and Playwright empties
// test-results/ before any global setup. The surveys downloaded from the shards (E2E_HEADINGS_FROM,
// see playwright.config.ts) are therefore put back here, once the output directory is clean.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { HEADING_SURVEYS } from "./support/rendering";

export default function restoreHeadings(): void {
  const from = process.env.E2E_HEADINGS_FROM;
  if (from === undefined) {
    throw new Error("E2E_HEADINGS_FROM is not set: no survey to restore.");
  }
  const to = path.join(process.cwd(), "test-results", HEADING_SURVEYS);
  mkdirSync(to, { recursive: true });
  const files = readdirSync(from).filter((file) => file.endsWith(".json"));
  if (files.length === 0) {
    throw new Error(`No survey (*.json) in ${from}: the shards recorded none.`);
  }
  for (const file of files) {
    copyFileSync(path.join(from, file), path.join(to, file));
  }
}

// L2AS-2: the closed list of route models (packages/contracts/src/route-models.ts) against the
// pages of apps/backoffice. The error collector sends `location.pathname`; the API keeps it only
// when its model is on the list. A page added under src/app fails here until it is listed, and a
// listed page that is gone fails too.
import { BACKOFFICE_PAGE_MODELS } from "@influx/contracts/route-models";
import { listFiles, relativePath } from "@influx/test-kit/guards";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_TREE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
);

/** The address of a page directory: route groups removed, `[id]` written `:id` (the collector's). */
function addressOf(directory: string): string {
  const segments = directory
    .split("/")
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment))
    .map((segment) => (segment === "[id]" ? ":id" : segment));
  return `/${segments.join("/")}`;
}

describe("route models of the pages of apps/backoffice (L2AS-2)", () => {
  it("lists exactly the pages under src/app", () => {
    const pages = listFiles(APP_TREE)
      .filter((file) => /[\\/]page\.tsx$/.test(file))
      .map((file) => addressOf(relativePath(APP_TREE, path.dirname(file))))
      .sort();
    expect([...BACKOFFICE_PAGE_MODELS].sort()).toEqual(pages);
  });
});

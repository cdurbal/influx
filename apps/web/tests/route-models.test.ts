// L2AS-2: the closed list of route models (packages/contracts/src/route-models.ts) against the
// pages of apps/web. The error collector sends `location.pathname`; the API keeps it only when its
// model is on the list. A page added to MEMBER_PAGE_SLUGS or to the public documents fails here
// until its two addresses are listed (one entry per address), and a listed address without a page
// fails too.
import { WEB_PAGE_MODELS } from "@influx/contracts/route-models";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, relativePath } from "@influx/test-kit/guards";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import { LEGAL_DOCUMENT_SLUGS } from "@/lib/legal-documents";
import { MEMBER_PAGE_SLUGS } from "@/lib/member-paths";

const LOCALE_TREE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "[locale]",
);

/** The address of every page of apps/web, in both languages, from the tables that name them. */
function addressesOfTheTables(): string[] {
  const slugs = [
    ...Object.values(MEMBER_PAGE_SLUGS),
    ...Object.values(LEGAL_DOCUMENT_SLUGS),
  ];
  return routing.locales
    .flatMap((locale) => [
      `/${locale}`,
      // a campaign is the one identifier of an address: the collector writes it `:id` (L3B-09)
      ...slugs.map(
        (bySlug) => `/${locale}/${bySlug[locale].replace("[id]", ":id")}`,
      ),
    ])
    .sort();
}

describe("route models of the pages of apps/web (L2AS-2)", () => {
  it("lists the landing, every member page and every public document, in both languages", () => {
    expect([...WEB_PAGE_MODELS].sort()).toEqual(addressesOfTheTables());
  });

  it("has a page file under [locale] for every listed address", () => {
    const pages = new Set(
      listFiles(LOCALE_TREE)
        .filter((file) => /[\\/]page\.tsx$/.test(file))
        .map((file) =>
          relativePath(LOCALE_TREE, path.dirname(file))
            .split("/")
            .filter((segment) => !/^\(.*\)$/.test(segment))
            .join("/"),
        ),
    );
    for (const model of WEB_PAGE_MODELS) {
      const [, , ...segments] = model.split("/");
      expect(
        pages.has(segments.map((s) => (s === ":id" ? "[id]" : s)).join("/")),
        model,
      ).toBe(true);
    }
  });
});

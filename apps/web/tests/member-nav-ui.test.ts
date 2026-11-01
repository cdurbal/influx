// The main navigation of the member spaces as drawn (sn-fiche TN4; D74; 20 §11.8 "Sous-entrée de
// navigation"): the sub-entries nested in the active item only, one `aria-current` per page, the
// rubric as an ancestor without it on a sub-page, the sub-list hidden below lg by CSS alone; and
// the way back above the h1 of a sub-page. Server rendering, no browser, no router (the link is a
// plain <a>); the e2e of member-shell.spec.ts look at the pixels.
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  MemberNav,
  type MemberNavEntry,
  type MemberNavLinkProps,
} from "@/components/member/MemberNav";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { activePlaceOf, subEntriesOf } from "@/lib/member-nav";
import type { MemberPage } from "@/lib/member-paths";

function PlainLink({ children, ...props }: MemberNavLinkProps) {
  return createElement("a", props, children);
}

const ENTRIES: MemberNavEntry[] = [
  { entry: "home", href: "/marque", label: "Accueil", subEntries: [] },
  {
    entry: "account",
    href: "/compte",
    label: "Compte",
    subEntries: subEntriesOf("account").map((page) => ({
      page,
      href: `/${page}`,
      label: `label-${page}`,
    })),
  },
];

/** The markup of the navigation on `page`. */
function render(page: MemberPage | null): string {
  return renderToStaticMarkup(
    createElement(MemberNav, {
      label: "Navigation principale",
      entries: ENTRIES,
      place: activePlaceOf(page),
      LinkComponent: PlainLink,
    }),
  );
}

/** The opening tags of the links that carry `aria-current`, with their text. */
function currentLinks(markup: string): string[] {
  return [
    ...markup.matchAll(/<a [^>]*aria-current="page"[^>]*>(.*?)<\/a>/g),
  ].map((match) => match[1] ?? "");
}

/** The <li> of an entry, up to the next entry's or the end of the list. */
function itemOf(markup: string, href: string): string {
  const start = markup.indexOf(`<li class`, markup.indexOf("<ul") + 1);
  const items = markup.slice(start).split(/<li class="flex-1/);
  return items.find((item) => item.includes(`href="${href}"`)) ?? "";
}

describe("TN4: the sub-entries of the active rubric, in the one <nav>", () => {
  it("nests the four pages of Compte in its <li> on a sub-page, the current one marked alone", () => {
    const markup = render("accountData");
    expect(markup.match(/<nav[ >]/g)).toHaveLength(1);
    expect(markup.match(/<ul[ >]/g)).toHaveLength(2);
    const account = itemOf(markup, "/compte");
    expect(account).toMatch(/<ul class="[^"]*max-lg:hidden/);
    for (const page of subEntriesOf("account")) {
      expect(account, page).toContain(`label-${page}`);
    }
    expect(itemOf(markup, "/marque")).not.toContain("<ul");
    expect(currentLinks(markup)).toEqual(["label-accountData"]);
  });

  it("keeps the rubric as an ancestor on a sub-page: heavier, no aria-current", () => {
    const markup = render("accountPreferences");
    const rubric = /<a href="\/compte"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(rubric).not.toContain("aria-current");
    expect(rubric).toContain("font-semibold");
    // In the column (lg), no surface and no line: those are the sub-entry's.
    expect(rubric).not.toMatch(/(?<![\w:-])bg-nav-item-active-bg/);
    expect(rubric).not.toContain("lg:before:w-(--border-width-thick)");
    const current = /<a [^>]*aria-current="page"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(current).toContain("bg-nav-item-active-bg");
    expect(current).toContain("before:w-(--border-width-thick)");
  });

  it("marks the rubric itself on its page-menu, its sub-menu open and no sub-entry current", () => {
    const markup = render("accountHub");
    expect(currentLinks(markup)).toHaveLength(1);
    expect(currentLinks(markup)[0]).toContain("Compte");
    expect(itemOf(markup, "/compte")).toContain("label-accountDetails");
  });

  it("shows no sub-entry away from the rubric, and no current link at all off the navigation", () => {
    const home = render("advertiserHome");
    expect(home.match(/<ul[ >]/g)).toHaveLength(1);
    expect(currentLinks(home)).toHaveLength(1);
    expect(currentLinks(home)[0]).toContain("Accueil");
    expect(currentLinks(render(null))).toEqual([]);
  });

  it("gives a sub-entry no icon, its label aligned on the rubric's, a touch target and text-sm", () => {
    const markup = render("accountSessions");
    const sub = /<a href="\/accountDetails"[^>]*>(.*?)<\/a>/.exec(markup);
    expect(sub?.[1]).toBe("label-accountDetails");
    expect(sub?.[0]).toContain("min-h-(--size-touch-target)");
    expect(sub?.[0]).toContain("text-sm");
    expect(sub?.[0]).toContain("rounded-md");
    expect(sub?.[0]).toContain("pl-(--spacing-nav-sub-indent)");
  });
});

describe("the way back above the h1 of a sub-page (D74, sn-fiche Retour)", () => {
  const header = (back: ReactNode) =>
    renderToStaticMarkup(
      createElement(
        PageBackContext,
        { value: back },
        createElement(PageHeader, { title: "Mes données" }),
      ),
    );

  it("draws the link given by the rubric's frame before the h1, and nothing without it", () => {
    const markup = header(
      createElement("a", { href: "/compte" }, "Mon compte"),
    );
    expect(markup.indexOf('href="/compte"')).toBeGreaterThan(-1);
    expect(markup.indexOf('href="/compte"')).toBeLessThan(
      markup.indexOf("<h1"),
    );
    expect(markup.match(/<h1[ >]/g)).toHaveLength(1);
    expect(header(null)).not.toContain("<a");
  });
});

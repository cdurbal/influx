// RUB-T1 (jalons/rub/annexe.md): the structure components of the member spaces, C01 PageFrame, C02
// PageHeader, C03 Section and C29 Announcer, as they render: one `h1`, the levels, the sections named by
// their heading, one live region. Server rendering, no browser, no jsdom (the e2e of the state board look
// at the pixels, the focus and the axe).
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  SCREEN_CLASSES,
  SPACE_SCREEN_CLASSES,
} from "@/components/auth/auth-classes";
import { PROFILE_PAGE_CLASSES } from "@/components/brand-profile/brand-profile-classes";
import { CAMPAIGN_PAGE_CLASSES } from "@/components/campaign/campaign-classes";
import { SEARCH_PAGE_CLASSES } from "@/components/creator-search/creator-search-classes";
import {
  AnnouncerProvider,
  useAnnouncer,
} from "@/components/member/ui/Announcer";
import {
  PageFrame,
  type PageFrameProps,
} from "@/components/member/ui/PageFrame";
import { pageFrameClasses } from "@/components/member/ui/page-frame-classes";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { Section, type SectionProps } from "@/components/member/ui/Section";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const headings = (markup: string) =>
  [...markup.matchAll(/<h([1-6])[ >]/g)].map((match) => Number(match[1]));

describe("RUB-T1: C01 PageFrame", () => {
  it("is a div that carries the glow, the gutter and the gap, and holds no main and no heading", () => {
    const markup = html(
      createElement(
        PageFrame,
        { variant: "wide" } as PageFrameProps,
        "content",
      ),
    );
    expect(markup).toMatch(/^<div /);
    expect(markup).toContain("bg-header-glow");
    expect(markup).toContain("min-h-(--size-header-glow)");
    expect(markup).toContain("px-page-gutter");
    expect(markup).toContain("gap-6");
    expect(markup).not.toContain("<main");
    expect(headings(markup)).toEqual([]);
  });

  it("never centres a variant, so that the edge of the h1 is the same on every page (CA08)", () => {
    for (const variant of ["wide", "narrow", "bo"] as const) {
      const classes = pageFrameClasses(variant);
      expect(classes, variant).not.toContain("mx-auto");
      expect(classes, variant).toContain("bg-header-glow");
    }
    expect(pageFrameClasses("narrow")).toContain("--container-narrow");
    expect(pageFrameClasses("wide")).toContain("max-w-(--container-max)");
    // U-7: the narrow frame is as wide as the wide one, the glow with it; its stack stays narrow by
    // the right padding alone, never under the gutter.
    expect(pageFrameClasses("narrow").split(" ")).toEqual(
      expect.arrayContaining([
        "max-w-(--container-max)",
        "pl-page-gutter",
        "pr-[max(var(--spacing-page-gutter),calc(min(100%,var(--container-max))-var(--container-narrow)-var(--spacing-page-gutter)))]",
      ]),
    );
    expect(pageFrameClasses("narrow")).not.toMatch(/max-w-\[|px-page-gutter/);
    expect(pageFrameClasses("wide")).not.toContain("--container-narrow");
  });

  it("takes the gap of the reading or the stacked page, and the reserve of its sticky bar on a phone only", () => {
    expect(pageFrameClasses("wide", { gap: "reading" })).toContain("gap-5");
    expect(pageFrameClasses("wide", { gap: "reading" })).not.toContain("gap-6");
    expect(pageFrameClasses("wide", { gap: "stack" })).toContain(
      "gap-8 max-lg:gap-6",
    );
    expect(pageFrameClasses("wide")).not.toContain("max-md:pb-");
    expect(pageFrameClasses("wide", { stickyBar: "wizard" })).toContain(
      "max-md:pb-(--size-mobile-space-wizard)",
    );
    expect(
      html(
        createElement(
          PageFrame,
          {
            variant: "narrow",
            id: "frame",
            "aria-label": "Frame",
            className: "extra",
          } as PageFrameProps,
          "content",
        ),
      ),
    ).toMatch(
      /id="frame"[^>]*aria-label="Frame"|aria-label="Frame"[^>]*id="frame"/,
    );
  });

  it("frames every page of the member space, the standalone pages keeping their centred chain apart (CA08, RUB-A §5)", () => {
    expect(SPACE_SCREEN_CLASSES).toBe(pageFrameClasses("narrow"));
    for (const classes of [
      PROFILE_PAGE_CLASSES,
      CAMPAIGN_PAGE_CLASSES,
      SEARCH_PAGE_CLASSES,
    ]) {
      expect(classes).toBe(pageFrameClasses("wide"));
    }
    expect(SCREEN_CLASSES).toBe(
      "mx-auto flex w-full max-w-(--container-narrow) flex-col gap-6 min-h-(--size-header-glow) px-page-gutter py-section-header bg-header-glow bg-no-repeat min-h-screen",
    );
  });
});

describe("RUB-T1: C02 PageHeader", () => {
  it("renders exactly one h1, focusable by script, whatever the properties given", () => {
    const full = html(
      createElement(PageHeader, {
        title: "Title",
        titleSize: "section",
        above: "Above",
        crumbs: [{ href: "/a", label: "A" }, { label: "Here" }],
        badges: createElement("span", null, "Badge"),
        lead: "Lead",
        actions: createElement("button", { type: "button" }, "Act"),
        meta: "Meta",
      }),
    );
    expect(headings(full)).toEqual([1]);
    expect(full).toContain('tabindex="-1"');
    expect(
      headings(html(createElement(PageHeader, { title: "Only" }))),
    ).toEqual([1]);
  });

  it("sizes the title by titleSize and keeps the page size by default (RU-17)", () => {
    const page = html(createElement(PageHeader, { title: "T" }));
    const section = html(
      createElement(PageHeader, { title: "T", titleSize: "section" }),
    );
    expect(page).toContain("text-title-page");
    expect(page).not.toContain("text-title-section");
    expect(section).toContain("text-title-section");
    expect(section).toContain("font-extrabold");
    expect(section).not.toContain("text-title-page");
  });

  it("renders as before when it is given none of the new properties: the way back, then the title", () => {
    const back = html(
      createElement(
        PageBackContext.Provider,
        { value: "Back" },
        createElement(PageHeader, { title: "T" }),
      ),
    );
    expect(back).toBe(
      '<header class="flex flex-col gap-3 py-4"><div class="text-sm text-text-secondary">Back</div>' +
        '<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">' +
        '<h1 tabindex="-1" class="font-display text-title-page font-extrabold tracking-heading text-text-primary">T</h1></div></header>',
    );
    expect(
      html(
        createElement(
          PageBackContext.Provider,
          { value: "Back" },
          createElement(PageHeader, { title: "T", above: "Above" }),
        ),
      ),
    ).not.toContain("Back");
  });

  it("writes the crumbs as a plain list, the page itself without a link, never a nav nor aria-current", () => {
    const markup = html(
      createElement(PageHeader, {
        title: "T",
        above: "Above",
        crumbs: [{ href: "/a", label: "A" }, { label: "Here" }],
      }),
    );
    expect(markup).toContain("<ol");
    expect(markup).toContain('<a href="/a"');
    expect(markup).toContain("<li>Here</li>");
    expect(markup).not.toContain("<nav");
    expect(markup).not.toContain("aria-current");
    expect(markup).not.toContain("Above");
  });

  it("puts the badges beside the title, the lead and the facts under it, the action in its own group", () => {
    const markup = html(
      createElement(PageHeader, {
        title: "T",
        badges: createElement("span", null, "Badge"),
        lead: "Lead",
        meta: "Meta",
        actions: "Act",
      }),
    );
    expect(markup.indexOf("Badge")).toBeGreaterThan(markup.indexOf("</h1>"));
    expect(markup.indexOf("Lead")).toBeGreaterThan(markup.indexOf("Act"));
    expect(markup.indexOf("Meta")).toBeGreaterThan(markup.indexOf("Lead"));
    expect(markup).toContain("flex flex-col gap-2 md:flex-row md:items-center");
  });
});

describe("RUB-T1: C03 Section", () => {
  const render = (props: Partial<Parameters<typeof Section>[0]> = {}) =>
    html(
      createElement(
        Section,
        { title: "Title", variant: "page", ...props } as never,
        "body",
      ),
    );

  it("is a section named by its heading: aria-labelledby is the id of the h2", () => {
    const markup = render();
    const labelled = /aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(labelled).toBeDefined();
    expect(markup).toContain(`id="${labelled}"`);
    expect(headings(markup)).toEqual([2]);
    expect(render({ as: "h3" })).toMatch(/<h3 id=/);
    expect(headings(render({ as: "h3" }))).toEqual([3]);
  });

  it("gives two sections two different names", () => {
    const markup = html(
      createElement(
        "div",
        null,
        createElement(
          Section,
          { title: "One", variant: "page" } as SectionProps,
          "a",
        ),
        createElement(
          Section,
          { title: "Two", variant: "page" } as SectionProps,
          "b",
        ),
      ),
    );
    const ids = [...markup.matchAll(/aria-labelledby="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("draws a hairline above every section but the first of its parent, and none when divider is off", () => {
    const classes = /<section [^>]*class="([^"]+)"/.exec(render())?.[1] ?? "";
    expect(classes).toContain("border-t-(length:--border-width-thin)");
    expect(classes).toContain("first-of-type:border-t-0");
    expect(classes).toContain("first-of-type:pt-0");
    expect(render({ divider: false })).not.toContain("border-t");
  });

  it("sizes each of the five variants as 02a C03 says", () => {
    const titleOf = (variant: string) =>
      /<h2 [^>]*class="([^"]+)"/.exec(render({ variant } as never))?.[1] ?? "";
    expect(titleOf("page")).toContain("text-title-section");
    expect(titleOf("reading")).toContain("text-title-section");
    expect(titleOf("account")).toContain("text-md");
    expect(titleOf("bo")).toContain("text-md");
    expect(titleOf("overline")).toContain("uppercase");
    expect(render({ variant: "reading" })).toContain("py-6");
    expect(render({ variant: "account" })).toContain("gap-4 pt-5");
    expect(render({ variant: "bo" })).toContain("gap-3 pt-5");
  });

  it("writes the count after the title, the description and the actions, and marks a section in progress", () => {
    const markup = render({
      count: "(3)",
      description: "Intro",
      actions: createElement("button", { type: "button" }, "Act"),
      busy: true,
    });
    expect(markup).toContain("Title");
    expect(markup).toContain("(3)");
    expect(markup).toContain("Intro");
    expect(markup).toContain("Act");
    expect(markup).toContain('aria-busy="true"');
    expect(render()).not.toContain("aria-busy");
  });
});

describe("RUB-T1: C29 Announcer", () => {
  function Speaker(): ReactNode {
    useAnnouncer();
    return "spoke";
  }

  it("renders one live region, off screen, empty at first, and marks it for the specs", () => {
    const markup = html(
      createElement(AnnouncerProvider, null, createElement("p", null, "page")),
    );
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain("data-announcer");
    expect(markup).toContain("sr-only");
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toMatch(/role="status"[^>]*><\/div>/);
    expect(markup).toContain("<p>page</p>");
  });

  it("gives its function to a component under the provider, and throws outside it", () => {
    expect(
      html(createElement(AnnouncerProvider, null, createElement(Speaker))),
    ).toContain("spoke");
    expect(() => html(createElement(Speaker))).toThrow(
      "useAnnouncer is called outside an AnnouncerProvider",
    );
  });
});

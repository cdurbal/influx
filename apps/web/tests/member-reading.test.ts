// RUB-T9 (docs/mvp/jalons/rub/annexe.md; 22-refonte-ux-ui/02b C34 to C37, C39, C40, C66, C68, 02c; RUB-B §4): the
// gallery and the components of a reading page. Server rendering, no browser: the visuals named by what they show,
// the mosaic without an empty cell, the valid lists of terms, the written value of a range, the named landmarks, the
// one `h1` of the head of a brand page, and no score. The dialog, the focus, the track, the widths and the pixels are
// the board's (e2e, RUB-T9 and RUB-AN2 09b).
import { createElement, type ComponentProps, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandHero } from "@/components/member/ui/BrandHero";
import { KeyFigures } from "@/components/member/ui/KeyFigures";
import {
  MediaGallery,
  type MediaGalleryProps,
} from "@/components/member/ui/MediaGallery";
import { PreviewFrame } from "@/components/member/ui/PreviewFrame";
import { RangeBar } from "@/components/member/ui/RangeBar";
import { ReadingLayout } from "@/components/member/ui/ReadingLayout";
import { ReasonList } from "@/components/member/ui/ReasonList";
import {
  MobileActionBar,
  StickyAside,
} from "@/components/member/ui/StickyAside";
import { galleryDialogClasses } from "@/components/member/ui/dialog-classes";
import { galleryCellClasses } from "@/components/member/ui/media-gallery-classes";
import {
  MOBILE_ACTION_BAR_CLASSES,
  STICKY_ASIDE_CLASSES,
} from "@/components/member/ui/sticky-aside-classes";
import { BadgeCheckIcon } from "@/components/ui/icons";

const html = (element: ReactElement) => renderToStaticMarkup(element);

const VISUALS = [1, 2, 3, 4, 5, 6].map((place) => ({
  src: `/visual-${place}.jpg`,
  alt: `Visual ${place}: a dish`,
  caption: `A dish ${place}`,
}));

function gallery(count: number, props: Partial<MediaGalleryProps> = {}) {
  return html(
    createElement(MediaGallery, {
      items: VISUALS.slice(0, count),
      allLabel: `See the ${count} visuals`,
      title: "Portfolio · Profile 93JMS4",
      closeLabel: "Close the gallery",
      emptyLabel: "No visual yet.",
      ...props,
    }),
  );
}

describe("RUB-T9: the gallery (C34)", () => {
  it("says a portfolio without a visual in a sentence, without a frame, a button or a dialog", () => {
    const markup = gallery(0);
    expect(markup).toBe(
      '<p data-media-gallery="empty" class="text-md text-text-secondary">No visual yet.</p>',
    );
  });

  it("fills its frame from one to five visuals, the first over the two rows, and shows five at most (RU-34)", () => {
    const layouts = [1, 2, 3, 4, 5, 6].map((count) =>
      Array.from({ length: Math.min(count, 5) }, (_, index) =>
        galleryCellClasses(count, index),
      ),
    );
    expect(layouts).toEqual([
      ["col-span-3 row-span-2 rounded-card"],
      ["row-span-2 rounded-l-card", "col-span-2 row-span-2 rounded-r-card"],
      [
        "row-span-2 rounded-l-card",
        "col-span-2 rounded-tr-card",
        "col-span-2 rounded-br-card",
      ],
      [
        "row-span-2 rounded-l-card",
        "col-span-2 rounded-tr-card",
        "",
        "rounded-br-card",
      ],
      [
        "row-span-2 rounded-l-card",
        "",
        "rounded-tr-card",
        "",
        "rounded-br-card",
      ],
      [
        "row-span-2 rounded-l-card",
        "",
        "rounded-tr-card",
        "",
        "rounded-br-card",
      ],
    ]);
    // twelve places in the grid of 3 by 2 are held: no cell stays empty
    for (const cells of layouts) {
      const places = cells.reduce((total, cell) => {
        const columns = Number(/col-span-(\d)/.exec(cell)?.[1] ?? 1);
        const rows = Number(/row-span-(\d)/.exec(cell)?.[1] ?? 1);
        return total + columns * rows;
      }, 0);
      expect(places).toBe(6);
    }
    const mosaic = /data-gallery-mosaic.*?data-gallery-carousel/s.exec(
      gallery(6),
    )![0];
    expect(mosaic.match(/data-gallery-visual/g)).toHaveLength(5);
  });

  it("makes each visual a button named by what it shows, draws one rendering per width by CSS, and leaves a lone visual without a counter, a track or a button to see them all", () => {
    const two = gallery(2);
    // each button holds its picture alone: its name is the alternative text
    expect(
      two.match(
        /<button type="button" data-gallery-visual="\d"[^>]*><img src="\/visual-\d\.jpg" alt="Visual \d: a dish"/g,
      ),
    ).toHaveLength(4);
    expect(two).toMatch(
      /data-gallery-mosaic="" class="relative max-md:hidden"/,
    );
    expect(two).toMatch(/data-gallery-carousel="" class="relative md:hidden"/);
    expect(two).toMatch(
      /role="region" aria-label="Portfolio · Profile 93JMS4" tabindex="0" data-gallery-track/,
    );
    expect(two).toMatch(
      /<span aria-hidden="true" data-gallery-count=""[^>]*>1 \/ 2<\/span>/,
    );
    expect(two).toMatch(/data-gallery-all=""[^>]*>.*?See the 2 visuals/s);

    const one = gallery(1);
    expect(one).not.toContain("data-gallery-count");
    expect(one).not.toContain("data-gallery-track");
    expect(one).not.toContain("data-gallery-all");
  });

  it("holds all the visuals and their captions in a closed dialog named by its title, closed by a named chevron, its body reached by the keyboard, fading without a scale", () => {
    const markup = gallery(6);
    const dialog = /<dialog data-dialog="gallery".*<\/dialog>/s.exec(
      markup,
    )![0];
    expect(dialog).not.toMatch(/<dialog[^>]* open=/);
    expect(dialog.match(/<figure /g)).toHaveLength(6);
    expect(dialog.match(/<figcaption /g)).toHaveLength(6);
    const titleId = /<dialog[^>]*aria-labelledby="([^"]+)"/.exec(dialog)?.[1];
    expect(dialog).toContain(`<h2 id="${titleId}"`);
    expect(dialog).toContain('aria-label="Close the gallery"');
    expect(dialog).toMatch(
      new RegExp(
        `role="region" aria-labelledby="${titleId}" tabindex="0" data-gallery-body`,
      ),
    );
    expect(galleryDialogClasses()).not.toContain("scale-");
    expect(galleryDialogClasses()).toContain("transition-discrete");
  });
});

describe("RUB-T9: the figures, the reasons and the ranges (C35 to C37)", () => {
  it("writes the figures as a valid list of terms, the verified cell in words beside its hidden icon, a missing value as the screen writes it", () => {
    const markup = html(
      createElement(KeyFigures, {
        variant: "figures",
        items: [
          { label: "Verified audience", value: "Instagram", verified: true },
          { label: "followers", value: "10–50 k", sub: "Micro" },
          { label: "comments", value: "Not provided" },
        ],
      }),
    );
    expect(markup).toMatch(/^<dl data-key-figures="figures"/);
    // each pair is a div that holds its term and its value alone
    expect(
      markup.match(
        /<div data-key-figure="[a-z]*" class="[^"]*"><dt [^>]*>.*?<\/dt><dd [^>]*>.*?<\/dd><\/div>/g,
      ),
    ).toHaveLength(3);
    expect(markup).toMatch(
      /data-key-figure="verified".*?<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg>Verified audience<\/dt><dd [^>]*>Instagram/s,
    );
    expect(markup.match(/<svg/g)).toHaveLength(1);
    expect(markup).toContain(">Not provided</dd>");

    for (const variant of ["essentials", "network"] as const) {
      const other = html(
        createElement(KeyFigures, {
          variant,
          items: [{ label: "A", value: "B", icon: BadgeCheckIcon }],
        }),
      );
      expect(other).toMatch(new RegExp(`^<dl data-key-figures="${variant}"`));
      // an icon stands in the essentials alone, inside the term
      expect(other.includes("<svg"), variant).toBe(variant === "essentials");
    }
  });

  it("lists reasons as facts, a title and a sentence each, 24 or 16 px apart, no score, and draws nothing for none", () => {
    const items = [
      { icon: BadgeCheckIcon, title: "Verified", body: "Checked by INFLUX." },
    ];
    const wide = html(createElement(ReasonList, { items }));
    expect(wide).toMatch(/<ul data-reason-list="" class="flex flex-col gap-5"/);
    expect(wide).toMatch(
      /<svg[^>]*aria-hidden="true".*?<\/svg><div><p [^>]*>Verified<\/p><p [^>]*>Checked by INFLUX\.<\/p>/s,
    );
    expect(html(createElement(ReasonList, { items, gap: "md" }))).toContain(
      "flex flex-col gap-4",
    );
    expect(wide).not.toMatch(/\d\s?%|score|\/10/i);
    expect(html(createElement(ReasonList, { items: [] }))).toBe("");
  });

  it("writes the value of a range and draws its band where it is told to, hidden from a screen reader", () => {
    const markup = html(
      createElement(RangeBar, {
        items: [
          { label: "Belgium", from: 30, to: 50, valueLabel: "30 to 50 %" },
        ],
      }),
    );
    expect(markup).toMatch(
      /<li [^>]*><span [^>]*>Belgium<\/span><svg aria-hidden="true"[^>]*><rect data-range-fill="" x="30%" width="20%"[^>]*><\/rect><\/svg><span [^>]*>30 to 50 %<\/span><\/li>/,
    );
    // the CSP of the fronts refuses a style attribute: the band is placed by the geometry of the drawing
    expect(markup).not.toContain("style=");
  });
});

describe("RUB-T9: the box, the layout, the preview and the head (C39, C40, C66, C68)", () => {
  it("names the box and its bar, one at a width by CSS, one action in the bar, the shadow on the box alone, and no bar when there is nothing to do", () => {
    expect(
      html(
        createElement(
          StickyAside,
          { label: "My selection" } as ComponentProps<typeof StickyAside>,
          "Box",
        ),
      ),
    ).toMatch(/^<aside aria-label="My selection" data-sticky-aside=""/);
    const bar = {
      label: "Add to my selection",
      text: "Private",
      action: createElement("button", { type: "button" }, "Add"),
    };
    const markup = html(createElement(MobileActionBar, bar));
    expect(markup).toMatch(
      /^<section aria-label="Add to my selection" data-mobile-action-bar=""/,
    );
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(html(createElement(MobileActionBar, { ...bar, hidden: true }))).toBe(
      "",
    );
    const aside = STICKY_ASIDE_CLASSES.split(" ");
    expect(aside).toEqual(
      expect.arrayContaining([
        "shadow-md",
        "max-lg:hidden",
        "lg:sticky",
        "lg:top-6",
      ]),
    );
    const fixed = MOBILE_ACTION_BAR_CLASSES.split(" ");
    expect(fixed).toEqual(
      expect.arrayContaining([
        "fixed",
        "bottom-(--size-nav-bottom-height)",
        "lg:hidden",
      ]),
    );
    expect(fixed).not.toContain("relative");
    expect(MOBILE_ACTION_BAR_CLASSES).not.toContain("shadow");
  });

  it("puts the content before the named box, and frames a preview in a group named by its label, an inert action left readable and explained", () => {
    const layout = html(
      createElement(ReadingLayout, {
        main: "Content",
        aside: "Box",
        asideLabel: "Application",
      }),
    );
    expect(layout).toMatch(
      /<div class="flex min-w-0 flex-col \[&amp;_p\]:max-w-\(--measure-text\)">Content<\/div><aside aria-label="Application"[^>]*>Box<\/aside>/,
    );
    for (const variant of ["zone", "strip"] as const) {
      const frame = html(
        createElement(
          PreviewFrame,
          { variant, label: "Preview" } as ComponentProps<typeof PreviewFrame>,
          createElement(
            "button",
            { type: "button", "aria-disabled": true },
            "Apply",
          ),
        ),
      );
      const id = /role="group" aria-labelledby="([^"]+)"/.exec(frame)?.[1];
      expect(frame).toMatch(
        new RegExp(`<p id="${id}"[^>]*>.*?<span>Preview</span></p>`, "s"),
      );
      expect(frame).toContain('aria-disabled="true"');
      // never dimmed, never hidden from a screen reader (RU-09)
      expect(frame).not.toMatch(/opacity|<button[^>]*aria-hidden/);
    }
  });

  it("writes the name of a brand as the one h1 of its head, the initials without a logo, the badge and the sector beside it", () => {
    const markup = html(
      createElement(BrandHero, {
        name: "Example Farms",
        badge: createElement("span", null, "Verified brand"),
        meta: "Food · Belgium",
      }),
    );
    expect(markup.match(/<h1 /g)).toHaveLength(1);
    expect(markup).toMatch(
      /<h1 tabindex="-1" class="[^"]*text-title-hero[^"]*">Example Farms<\/h1>/,
    );
    expect(markup).toMatch(/role="img" aria-label="Example Farms"/);
    expect(markup).toMatch(
      /<span>Verified brand<\/span><span>Food · Belgium<\/span>/,
    );
    // no ground of the landing under the member charter (G8)
    expect(markup).not.toContain("halo");
    expect(
      html(
        createElement(BrandHero, {
          name: "Example Farms",
          logo: "/logo.png",
          meta: "Food",
        }),
      ),
    ).toMatch(/<img src="\/logo\.png" alt="Example Farms"/);
  });
});

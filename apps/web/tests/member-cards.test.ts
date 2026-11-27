// RUB-T9 (docs/mvp/jalons/rub/annexe.md; 22-refonte-ux-ui/02b C31, C48, 02c; RUB-B §5): the photo card and the card of
// the feed. Server rendering, no browser: the names a screen reader reads, the one link of each card, the heart that is
// pressed and never green, the verified mark of the photo card in words only (RU-02, D88) and the dated badge elsewhere,
// no amount and no button on the feed card (D78), and the classes that carry the motion, the double ring and the
// forced-colours contour. The swipe, the arrows, the dots that follow and the pixels are the board's (e2e, RUB-T9 and
// RUB-AN2 09a).
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedCard, type FeedCardProps } from "@/components/member/ui/FeedCard";
import {
  PhotoCard,
  type PhotoCardProps,
} from "@/components/member/ui/PhotoCard";
import {
  PHOTO_ARROW_CLASSES,
  PHOTO_CARD_CLASSES,
  PHOTO_DOTS_CLASSES,
  photoBadgeClasses,
  photoDotClasses,
  photoHeartClasses,
  photoHeartIconClasses,
} from "@/components/member/ui/photo-card-classes";
import {
  FEED_CARD_CLASSES,
  FEED_CARD_CLOSED_CLASSES,
} from "@/components/member/ui/feed-card-classes";

const html = (element: ReactElement) => renderToStaticMarkup(element);
const noop = () => undefined;

const MEDIA = [
  { src: "/one.jpg", alt: "Visual 1 of 3: a kitchen" },
  { src: "/two.jpg", alt: "Visual 2 of 3: a dish" },
  { src: "/three.jpg", alt: "Visual 3 of 3: a market" },
];

const CAROUSEL = {
  label: "Visuals of the portfolio of Profile 93JMS4",
  previous: "Previous visual",
  next: "Next visual",
};

function photoCard(props: Partial<PhotoCardProps> = {}) {
  return html(
    createElement(PhotoCard, {
      variant: "search",
      carousel: CAROUSEL,
      href: "#profile",
      media: MEDIA,
      name: "Profile 93JMS4",
      lines: ["Seasonal plant cooking", "Cooking · Family · Belgium"],
      saveLabel: "Add Profile 93JMS4 to My selection",
      onToggleSave: noop,
      ...props,
    } as PhotoCardProps),
  );
}

function feedCard(props: Partial<FeedCardProps> = {}) {
  return html(
    createElement(FeedCard, {
      href: "#campaign",
      brand: "Example Farms",
      title: "Seasonal baskets: three winter recipes",
      due: { label: "Applications: 9 days" },
      meta: ["Instagram: 1 Reel · product sent", "Belgium · Cooking"],
      ...props,
    }),
  );
}

describe("RUB-T9: the photo card (C31)", () => {
  it("is an article named by its alias, the one link of the card, stretched over it", () => {
    const markup = photoCard();
    const id = /<article aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(id).toBeDefined();
    expect(markup.match(/<a /g)).toHaveLength(1);
    expect(markup).toMatch(
      new RegExp(
        `<a id="${id}" href="#profile" class="[^"]*after:inset-0[^"]*">Profile 93JMS4</a>`,
      ),
    );
    expect(markup).toContain('data-photo-card="search"');
  });

  it("puts the visuals of a search in a focusable named region with one slide each, the text of a picture saying what it shows, two named arrows (the previous one hidden at the start) and inert dots, one current", () => {
    const markup = photoCard();
    expect(markup).toMatch(
      /<div role="region" aria-label="Visuals of the portfolio of Profile 93JMS4" tabindex="0" data-photo-track=""/,
    );
    for (const { src, alt } of MEDIA) {
      expect(markup).toContain(`<img src="${src}" alt="${alt}"`);
    }
    expect(markup).toMatch(
      /<button type="button" aria-label="Previous visual" disabled="" data-photo-arrow="previous"/,
    );
    expect(markup).toMatch(
      /<button type="button" aria-label="Next visual" data-photo-arrow="next"/,
    );
    const dots =
      /<div aria-hidden="true" data-photo-dots=""[^>]*>(.*?)<\/div>/.exec(
        markup,
      )?.[1];
    expect(dots?.match(/<span/g)).toHaveLength(3);
    expect(dots?.match(/data-current=""/g)).toHaveLength(1);
  });

  it("presses a heart named by the screen, filled in primary text once saved with its transparent contour, never green, and that does not pop at its first drawing", () => {
    const idle = photoCard();
    expect(idle).toMatch(
      /<button type="button" aria-pressed="false" aria-label="Add Profile 93JMS4 to My selection" data-photo-heart=""/,
    );
    const saved = photoCard({
      saved: true,
      saveLabel: "Remove Profile 93JMS4 from My selection",
    });
    expect(saved).toMatch(
      /<button type="button" aria-pressed="true" aria-label="Remove Profile 93JMS4 from My selection"/,
    );
    expect(saved).not.toContain("data-pop");
    expect(photoHeartIconClasses(false, false)).toContain(
      "fill-(--effect-photo-scrim-soft)",
    );
    expect(photoHeartIconClasses(true, false)).toContain("fill-text-primary");
    expect(photoHeartIconClasses(true, true)).toContain("animate-pop");
    expect(photoHeartClasses(true)).toContain("outline-transparent");
    expect(photoHeartClasses(false)).not.toContain("outline-transparent");
    for (const classes of [
      photoHeartClasses(true),
      photoHeartIconClasses(true, true),
    ]) {
      expect(classes).not.toMatch(/brand|action-primary|success|green/);
    }
  });

  it("holds a heart whose request runs, and ties a refusal written in words to it", () => {
    expect(photoCard({ saving: true })).toMatch(
      /<button type="button" aria-pressed="false" aria-label="[^"]+" aria-disabled="true"/,
    );
    const refused = photoCard({ refusal: "My selection is full." });
    const id = /aria-describedby="([^"]+)"/.exec(refused)?.[1];
    expect(id).toBeDefined();
    expect(refused).toMatch(
      new RegExp(
        `<p id="${id}" data-photo-refusal=""[^>]*>My selection is full.</p>`,
      ),
    );
  });

  it("writes the verified mark as the blue icon and its words for a screen reader, beside the alias and never inside its link (RU-02, D88)", () => {
    const markup = photoCard({
      verified: { label: "Verified · Instagram", date: "12 November 2026" },
    });
    expect(markup).toMatch(
      /<\/a><span data-photo-verified="" class="[^"]*text-verified-text[^"]*"><svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span class="sr-only">Verified · Instagram 12 November 2026<\/span><\/span>/,
    );
    expect(photoCard()).not.toContain("data-photo-verified");
  });

  it("shows the first visual alone in a selection, without a track, arrows or dots, then its note; a card that leaves is inert", () => {
    const markup = photoCard({
      variant: "shortlist",
      carousel: undefined,
      saved: true,
      note: createElement("p", null, "NOTE"),
    } as Partial<PhotoCardProps>);
    expect(markup).toContain('data-photo-card="shortlist"');
    expect(markup).not.toContain("data-photo-track");
    expect(markup).not.toContain("data-photo-arrow");
    expect(markup).not.toContain("data-photo-dots");
    expect(markup.match(/<img /g)).toHaveLength(1);
    expect(markup).toContain('alt="Visual 1 of 3: a kitchen"');
    expect(markup).toContain("<p>NOTE</p>");
    expect(markup).not.toContain('data-leaving=""');
    const leaving = photoCard({ leaving: true });
    expect(leaving).toMatch(/<article[^>]*data-leaving=""[^>]*inert=""/);
  });

  it("draws the ground of the photo without a visual, and names a visual whose source is missing", () => {
    const none = photoCard({ media: [] });
    expect(none).not.toContain("<img");
    expect(none).not.toContain("data-photo-track");
    expect(none).toMatch(/<div aria-hidden="true" class="[^"]*aspect-photo/);
    const pending = photoCard({ media: [{ alt: "Visual 1 of 1: a dish" }] });
    expect(pending).toMatch(
      /<div role="img" aria-label="Visual 1 of 1: a dish"/,
    );
  });

  it("carries its motion in its classes: the leave by opacity and scale, the dots by width and colour, the arrows by opacity and hidden without hover, the double ring on the controls", () => {
    expect(PHOTO_CARD_CLASSES).toContain("transition-[opacity,scale]");
    expect(PHOTO_CARD_CLASSES).toContain("data-leaving:opacity-0");
    expect(PHOTO_CARD_CLASSES).toContain(
      "motion-safe:data-leaving:scale-(--scale-leave)",
    );
    expect(photoDotClasses(true)).toContain("w-4 bg-text-primary");
    expect(photoDotClasses(false)).toContain(
      "w-(--size-segment-bar) bg-text-secondary",
    );
    expect(photoDotClasses(false)).toContain(
      "transition-[width,background-color]",
    );
    expect(PHOTO_DOTS_CLASSES).toContain("filter-(--effect-photo-shadow)");
    expect(PHOTO_ARROW_CLASSES).toContain("transition-opacity");
    expect(PHOTO_ARROW_CLASSES).toContain("[@media(hover:none)]:hidden");
    for (const classes of [PHOTO_ARROW_CLASSES, photoHeartClasses(false)]) {
      expect(classes).toContain("var(--color-surface-page)");
      expect(classes).toContain("focus-visible:outline-focus-ring");
    }
    expect(photoBadgeClasses("dark")).toContain(
      "bg-(--effect-photo-scrim-strong)",
    );
    expect(photoBadgeClasses("light")).toContain("bg-surface-inverse");
    for (const classes of [PHOTO_CARD_CLASSES, PHOTO_ARROW_CLASSES]) {
      expect(classes).not.toContain("transition-all");
    }
  });
});

describe("RUB-T9: the card of the feed (C48)", () => {
  it("is an article named by its title, its one link; no button, no amount; the dated badge whole; the deadline by its icon and its words; a closed card links nowhere and stays flat", () => {
    const markup = feedCard({
      logo: "/logo.jpg",
      verified: {
        label: "Verified",
        network: "Instagram",
        date: "3 November 2026",
      },
      due: { label: "Applications: 2 days left", soon: true },
    });
    const id = /<article aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(markup).toMatch(
      new RegExp(
        `<p id="${id}"[^>]*><a href="#campaign"[^>]*>Seasonal baskets: three winter recipes</a></p>`,
      ),
    );
    expect(markup.match(/<a /g)).toHaveLength(1);
    expect(markup).not.toContain("<button");
    expect(markup).not.toMatch(/[€$£]|\bEUR\b/);
    expect(markup).toContain("Verified · Instagram · 3 November 2026");
    expect(markup).toMatch(
      /<span aria-hidden="true"><span class="[^"]*"><img src="\/logo.jpg"/,
    );
    expect(markup).toMatch(
      /<p data-feed-due="soon" class="[^"]*text-feedback-warning-text[^"]*"><svg[^>]*lucide-triangle-alert/,
    );
    expect(feedCard()).toMatch(
      /<p data-feed-due="" class="[^"]*"><svg[^>]*lucide-clock/,
    );
    const closed = feedCard({ closed: "Applications closed" });
    expect(closed).not.toContain("<a ");
    expect(closed).not.toContain("data-feed-due");
    expect(closed).toContain(">Applications closed</span>");
    expect(closed).toContain('data-closed=""');
    expect(FEED_CARD_CLASSES).toContain(
      "motion-safe:hover:translate-y-(--translate-lift)",
    );
    expect(FEED_CARD_CLOSED_CLASSES).not.toContain("hover:");
  });
});

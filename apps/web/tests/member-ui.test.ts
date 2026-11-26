// The primitives of the connected spaces (docs/mvp/20 §11.8; DS-5): what each one renders, and the
// rules that no class check sees: one h1, the role and the verified badge written, the counter read
// in words, motion under motion-safe: only. Server rendering, no browser (the e2e look at pixels).
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buttonClasses,
  type ButtonVariant,
} from "@/components/member/ui/button-classes";
import { counterText } from "@/components/member/ui/counter";
import { CounterBadge } from "@/components/member/ui/CounterBadge";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
  memberControlClasses,
  memberTextAreaClasses,
} from "@/components/member/ui/field-classes";
import { ActionLink } from "@/components/member/ui/ActionLink";
import { Button } from "@/components/member/ui/Button";
import { Card } from "@/components/member/ui/Card";
import {
  cardClasses,
  MEMBER_CARD_CLASSES,
} from "@/components/member/ui/card-classes";
import { CardActions } from "@/components/member/ui/CardActions";
import { InnerPanel } from "@/components/member/ui/InnerPanel";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { RoleBadge } from "@/components/member/ui/RoleBadge";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { YesNoField } from "@/components/member/ui/YesNoField";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

describe("buttons (20 §11.8)", () => {
  const variants: ButtonVariant[] = ["primary", "secondary", "danger", "text"];

  it("are pills with a named transition, zoomed and pressed under motion-safe: and never when aria-disabled, the text button still", () => {
    for (const variant of variants) {
      const classes = buttonClasses(variant);
      expect(classes, variant).toContain("transition-lift");
      expect(classes, variant).not.toContain("transition-all");
      expect(classes, variant).toContain("aria-disabled:bg-action-disabled-bg");
    }
    for (const variant of ["primary", "secondary", "danger"] as const) {
      const classes = buttonClasses(variant);
      expect(classes, variant).toContain(
        "motion-safe:not-aria-disabled:hover:scale-(--scale-hover)",
      );
      expect(classes, variant).toContain(
        "motion-safe:not-aria-disabled:active:scale-(--scale-press)",
      );
    }
    expect(buttonClasses("text")).not.toContain("scale-");
    for (const variant of ["primary", "secondary", "danger"] as const) {
      expect(buttonClasses(variant)).toContain("rounded-pill");
    }
  });

  it("gives the glow to the primary button alone, and takes it away when disabled", () => {
    const primary = buttonClasses("primary");
    expect(primary).toContain("shadow-(--effect-action-glow)");
    expect(primary).toContain(
      "not-aria-disabled:hover:shadow-(--effect-action-glow-hover)",
    );
    expect(primary).toContain("aria-disabled:shadow-none");
    for (const variant of ["secondary", "danger", "text"] as const) {
      expect(buttonClasses(variant), variant).not.toContain("shadow-");
    }
  });

  it("renders a button that never submits by chance, and stretches only on request", () => {
    const plain = html(createElement(Button, null, "Save"));
    expect(plain).toContain('type="button"');
    expect(plain).not.toContain("w-full");
    const stretched = html(
      createElement(
        Button,
        { type: "submit", block: true, "aria-disabled": true },
        "Send",
      ),
    );
    expect(stretched).toContain('type="submit"');
    expect(stretched).toContain("w-full");
    expect(stretched).toContain('aria-disabled="true"');
  });
});

describe("counter (17 §2.2)", () => {
  it("shows nothing at zero, the number up to nine and 9+ above", () => {
    expect([0, -1, Number.NaN].map(counterText)).toEqual([null, null, null]);
    expect([1, 9, 10, 250].map(counterText)).toEqual(["1", "9", "9+", "9+"]);
  });

  it("hides the digits from a screen reader and reads the translated label instead", () => {
    const markup = html(
      createElement(CounterBadge, { count: 12, label: "12 new items" }),
    );
    expect(markup).toContain('<span aria-hidden="true">9+</span>');
    expect(markup).toContain('<span class="sr-only">12 new items</span>');
    expect(html(createElement(CounterBadge, { count: 0, label: "none" }))).toBe(
      "",
    );
  });
});

describe("page header (20 §11.8)", () => {
  it("renders exactly one h1 and no glow layer of its own, and the action beside it", () => {
    const markup = html(
      createElement(PageHeader, {
        title: "Campaigns",
        above: "Home",
        actions: createElement(Button, null, "New"),
      }),
    );
    expect(markup.match(/<h1[ >]/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<h[2-6][ >]/);
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toContain("bg-header-glow");
    expect(markup).toContain("Campaigns");
    expect(markup).toContain("New");
  });
});

describe("badges and notices", () => {
  it("writes the role next to its dot, which is decorative", () => {
    const markup = html(
      createElement(RoleBadge, { role: "creator", label: "Creator" }),
    );
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("bg-role-creator");
    expect(markup).toContain("Creator");
    expect(
      html(createElement(RoleBadge, { role: "advertiser", label: "Brand" })),
    ).toContain("bg-role-advertiser");
  });

  it("writes the verified badge as label, network and date, with a decorative icon (F3)", () => {
    const markup = html(
      createElement(VerifiedBadge, {
        label: "Verified",
        network: "Instagram",
        date: "October 2026",
      }),
    );
    expect(markup).toContain("Verified · Instagram · October 2026");
    expect(markup).toContain("text-verified-text");
    expect(markup).toContain("border-verified-border");
    expect(markup).toContain("bg-verified-bg");
    expect(markup).toMatch(/font-display(?=[ "])[^"]*font-bold/);
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("writes the verified badge as the whole sentence of RG93 when the caller gives one, same look (L2E 18, EC-L2E-9)", () => {
    const markup = html(
      createElement(VerifiedBadge, {
        text: "Compte vérifié — Instagram, le 3 mars 2026",
      }),
    );
    expect(markup).toContain("Compte vérifié — Instagram, le 3 mars 2026");
    expect(markup).not.toContain(" · ");
    expect(markup).toContain("text-verified-text");
    expect(markup).toContain("bg-verified-bg");
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("fills a status badge with the opaque ground of its own family, never green (RK-11)", () => {
    const grounds = {
      neutral: "bg-surface-raised",
      success: "bg-feedback-success-bg",
      warning: "bg-feedback-warning-bg",
      error: "bg-badge-error-bg",
      info: "bg-feedback-info-bg",
    } as const;
    for (const [tone, ground] of Object.entries(grounds) as [
      keyof typeof grounds,
      string,
    ][]) {
      const markup = html(createElement(StatusBadge, { tone }, "Accepted"));
      expect(markup, tone).toContain("Accepted");
      expect(markup, tone).toContain("rounded-pill");
      expect(markup, tone).toContain(ground);
      expect(markup, tone).toMatch(/font-display(?=[ "])[^"]*font-bold/);
      expect(markup, tone).not.toMatch(/bg-(?:brand|action-primary)/);
    }
  });

  it("announces a notice as a status with its family icon, or not at all on request", () => {
    for (const [tone, icon] of [
      ["success", "lucide-circle-check"],
      ["warning", "lucide-triangle-alert"],
      ["info", "lucide-info"],
    ] as const) {
      const markup = html(createElement(Notice, { tone }, "Text"));
      expect(markup, tone).toContain('role="status"');
      expect(markup, tone).toContain(icon);
      expect(markup, tone).toContain('aria-hidden="true"');
    }
    expect(
      html(createElement(Notice, { tone: "info", announce: false }, "Text")),
    ).not.toContain("role=");
  });
});

describe("locked fields (L3C-X3)", () => {
  it("keeps a locked radio disabled and checked, redrawn as a shape and never dimmed, its value still readable", () => {
    const markup = html(
      createElement(YesNoField, {
        name: "remote",
        label: "Remote",
        value: true,
        onChange: () => undefined,
        yesLabel: "Yes",
        noLabel: "No",
        disabled: true,
      }),
    );
    const radios = markup.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
    expect(radios).toHaveLength(2);
    expect(radios.filter((radio) => / checked=""/.test(radio))).toHaveLength(1);
    for (const radio of radios) {
      expect(radio).toContain("disabled");
      expect(radio).not.toMatch(/readonly|aria-readonly|aria-disabled/);
    }
    const classes = [
      memberChoiceInputClasses(),
      memberChoiceInputClasses(true),
      memberControlClasses(false),
      memberTextAreaClasses(false),
    ].join(" ");
    expect(classes).not.toMatch(/opacity-(?!100)/);
    expect(classes).not.toContain("text-disabled");
    expect(memberChoiceInputClasses()).toContain("disabled:appearance-none");
    expect(memberChoiceInputClasses()).toContain(
      "disabled:checked:bg-text-secondary",
    );
    expect(memberChoiceInputClasses()).toContain(
      "disabled:border-border-strong",
    );
    expect(memberControlClasses(false)).toContain(
      "disabled:text-text-secondary",
    );
    expect(memberChoiceRowClasses()).toContain("has-disabled:cursor-default");
  });
});

// RUB-T2 (docs/mvp/jalons/rub/annexe.md; line 02): C04, C05, C10, C11 and C12, by what they render. Server
// rendering; the handlers are called as functions, the pixels, the hover and the motion are the board's (RUB-AN2).
describe("RUB-T2: the button, its sizes and its states (C10)", () => {
  it("draws the four sizes by their height token, the two small ones reaching 44 px by a transparent pseudo-element, the text button keeping its own", () => {
    expect(buttonClasses("primary", "sm")).toContain("min-h-(--size-tag)");
    expect(buttonClasses("primary", "bar")).toContain("min-h-(--size-pill)");
    expect(buttonClasses("primary", "md")).toContain(
      "min-h-(--size-button-md)",
    );
    expect(buttonClasses("primary", "lg")).toContain(
      "min-h-(--size-button-lg)",
    );
    for (const size of ["sm", "bar"] as const) {
      const classes = buttonClasses("secondary", size);
      expect(classes, size).toContain("before:h-(--size-touch-target)");
      expect(classes, size).toContain("py-0");
    }
    for (const size of ["md", "lg"] as const) {
      expect(buttonClasses("secondary", size), size).not.toContain("before:");
    }
    expect(buttonClasses("text", "sm")).toBe(buttonClasses("text", "lg"));
    expect(buttonClasses("text")).toContain("min-h-(--size-touch-target)");
  });

  it("makes a busy button unavailable and busy, keeps its width by stacking both labels, and runs nothing", () => {
    const calls: string[] = [];
    const markup = html(
      createElement(
        Button,
        { busy: true, busyLabel: "Sending", onClick: () => calls.push("x") },
        "Send",
      ),
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Sending");
    expect(markup).toMatch(/<span class="[^"]*invisible[^"]*">Send<\/span>/);
    const element = Button({
      busy: true,
      onClick: () => calls.push("click"),
      children: "Send",
    }) as ReactElement<{
      onClick: (event: { preventDefault: () => void }) => void;
    }>;
    let prevented = false;
    element.props.onClick({
      preventDefault: () => {
        prevented = true;
      },
    });
    expect(prevented).toBe(true);
    expect(calls).toEqual([]);
    const idle = html(createElement(Button, { busyLabel: "Sending" }, "Send"));
    expect(idle).not.toContain("aria-busy");
    expect(idle).toMatch(
      /<span aria-hidden="true" class="[^"]*invisible[^"]*">Sending<\/span>/,
    );
  });

  it("ties an unavailable button to the text that says why, keeping the ids it already had", () => {
    const markup = html(
      createElement(
        Button,
        { disabledReason: "why", "aria-describedby": "hint" },
        "Continue",
      ),
    );
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain('aria-describedby="hint why"');
    expect(markup).not.toMatch(/ disabled[ =>]/);
    expect(html(createElement(Button, null, "Continue"))).not.toContain(
      "aria-describedby",
    );
  });

  it("says pressed or not by aria-pressed, and the added state by a fading check and a calmer contour of the secondary button alone", () => {
    expect(html(createElement(Button, { pressed: true }, "On"))).toContain(
      'aria-pressed="true"',
    );
    expect(html(createElement(Button, { pressed: false }, "Off"))).toContain(
      'aria-pressed="false"',
    );
    expect(html(createElement(Button, null, "Plain"))).not.toContain(
      "aria-pressed",
    );
    const added = html(
      createElement(Button, { variant: "secondary", added: true }, "Added"),
    );
    expect(added).toMatch(/<svg[^>]*animate-fade-in[^>]*aria-hidden="true"/);
    const calm = buttonClasses("secondary", "md", true);
    expect(calm).toContain("border-border-default");
    expect(calm.split(" ")).not.toContain("border-action-secondary-border");
    expect(buttonClasses("secondary").split(" ")).toContain(
      "border-action-secondary-border",
    );
    expect(buttonClasses("primary", "md", true)).toBe(buttonClasses("primary"));
  });

  it("renders a link of the same look when given an href, unavailable by aria-disabled and without a type", () => {
    const link = html(createElement(Button, { href: "/next" }, "Go"));
    expect(link).toMatch(/^<a href="\/next"/);
    expect(link).not.toContain("type=");
    expect(link).toContain(buttonClasses("primary"));
    const busy = html(
      createElement(Button, { href: "/next", busy: true }, "Go"),
    );
    expect(busy).toContain('aria-disabled="true"');
    expect(busy).toContain('aria-busy="true"');
  });
});

describe("RUB-T2: the card, its variants and its link (C04)", () => {
  it("keeps the card of today as it is and draws the others by their padding alone", () => {
    expect(cardClasses("default")).toBe(MEMBER_CARD_CLASSES);
    expect(html(createElement(Card, null, "Text"))).toBe(
      `<div class="${MEMBER_CARD_CLASSES}">Text</div>`,
    );
    expect(cardClasses("compact")).toContain("p-4");
    expect(cardClasses("box")).toContain("p-5");
    for (const variant of ["compact", "box"] as const) {
      expect(cardClasses(variant), variant).toContain("bg-surface-card");
      expect(cardClasses(variant), variant).toContain("border-border-default");
      expect(cardClasses(variant), variant).not.toContain("p-inset-card");
    }
  });

  it("makes the whole card the click zone of one link, stretched, lifting on hover under motion-safe: only", () => {
    const markup = html(
      createElement(
        Card,
        { variant: "link", href: "/campaign", title: "Spring", as: "li" },
        "Body",
      ),
    );
    expect(markup).toMatch(/^<li class="/);
    expect(markup.match(/<a /g)).toHaveLength(1);
    expect(markup).not.toContain("<button");
    expect(markup).toContain('<a href="/campaign"');
    expect(markup).toContain("after:absolute after:inset-0");
    expect(markup).toContain(">Spring</a>");
    const classes = cardClasses("link");
    expect(classes).toContain("border-border-strong");
    expect(classes).toContain("hover:bg-surface-raised");
    expect(classes).toContain(
      "motion-safe:hover:translate-y-(--translate-lift)",
    );
    expect(classes).not.toMatch(/(?<!motion-safe:)hover:translate-y/);
  });
});

describe("RUB-T2: the inner panel and the actions of a card (C05, C12)", () => {
  it("raises its surface without a contour and draws each variant by its parts", () => {
    const base = html(createElement(InnerPanel, { title: "Title" }, "Body"));
    expect(base).toContain("bg-surface-raised");
    expect(base).toContain("rounded-md");
    expect(base).not.toMatch(/border-/);
    expect(base).toContain("animate-rise-in");
    expect(base).toContain(">Title</p>");
    const readonly = html(
      createElement(
        InnerPanel,
        {
          variant: "readonly",
          title: "Email",
          action: createElement("a", { href: "/edit" }, "Edit"),
        },
        "a@example.test",
      ),
    );
    expect(readonly.indexOf("Email")).toBeLessThan(
      readonly.indexOf("a@example.test"),
    );
    expect(readonly.indexOf("a@example.test")).toBeLessThan(
      readonly.indexOf("Edit"),
    );
    expect(readonly).toContain("px-4 py-3");
    const preview = html(
      createElement(
        InnerPanel,
        { variant: "preview", title: "Preview", icon: createElement("svg") },
        "Body",
      ),
    );
    expect(preview).toContain("uppercase");
    expect(preview).toMatch(/<span aria-hidden="true"[^>]*><svg/);
    expect(
      html(createElement(InnerPanel, { variant: "form" }, "Body")),
    ).toContain("flex-col");
  });

  it("wraps the actions 12 px apart and stretches them under 480 px on request alone", () => {
    const plain = html(createElement(CardActions, null, "Body"));
    expect(plain).toContain("flex-wrap");
    expect(plain).toContain("gap-3");
    expect(plain).not.toContain("max-sm:");
    const stretched = html(
      createElement(CardActions, { stretch: true }, "Body"),
    );
    expect(stretched).toContain("max-sm:*:w-full");
    expect(stretched.split(" ")).not.toContain("w-full");
  });
});

describe("RUB-T2: the link of action (C11)", () => {
  it("underlines the inline link, adds a chevron nudging under motion-safe: to the go link and a pressed heart to the save link", () => {
    const inline = html(createElement(ActionLink, { href: "/back" }, "Back"));
    expect(inline).toMatch(/^<a href="\/back"/);
    expect(inline).toContain("underline");
    expect(inline).toContain("before:min-h-(--size-touch-target)");
    expect(inline).toContain("before:min-w-(--size-touch-target)");
    const go = html(
      createElement(ActionLink, { variant: "go", href: "/detail" }, "Detail"),
    );
    expect(go).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(go).toContain("motion-safe:group-hover:translate-x-(--size-nudge)");
    expect(go).not.toMatch(/(?<!motion-safe:)group-hover:translate-x/);
    expect(go).toContain("size-(--size-icon-md)");
    expect(
      html(
        createElement(
          ActionLink,
          { variant: "go", dense: true, href: "/detail" },
          "Detail",
        ),
      ),
    ).toContain("size-(--size-icon-sm)");
    const save = html(
      createElement(ActionLink, { variant: "save", pressed: true }, "Saved"),
    );
    expect(save).toMatch(/^<button type="button"[^>]*aria-pressed="true"/);
    expect(save).toContain("group-aria-pressed:fill-current");
    expect(
      html(createElement(ActionLink, { variant: "save" }, "Save")),
    ).not.toContain(" aria-pressed=");
  });

  it("opens an external link in a new tab and says so after its label, in the text it is given", () => {
    const external = html(
      createElement(
        ActionLink,
        { href: "https://example.test", external: "(new tab)" },
        "Terms",
      ),
    );
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
    expect(external).toContain('<span class="sr-only"> (new tab)</span>');
    expect(
      html(createElement(ActionLink, { href: "/terms" }, "Terms")),
    ).not.toContain("target=");
  });
});

// The primitives of the connected spaces (docs/mvp/20 §11.8; DS-5): what each one renders, and the
// rules that no class check sees: one h1, the role and the verified badge written, the counter read
// in words, motion under motion-safe: only. Server rendering, no browser (the e2e look at pixels).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  memberButtonClasses,
  type MemberButtonVariant,
} from "@/components/member/ui/button-classes";
import { counterText } from "@/components/member/ui/counter";
import { CounterBadge } from "@/components/member/ui/CounterBadge";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { RoleBadge } from "@/components/member/ui/RoleBadge";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

describe("buttons (20 §11.8)", () => {
  const variants: MemberButtonVariant[] = [
    "primary",
    "secondary",
    "danger",
    "text",
  ];

  it("are pills with a named transition, zoomed under motion-safe: and never when aria-disabled", () => {
    for (const variant of variants) {
      const classes = memberButtonClasses(variant);
      expect(classes, variant).toContain("transition-lift");
      expect(classes, variant).not.toContain("transition-all");
      expect(classes, variant).toContain(
        "motion-safe:not-aria-disabled:hover:scale-(--scale-hover)",
      );
      expect(classes, variant).toContain("aria-disabled:bg-action-disabled-bg");
    }
    for (const variant of ["primary", "secondary", "danger"] as const) {
      expect(memberButtonClasses(variant)).toContain("rounded-pill");
    }
  });

  it("gives the glow to the primary button alone, and takes it away when disabled", () => {
    const primary = memberButtonClasses("primary");
    expect(primary).toContain("shadow-(--effect-action-glow)");
    expect(primary).toContain(
      "not-aria-disabled:hover:shadow-(--effect-action-glow-hover)",
    );
    expect(primary).toContain("aria-disabled:shadow-none");
    for (const variant of ["secondary", "danger", "text"] as const) {
      expect(memberButtonClasses(variant), variant).not.toContain("shadow-");
    }
  });

  it("renders a button that never submits by chance, and stretches only on request", () => {
    const plain = html(createElement(MemberButton, null, "Save"));
    expect(plain).toContain('type="button"');
    expect(plain).not.toContain("w-full");
    const stretched = html(
      createElement(
        MemberButton,
        { type: "submit", fullWidth: true, "aria-disabled": true },
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
  it("renders exactly one h1 and a decorative glow, and the action beside it", () => {
    const markup = html(
      createElement(PageHeader, {
        title: "Campaigns",
        above: "Home",
        actions: createElement(MemberButton, null, "New"),
      }),
    );
    expect(markup.match(/<h1[ >]/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<h[2-6][ >]/);
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toMatch(/aria-hidden="true"[^>]*bg-header-glow/);
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
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("outlines a status badge and never fills it", () => {
    for (const tone of [
      "neutral",
      "success",
      "warning",
      "error",
      "info",
    ] as const) {
      const markup = html(createElement(StatusBadge, { tone }, "Accepted"));
      expect(markup, tone).toContain("Accepted");
      expect(markup, tone).toContain("rounded-pill");
      expect(markup, tone).not.toMatch(/(?:^|[ "])bg-/);
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

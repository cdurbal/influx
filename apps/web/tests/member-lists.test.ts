// RUB-T4 (docs/mvp/jalons/rub/annexe.md; 22-refonte-ux-ui/02a C06 to C09): the list of rows, the list of
// properties, the state message and the skeleton. Server rendering, no browser: what each one writes, the
// roles and names a screen reader reads, the classes that carry the measures (the e2e look at pixels).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/member/ui/EmptyState";
import { PropertyList } from "@/components/member/ui/PropertyList";
import { RowList, type RowListItem } from "@/components/member/ui/RowList";
import {
  rowHasChevron,
  rowListClasses,
  rowParts,
  type RowListVariant,
} from "@/components/member/ui/row-list-classes";
import { Skeleton, SKELETON_DELAY_MS } from "@/components/member/ui/Skeleton";
import {
  propertyListClasses,
  type PropertyLabelWidth,
} from "@/components/member/ui/property-list-classes";
import type { EmptyStateKind } from "@/components/member/ui/empty-state-classes";
import type { SkeletonShape } from "@/components/member/ui/skeleton-classes";
import { CheckIcon } from "@/components/ui/icons";
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);
const VARIANTS: readonly RowListVariant[] = [
  "campaign",
  "feed",
  "lists",
  "tasks",
  "hub",
  "sessions",
  "todo",
  "mini",
];
const ROW: RowListItem = {
  id: "a",
  href: "https://example.test/a",
  title: "Coffret de fêtes",
};
const SHAPE = { meta: false, end: false, sub: false };
const AT_REST = { linked: true, current: false };
describe("RUB-T4: the list of rows, its eight variants (C06)", () => {
  it("is a `ul` named by its label, one `li` per row, whatever the variant (the eight of EC-RUB-2)", () => {
    expect(VARIANTS).toHaveLength(8);
    for (const variant of VARIANTS) {
      const markup = html(
        createElement(RowList, {
          variant: variant,
          label: "Vos campagnes",
          items: [ROW, { ...ROW, id: "b" }],
        }),
      );
      expect(markup, variant).toMatch(/^<ul aria-label="Vos campagnes"/);
      expect(markup.match(/<li /g), variant).toHaveLength(2);
      expect(markup, variant).not.toContain("<nav");
      expect(rowListClasses(variant), variant).toContain(
        "border-t-(length:--border-width-thin)",
      );
    }
  });
  it("stretches the link of the title over the row, its ring drawn inside it, and stands an action above the link", () => {
    const markup = html(
      createElement(RowList, {
        variant: "sessions",
        label: "Sessions",
        items: [
          {
            ...ROW,
            action: createElement(
              "button",
              { type: "button" },
              "D\u00E9connecter",
            ),
          },
        ],
      }),
    );
    expect(markup).toContain("after:absolute after:inset-0");
    expect(markup).toContain(
      "focus-visible:after:outline-offset-(--focus-ring-offset-inset)",
    );
    expect(markup).toContain("z-(--z-raised)");
    expect(markup.indexOf("<a ")).toBeLessThan(markup.indexOf("<button"));
  });
  it("gives the row 60 px at least, a hairline between rows, and the surface-raised hover of a linked row alone", () => {
    const linked = rowParts("feed", SHAPE, AT_REST).row;
    expect(linked).toContain(
      "min-h-[calc(var(--size-touch-target)+var(--spacing-4))]",
    );
    expect(linked).toContain("border-border-subtle");
    expect(linked).toContain("hover:bg-surface-raised");
    expect(linked).toContain("transition-colors");
    expect(
      rowParts("feed", SHAPE, { linked: false, current: false }).row,
    ).not.toContain("hover:");
    expect(rowParts("tasks", SHAPE, AT_REST).row).toContain(
      "border-border-default",
    );
    expect(rowListClasses("tasks")).toContain("border-border-default");
  });
  it("draws a chevron on a row that leads somewhere, in the four variants that have one, and on no other", () => {
    const withChevron = VARIANTS.filter((variant) => rowHasChevron(variant));
    expect(withChevron).toEqual(["campaign", "feed", "lists", "hub"]);
    expect(
      html(
        createElement(RowList, {
          variant: "hub",
          label: "Compte",
          items: [ROW],
        }),
      ),
    ).toContain("<svg");
    expect(
      html(
        createElement(RowList, {
          variant: "hub",
          label: "Compte",
          items: [{ id: "a", title: "Sans lien" }],
        }),
      ),
    ).not.toContain("<svg");
    expect(
      html(
        createElement(RowList, {
          variant: "tasks",
          label: "T\u00E2ches",
          items: [ROW],
        }),
      ),
    ).not.toContain("<svg");
  });
  it("names the columns of a campaign row by the fields it shows: date, state alone, or the sentence alone", () => {
    const full = rowParts(
      "campaign",
      { meta: true, end: true, sub: false },
      AT_REST,
    );
    expect(full.row).toContain("md:grid-cols-(--grid-campaign-row)");
    expect(full.meta).toBe("md:col-start-2");
    expect(full.end).toBe("md:col-start-3");
    expect(full.chevron).toContain("md:col-start-4");
    const stateOnly = rowParts(
      "campaign",
      { meta: true, end: false, sub: false },
      AT_REST,
    );
    expect(stateOnly.row).toContain("md:grid-cols-[minmax(0,1fr)_auto_auto]");
    expect(stateOnly.chevron).toContain("md:col-start-3");
    const sentence = rowParts(
      "campaign",
      { meta: false, end: false, sub: true },
      AT_REST,
    );
    expect(sentence.row).not.toContain("md:grid");
    expect(rowParts("campaign", SHAPE, AT_REST).body).toContain("md:contents");
  });
  it("stacks the variants under their widths: 768 for the campaign, 640 for the tasks and the thumbnails, 480 for the sessions", () => {
    expect(rowParts("campaign", SHAPE, AT_REST).trail).toContain("md:contents");
    expect(rowParts("tasks", SHAPE, AT_REST).row).toContain("flex-col");
    expect(rowParts("tasks", SHAPE, AT_REST).row).toContain("form:flex-row");
    expect(rowParts("lists", SHAPE, AT_REST).media).toContain(
      "max-form:hidden",
    );
    expect(rowParts("sessions", SHAPE, AT_REST).row).toContain("flex-wrap");
    expect(rowParts("sessions", SHAPE, AT_REST).row).toContain(
      "sm:flex-nowrap",
    );
    expect(rowParts("sessions", SHAPE, AT_REST).action).toContain(
      "max-sm:basis-full",
    );
  });
  it("sets the dense rows of the backoffice at 36 px and 14 px, the mini aligned to the top when it has a sentence", () => {
    const mini = rowParts("mini", SHAPE, AT_REST);
    expect(mini.row).toContain("min-h-(--size-tag)");
    expect(mini.row).toContain("items-center");
    expect(mini.title).toContain("text-sm");
    expect(rowParts("mini", { ...SHAPE, sub: true }, AT_REST).row).toContain(
      "items-start",
    );
    expect(rowParts("todo", SHAPE, AT_REST).row).not.toContain("min-h-");
    expect(rowParts("todo", SHAPE, AT_REST).sub).toContain("text-xs");
    expect(rowParts("feed", SHAPE, AT_REST).title).toContain(
      "text-md font-bold",
    );
  });
  it("marks the current row by `aria-current=true`, a ground and a transparent contour that forced colours draw (AP1)", () => {
    const markup = html(
      createElement(RowList, {
        variant: "tasks",
        label: "\u00C9tapes",
        items: [{ ...ROW, current: true }],
      }),
    );
    expect(markup).toContain('aria-current="true"');
    expect(markup).not.toContain('aria-current="page"');
    const row = rowParts("tasks", SHAPE, { linked: true, current: true }).row;
    expect(row).toContain("bg-surface-hover");
    expect(row).toContain("outline-transparent");
    expect(row).toContain("outline-(length:--border-width-thick)");
    expect(row).not.toContain("hover:bg-surface-raised");
    // A row without a link carries `aria-current` itself.
    expect(
      html(
        createElement(RowList, {
          variant: "tasks",
          label: "\u00C9tapes",
          items: [{ id: "a", title: "Sans lien", current: true }],
        }),
      ),
    ).toMatch(/<li aria-current="true"/);
  });
  it("marks a tone by a shape before the title, the words staying the caller's", () => {
    const done = html(
      createElement(RowList, {
        variant: "feed",
        label: "L",
        items: [{ ...ROW, tone: "done", meta: "Faite" }],
      }),
    );
    expect(done).toContain("text-feedback-success-icon");
    expect(done).toContain('aria-hidden="true"');
    expect(done).toContain("Faite");
    expect(
      html(
        createElement(RowList, {
          variant: "feed",
          label: "L",
          items: [{ ...ROW, tone: "attention" }],
        }),
      ),
    ).toContain("text-feedback-warning-icon");
    expect(
      html(
        createElement(RowList, { variant: "feed", label: "L", items: [ROW] }),
      ),
    ).not.toContain("feedback-");
  });
});
describe("RUB-T4: the list of properties (C07)", () => {
  const LINES = [
    { label: "Pays", value: "France" },
    {
      label: "Site",
      value: "example.test",
      mark: createElement("b", null, "Modifi\u00E9"),
    },
    { label: "Présentation", value: "", empty: true },
    { label: "Réseaux", value: "2", sub: "Instagram, TikTok" },
  ];
  it("is a valid `dl`: its only children are labels and values, in pairs, in the order given", () => {
    const markup = html(createElement(PropertyList, { items: LINES }));
    const inner = markup.replace(/^<dl[^>]*>/, "").replace(/<\/dl>$/, "");
    const rest = inner
      .replace(/<dt[^>]*>[\s\S]*?<\/dt>/g, "")
      .replace(/<dd[^>]*>[\s\S]*?<\/dd>/g, "");
    expect(rest).toBe("");
    expect(markup.match(/<dt/g)).toHaveLength(4);
    expect(markup.match(/<dd/g)).toHaveLength(4);
    expect(markup.indexOf("Pays")).toBeLessThan(markup.indexOf("Réseaux"));
  });
  it("writes an empty value in the tertiary text, as the caller says it, and a filled one in the primary text", () => {
    const markup = html(
      createElement(PropertyList, {
        items: LINES,
        emptyLabel: "Non renseign\u00E9",
      }),
    );
    expect(markup).toMatch(
      /<dd class="[^"]*text-text-tertiary[^"]*"><span[^>]*>Non renseigné<\/span>/,
    );
    expect(markup).toMatch(
      /<dd class="[^"]*text-text-primary[^"]*"><span[^>]*>France<\/span>/,
    );
    expect(html(createElement(PropertyList, { items: LINES }))).not.toContain(
      "Non renseigné",
    );
  });
  it("draws the label in the secondary text at weight 600, and puts the mark beside the value and the sub line under it", () => {
    const markup = html(createElement(PropertyList, { items: LINES }));
    expect(markup).toContain(
      '<dt class="font-semibold text-text-secondary">Pays</dt>',
    );
    expect(markup).toContain("<b>Modifié</b>");
    expect(markup).toContain("basis-full");
    expect(markup).toContain("Instagram, TikTok");
  });
  it("takes the width of its labels from the tokens, one per role, the standard one by default", () => {
    const widths: Record<PropertyLabelWidth, string> = {
      standard: "--size-property-label)",
      summary: "--size-property-label-summary)",
      reading: "--size-property-label-reading)",
      compact: "--size-property-label-reading-compact)",
      terms: "--size-property-label-terms)",
    };
    for (const [name, token] of Object.entries(widths)) {
      expect(
        propertyListClasses(undefined, name as PropertyLabelWidth),
        name,
      ).toContain(token);
    }
    expect(propertyListClasses(undefined, undefined)).toContain(
      "--size-property-label)",
    );
  });
  it("sets 14 px with 8 by 24 of gap by default, 16 px for the reading sheet and 12 px with 8 by 12 for the dense column", () => {
    expect(propertyListClasses(undefined, undefined)).toContain("text-sm");
    expect(propertyListClasses(undefined, undefined)).toContain(
      "gap-x-5 gap-y-2",
    );
    expect(propertyListClasses("md", undefined)).toContain("text-md");
    expect(propertyListClasses("xs", undefined)).toContain("text-xs");
    expect(propertyListClasses("xs", undefined)).toContain("gap-x-3 gap-y-2");
  });
  it("splits its lines into two lists side by side from 1 280 px on `columns={2}`, the first half first", () => {
    const markup = html(
      createElement(PropertyList, { items: LINES, columns: 2 }),
    );
    expect(markup).toContain("xl:grid-cols-2");
    expect(markup.match(/<dl/g)).toHaveLength(2);
    const second = markup.split("<dl")[2] ?? "";
    expect(second).toContain("Présentation");
    expect(second).not.toContain("Pays");
    expect(
      html(createElement(PropertyList, { items: LINES, columns: 1 })).match(
        /<dl/g,
      ),
    ).toHaveLength(1);
  });
});
describe("RUB-T4: the state message (C08)", () => {
  const KINDS: readonly EmptyStateKind[] = [
    "empty",
    "filtered",
    "error",
    "closed",
    "sent",
    "inline",
  ];
  it("draws the six kinds, each with an icon hidden from screen readers and its title written", () => {
    expect(KINDS).toHaveLength(6);
    for (const kind of KINDS) {
      const markup = html(
        createElement(EmptyState, { kind: kind, title: "Rien ici" }),
      );
      expect(markup, kind).toContain("<svg");
      expect(markup, kind).toContain('aria-hidden="true"');
      expect(markup, kind).toContain("Rien ici");
    }
  });
  it("writes the title as a paragraph in the style of a section title, never a level of heading (PT5)", () => {
    for (const kind of KINDS) {
      const markup = html(
        createElement(EmptyState, {
          kind: kind,
          title: "Rien ici",
          body: "Revenez plus tard.",
        }),
      );
      expect(markup, kind).not.toMatch(/<h[1-6]/);
      expect(markup, kind).toMatch(/<p class="[^"]*">Rien ici<\/p>/);
    }
    expect(
      html(createElement(EmptyState, { kind: "empty", title: "T" })),
    ).toContain("text-title-section");
  });
  it("has no frame, 32 px above and below, 12 px between its parts and 40 rem at most, the icon at 24 px in tertiary", () => {
    const markup = html(
      createElement(EmptyState, { kind: "empty", title: "T" }),
    );
    expect(markup).toContain("py-6");
    expect(markup).toContain("gap-3");
    expect(markup).toContain("max-w-(--measure-text)");
    expect(markup).not.toContain("border");
    expect(markup).toContain("size-(--size-icon-lg)");
    expect(markup).toContain("text-text-tertiary");
  });
  it("holds one action at most, after the sentence, and draws the inline kind as a teal check and one phrase", () => {
    const markup = html(
      createElement(EmptyState, {
        kind: "filtered",
        title: "Aucun r\u00E9sultat",
        body: "\u00C9largissez.",
        action: createElement(
          "button",
          { type: "button" },
          "R\u00E9initialiser",
        ),
      }),
    );
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup.indexOf("Élargissez.")).toBeLessThan(
      markup.indexOf("<button"),
    );
    const inline = html(
      createElement(EmptyState, {
        kind: "inline",
        title: "Tout est \u00E0 jour.",
        body: "Ignor\u00E9e",
      }),
    );
    expect(inline).toContain("text-feedback-success-icon");
    expect(inline).toContain("Tout est à jour.");
    expect(inline).not.toContain("Ignorée");
  });
  it("takes the icon it is given, and announces nothing unless it is `live`", () => {
    const markup = html(
      createElement(EmptyState, {
        kind: "sent",
        title: "Envoy\u00E9",
        icon: CheckIcon,
      }),
    );
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("role=");
    expect(markup).not.toContain("aria-live");
  });
});
describe("RUB-T4: the skeleton (C09)", () => {
  const SHAPES: readonly SkeletonShape[] = [
    "line",
    "row",
    "card",
    "photo",
    "field",
  ];
  it("marks its container busy, reads its label off screen, and hides its shapes from screen readers", () => {
    for (const shape of SHAPES) {
      const markup = html(
        createElement(Skeleton, { shape: shape, label: "Chargement\u2026" }),
      );
      expect(markup, shape).toContain('aria-busy="true"');
      expect(markup, shape).toContain(
        '<span class="sr-only">Chargement…</span>',
      );
      expect(markup, shape).toContain('aria-hidden="true"');
    }
  });
  it("draws nothing visible before one second: the shapes are there, invisible, so that their room is kept", () => {
    expect(SKELETON_DELAY_MS).toBe(1000);
    const markup = html(
      createElement(Skeleton, { shape: "line", label: "Chargement\u2026" }),
    );
    expect(markup).toContain("invisible");
  });
  it("draws the five shapes at the height of what they stand for: 14 px line, 60 px row, photo 4/3, 48 px field box, card of photo and three lines", () => {
    expect(
      html(createElement(Skeleton, { shape: "line", label: "L" })),
    ).toContain("h-(--size-skeleton-line)");
    expect(
      html(createElement(Skeleton, { shape: "row", label: "L" })),
    ).toContain("h-[calc(var(--size-touch-target)+var(--spacing-4))]");
    expect(
      html(createElement(Skeleton, { shape: "photo", label: "L" })),
    ).toContain("aspect-4/3");
    const field = html(createElement(Skeleton, { shape: "field", label: "L" }));
    expect(field).toContain("h-(--size-input)");
    expect(field).toContain("w-1/4");
    const card = html(createElement(Skeleton, { shape: "card", label: "L" }));
    expect(card).toContain("aspect-4/3");
    expect(card.match(/h-\(--size-skeleton-line\)/g)).toHaveLength(3);
  });
  it("repeats a shape `count` times, once at least", () => {
    expect(
      html(
        createElement(Skeleton, { shape: "row", count: 3, label: "L" }),
      ).match(/w-full/g),
    ).toHaveLength(3);
    expect(
      html(
        createElement(Skeleton, { shape: "row", count: 0, label: "L" }),
      ).match(/w-full/g),
    ).toHaveLength(1);
  });
  it("slides the sheen by the animation token under `motion-safe:` alone, on the two roles of the skeleton, with a radius of 6 px", () => {
    const markup = html(createElement(Skeleton, { shape: "line", label: "L" }));
    expect(markup).toContain("bg-skeleton-base");
    expect(markup).toContain("motion-safe:after:animate-skeleton");
    expect(markup).toContain("motion-safe:after:via-skeleton-sheen");
    expect(markup).toContain("rounded-sm");
    expect(markup).not.toMatch(/(?<!motion-safe:)after:animate-skeleton/);
  });
});

// The primitives of the brand profile form (docs/mvp/06 RG62, RG84, RG85, CA39, CA47; 17 §4.2; 20
// §11.8; jalons/l2b, commit 10): what each field says about itself, the cap of a multiple choice,
// the layer badge's icon AND text, and the labels in both languages. Server rendering, no browser:
// the keys of the keyboard are the native controls' (radio, checkbox, select), so what is checked
// here is that nothing replaces them and that every text is tied to its control. The e2e of the
// screen (commit 11) look at the pixels. Parity of the reference codes with the database:
// apps/api/db-tests/reference-labels.test.ts.
import {
  COLLABORATION_RHYTHMS,
  COMPANY_SIZE_BANDS,
  CONTACT_ROLES,
  EXCLUSIVITY_BANDS,
  WORKING_LANGUAGES,
} from "@influx/contracts/brand-profile";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  isChoiceBlocked,
  toggleChoice,
} from "@/components/member/ui/choice-limits";
import { ScoreGauge } from "@/components/member/ui/ScoreGauge";
import { DomainField } from "@/components/member/ui/DomainField";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { MultiChoiceField } from "@/components/member/ui/MultiChoiceField";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { YesNoField } from "@/components/member/ui/YesNoField";
import { describedByOf } from "@/components/member/ui/field-ids";
import {
  countCharacters,
  limitCharacters,
} from "@/components/member/ui/text-limits";
import enMessages from "@/locales/en/brand-profile.json";
import frMessages from "@/locales/fr/brand-profile.json";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const noop = () => undefined;

const OPTIONS = [
  { code: "a", label: "Alpha" },
  { code: "b", label: "Bravo" },
  { code: "c", label: "Charlie" },
];

/** The ids a markup refers to by `aria-describedby`, in order. */
function describedIds(markup: string): string[] {
  const match = /aria-describedby="([^"]*)"/.exec(markup);
  return match === null ? [] : (match[1] ?? "").split(" ");
}

/** True when the markup holds an element with this id. */
function hasId(markup: string, id: string): boolean {
  return markup.includes(`id="${id}"`);
}

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => leafKeys(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function leafValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return Object.values(value as Record<string, unknown>).flatMap(leafValues);
}

describe("layer badge (06 RG62, RG84, CA39, CA47; 17 §4.2)", () => {
  const LAYERS = ["public", "revealed", "internal"] as const;

  it("writes the layer AND draws an icon in each of the three layers, the icon hidden from readers", () => {
    for (const layer of LAYERS) {
      const text = frMessages.layer[layer];
      const markup = html(createElement(LayerBadge, { layer, label: text }));
      expect(markup, layer).toContain(text.replaceAll("'", "&#x27;"));
      expect(markup, layer).toContain("<svg");
      expect(markup, layer).toContain('aria-hidden="true"');
    }
  });

  it("gives each layer its own icon and look, the green one included in the text", () => {
    const markups = LAYERS.map((layer) =>
      html(createElement(LayerBadge, { layer, label: layer })),
    );
    expect(new Set(markups).size).toBe(3);
    expect(markups[1]).toContain("bg-brand-subtle-bg");
    expect(markups[1]).toContain("text-text-brand-strong");
    expect(markups[0]).toContain("bg-surface-raised");
    expect(markups[2]).toContain("text-text-tertiary");
    for (const markup of markups) {
      expect(markup).toContain("rounded-pill");
    }
  });
});

describe("a field's texts are tied to its control (06 RG85)", () => {
  it("a select: label for the control, layer, help and error described by id, invalid announced", () => {
    const markup = html(
      createElement(SingleChoiceField, {
        id: "f-sector",
        name: "sector",
        label: "Sector",
        requiredLabel: "required",
        layer: { layer: "public", label: "Visible to all creators." },
        help: "Pick the closest.",
        error: "Pick a sector.",
        options: OPTIONS,
        value: null,
        placeholder: "Choose…",
        onChange: noop,
      }),
    );
    expect(markup).toContain('<label for="f-sector"');
    expect(markup).toContain('<select id="f-sector"');
    expect(markup).toContain("(required)");
    expect(markup).toContain('aria-invalid="true"');
    expect(describedIds(markup)).toEqual([
      "f-sector-layer",
      "f-sector-help",
      "f-sector-error",
    ]);
    for (const id of describedIds(markup)) {
      expect(hasId(markup, id), id).toBe(true);
    }
    expect(markup).toContain("Visible to all creators.");
  });

  it("a field without error is not invalid and does not point to an error", () => {
    const markup = html(
      createElement(SingleChoiceField, {
        id: "f-ok",
        name: "ok",
        label: "Sector",
        options: OPTIONS,
        value: "a",
        onChange: noop,
      }),
    );
    expect(markup).not.toContain("aria-invalid");
    expect(markup).not.toContain("aria-describedby");
    expect(markup).not.toContain("f-ok-error");
  });

  it("radios: a fieldset with its legend, native radios of one name, the first one carrying the id", () => {
    const markup = html(
      createElement(SingleChoiceField, {
        id: "f-size",
        name: "size",
        display: "radios",
        label: "Size",
        layer: { layer: "revealed", label: "After an introduction" },
        error: "Pick a size.",
        options: OPTIONS,
        value: "b",
        onChange: noop,
      }),
    );
    // A group of radios is a radiogroup, invalid as a whole, described by its layer and its error.
    expect(markup).toMatch(
      /^<fieldset role="radiogroup" aria-invalid="true" aria-describedby="f-size-layer f-size-error"/,
    );
    expect(markup).toContain("<legend");
    expect(markup.match(/type="radio"/g)).toHaveLength(3);
    expect(markup.match(/name="size"/g)).toHaveLength(3);
    expect(markup.match(/id="f-size"/g)).toHaveLength(1);
    expect(markup).toMatch(/checked="" value="b"/);
    expect(markup).not.toContain("tabindex");
  });

  it("yes/no: two native radios, both answers written, nothing ticked until answered", () => {
    const markup = html(
      createElement(YesNoField, {
        id: "f-nm",
        name: "nm",
        label: "Do you offer products?",
        yesLabel: "Yes",
        noLabel: "No",
        value: null,
        onChange: noop,
      }),
    );
    expect(markup.match(/type="radio"/g)).toHaveLength(2);
    expect(markup).not.toContain("checked");
    expect(markup).toContain("Yes");
    expect(markup).toContain("No");
    const answered = html(
      createElement(YesNoField, {
        name: "nm",
        label: "?",
        yesLabel: "Yes",
        noLabel: "No",
        value: false,
        onChange: noop,
      }),
    );
    expect(answered.match(/checked=""/g)).toHaveLength(1);
  });

  it("joins only the ids present, in order", () => {
    expect(describedByOf("a", false, null, undefined, "", "b")).toBe("a b");
    expect(describedByOf(false, null)).toBeUndefined();
  });
});

describe("multiple choice with a cap (06 RG15, RG27)", () => {
  it("refuses a choice over the cap and keeps the list as it was, never replacing one", () => {
    expect(toggleChoice(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(toggleChoice(["a"], "c", 2)).toEqual(["a", "c"]);
    expect(toggleChoice(["a", "b"], "a", 2)).toEqual(["b"]);
    expect(isChoiceBlocked(["a", "b"], "c", 2)).toBe(true);
    expect(isChoiceBlocked(["a", "b"], "a", 2)).toBe(false);
    expect(isChoiceBlocked(["a"], "c", 2)).toBe(false);
    const original = ["a", "b"];
    toggleChoice(original, "c", 2);
    expect(original).toEqual(["a", "b"]);
  });

  function render(value: string[]): string {
    return html(
      createElement(MultiChoiceField, {
        id: "f-topics",
        label: "Topics",
        options: OPTIONS,
        value,
        max: 2,
        limitText: "Up to 2",
        countText: `${value.length} of 2`,
        limitReachedText: "Limit reached: untick a choice to pick another.",
        onChange: noop,
      }),
    );
  }

  it("says the cap before any choice and the count, both read with the group", () => {
    const markup = render([]);
    expect(markup).toContain("Up to 2");
    expect(markup).toContain("0 of 2");
    expect(markup).toContain("<fieldset");
    expect(markup.match(/type="checkbox"/g)).toHaveLength(3);
    expect(describedIds(markup)).toEqual(["f-topics-help", "f-topics-count"]);
    expect(markup).not.toContain("Limit reached");
    expect(markup).not.toContain("aria-disabled");
  });

  it("at the cap: the other boxes are marked unavailable but stay in the tab order, and the reason is said in a live region", () => {
    const markup = render(["a", "b"]);
    expect(markup).toContain("Limit reached");
    expect(markup).toContain('role="status"');
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(1);
    expect(markup).not.toContain(" disabled=");
    expect(markup).not.toContain("tabindex");
    expect(describedIds(markup)).toContain("f-topics-status");
    // The box over the cap is the third one, Charlie; the two chosen stay available.
    expect(markup).toMatch(/aria-disabled="true"[^>]*value="c"/);
  });
});

describe("text area, domain, gauge (06 RG15, RG17, RG57, RG60)", () => {
  it("counts characters as the API does, an emoji being one, and cuts what exceeds", () => {
    expect(countCharacters("a😀b")).toBe(3);
    expect(limitCharacters("a😀bcd", 3)).toBe("a😀b");
    expect(limitCharacters("abc", 3)).toBe("abc");
  });

  it("writes the counter and ties it to the text area with the help", () => {
    const markup = html(
      createElement(TextAreaField, {
        id: "f-pres",
        name: "presentation",
        label: "Presentation",
        help: "Two or three sentences.",
        value: "Hello",
        maxLength: 1000,
        counterText: (count, max) => `${count} / ${max} characters`,
        onChange: noop,
      }),
    );
    expect(markup).toContain("5 / 1000 characters");
    expect(markup).toContain('<textarea id="f-pres"');
    expect(describedIds(markup)).toEqual(["f-pres-help", "f-pres-counter"]);
    expect(markup).not.toContain('role="status"');
  });

  it("types a domain on a web-address keyboard, without correction, and ties the notice to the field", () => {
    const markup = html(
      createElement(DomainField, {
        id: "f-site",
        name: "website",
        label: "Website",
        value: "example.com",
        maxLength: 300,
        notice: createElement("p", null, "We kept the domain example.com."),
        onChange: noop,
      }),
    );
    expect(markup).toContain('inputMode="url"');
    expect(markup).toContain('autoCapitalize="none"');
    expect(markup).toContain('autoComplete="off"');
    expect(markup).toContain('spellCheck="false"');
    expect(markup).toContain('maxLength="300"');
    expect(describedIds(markup)).toEqual(["f-site-notice"]);
    expect(markup).toContain("We kept the domain example.com.");
  });

  it("shows the completeness as a measure AND a written value", () => {
    const markup = html(
      createElement(ScoreGauge, {
        label: "Profile completeness",
        value: 82,
        valueText: "82%",
      }),
    );
    expect(markup).toContain('role="meter"');
    expect(markup).toContain('aria-valuenow="82"');
    expect(markup).toContain('width="82%"');
    expect(markup).toContain('aria-valuetext="82%"');
    expect(markup).toContain('aria-label="Profile completeness"');
    expect(markup).toContain(">82%<");
  });
});

describe("labels in French and English (06 RG84, CA46)", () => {
  it("hold the same keys in both languages, none empty", () => {
    expect(leafKeys(frMessages).sort()).toEqual(leafKeys(enMessages).sort());
    for (const text of [...leafValues(frMessages), ...leafValues(enMessages)]) {
      expect(text.trim()).not.toBe("");
    }
  });

  it("carry the three layer labels of RG84, word for word", () => {
    expect(frMessages.layer).toEqual({
      public: "Visible de tous les créateurs.",
      revealed: "Visible uniquement après l'ouverture d'une mise en relation.",
      internal: "Visible uniquement par l'équipe INFLUX.",
    });
    expect(enMessages.layer).toEqual({
      public: "Visible to all creators.",
      revealed: "Visible only after an introduction is opened.",
      internal: "Visible only to the INFLUX team.",
    });
  });

  it("name every code of the lists held by a check constraint, and no other", () => {
    for (const messages of [frMessages, enMessages]) {
      expect(Object.keys(messages.companySize)).toEqual([
        ...COMPANY_SIZE_BANDS,
      ]);
      expect(Object.keys(messages.exclusivity)).toEqual([...EXCLUSIVITY_BANDS]);
      expect(Object.keys(messages.rhythm)).toEqual([...COLLABORATION_RHYTHMS]);
      expect(Object.keys(messages.contactRole)).toEqual([...CONTACT_ROLES]);
      expect(Object.keys(messages.workingLanguage)).toEqual([
        ...WORKING_LANGUAGES,
      ]);
    }
  });

  it("have no label for usage right `none`, which is no right and never ticked among others (L2-amend)", () => {
    for (const messages of [frMessages, enMessages]) {
      expect(Object.keys(messages.reference.usage_right)).not.toContain("none");
    }
  });

  it("show no commission, rate, net or price in any label (CLAUDE.md §2, D48, D78)", () => {
    for (const text of [...leafValues(frMessages), ...leafValues(enMessages)]) {
      expect(text).not.toMatch(/commission|net créateur|net creator|tarif|€/i);
    }
  });
});

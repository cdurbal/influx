// RUB-T5 (docs/mvp/archives/jalons/rub/annexe.md; 22-refonte-ux-ui/02a C18 to C21): the field and its layout, the message
// under a field, the summary of the errors and the list of what is missing, the group of choices. Server
// rendering, no browser: what each one writes, the ids a control is described by, the roles a screen reader
// reads, the classes that carry the measures. The focus, the keyboard and the pixels are the board's (e2e).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChoiceGroup } from "@/components/member/ui/ChoiceGroup";
import { ErrorSummary, MissingList } from "@/components/member/ui/ErrorSummary";
import { Field, FieldGrid } from "@/components/member/ui/Field";
import { FieldMessage } from "@/components/member/ui/FieldMessage";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { TextField } from "@/components/member/ui/TextField";
import {
  fieldClasses,
  fieldGridClasses,
  fieldWidthClasses,
  memberControlClasses,
  memberTextAreaClasses,
  type FieldGridColumns,
  type FieldSize,
  type FieldWidth,
} from "@/components/member/ui/field-classes";
import {
  answerToCode,
  codeToAnswer,
  yesNoOptions,
} from "@/components/member/ui/yes-no-answer";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);
const noop = () => undefined;

/** The ids of the `aria-describedby` of the first element that carries one, in order. */
const describedIds = (markup: string): string[] =>
  /aria-describedby="([^"]*)"/.exec(markup)?.[1]?.split(" ") ?? [];

const TEXT_FIELD = {
  id: "f-name",
  name: "name",
  label: "Brand name",
  value: "Atelier",
  maxLength: 80,
  onChange: noop,
};

describe("RUB-T5: the field (C18)", () => {
  it("writes the label, the requirement in words and the help under the label, and ties the label to the control", () => {
    const markup = html(
      createElement(TextField, {
        ...TEXT_FIELD,
        requiredLabel: "required",
        help: "As on your site.",
      }),
    );
    expect(markup).toContain('<label for="f-name"');
    expect(markup).toContain("Brand name");
    expect(markup).toContain(" (required)");
    expect(markup).toContain('id="f-name-help"');
    expect(markup).toContain("As on your site.");
    expect(describedIds(markup)).toEqual(["f-name-help"]);
  });

  it("marks a field in error invalid and describes it by its message, in the order the field is read", () => {
    const markup = html(
      createElement(TextField, {
        ...TEXT_FIELD,
        layer: { layer: "public", label: "Public" },
        help: "As on your site.",
        suffix: "days",
        warnings: ["To check: it looks like another."],
        error: "This field is required.",
      }),
    );
    expect(markup).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(describedIds(markup)).toEqual([
      "f-name-layer",
      "f-name-help",
      "f-name-suffix",
      "f-name-warning",
      "f-name-error",
    ]);
    expect(markup).toContain('id="f-name-error"');
    // The message is a line with its icon, tied to the control: never a live region, never a box.
    expect(markup).not.toContain("role=");
    expect(markup).not.toContain("bg-feedback-error-bg");
  });

  it("keeps a warning from invalidating the control: one message per signal, the control stays valid", () => {
    const markup = html(
      createElement(TextField, {
        ...TEXT_FIELD,
        warnings: ["To check: first.", "To check: second."],
      }),
    );
    expect(markup).not.toContain("aria-invalid");
    expect(markup.match(/lucide-triangle-alert/g)).toHaveLength(2);
    expect(markup.match(/id="f-name-warning"/g)).toHaveLength(1);
    expect(markup).toContain("To check: first.");
    expect(markup).toContain("To check: second.");
    expect(describedIds(markup)).toEqual(["f-name-warning"]);
  });

  it("does not draw the badge of the layer when it is told elsewhere, and does not point to it", () => {
    const layer = { layer: "revealed", label: "Seen by your adviser" } as const;
    const shown = html(createElement(TextField, { ...TEXT_FIELD, layer }));
    const hidden = html(
      createElement(TextField, { ...TEXT_FIELD, layer, layerShown: false }),
    );
    expect(shown).toContain("Seen by your adviser");
    expect(describedIds(shown)).toEqual(["f-name-layer"]);
    expect(hidden).not.toContain("Seen by your adviser");
    expect(describedIds(hidden)).toEqual([]);
  });

  it("gives the control a width of its own and writes its unit after it, never wrapping a full line", () => {
    const full = html(createElement(TextField, TEXT_FIELD));
    expect(full).not.toContain("size-input-number");
    const number = html(
      createElement(TextField, {
        ...TEXT_FIELD,
        width: "number",
        suffix: "days",
      }),
    );
    expect(number).toContain("w-(--size-input-number)");
    expect(number).toMatch(/<span id="f-name-suffix"[^>]*>days<\/span>/);
    const widths: FieldWidth[] = ["xs", "sm", "md", "lg", "xl"];
    for (const width of widths) {
      expect(fieldWidthClasses(width), width).toContain(
        `max-w-(--container-field-${width})`,
      );
    }
    expect(fieldWidthClasses("full")).toBe("");
    expect(fieldWidthClasses(undefined)).toBe("");
  });

  it("counts under the control: the default count, or the count as it is written, read with the field", () => {
    const area = html(
      createElement(TextAreaField, {
        id: "f-bio",
        name: "bio",
        label: "Bio",
        value: "Hello",
        maxLength: 400,
        counterText: (count: number, max: number) =>
          `${count} of ${max} characters`,
        onChange: noop,
      }),
    );
    expect(area).toMatch(/<p id="f-bio-counter"[^>]*>5 of 400 characters<\/p>/);
    expect(describedIds(area)).toEqual(["f-bio-counter"]);
    const plain = html(
      createElement(Field, {
        ids: {
          control: "c",
          layer: "c-layer",
          help: "c-help",
          error: "c-error",
          warning: "c-warning",
          counter: "c-counter",
          suffix: "c-suffix",
        },
        kind: "single",
        label: "Count",
        counter: { value: 12, max: 50 },
      }),
    );
    expect(plain).toContain(">12 / 50<");
  });

  it("holds the same measures for the three sizes until the backoffice renders its own, and enters a conditional field by rise-in", () => {
    const sizes: FieldSize[] = ["md", "bo", "dense"];
    for (const size of sizes) {
      expect(fieldClasses(size), size).toBe(fieldClasses());
    }
    const plain = html(createElement(TextField, TEXT_FIELD));
    const conditional = html(
      createElement(TextField, { ...TEXT_FIELD, conditional: true }),
    );
    expect(plain).not.toContain("animate-rise-in");
    expect(conditional).toMatch(/^<div class="[^"]*animate-rise-in/);
  });

  it("draws an error as a 2 px outline that does not move the text: the padding grows back what the outline took, the height is fixed, only the colour transitions", () => {
    const resting = memberControlClasses(false);
    const failing = memberControlClasses(true);
    expect(resting).toContain("border-(length:--border-width-thin)");
    expect(failing).toContain("border-(length:--border-width-thick)");
    expect(failing).toContain("border-border-error");
    // 16 − (2 − 1) = 15: the text stays at 1 + 16 = 2 + 15 from the edge.
    expect(failing).toContain(
      "px-[calc(var(--spacing-4)-var(--border-width-thick)+var(--border-width-thin))]",
    );
    expect(resting).toContain("px-4");
    for (const classes of [resting, failing]) {
      expect(classes).toContain("h-(--size-input)");
      expect(classes).toContain("transition-colors");
      expect(classes).not.toContain("transition-all");
    }
    const area = memberTextAreaClasses(true);
    expect(area).toContain("py-[calc(var(--spacing-3)-");
    expect(area).toContain("min-h-(--size-textarea)");
  });

  it("lays the fields in a grid of one column that becomes 2, 3 or 4 from 640 px, a gap of 24 px", () => {
    const columns: FieldGridColumns[] = [1, 2, 3, 4];
    for (const count of columns) {
      const classes = fieldGridClasses(count);
      expect(classes, String(count)).toContain("gap-5");
      expect(classes, String(count)).toContain("grid-cols-1");
      if (count > 1) {
        expect(classes, String(count)).toContain(`form:grid-cols-${count}`);
      }
    }
    expect(fieldGridClasses()).toBe(fieldGridClasses(1));
    expect(
      html(createElement(FieldGrid, { columns: 2 }, createElement("i"))),
    ).toMatch(/^<div class="grid gap-5 grid-cols-1 form:grid-cols-2"/);
  });
});

describe("RUB-T5: the message of a field (C19)", () => {
  it("is a line with the icon of its kind and the text, three different shapes, the error in 600", () => {
    const kinds = [
      ["error", "lucide-circle-alert", "font-semibold"],
      ["warning", "lucide-triangle-alert", ""],
      ["seen", "lucide-eye", ""],
    ] as const;
    const icons = new Set<string>();
    for (const [kind, icon, weight] of kinds) {
      const markup = html(
        createElement(FieldMessage, { kind, id: `m-${kind}` }, "Text"),
      );
      expect(markup, kind).toContain(`id="m-${kind}"`);
      expect(markup, kind).toContain(icon);
      expect(markup, kind).toContain('aria-hidden="true"');
      expect(markup, kind).toContain("Text");
      expect(markup, kind).not.toContain("role=");
      expect(markup, kind).not.toMatch(/\bborder|bg-/);
      if (weight !== "") expect(markup, kind).toContain(weight);
      else expect(markup, kind).not.toContain("font-semibold");
      icons.add(icon);
    }
    expect(icons.size).toBe(3);
  });
});

describe("RUB-T5: the summary of the errors and the list of what is missing (C20)", () => {
  const items = [
    {
      fieldId: "f-site",
      label: "Website",
      reason: "This field is required.",
    },
    { fieldId: "f-name", label: "Brand name", reason: "Too short." },
  ];

  it("is absent when there is no error, and a named group that can take the focus when there is", () => {
    expect(
      html(createElement(ErrorSummary, { title: "No error", items: [] })),
    ).toBe("");
    const markup = html(
      createElement(ErrorSummary, {
        id: "summary",
        title: "2 fields need your attention",
        items,
      }),
    );
    expect(markup).toMatch(
      /^<div id="summary" role="group" aria-labelledby="summary-title" tabindex="-1"/,
    );
    expect(markup).toContain('<p id="summary-title"');
    expect(markup).toContain("2 fields need your attention");
    expect(markup).toContain("border-feedback-error-border");
    expect(markup).not.toContain("bg-feedback-error-bg");
  });

  it("links each item to its field, the label in the link and the reason after it", () => {
    const markup = html(
      createElement(ErrorSummary, { title: "Errors", items }),
    );
    expect(markup.match(/<li /g)).toHaveLength(2);
    expect(markup).toContain('href="#f-site"');
    expect(markup).toContain('href="#f-name"');
    expect(markup).toMatch(/<a [^>]*href="#f-site"[^>]*>Website<\/a>/);
    expect(markup).toContain("This field is required.");
    expect(markup).toContain("underline");
  });

  it("lists what is missing as lines of alert with a link to complete each, named by what it completes; absent if nothing is", () => {
    expect(
      html(createElement(MissingList, { actionLabel: "Complete", items: [] })),
    ).toBe("");
    const markup = html(
      createElement(MissingList, {
        actionLabel: "Complete",
        items: [
          { id: "logo", label: "Logo", href: "/fr/profile?step=1" },
          { id: "sector", label: "Sector", href: "/fr/profile?step=2" },
        ],
      }),
    );
    expect(markup.match(/<li /g)).toHaveLength(2);
    expect(markup.match(/lucide-triangle-alert/g)).toHaveLength(2);
    expect(markup).toContain('href="/fr/profile?step=2"');
    expect(markup).toMatch(
      /<a [^>]*>Complete<span class="sr-only"> Logo<\/span><\/a>/,
    );
  });
});

describe("RUB-T5: the group of choices (C21)", () => {
  const options = [
    { code: "a", label: "Alpha" },
    { code: "b", label: "Beta" },
    { code: "c", label: "Gamma" },
  ];
  const boxes = (value: string[], extra: Record<string, unknown> = {}) =>
    html(
      createElement(ChoiceGroup, {
        type: "checkbox",
        id: "g",
        label: "Topics",
        options,
        value,
        max: 2,
        limitText: "Up to 2",
        countText: `${value.length} of 2`,
        limitReachedText: "Limit reached.",
        onChange: noop,
        ...extra,
      }),
    );

  it("is a fieldset with its legend, one 44 px row per choice whose whole label is the click zone", () => {
    const markup = boxes([]);
    expect(markup).toMatch(/^<fieldset/);
    expect(markup).toMatch(/<legend[^>]*>Topics/);
    expect(markup.match(/<label /g)).toHaveLength(3);
    expect(markup.match(/min-h-\(--size-touch-target\)/g)).toHaveLength(3);
    expect(markup.match(/type="checkbox"/g)).toHaveLength(3);
    expect(markup).toContain('id="g"');
  });

  it("tells the cap before any choice, and at the cap marks the others unavailable without removing them from the tab order", () => {
    const open = boxes(["a"]);
    expect(describedIds(open)).toEqual(["g-help", "g-count"]);
    expect(open).not.toContain("aria-disabled");
    expect(open).toMatch(/<p id="g-status" role="status"[^>]*><\/p>/);
    const atCap = boxes(["a", "b"]);
    expect(describedIds(atCap)).toEqual(["g-help", "g-count", "g-status"]);
    expect(atCap.match(/aria-disabled="true"/g)).toHaveLength(1);
    expect(atCap).toContain("Limit reached.");
    expect(atCap).not.toContain("tabindex");
    expect(atCap).not.toContain(" disabled=");
  });

  it("says why a choice cannot be taken, in words under its label, and points the control to the reason", () => {
    const markup = html(
      createElement(ChoiceGroup, {
        type: "checkbox",
        id: "g",
        label: "Formats",
        options: [
          { code: "a", label: "Video", help: "Up to a minute." },
          {
            code: "b",
            label: "Live",
            disabled: true,
            reason: "Not open in your country.",
          },
        ],
        value: ["a"],
        onChange: noop,
      }),
    );
    expect(markup).toContain('id="g-option-1-reason"');
    expect(markup).toContain("Not open in your country.");
    expect(markup).toContain('id="g-option-0-help"');
    const disabled = /<input[^>]*value="b"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(disabled).toContain("disabled");
    expect(disabled).toContain('aria-describedby="g-option-1-reason"');
    expect(disabled).not.toContain("aria-disabled");
    // The reason and the help are outside the label: the name of a choice is its label.
    expect(markup).toMatch(/<span>Live<\/span><\/label>/);
  });

  it("is a radiogroup, invalid as a whole, for radios; the radios carry no `aria-invalid` of their own", () => {
    const markup = html(
      createElement(ChoiceGroup, {
        type: "radio",
        id: "r",
        name: "size",
        label: "Size",
        options,
        value: "b",
        error: "Pick a size.",
        onChange: noop,
      }),
    );
    expect(markup).toMatch(
      /^<fieldset role="radiogroup" aria-invalid="true" aria-describedby="r-error"/,
    );
    expect(markup.match(/type="radio"/g)).toHaveLength(3);
    expect(markup.match(/name="size"/g)).toHaveLength(3);
    expect(markup.match(/checked=""/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<input[^>]*aria-invalid/);
    const flagged = html(
      createElement(ChoiceGroup, {
        type: "radio",
        name: "size",
        label: "Size",
        options,
        value: null,
        invalid: true,
        onChange: noop,
      }),
    );
    expect(flagged).toContain('aria-invalid="true"');
    expect(flagged).not.toContain('id="-error"');
  });

  it("answers a yes/no question by code: the answer round-trips, nothing is ticked until it is given", () => {
    expect(yesNoOptions("Yes", "No").map((option) => option.label)).toEqual([
      "Yes",
      "No",
    ]);
    expect(answerToCode(null)).toBeNull();
    expect(answerToCode(true)).toBe("yes");
    expect(answerToCode(false)).toBe("no");
    expect(codeToAnswer("yes")).toBe(true);
    expect(codeToAnswer("no")).toBe(false);
    const markup = html(
      createElement(ChoiceGroup, {
        type: "radio",
        name: "q",
        label: "Question",
        options: yesNoOptions("Yes", "No"),
        value: answerToCode(null),
        onChange: noop,
      }),
    );
    expect(markup).not.toMatch(/ checked=""/);
  });
});

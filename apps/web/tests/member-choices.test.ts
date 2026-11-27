// RUB-T6 (docs/mvp/jalons/rub/annexe.md; 22-refonte-ux-ui/02a C22 to C26, 02b C47): the segmented control, the tag
// picker, the internal zone, the save status, the disclosure and the date field. Server rendering, no browser: what
// each one writes, the roles and the names a screen reader reads, the classes that carry the measures, the writing
// of a date in French and in English, and that none of them acts on its own (a gesture only calls `onChange`).
// The keyboard, the focus and the pixels are the board's (e2e).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateField } from "@/components/member/ui/DateField";
import { Disclosure } from "@/components/member/ui/Disclosure";
import { InternalZone } from "@/components/member/ui/InternalZone";
import { AnnouncerProvider } from "@/components/member/ui/Announcer";
import { SaveStatus } from "@/components/member/ui/SaveStatus";
import { SegmentedControl } from "@/components/member/ui/SegmentedControl";
import { TagPicker } from "@/components/member/ui/TagPicker";
import {
  dateOrderOf,
  dateRefusalOf,
  dateValueOf,
  formatDateIso,
  isDateWithin,
  isDraftTakenBack,
  parseDateText,
  readDateText,
} from "@/components/member/ui/date-field-format";
import {
  disclosureSummaryClasses,
  type DisclosureVariant,
} from "@/components/member/ui/disclosure-classes";
import {
  saveStatusClasses,
  type SaveState,
} from "@/components/member/ui/save-status-classes";
import { segmentClasses } from "@/components/member/ui/segmented-control-classes";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);
const noop = () => undefined;

const OPTIONS = [
  { value: "list", label: "List", count: 12, controls: "panel-list" },
  { value: "grid", label: "Grid", count: 4, controls: "panel-grid" },
  { value: "map", label: "Map" },
];

describe("RUB-T6: the segmented control (C22)", () => {
  it("writes the radios as a fieldset with a legend, native radios that share a name, the chosen one checked, and calls nothing while drawing", () => {
    let called = 0;
    const markup = html(
      createElement(SegmentedControl, {
        kind: "radio",
        label: "Display",
        name: "display",
        value: "grid",
        options: OPTIONS,
        onChange: () => {
          called += 1;
        },
      }),
    );
    expect(markup).toMatch(/<fieldset[^>]*>\s*<legend[^>]*>Display<\/legend>/);
    expect(markup.match(/type="radio"/g)).toHaveLength(3);
    expect(markup.match(/name="display"/g)).toHaveLength(3);
    expect(markup.match(/checked=""/g)).toHaveLength(1);
    expect(markup).toMatch(/<input[^>]*checked=""[^>]*value="grid"/);
    expect(called).toBe(0);
  });

  it("keeps the legend for the screen reader alone and draws the count of a segment after its label", () => {
    const markup = html(
      createElement(SegmentedControl, {
        kind: "radio",
        label: "Display",
        value: "list",
        options: OPTIONS,
        onChange: noop,
      }),
    );
    expect(markup).toMatch(/<legend class="sr-only">/);
    expect(markup).toContain('<span class="tabular-nums">12</span>');
    expect(markup).not.toContain('<span class="tabular-nums"></span>');
  });

  it("writes the tabs as a named tablist with one tab stop: the chosen tab, or the first when none is chosen", () => {
    const tabs = (value: string) =>
      html(
        createElement(SegmentedControl, {
          kind: "tabs",
          label: "Sections",
          value,
          options: OPTIONS,
          onChange: noop,
        }),
      );
    const chosen = tabs("grid");
    expect(chosen).toMatch(/role="tablist"[^>]*aria-label="Sections"/);
    expect(chosen.match(/role="tab"/g)).toHaveLength(3);
    expect(chosen).toMatch(
      /aria-selected="true"[^>]*aria-controls="panel-grid"/,
    );
    expect(chosen.match(/tabindex="0"/g)).toHaveLength(1);
    expect(chosen.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(chosen.match(/aria-selected="true"/g)).toHaveLength(1);
    const none = tabs("elsewhere");
    expect(none.match(/tabindex="0"/g)).toHaveLength(1);
    expect(none).toMatch(/aria-selected="false"[^>]*tabindex="0"/);
  });

  it("writes the views as a named list of links, without a nav, the current one `true` and never `page` (D74, TD5.1)", () => {
    const markup = html(
      createElement(SegmentedControl, {
        kind: "views",
        label: "Views",
        value: "map",
        options: [
          { value: "list", label: "List", href: "#list" },
          { value: "map", label: "Map", href: "#map" },
        ],
      }),
    );
    expect(markup).toMatch(/^<ul[^>]*aria-label="Views"/);
    expect(markup).not.toContain("<nav");
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1);
    expect(markup).not.toContain('aria-current="page"');
    expect(markup).toMatch(/<a href="#map" aria-current="true"/);
    expect(markup).not.toContain('role="tablist"');
  });

  it("draws the active segment on its surface with a transparent contour for forced colours, the ring on a pseudo-element, and never green", () => {
    for (const kind of ["radio", "tabs", "views"] as const) {
      const active = segmentClasses(kind, true);
      const rest = segmentClasses(kind, false);
      expect(active, kind).toContain("bg-surface-active");
      expect(active, kind).toContain("outline-transparent");
      expect(active, kind).toContain("outline-(length:--border-width-thick)");
      expect(rest, kind).not.toContain("outline-transparent");
      expect(rest, kind).not.toContain("bg-surface-active");
      expect(rest, kind).toContain("text-text-secondary");
      expect(active, kind).toContain("after:outline-focus-ring");
      expect(`${active} ${rest}`, kind).not.toMatch(
        /brand|green|action-primary/,
      );
    }
  });
});

const COUNTRIES = [
  { code: "fr", label: "France" },
  { code: "be", label: "Belgium" },
  { code: "ca", label: "Canada" },
];

const PICKER = {
  id: "p-countries",
  name: "countries",
  label: "Countries",
  options: COUNTRIES,
  max: 2,
  limitText: "2 at most.",
  countText: "1 / 2",
  limitReachedText: "Limit reached.",
  addLabel: "Add a country…",
  listLabel: "Chosen countries",
  removeLabel: (label: string) => `Remove ${label}`,
  onChange: noop,
};

describe("RUB-T6: the tag picker (C23)", () => {
  it("lists the chosen tags in a named list, each cross named by its removal, and offers only what is left to add", () => {
    const markup = html(createElement(TagPicker, { ...PICKER, value: ["fr"] }));
    expect(markup).toMatch(/<ul aria-label="Chosen countries"/);
    expect(markup).toContain('aria-label="Remove France"');
    expect(markup).not.toContain('value="fr">France');
    expect(markup).toContain('<option value="be">Belgium</option>');
    expect(markup).toContain(
      '<option value="" selected="">Add a country…</option>',
    );
  });

  it("offers nothing more at the cap and says why in its status line, tied to the select", () => {
    const markup = html(
      createElement(TagPicker, { ...PICKER, value: ["fr", "be"] }),
    );
    expect(markup).not.toContain('<option value="ca">');
    expect(markup).toMatch(
      /<p id="p-countries-status" role="status"[^>]*>Limit reached\./,
    );
    expect(/aria-describedby="([^"]*)"/.exec(markup)?.[1]).toContain(
      "p-countries-status",
    );
  });

  it("has a cross of 24 px with a zone of 44 by 44 px, a tag of 36 px and a select of 13 to 20 rem", () => {
    const markup = html(createElement(TagPicker, { ...PICKER, value: ["fr"] }));
    expect(markup).toContain("size-5");
    expect(markup).toContain("before:min-h-(--size-touch-target)");
    expect(markup).toContain("before:min-w-(--size-touch-target)");
    expect(markup).toContain("min-h-(--size-tag)");
    expect(markup).toContain("min-w-(--size-select-add)");
    expect(markup).toContain("max-w-(--size-select-add-max)");
  });

  it("marks the select invalid and describes it by the message when the field is in error", () => {
    const markup = html(
      createElement(TagPicker, { ...PICKER, value: [], error: "Pick one." }),
    );
    expect(markup).toMatch(/<select[^>]*aria-invalid="true"/);
    expect(/aria-describedby="([^"]*)"/.exec(markup)?.[1]).toContain(
      "p-countries-error",
    );
    expect(markup).toContain("Pick one.");
  });
});

describe("RUB-T6: the internal zone (C24)", () => {
  it("is a group named by its title, a crossed eye hidden from the screen reader, in a dashed frame", () => {
    const markup = html(
      createElement(
        InternalZone,
        { title: "Visible by INFLUX only", id: "z" },
        createElement("p", null, "inside"),
      ),
    );
    expect(markup).toMatch(/role="group" aria-labelledby="([^"]+)"/);
    const labelled = /aria-labelledby="([^"]+)"/.exec(markup)?.[1];
    expect(markup).toContain(`id="${labelled}"`);
    expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(markup).toContain("border-dashed");
    expect(markup).toContain("border-border-strong");
    expect(markup).toContain("Visible by INFLUX only");
    expect(markup).toContain("inside");
  });
});

const SAVE = {
  idleText: "Saved automatically",
  savingText: "Saving…",
  savedText: (time: string) => `Saved at ${time}`,
  failedText: "Not saved",
  retryInText: (seconds: number) => `Next try in ${seconds} s`,
  retryLabel: "Try again",
  retryInSeconds: 5,
  onRetry: noop,
};

const save = (state: SaveState, extra: object = {}) =>
  html(
    createElement(
      AnnouncerProvider,
      null,
      createElement(SaveStatus, {
        ...SAVE,
        state,
        savedAt: "14:07",
        ...extra,
      }),
    ),
  );

describe("RUB-T6: the save status (C25)", () => {
  it("writes one sentence and one icon for each of the four states, in no live region of its own", () => {
    const sentences: Record<SaveState, string> = {
      idle: "Saved automatically",
      saving: "Saving…",
      saved: "Saved at 14:07",
      failed: "Not saved",
    };
    for (const state of Object.keys(sentences) as SaveState[]) {
      const markup = save(state);
      expect(markup, state).toContain(`data-save-state="${state}"`);
      expect(markup, state).toContain(`<span>${sentences[state]}</span>`);
      expect(markup, state).toMatch(/<svg[^>]*aria-hidden="true"/);
      const own = markup.replace(/<div[^>]*data-announcer[^>]*>.*?<\/div>/, "");
      expect(own, state).not.toMatch(/role="(?:status|alert)"|aria-live/);
    }
  });

  it("offers to try again, with the delay of the next try, on the failure alone", () => {
    const failed = save("failed");
    expect(failed).toContain("Try again");
    expect(failed).toContain("Next try in 5 s");
    for (const state of ["idle", "saving", "saved"] as const) {
      expect(save(state), state).not.toContain("Try again");
      expect(save(state), state).not.toContain("Next try");
    }
    expect(save("failed", { onRetry: undefined })).not.toContain("Try again");
  });

  it("falls back to the idle sentence before the first save, turns only where motion is allowed and puts its line at the foot or in the meta", () => {
    expect(save("saved", { savedAt: undefined })).toContain(
      "<span>Saved automatically</span>",
    );
    expect(save("saving")).toContain("motion-safe:animate-spin");
    expect(save("saved")).not.toContain("animate-spin");
    expect(saveStatusClasses("saved", "foot")).toContain("justify-center");
    expect(saveStatusClasses("saved", "meta")).toContain("justify-start");
    expect(saveStatusClasses("saved")).toContain("justify-start");
  });

  it("speaks the failure through the announcer of the page and throws outside one: a message lost in silence would hide the mistake", () => {
    expect(() =>
      html(createElement(SaveStatus, { ...SAVE, state: "failed" })),
    ).toThrow(/AnnouncerProvider/);
    expect(() =>
      html(createElement(SaveStatus, { ...SAVE, state: "saved" })),
    ).not.toThrow();
  });
});

describe("RUB-T6: the disclosure (C26)", () => {
  const fold = (props: object = {}) =>
    html(
      createElement(
        Disclosure,
        { variant: "fold", summary: "More", ...props },
        createElement("p", null, "content"),
      ),
    );

  it("is a native details with a summary of 44 px, closed unless asked, its content entering by rise-in", () => {
    const closed = fold();
    expect(closed).toMatch(/^<details[^>]*data-disclosure="fold"/);
    expect(closed).not.toMatch(/<details[^>]*\sopen=""/);
    expect(closed).toContain("<summary");
    expect(closed).toContain("min-h-(--size-touch-target)");
    expect(closed).toContain("animate-rise-in");
    expect(fold({ defaultOpen: true })).toMatch(/<details[^>]*\sopen=""/);
  });

  it("opens by itself when an error is inside (forceOpen)", () => {
    expect(fold({ forceOpen: true })).toMatch(/<details[^>]*\sopen=""/);
  });

  it("has six variants: the danger one is read in the text of an error, the rare one has a chevron down that turns over, the group one a count", () => {
    const variants: DisclosureVariant[] = [
      "optional",
      "fold",
      "danger",
      "rare",
      "group",
      "change",
    ];
    for (const variant of variants) {
      expect(fold({ variant }), variant).toContain(
        `data-disclosure="${variant}"`,
      );
    }
    expect(disclosureSummaryClasses("danger")).toContain(
      "text-feedback-error-text",
    );
    expect(disclosureSummaryClasses("fold")).not.toContain("feedback-error");
    expect(fold({ variant: "rare" })).toContain("group-open:rotate-180");
    expect(fold({ variant: "rare" })).toContain("duration-(--duration-fast)");
    expect(fold({ variant: "fold" })).toContain("group-open:rotate-90");
    expect(fold({ variant: "fold" })).toContain("duration-(--duration-base)");
    expect(fold({ variant: "group", count: 3 })).toContain(">3</span>");
    expect(fold({ variant: "fold" })).not.toContain("tabular-nums");
  });
});

describe("RUB-T6: the writing of a date (C47)", () => {
  it("says day, month, year for French and for English, and month first for en-US alone", () => {
    expect(dateOrderOf("fr")).toBe("dmy");
    expect(dateOrderOf("en")).toBe("dmy");
    expect(dateOrderOf("en-US")).toBe("mdy");
    expect(parseDateText("05/01/2027", "dmy")).toBe("2027-01-05");
    expect(parseDateText("05/01/2027", "mdy")).toBe("2027-05-01");
    expect(formatDateIso("2027-01-15", "dmy")).toBe("15/01/2027");
    expect(formatDateIso("2027-01-15", "mdy")).toBe("01/15/2027");
  });

  it("reads the separators / . and -, a single digit, and eight digits typed alone, and nothing else", () => {
    for (const text of [
      "15/01/2027",
      "15.01.2027",
      "15-01-2027",
      "15/1/2027",
      "15012027",
      " 15/01/2027 ",
    ]) {
      expect(parseDateText(text, "dmy"), text).toBe("2027-01-15");
    }
    for (const text of [
      "15/01/27",
      "2027-01-15",
      "15 01 2027",
      "1501",
      "abc",
      "",
    ]) {
      expect(parseDateText(text, "dmy"), text).toBeNull();
    }
  });

  it("refuses an impossible date and keeps the leap day of a leap year", () => {
    expect(parseDateText("31/02/2027", "dmy")).toBeNull();
    expect(parseDateText("29/02/2027", "dmy")).toBeNull();
    expect(parseDateText("29/02/2028", "dmy")).toBe("2028-02-29");
    expect(parseDateText("31/04/2027", "dmy")).toBeNull();
    expect(parseDateText("00/01/2027", "dmy")).toBeNull();
    expect(parseDateText("15/13/2027", "dmy")).toBeNull();
    expect(parseDateText("01/15/2027", "dmy")).toBeNull();
    expect(parseDateText("01/15/2027", "mdy")).toBe("2027-01-15");
  });

  it("tells a text that is no date from a date out of its bounds and from nothing typed", () => {
    expect(readDateText("", "dmy")).toEqual({ kind: "empty" });
    expect(readDateText("  ", "dmy")).toEqual({ kind: "empty" });
    expect(readDateText("31/02/2027", "dmy")).toEqual({ kind: "format" });
    expect(readDateText("15/01/2027", "dmy")).toEqual({
      kind: "valid",
      iso: "2027-01-15",
    });
    expect(readDateText("15/01/2026", "dmy", "2027-01-01")).toEqual({
      kind: "range",
    });
    expect(isDateWithin("2027-01-15", "2027-01-15", "2027-01-15")).toBe(true);
    expect(isDateWithin("2027-01-16", undefined, "2027-01-15")).toBe(false);
    expect(formatDateIso("not a date", "dmy")).toBe("");
  });
});

describe("RUB-T6: the typed text of a date when the screen changes under it (C47, RUBT-3)", () => {
  const readFrom = (min: string) => readDateText("01/01/2027", "dmy", min);

  it("keeps a refused text when its bound moves: the value did not change, the refusal is lifted and the date goes out", () => {
    expect(dateRefusalOf(readFrom("2027-02-01"), true)).toBe("range");
    const after = readFrom("2026-12-01");
    expect(isDraftTakenBack(null, null, after)).toBe(false);
    expect(dateRefusalOf(after, true)).toBeNull();
    expect(dateValueOf(after)).toBe("2027-01-01");
  });

  it("never writes the typed text again with the value that the typing sent out", () => {
    expect(isDraftTakenBack(null, "2027-01-01", readFrom("2026-12-01"))).toBe(
      false,
    );
    expect(
      isDraftTakenBack("2027-01-01", null, readDateText("01/01/202", "dmy")),
    ).toBe(false);
  });

  it("takes the field back when the screen resets or loads another value", () => {
    const reading = readFrom("2026-12-01");
    expect(isDraftTakenBack("2027-01-01", null, reading)).toBe(true);
    expect(isDraftTakenBack("2027-01-01", "2027-03-05", reading)).toBe(true);
    expect(
      isDraftTakenBack(null, "2027-03-05", readDateText("31/02/2027", "dmy")),
    ).toBe(true);
  });

  it("refuses a date that a bound puts outside once the field was left, not while it is typed, and sends out nothing", () => {
    const outside = readFrom("2027-02-01");
    expect(dateRefusalOf(outside, false)).toBeNull();
    expect(dateRefusalOf(outside, true)).toBe("range");
    expect(dateValueOf(outside)).toBeNull();
    expect(isDraftTakenBack("2027-01-01", "2027-01-01", outside)).toBe(false);
    expect(isDraftTakenBack("2027-01-01", null, outside)).toBe(false);
  });
});

const DATE = {
  id: "d-start",
  name: "start",
  label: "Start",
  value: "2027-01-15",
  onChange: noop,
  locale: "fr",
  formatError: "Write dd/mm/yyyy.",
  help: "dd/mm/yyyy, for example 15/01/2027.",
};

describe("RUB-T6: the date field (C47)", () => {
  it("is a text field of 12 rem with a numeric keypad and no native picker, showing the date in the order of the language", () => {
    const markup = html(createElement(DateField, DATE));
    expect(markup).toMatch(/<input[^>]*type="text"/);
    expect(markup).toMatch(/<input[^>]*inputMode="numeric"/);
    expect(markup).not.toContain('type="date"');
    expect(markup).toContain("max-w-(--size-date)");
    expect(markup).toContain('value="15/01/2027"');
    expect(html(createElement(DateField, { ...DATE, locale: "en" }))).toContain(
      'value="15/01/2027"',
    );
    expect(
      html(createElement(DateField, { ...DATE, locale: "en-US" })),
    ).toContain('value="01/15/2027"');
    expect(html(createElement(DateField, { ...DATE, value: null }))).toContain(
      'value=""',
    );
  });

  it("says the order under the field, as an error that marks the field invalid, or as a warning that does not", () => {
    const asError = html(
      createElement(DateField, {
        ...DATE,
        orderNote: "The end is before the start.",
        orderKind: "error",
      }),
    );
    expect(asError).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(asError).toContain("The end is before the start.");
    expect(/aria-describedby="([^"]*)"/.exec(asError)?.[1]).toContain(
      "d-start-error",
    );
    const asWarning = html(
      createElement(DateField, {
        ...DATE,
        orderNote: "Check the order.",
        orderKind: "warning",
      }),
    );
    expect(asWarning).not.toMatch(/<input[^>]*aria-invalid/);
    expect(asWarning).toContain("Check the order.");
    expect(/aria-describedby="([^"]*)"/.exec(asWarning)?.[1]).toContain(
      "d-start-warning",
    );
    const unsaved = html(
      createElement(DateField, { ...DATE, orderNote: "Not saved order." }),
    );
    expect(unsaved).toMatch(/<input[^>]*aria-invalid="true"/);
  });

  it("describes the field by its help first, and shows the message of the screen when it has one", () => {
    const markup = html(
      createElement(DateField, { ...DATE, error: "This date is required." }),
    );
    expect(describedIds(markup)).toEqual(["d-start-help", "d-start-error"]);
    expect(markup).toContain("This date is required.");
  });
});

/** The ids of the `aria-describedby` of the first element that carries one, in order. */
function describedIds(markup: string): string[] {
  return /aria-describedby="([^"]*)"/.exec(markup)?.[1]?.split(" ") ?? [];
}

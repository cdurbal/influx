// RUB-T7 (docs/mvp/archives/jalons/rub/annexe.md; 22-refonte-ux-ui/02a C27, C28, C30, C32): the dialog, the dialog of the filters,
// the filter bar and the pager. Server rendering, no browser: what each one writes, the roles and the names a screen
// reader reads, the classes that carry the motion and the measures, and that none of them acts while it is drawn.
// The focus given back, `Échap`, the backdrop and the draft given up are the board's (e2e, RUB-T7 and RUB-AN2 07).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dialog } from "@/components/member/ui/Dialog";
import { FilterBar } from "@/components/member/ui/FilterBar";
import { FiltersDialog } from "@/components/member/ui/FiltersDialog";
import { Pager } from "@/components/member/ui/Pager";
import {
  dialogClasses,
  filtersDialogClasses,
} from "@/components/member/ui/dialog-classes";
import {
  filterBarClasses,
  filterPillClasses,
} from "@/components/member/ui/filter-bar-classes";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);
const noop = () => undefined;

describe("RUB-T7: the dialog (C27)", () => {
  it("writes a native dialog named by its title, an h2 the focus can land on, then the content, then the actions, closed", () => {
    const markup = html(
      createElement(
        Dialog,
        {
          open: false,
          onClose: noop,
          title: "Remove this selection?",
          actions: createElement("button", { type: "button" }, "Remove"),
        },
        createElement("p", null, "Its creators stay in your search."),
      ),
    );
    expect(markup).toMatch(/^<dialog /);
    expect(markup).not.toMatch(/<dialog[^>]*\sopen/);
    const labelledBy = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(labelledBy).toBeDefined();
    expect(markup).toMatch(
      new RegExp(
        `<h2 id="${labelledBy}"[^>]*tabindex="-1"[^>]*>Remove this selection\\?</h2>`,
      ),
    );
    expect(markup).not.toMatch(/<h1/);
    const order = ["<h2", "Its creators stay", "Remove</button>"].map((text) =>
      markup.indexOf(text),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((position) => position >= 0)).toBe(true);
  });

  it("is 30 rem wide for a confirmation and 34 rem wide when it holds more, the browser keeping its own gutter", () => {
    expect(dialogClasses("confirm")).toContain("w-(--container-dialog)");
    expect(dialogClasses("wide")).toContain("w-(--container-confirm)");
    for (const size of ["confirm", "wide"] as const) {
      const classes = dialogClasses(size);
      expect(classes).toContain("bg-surface-raised");
      expect(classes).toContain("rounded-card");
      expect(classes).toContain("shadow-lg");
      expect(classes).toContain("backdrop:bg-overlay-scrim");
      // no padding on the element itself: what lands on it is the backdrop
      expect(classes).toContain("p-0");
      expect(classes).not.toMatch(/(^| )max-w-/);
    }
  });

  it("comes in over 200 ms on the standard curve and goes out over 120 ms on the exit one, by named properties, the scale under motion-safe only", () => {
    for (const classes of [dialogClasses("confirm"), filtersDialogClasses()]) {
      expect(classes).toContain("transition-discrete");
      expect(classes).not.toMatch(/transition-all/);
      expect(classes).toContain("duration-(--duration-base)");
      expect(classes).toContain("ease-(--ease-standard)");
      expect(classes).toContain("not-open:duration-(--duration-fast)");
      expect(classes).toContain("not-open:ease-(--ease-exit)");
      expect(classes).toContain("starting:opacity-0");
      expect(classes).toContain("not-open:backdrop:opacity-0");
      // every scale of the dialog is behind motion-safe: reduced motion fades, never moves
      const scales = classes.split(" ").filter((name) => /scale-/.test(name));
      expect(scales.length).toBeGreaterThan(0);
      expect(scales.every((name) => name.startsWith("motion-safe:"))).toBe(
        true,
      );
    }
  });
});

describe("RUB-T7: the dialog of the filters (C28)", () => {
  const filters = (activeCount: number) =>
    html(
      createElement(FiltersDialog, {
        open: false,
        onClose: noop,
        title: "Filters",
        groups: [
          createElement("p", { key: "a" }, "Networks"),
          createElement("p", { key: "b" }, "Languages"),
        ],
        activeCount,
        onApply: noop,
        onClear: noop,
        applyLabel: "See the 24 results",
        clearLabel: "Clear all",
        closeLabel: "Close the filters",
      }),
    );

  it("writes a head with its named cross and its title, one group per node, and a foot with « Clear all » to the left and the applying action to the right", () => {
    const markup = filters(2);
    expect(markup).toMatch(/aria-label="Close the filters"/);
    expect(markup).toMatch(/<h2[^>]*tabindex="-1"[^>]*>Filters<\/h2>/);
    expect(
      markup.match(/border-t-\(length:--border-width-thin\)/g),
    ).toHaveLength(
      3, // the two groups and the foot
    );
    const positions = [
      "Close the filters",
      ">Filters</h2>",
      "Networks",
      "Languages",
      "Clear all",
      "See the 24 results",
    ].map((text) => markup.indexOf(text));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("offers « Clear all » only when the draft holds a criterion, the button staying where it is", () => {
    expect(filters(0)).toMatch(/aria-disabled="true"[^>]*>Clear all</);
    expect(filters(3)).not.toMatch(/aria-disabled="true"[^>]*>Clear all</);
  });

  it("is 42 rem wide and 85 % high at most, a column whose body scrolls, the whole screen under 768 px", () => {
    const classes = filtersDialogClasses();
    expect(classes).toContain("w-(--container-filters)");
    expect(classes).toContain("max-h-(--size-overlay-max)");
    expect(classes).toContain("open:flex open:flex-col");
    expect(classes).toContain("max-md:h-dvh");
    expect(classes).toContain("max-md:w-screen");
    expect(classes).toContain("max-md:rounded-none");
  });

  it("applies, clears and closes nothing while it is drawn", () => {
    const calls: string[] = [];
    html(
      createElement(FiltersDialog, {
        open: true,
        onClose: () => calls.push("close"),
        title: "Filters",
        groups: [],
        activeCount: 1,
        onApply: () => calls.push("apply"),
        onClear: () => calls.push("clear"),
        applyLabel: "See the results",
        clearLabel: "Clear all",
        closeLabel: "Close",
      }),
    );
    expect(calls).toEqual([]);
  });
});

describe("RUB-T7: the filter bar (C30)", () => {
  const bar = (expanded: boolean) =>
    html(
      createElement(FilterBar, {
        label: "Search criteria",
        filtersButton: {
          label: "Filters",
          count: 2,
          countLabel: "2 active filters",
          onOpen: noop,
        },
        pills: [
          { id: "avail", label: "Available", active: true, onToggle: noop },
          { id: "theme", label: "Theme", onOpen: noop, expanded },
          {
            id: "country",
            label: "Audience country: Belgium",
            active: true,
            onClear: noop,
            clearLabel: "Remove the criterion: Audience country: Belgium",
          },
        ],
      }),
    );

  it("is a named group; a toggle says its state by aria-pressed, a pill with a menu by aria-haspopup and aria-expanded, and a pill that only offers its cross is no control", () => {
    const markup = bar(false);
    expect(markup).toMatch(/role="group" aria-label="Search criteria"/);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>Available</);
    expect(markup).toMatch(
      /aria-haspopup="dialog" aria-expanded="false"[^>]*>Theme</,
    );
    expect(markup).toMatch(
      /aria-haspopup="dialog" aria-expanded="false"[^>]*>(<svg[^>]*>.*?<\/svg>)?Filters/s,
    );
    // the static pill: its words are in a span, its only control is the cross
    expect(markup).toMatch(
      /<span class="[^"]*">Audience country: Belgium<\/span>/,
    );
    expect(markup).not.toMatch(/aria-pressed="[^"]*"[^>]*>Audience country/);
    expect(markup).not.toMatch(/<nav/);
  });

  it("turns the chevron of a pill with a menu over when it is open, and gives a pill that is a toggle none", () => {
    const rest = bar(false);
    const open = bar(true);
    expect(rest).toMatch(
      /aria-expanded="false"[^>]*>Theme<svg[^>]*class="[^"]*"/,
    );
    expect(rest).not.toMatch(/rotate-180/);
    expect(open).toMatch(/aria-expanded="true"[^>]*>Theme<svg[^>]*rotate-180/);
    // « Available » is a toggle: its control holds the label and nothing else
    expect(open).toMatch(/aria-pressed="true"[^>]*>Available<\/button>/);
  });

  it("gives the cross its own button, named, and the count its words for a screen reader", () => {
    const markup = bar(false);
    expect(markup).toMatch(
      /<button[^>]*aria-label="Remove the criterion: Audience country: Belgium"/,
    );
    expect(markup).toContain("2 active filters");
    // the hairline between the button of the filters and the criteria is decoration
    expect(markup).toMatch(
      /<span aria-hidden="true" class="[^"]*w-\(--border-width-thin\)/,
    );
  });

  it("draws members on one line that scrolls and the backoffice wrapping, the pill of the backoffice 36 px instead of 40, active by contour, ground and weight", () => {
    expect(filterBarClasses("md")).toContain("overflow-x-auto");
    expect(filterBarClasses("bo")).toContain("flex-wrap");
    expect(filterBarClasses("bo")).not.toContain("overflow-x-auto");
    expect(filterPillClasses("md", false)).toContain("min-h-(--size-pill)");
    expect(filterPillClasses("bo", false)).toContain("min-h-(--size-tag)");
    const active = filterPillClasses("md", true);
    expect(active).toContain("border-text-primary");
    expect(active).toContain("bg-surface-active");
    expect(active).toContain("font-semibold");
    expect(filterPillClasses("md", false)).not.toContain("font-semibold");
  });
});

describe("RUB-T7: the pager (C32)", () => {
  const pager = (props: Record<string, unknown>) =>
    html(
      createElement(Pager, {
        kind: "pages",
        page: 2,
        hasPrevious: true,
        hasNext: true,
        onPrevious: noop,
        onNext: noop,
        summary: "Page 2 of 5",
        label: "Result pages",
        previousLabel: "Previous page",
        nextLabel: "Next page",
        ...props,
      }),
    );

  it("is a named group and never a nav, with the two buttons around the written position", () => {
    const markup = pager({});
    expect(markup).toMatch(/role="group" aria-label="Result pages"/);
    expect(markup).not.toMatch(/<nav/);
    const positions = ["Previous page", "Page 2 of 5", "Next page"].map(
      (text) => markup.indexOf(text),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(markup).toContain('data-page="2"');
  });

  it("leaves the last page without « Next page » and keeps its place, and draws nothing where there is nowhere to go", () => {
    const last = pager({ hasNext: false });
    expect(last).not.toContain("Next page");
    expect(last).toContain("Previous page");
    // the three parts stay: the side of the missing button is still there, so the position does not move
    expect(last.match(/flex min-w-0 flex-1 items-center/g)).toHaveLength(2);
    expect(pager({ hasPrevious: false, hasNext: false })).toBe("");
  });

  it("makes both buttons unavailable while the next page is fetched, and writes the total on the line of the position", () => {
    const busy = pager({ busy: true });
    expect(busy.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(busy.match(/aria-busy="true"/g)).toHaveLength(2);
    const cursor = pager({
      kind: "cursor",
      page: undefined,
      total: "128 creators",
      summary: "Results 26 to 50",
    });
    expect(cursor).not.toContain("data-page=");
    expect(cursor).toMatch(
      /<p class="[^"]*tabular-nums[^"]*"><span>Results 26 to 50<\/span><span>128 creators<\/span><\/p>/,
    );
  });
});

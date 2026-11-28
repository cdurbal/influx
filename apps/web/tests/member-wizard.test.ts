// RUB-T8 (docs/mvp/archives/jalons/rub/annexe.md; 22-refonte-ux-ui/02b C41, C42, C49, C51): the wizard, the recap, the code field and
// the numbered steps. Server rendering, no browser: what each one writes, the roles and the names a screen reader reads,
// that « Continue » never blocks, that the code is ONE input, and the classes that carry the measures and the
// forced-colours contours. The keyboard, the paste, the focus and the pixels are the board's (e2e, RUB-T8 and RUB-AN2 08).
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnnouncerProvider } from "@/components/member/ui/Announcer";
import { NumberedSteps } from "@/components/member/ui/NumberedSteps";
import { OtpField } from "@/components/member/ui/OtpField";
import { Recap } from "@/components/member/ui/Recap";
import { Wizard, type WizardProps } from "@/components/member/ui/Wizard";
import { numberedMarkerClasses } from "@/components/member/ui/numbered-steps-classes";
import {
  otpBoxClasses,
  otpLineClasses,
} from "@/components/member/ui/otp-field-classes";
import {
  WIZARD_CLASSES,
  WIZARD_FOOT_CLASSES,
  WIZARD_SEGMENTS_CLASSES,
  WIZARD_STEP_CLASSES,
  WIZARD_TITLE_CLASSES,
  wizardSegmentClasses,
} from "@/components/member/ui/wizard-classes";

const html = (element: ReactElement) => renderToStaticMarkup(element);
const noop = () => undefined;

const SAVE = {
  state: "saved" as const,
  savedAt: "14:07",
  idleText: "Saved automatically",
  savingText: "Saving",
  savedText: (time: string) => `Saved at ${time}`,
  failedText: "Not saved",
};

const STEPS: WizardProps["steps"] = [
  {
    id: "one",
    href: "#one",
    state: "done",
    label: "Step 1 of 3: Introduce yourself, done",
  },
  {
    id: "two",
    href: "#two",
    state: "current",
    label: "Step 2 of 3: Your networks, current",
  },
  {
    id: "three",
    href: "#three",
    state: "gap",
    label: "Step 3 of 3: Your audience, to complete",
  },
];

/** The wizard alone: the region of the page is the announcer's, and only a failed save speaks to it. */
function wizard(props: Partial<WizardProps> = {}, children?: ReactElement) {
  const element = createElement(
    Wizard,
    {
      title: "Create your profile",
      progress: "Step 2 of 3",
      stepsLabel: "Steps",
      steps: STEPS,
      remaining: "About 12 min in all",
      leave: { href: "#later", label: "Save and resume later" },
      save: SAVE,
      name: "Your networks",
      intro: "What brands read first.",
      next: { label: "Continue: Your audience", onClick: noop },
      ...props,
    },
    children,
  );
  return props.save?.state === "failed"
    ? createElement(AnnouncerProvider, null, element)
    : element;
}

describe("RUB-T8: the wizard (C41)", () => {
  it("writes one h1, the count, a named list of links one per step with the current one aria-current=step, and no segment that is unavailable", () => {
    const markup = html(wizard());
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toMatch(/<h1[^>]*>Create your profile<\/h1>/);
    expect(markup).toContain("Step 2 of 3");
    expect(markup).toMatch(/<ol aria-label="Steps"/);
    const links = markup.match(/<a href="#(?:one|two|three)"[^>]*>/g) ?? [];
    expect(links).toHaveLength(3);
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    expect(markup).toMatch(
      /<a href="#two" aria-current="step"[^>]*><span class="sr-only">Step 2 of 3: Your networks, current<\/span>/,
    );
    // free navigation: a done, a current and a step to complete are all followed, none is disabled
    expect(markup).toContain(">Step 1 of 3: Introduce yourself, done<");
    expect(markup).toContain(">Step 3 of 3: Your audience, to complete<");
    for (const link of links) {
      expect(link).not.toContain(" aria-disabled=");
      expect(link).not.toContain("tabindex");
    }
  });

  it("writes the step as a section named by an h2 that the focus can land on, its introduction under it, then the badge and the fields", () => {
    const markup = html(
      wizard(
        { badge: createElement("p", null, "LAYER") },
        createElement("p", null, "FIELDS"),
      ),
    );
    const labelledBy = markup.match(
      /<section[^>]*aria-labelledby="([^"]+)"/,
    )?.[1];
    expect(labelledBy).toBeDefined();
    expect(markup).toMatch(
      new RegExp(
        `<h2 id="${labelledBy}"[^>]*tabindex="-1"[^>]*>Your networks</h2>`,
      ),
    );
    const order = [
      "<h1",
      "<ol",
      "About 12 min in all",
      "<h2",
      "What brands read first.",
      "LAYER",
      "FIELDS",
      "Continue: Your audience",
    ].map((text) => markup.indexOf(text));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(WIZARD_STEP_CLASSES).toContain("animate-fade-in");
  });

  it("never blocks « Continue »: it is a plain button, unavailable only while its request runs", () => {
    const free = html(wizard());
    const button = free.match(/<button[^>]*>Continue: Your audience<\/button>/);
    expect(button).not.toBeNull();
    expect(button?.[0]).not.toContain(" aria-disabled=");
    expect(button?.[0]).not.toContain(" disabled");
    // a gap in the steps and in the save changes nothing for it
    const gap = html(wizard({ save: { ...SAVE, state: "idle" } }));
    expect(gap).not.toMatch(/<button[^>]* aria-disabled=[^>]*>Continue/);
    const busy = html(
      wizard({
        next: { label: "Continue: Your audience", onClick: noop, busy: true },
      }),
    );
    expect(busy).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*aria-busy="true"[^>]*>Continue/,
    );
  });

  it("keeps « Previous » named at every width: the chevron alone under 480 px, the label read but not seen, no aria-label", () => {
    const markup = html(wizard({ back: { label: "Previous", onClick: noop } }));
    expect(markup).toMatch(
      /<button[^>]*max-sm:min-w-\(--size-touch-target\)[^>]*><span[^>]*aria-hidden="true"[^>]*><svg[^>]*>.*?<\/svg><\/span><span class="max-sm:sr-only">Previous<\/span><\/button>/,
    );
    expect(markup).not.toMatch(/aria-label="Previous"/);
    // the first step has none, and « Continue » stays on the right
    const first = html(wizard());
    expect(first).not.toContain("Previous");
    expect(first).toMatch(/<button[^>]*ml-auto[^>]*>Continue/);
    // a previous step that is an address is a link of the same look
    const link = html(wizard({ back: { label: "Previous", href: "#one" } }));
    expect(link).toMatch(/<a[^>]*href="#one"[^>]*>.*Previous<\/span><\/a>/);
  });

  it("draws the save status of C25 twice, in the foot from 768 px and in the line of meta under, never both at once", () => {
    const markup = html(wizard());
    expect(markup.match(/data-save-state="saved"/g)).toHaveLength(2);
    const [meta, foot] = markup.split("data-save-state").slice(1);
    expect(meta).toContain("md:hidden");
    expect(foot).toContain("max-md:hidden");
    expect(foot).toContain("flex-1");
    // the line of meta also holds the time left and the link to leave, which is a link of action
    expect(markup).toMatch(
      /<a[^>]*href="#later"[^>]*>Save and resume later<\/a>/,
    );
    const failed = html(wizard({ save: { ...SAVE, state: "failed" } }));
    expect(failed).toContain("Not saved");
  });

  it("leaves the place of a notice of the screen in the head, before the step, and writes no region of its own", () => {
    const markup = html(
      wizard({ notice: createElement("p", null, "VERSION CONFLICT") }),
    );
    expect(markup.indexOf("VERSION CONFLICT")).toBeGreaterThan(
      markup.indexOf("<ol"),
    );
    expect(markup.indexOf("VERSION CONFLICT")).toBeLessThan(
      markup.indexOf("<section"),
    );
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain("aria-live");
    expect(markup).not.toContain('role="alert"');
  });

  it("is a box of 768 px, a card from md and none on a phone, never centred, its title at 700", () => {
    expect(WIZARD_CLASSES).toContain("max-w-(--container-narrow)");
    expect(WIZARD_CLASSES).toContain("md:bg-surface-card");
    expect(WIZARD_CLASSES).toContain("md:rounded-card");
    expect(WIZARD_CLASSES).not.toContain("mx-auto");
    expect(WIZARD_CLASSES).not.toMatch(/(^| )bg-surface-card/);
    // RU-17, EC-RUB-01-3: 20 px, Manrope 700 (the header of the page keeps its 800)
    expect(WIZARD_TITLE_CLASSES).toContain("text-title-section");
    expect(WIZARD_TITLE_CLASSES).toContain("font-bold");
    expect(WIZARD_TITLE_CLASSES).not.toContain("font-extrabold");
  });

  it("fixes the foot over the bottom bar under 768 px, with its filet, and holds « Continue » on the right", () => {
    expect(WIZARD_FOOT_CLASSES).toContain("max-md:fixed");
    expect(WIZARD_FOOT_CLASSES).toContain(
      "max-md:bottom-(--size-nav-bottom-height)",
    );
    expect(WIZARD_FOOT_CLASSES).toContain("max-md:z-(--z-raised)");
    expect(WIZARD_FOOT_CLASSES).toContain("max-md:bg-surface-page");
    expect(WIZARD_FOOT_CLASSES).toContain("border-border-default");
    expect(WIZARD_FOOT_CLASSES).not.toMatch(/(^| )md:fixed/);
  });

  it("draws the segments as 6 px bars of 26 px of touch zone, one column each, the brand colour for progress and the warning colour for a gap", () => {
    expect(WIZARD_SEGMENTS_CLASSES).toContain("auto-cols-fr");
    expect(WIZARD_SEGMENTS_CLASSES).toContain("gap-1");
    for (const state of ["todo", "current", "done", "gap"] as const) {
      const classes = wizardSegmentClasses(state);
      expect(classes).toContain("h-(--size-segment-bar)");
      expect(classes).toContain("before:inset-y-(--inset-segment-hit)");
      // 320 ms on the curve standard, never `all`
      expect(classes).toContain("transition-colors");
      expect(classes).toContain("duration-(--duration-slow)");
      expect(classes).not.toContain("transition-all");
      // the ring replaces the contour at focus
      expect(classes).toContain("focus-visible:outline-focus-ring");
    }
    expect(wizardSegmentClasses("done")).toContain("bg-brand-primary");
    expect(wizardSegmentClasses("current")).toContain("bg-brand-primary");
    expect(wizardSegmentClasses("gap")).toContain("bg-feedback-warning-icon");
    expect(wizardSegmentClasses("todo")).toContain("bg-surface-active");
  });

  it("gives every segment a transparent contour for forced colours, thin on all and thick on the done and the current one (AP1)", () => {
    for (const state of ["todo", "current", "done", "gap"] as const) {
      expect(wizardSegmentClasses(state)).toContain("outline-transparent");
    }
    for (const state of ["done", "current"] as const) {
      expect(wizardSegmentClasses(state)).toContain(
        "outline-(length:--border-width-thick)",
      );
    }
    for (const state of ["todo", "gap"] as const) {
      expect(wizardSegmentClasses(state)).toContain(
        "outline-(length:--border-width-thin)",
      );
      expect(wizardSegmentClasses(state)).not.toContain("--border-width-thick");
    }
  });
});

describe("RUB-T8: the numbered steps (C51)", () => {
  const STATE_LABELS = {
    todo: "To do: ",
    current: "Current: ",
    done: "Done: ",
  };

  it("writes a named ordered list, the current step aria-current=step, a check for a done step and the number for the others", () => {
    const markup = html(
      createElement(NumberedSteps, {
        label: "Steps to change the address",
        stateLabels: STATE_LABELS,
        items: [
          { label: "Enter the new address", state: "done" },
          { label: "Confirm it is you", state: "current" },
          { label: "Enter the two codes" },
        ],
      }),
    );
    expect(markup).toMatch(/<ol aria-label="Steps to change the address"/);
    expect(markup.match(/<li/g)).toHaveLength(3);
    expect(markup.match(/aria-current="step"/g)).toHaveLength(1);
    const [done, current, todo] = markup.split("<li").slice(1);
    expect(done).toContain("<svg");
    expect(done).not.toMatch(/>1</);
    expect(current).toMatch(/>2</);
    expect(todo).toMatch(/>3</);
    // the marker is decoration: the state is written before the label, for the screen reader
    expect(done).toContain(
      '<span class="sr-only">Done: </span>Enter the new address',
    );
    expect(current).toContain('<span class="sr-only">Current: </span>');
    expect(todo).toContain('<span class="sr-only">To do: </span>');
  });

  it("writes the body of a step under its label, and nothing under the others", () => {
    const markup = html(
      createElement(NumberedSteps, {
        items: [
          { label: "One", state: "current", body: "A code goes to both." },
          { label: "Two" },
        ],
      }),
    );
    expect(markup).toContain("A code goes to both.");
    expect(markup.match(/font-regular/g)).toHaveLength(1);
    expect(markup).not.toContain("aria-label=");
    expect(markup).not.toContain("sr-only");
  });

  it("lights the current marker with a contour that forced colours draw, and tells a done step by a check on the success ground", () => {
    expect(numberedMarkerClasses("current")).toContain("outline-transparent");
    expect(numberedMarkerClasses("current")).toContain("bg-surface-active");
    expect(numberedMarkerClasses("done")).toContain("bg-feedback-success-bg");
    expect(numberedMarkerClasses("todo")).toContain("bg-surface-raised");
    for (const state of ["todo", "current", "done"] as const) {
      // 28 px, round, never green
      expect(numberedMarkerClasses(state)).toContain(
        "size-(--size-step-marker)",
      );
      expect(numberedMarkerClasses(state)).toContain("rounded-round");
      expect(numberedMarkerClasses(state)).not.toContain("brand");
    }
  });
});

describe("RUB-T8: the recap (C42)", () => {
  const SECTIONS = [
    {
      id: "intro",
      title: "1. Introduce yourself",
      editHref: "#one",
      items: [
        { label: "Headline", value: "Seasonal vegan cooking" },
        { label: "Bio", value: "", empty: true },
      ],
      missing: ["To complete: the bio"],
    },
    {
      id: "lines",
      title: "2. Your editorial line",
      editHref: "#two",
      items: [{ label: "Themes", value: "Cooking, family" }],
    },
  ];

  it("writes one section per step, named by its h3, with a link to edit that names the section for a screen reader", () => {
    const markup = html(
      createElement(Recap, {
        sections: SECTIONS,
        editLabel: "Edit",
        emptyLabel: "Not provided",
      }),
    );
    expect(markup.match(/<section/g)).toHaveLength(2);
    expect(markup).toMatch(
      /<section aria-labelledby="recap-intro"[^>]*><div[^>]*><h3 id="recap-intro"[^>]*>1\. Introduce yourself<\/h3>/,
    );
    expect(markup).toMatch(
      /<a href="#one"[^>]*>Edit<span class="sr-only">: 1\. Introduce yourself<\/span><\/a>/,
    );
    expect(markup).not.toContain("<h1");
    expect(markup).not.toContain("<h2");
  });

  it("reads the answers in a list of properties on a label of 11 rem, an empty answer said in words", () => {
    const markup = html(
      createElement(Recap, {
        sections: SECTIONS,
        editLabel: "Edit",
        emptyLabel: "Not provided",
      }),
    );
    expect(markup.match(/<dl/g)).toHaveLength(2);
    expect(markup).toContain("--size-property-label-summary");
    expect(markup).toContain("Seasonal vegan cooking");
    expect(markup).toContain("Not provided");
  });

  it("shows what is missing as a line of warning with its icon, only in the section that misses it, and blocks nothing", () => {
    const markup = html(
      createElement(Recap, {
        sections: SECTIONS,
        editLabel: "Edit",
      }),
    );
    expect(markup.match(/To complete: the bio/g)).toHaveLength(1);
    const [first, second] = markup.split("<section").slice(1);
    expect(first).toMatch(
      /<p[^>]*text-feedback-warning-text[^>]*><svg[^>]*aria-hidden="true"/,
    );
    expect(second).not.toContain("text-feedback-warning-text");
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain("<button");
  });
});

describe("RUB-T8: the code field (C49)", () => {
  const code = (props: Record<string, unknown> = {}) =>
    html(
      createElement(OtpField, {
        id: "code",
        label: "6-digit code",
        value: "123",
        onChange: noop,
        ...props,
      }),
    );

  it("writes ONE input, named by its label, one-time-code on a numeric keyboard, under six boxes that a screen reader skips", () => {
    const markup = code({
      requiredLabel: "required",
      help: "Stay in this tab.",
    });
    expect(markup.match(/<input/g)).toHaveLength(1);
    expect(markup).toMatch(/<label for="code"[^>]*>6-digit code/);
    expect(markup).toMatch(/<input id="code"/);
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('autoComplete="one-time-code"');
    expect(markup).not.toContain("maxLength");
    const boxes = markup.match(/<span aria-hidden="true" data-otp-box=/g);
    expect(boxes).toHaveLength(6);
    expect(markup).toMatch(/aria-describedby="code-help"/);
    // the digits typed fill the first boxes
    expect(markup).toMatch(/data-otp-box="rest"[^>]*>1<\/span>/);
    expect(markup).toContain('value="123"');
  });

  it("keeps the digits of what it is given, in order and no more than six, whatever the separators", () => {
    expect(code({ value: "123 456" })).toContain('value="123456"');
    expect(code({ value: "12-34.56" })).toContain('value="123456"');
    expect(code({ value: "12345678" })).toContain('value="123456"');
    expect(code({ value: "ab" })).toContain('value=""');
  });

  it("draws the error on the six boxes and ties the input to its message", () => {
    const markup = code({ error: "This code is wrong. 4 tries left." });
    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toMatch(/aria-describedby="code-error"/);
    expect(markup).toContain("This code is wrong. 4 tries left.");
    expect(markup.match(/data-otp-box="invalid"/g)).toHaveLength(6);
    // an error drawn without a text of its own is the screen's: the boxes still say it
    const drawn = code({ invalid: true });
    expect(drawn.match(/data-otp-box="invalid"/g)).toHaveLength(6);
    expect(drawn).toContain('aria-invalid="true"');
  });

  it("is unavailable while a check runs or when the tries are used up, and calls nothing while it draws", () => {
    let called = 0;
    const count = () => {
      called += 1;
    };
    const busy = code({ busy: true, onChange: count });
    expect(busy).toContain("readOnly");
    expect(busy).toContain('aria-busy="true"');
    const blocked = code({ disabled: true, onChange: count });
    expect(blocked).toMatch(/<input[^>]*disabled/);
    expect(blocked.match(/data-otp-box="disabled"/g)).toHaveLength(6);
    expect(called).toBe(0);
  });

  it("draws a box of 5 to 6 whose outline changes the colour and never the size, the next digit's box in the ring colour", () => {
    for (const state of ["rest", "current", "invalid", "disabled"] as const) {
      const classes = otpBoxClasses(state);
      expect(classes).toContain("aspect-otp");
      expect(classes).toContain("bg-surface-raised");
      expect(classes).toContain("transition-colors");
      expect(classes).not.toMatch(/(^| )h-/);
      expect(classes).not.toContain("transition-all");
    }
    expect(otpBoxClasses("current")).toContain("border-focus-ring");
    expect(otpBoxClasses("invalid")).toContain("border-border-error");
    expect(otpBoxClasses("invalid")).toContain("--border-width-thick");
    expect(otpBoxClasses("rest")).toContain("--border-width-thin");
  });

  it("writes the line variant as one visible field of 12 rem with the digits spaced, and no box", () => {
    const markup = code({ variant: "line" });
    expect(markup.match(/<input/g)).toHaveLength(1);
    expect(markup).not.toContain("data-otp-box");
    expect(markup).toContain("tracking-code-entry");
    expect(markup).toContain("max-w-(--size-date)");
    expect(markup).not.toContain("opacity-0");
    expect(otpLineClasses(true)).toContain("border-border-error");
  });
});

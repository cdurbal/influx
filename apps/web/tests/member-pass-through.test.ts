// RUB-T12 (docs/mvp/jalons/rub/annexe.md; 22-refonte-ux-ui/02c, head; RUBT-4): every module of the catalogue takes
// `id`, `data-*` and `aria-*` and sets them on its root, a field `id` and `aria-*` on its control and `data-*` on its
// root, and nothing else goes through. Server rendering, no browser. `CATALOGUE_MODULES` is read as it is: a module
// without a rendering here fails.
import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionLink } from "@/components/member/ui/ActionLink";
import { AnnouncerProvider } from "@/components/member/ui/Announcer";
import { BrandHero } from "@/components/member/ui/BrandHero";
import { Button } from "@/components/member/ui/Button";
import { Card } from "@/components/member/ui/Card";
import { CardActions } from "@/components/member/ui/CardActions";
import { ChipList } from "@/components/member/ui/ChipList";
import { ChoiceGroup } from "@/components/member/ui/ChoiceGroup";
import { CounterBadge } from "@/components/member/ui/CounterBadge";
import { DateField } from "@/components/member/ui/DateField";
import { Dialog } from "@/components/member/ui/Dialog";
import { Disclosure } from "@/components/member/ui/Disclosure";
import { DomainField } from "@/components/member/ui/DomainField";
import { EmptyState } from "@/components/member/ui/EmptyState";
import { ErrorSummary, MissingList } from "@/components/member/ui/ErrorSummary";
import { FeedCard } from "@/components/member/ui/FeedCard";
import { Field, FieldGrid } from "@/components/member/ui/Field";
import { FieldMessage } from "@/components/member/ui/FieldMessage";
import { FilterBar } from "@/components/member/ui/FilterBar";
import { FiltersDialog } from "@/components/member/ui/FiltersDialog";
import { InnerPanel } from "@/components/member/ui/InnerPanel";
import { InternalZone } from "@/components/member/ui/InternalZone";
import { KeyFigures } from "@/components/member/ui/KeyFigures";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import { LogoPlate } from "@/components/member/ui/LogoPlate";
import { MediaGallery } from "@/components/member/ui/MediaGallery";
import { Notice } from "@/components/member/ui/Notice";
import { NumberedSteps } from "@/components/member/ui/NumberedSteps";
import { OtpField } from "@/components/member/ui/OtpField";
import { PageFrame } from "@/components/member/ui/PageFrame";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { Pager } from "@/components/member/ui/Pager";
import { PhotoCard } from "@/components/member/ui/PhotoCard";
import { PreviewFrame } from "@/components/member/ui/PreviewFrame";
import { PropertyList } from "@/components/member/ui/PropertyList";
import { RangeBar } from "@/components/member/ui/RangeBar";
import { ReadingLayout } from "@/components/member/ui/ReadingLayout";
import { ReasonList } from "@/components/member/ui/ReasonList";
import { Recap } from "@/components/member/ui/Recap";
import { RoleBadge } from "@/components/member/ui/RoleBadge";
import { RowList } from "@/components/member/ui/RowList";
import { SaveStatus } from "@/components/member/ui/SaveStatus";
import { ScoreGauge } from "@/components/member/ui/ScoreGauge";
import { Section } from "@/components/member/ui/Section";
import { SegmentedControl } from "@/components/member/ui/SegmentedControl";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { Skeleton } from "@/components/member/ui/Skeleton";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import {
  MobileActionBar,
  StickyAside,
} from "@/components/member/ui/StickyAside";
import { TagPicker } from "@/components/member/ui/TagPicker";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { TextField } from "@/components/member/ui/TextField";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { Wizard } from "@/components/member/ui/Wizard";
import { passThroughOf } from "@/components/member/ui/pass-through";
import { CATALOGUE_MODULES } from "./catalogue-data";

type Given = Record<string, unknown>;

/** Where `id` and the `aria-*` must land; the `data-*` always land on the root. */
type Landing = "root" | "control";

/** One form of a component: a rendering with the attributes a caller adds, and where each of them lands. */
type Shape = {
  form: string;
  render: (given: Given) => ReactElement;
  id: Landing;
  aria: Landing;
  /** `Button` and `PageFrame` take the attributes of their element, which their properties type. */
  element?: true;
};

const noop = () => undefined;

/** A form of a component on its root, with the properties it needs to draw. */
function shape<Properties>(
  form: string,
  component: ComponentType<Properties>,
  properties: NoInfer<Properties>,
  landing: Partial<Pick<Shape, "id" | "aria" | "element">> = {},
): Shape {
  return {
    form,
    render: (given) =>
      createElement(component as ComponentType<object>, {
        ...(properties as object),
        ...given,
      }),
    id: "root",
    aria: "root",
    ...landing,
  };
}

/** `id` and the `aria-*` on the control, the `data-*` on the root. */
const FIELD = { id: "control", aria: "control" } as const;
/** A group of choices: `id` on its first control, the `aria-*` on the `fieldset`, which is its root. */
const GROUP = { id: "control", aria: "root" } as const;

const LABELLED = { label: "Label" };
const OPTIONS = [{ code: "one", label: "One" }];
const SEGMENTS = [{ value: "one", label: "One", href: "#one" }];
const ICON = () => null;
const FIELD_IDS = {
  control: "field",
  layer: "field-layer",
  help: "field-help",
  error: "field-error",
  warning: "field-warning",
  counter: "field-counter",
  suffix: "field-suffix",
};
const TEXT = {
  name: "text",
  label: "Label",
  value: "",
  onChange: noop,
  maxLength: 10,
};
const GROUP_TEXTS = { label: "Label", options: OPTIONS, onChange: noop };
const SAVE = {
  state: "idle",
  idleText: "Saved automatically",
  savingText: "Saving",
  savedText: (time: string) => time,
  failedText: "Not saved",
} as const;
const PHOTO = {
  href: "#profile",
  media: [{ src: "/one.jpg", alt: "One" }],
  name: "Profile 93JMS4",
  lines: ["Line"],
  saveLabel: "Add",
};
const DIALOG = { open: false, onClose: noop, title: "Title" };

const RENDERINGS = {
  ActionLink: [
    shape("link", ActionLink, { href: "#a", children: "Go" }),
    shape("button", ActionLink, { children: "Do" }),
  ],
  Announcer: [shape("region", AnnouncerProvider, { children: null })],
  BrandHero: [shape("hero", BrandHero, { name: "Brand", meta: "Meta" })],
  Button: [
    shape("button", Button, { children: "Do" }, { element: true }),
    shape("link", Button, { href: "#a", children: "Go" }, { element: true }),
  ],
  Card: [
    shape("plain", Card, { children: "Body" }),
    shape("link", Card, { variant: "link", href: "#a", title: "Title" }),
  ],
  CardActions: [shape("row", CardActions, { children: "Body" })],
  ChipList: [shape("list", ChipList, { items: ["One"], label: "Topics" })],
  ChoiceGroup: [
    shape(
      "boxes",
      ChoiceGroup,
      { ...GROUP_TEXTS, type: "checkbox", value: [] },
      GROUP,
    ),
    shape(
      "radios",
      ChoiceGroup,
      { ...GROUP_TEXTS, type: "radio", name: "one", value: null },
      GROUP,
    ),
  ],
  CounterBadge: [shape("pill", CounterBadge, { count: 3, label: "3 new" })],
  DateField: [
    shape(
      "field",
      DateField,
      {
        name: "date",
        label: "Label",
        value: null,
        onChange: noop,
        locale: "en",
        formatError: "Format",
      },
      FIELD,
    ),
  ],
  Dialog: [shape("dialog", Dialog, DIALOG)],
  Disclosure: [
    shape("fold", Disclosure, { variant: "optional", summary: "More" }),
  ],
  DomainField: [shape("field", DomainField, TEXT, FIELD)],
  EmptyState: [
    shape("block", EmptyState, { kind: "empty", title: "Nothing" }),
    shape("line", EmptyState, { kind: "inline", title: "Nothing" }),
  ],
  ErrorSummary: [
    shape("summary", ErrorSummary, {
      title: "Errors",
      items: [{ fieldId: "a", label: "A", reason: "Why" }],
    }),
    shape("missing", MissingList, {
      items: [{ id: "a", label: "A", href: "#a" }],
      actionLabel: "Complete",
    }),
  ],
  FeedCard: [
    shape("card", FeedCard, {
      href: "#a",
      brand: "Brand",
      title: "Title",
      due: { label: "Soon" },
      meta: [],
    }),
  ],
  Field: [
    shape("single", Field, { ...LABELLED, ids: FIELD_IDS, kind: "single" }),
    shape("group", Field, { ...LABELLED, ids: FIELD_IDS, kind: "group" }),
    shape("grid", FieldGrid, { children: "Body" }),
  ],
  FieldMessage: [
    shape("message", FieldMessage, { kind: "error", children: "Why" }),
  ],
  FilterBar: [shape("bar", FilterBar, { label: "Criteria", pills: [] })],
  FiltersDialog: [
    shape("dialog", FiltersDialog, {
      ...DIALOG,
      groups: [],
      activeCount: 0,
      onApply: noop,
      onClear: noop,
      applyLabel: "Apply",
      clearLabel: "Clear",
      closeLabel: "Close",
    }),
  ],
  InnerPanel: [
    shape("panel", InnerPanel, { title: "Title" }),
    shape("readonly", InnerPanel, { variant: "readonly", title: "Title" }),
    shape("preview", InnerPanel, { variant: "preview", title: "Title" }),
  ],
  InternalZone: [shape("zone", InternalZone, { title: "Title" })],
  KeyFigures: [
    shape("list", KeyFigures, {
      variant: "figures",
      items: [{ label: "A", value: "1" }],
    }),
  ],
  LayerBadge: [
    shape("whole", LayerBadge, { layer: "public", label: "Public" }),
    shape("icon", LayerBadge, {
      layer: "public",
      label: "Public",
      iconOnly: true,
    }),
  ],
  LogoPlate: [
    shape("picture", LogoPlate, {
      src: "/logo.png",
      name: "Brand",
      size: 32,
      shape: "plate",
    }),
    shape("initials", LogoPlate, { name: "Brand", size: 32, shape: "plate" }),
  ],
  MediaGallery: [
    shape("gallery", MediaGallery, {
      items: [{ src: "/one.jpg", alt: "One" }],
      allLabel: "All",
      title: "Title",
      closeLabel: "Close",
      emptyLabel: "None",
    }),
    shape("empty", MediaGallery, {
      items: [],
      allLabel: "All",
      title: "Title",
      closeLabel: "Close",
      emptyLabel: "None",
    }),
  ],
  Notice: [shape("notice", Notice, { tone: "info", children: "Body" })],
  NumberedSteps: [
    shape("list", NumberedSteps, { items: [{ label: "One" }] }),
    shape("named", NumberedSteps, { items: [{ label: "One" }], label: "Name" }),
  ],
  OtpField: [
    shape(
      "boxes",
      OtpField,
      { label: "Code", value: "", onChange: noop },
      FIELD,
    ),
    shape(
      "line",
      OtpField,
      { label: "Code", value: "", onChange: noop, variant: "line" },
      FIELD,
    ),
  ],
  PageFrame: [
    shape(
      "frame",
      PageFrame,
      { variant: "wide", children: "Body" },
      { element: true },
    ),
  ],
  PageHeader: [shape("header", PageHeader, { title: "Title" })],
  Pager: [
    shape("foot", Pager, {
      kind: "cursor",
      hasPrevious: false,
      hasNext: true,
      onPrevious: noop,
      onNext: noop,
      label: "Pages",
      previousLabel: "Previous",
      nextLabel: "Next",
    }),
  ],
  PhotoCard: [
    shape("search", PhotoCard, {
      ...PHOTO,
      variant: "search",
      carousel: { label: "Visuals", previous: "Previous", next: "Next" },
    }),
    shape("shortlist", PhotoCard, { ...PHOTO, variant: "shortlist" }),
  ],
  PreviewFrame: [
    shape("frame", PreviewFrame, {
      label: "Preview",
      variant: "zone",
      children: "Body",
    }),
  ],
  PropertyList: [
    shape("list", PropertyList, { items: [{ label: "A", value: "1" }] }),
    shape("columns", PropertyList, {
      items: [{ label: "A", value: "1" }],
      columns: 2,
    }),
  ],
  RangeBar: [
    shape("list", RangeBar, {
      items: [{ label: "A", from: 10, to: 20, valueLabel: "10 to 20" }],
    }),
  ],
  ReadingLayout: [
    shape("layout", ReadingLayout, {
      main: "Main",
      aside: "Aside",
      asideLabel: "Box",
    }),
  ],
  ReasonList: [
    shape("list", ReasonList, {
      items: [{ icon: ICON, title: "A", body: "B" }],
    }),
  ],
  Recap: [shape("recap", Recap, { sections: [], editLabel: "Edit" })],
  RoleBadge: [shape("pill", RoleBadge, { role: "creator", label: "Creator" })],
  RowList: [
    shape("list", RowList, {
      variant: "campaign",
      items: [{ id: "a", title: "A" }],
      label: "Rows",
    }),
  ],
  SaveStatus: [shape("status", SaveStatus, SAVE)],
  ScoreGauge: [
    shape("gauge", ScoreGauge, { label: "A", value: 10, valueText: "10 %" }),
  ],
  Section: [
    shape("section", Section, {
      title: "Title",
      variant: "page",
      children: "Body",
    }),
  ],
  SegmentedControl: [
    shape("radio", SegmentedControl, {
      kind: "radio",
      label: "Display",
      value: "one",
      options: SEGMENTS,
      onChange: noop,
    }),
    shape("tabs", SegmentedControl, {
      kind: "tabs",
      label: "Display",
      value: "one",
      options: SEGMENTS,
      onChange: noop,
    }),
    shape("views", SegmentedControl, {
      kind: "views",
      label: "Display",
      value: "one",
      options: SEGMENTS,
    }),
  ],
  SingleChoiceField: [
    shape(
      "select",
      SingleChoiceField,
      { ...GROUP_TEXTS, name: "one", value: null },
      FIELD,
    ),
    shape(
      "radios",
      SingleChoiceField,
      { ...GROUP_TEXTS, name: "one", value: null, display: "radios" },
      GROUP,
    ),
  ],
  Skeleton: [shape("block", Skeleton, { shape: "card", label: "Loading" })],
  StatusBadge: [
    shape("pill", StatusBadge, { tone: "neutral", children: "State" }),
  ],
  StickyAside: [
    shape("aside", StickyAside, { label: "Box", children: "Body" }),
    shape("bar", MobileActionBar, {
      label: "Box",
      text: "Text",
      action: "Action",
    }),
  ],
  TagPicker: [
    shape(
      "field",
      TagPicker,
      {
        name: "tags",
        label: "Label",
        options: OPTIONS,
        value: [],
        onChange: noop,
        max: 3,
        limitText: "3 at most",
        countText: "0 of 3",
        limitReachedText: "Full",
        addLabel: "Add",
        listLabel: "Chosen",
        removeLabel: (label: string) => label,
      },
      FIELD,
    ),
  ],
  TextAreaField: [
    shape(
      "field",
      TextAreaField,
      { ...TEXT, counterText: (count: number) => `${count}` },
      FIELD,
    ),
  ],
  TextField: [shape("field", TextField, TEXT, FIELD)],
  VerifiedBadge: [shape("badge", VerifiedBadge, { text: "Verified" })],
  Wizard: [
    shape("wizard", Wizard, {
      title: "Title",
      progress: "1 of 2",
      stepsLabel: "Steps",
      steps: [],
      leave: { href: "#a", label: "Leave" },
      save: SAVE,
      name: "Step",
      next: { label: "Next", onClick: noop },
    }),
  ],
};

const PROBES = {
  id: "probe-id",
  "data-probe": "kept",
  "aria-describedby": "probe-text",
  "aria-details": "probe-details",
};

/** What no component of the catalogue passes on, written as a caller that spreads too much would give it. */
const FOREIGN = {
  lang: "probe-lang",
  tabIndex: 77,
  style: { color: "red" },
  dangerouslySetInnerHTML: { __html: "probe-html" },
};

/** The opening tags of a markup, in order; React writes the preload of a picture before the root. */
function tagsOf(markup: string): string[] {
  return (markup.match(/<[a-z][^>]*>/g) ?? []).filter(
    (tag) => !tag.startsWith("<link"),
  );
}

/** The value of an attribute of an opening tag, or null. */
function attributeOf(tag: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

/** The probes that are not where the shape expects them, or that are written more than once. */
function lostProbes(subject: Shape): string[] {
  const markup = renderToStaticMarkup(subject.render(PROBES));
  const tags = tagsOf(markup);
  const root = tags[0] ?? "";
  const control =
    tags.find((tag) => /^<(?:input|select|textarea)\b/.test(tag)) ?? "";
  const on = (landing: Landing) => (landing === "root" ? root : control);
  const lost: string[] = [];
  const once = (text: string) => markup.split(text).length === 2;
  if (
    attributeOf(on(subject.id), "id") !== PROBES.id ||
    !once(` id="${PROBES.id}"`)
  ) {
    lost.push("id");
  }
  if (
    attributeOf(root, "data-probe") !== PROBES["data-probe"] ||
    !once(" data-probe=")
  ) {
    lost.push("data-probe");
  }
  const describedBy =
    attributeOf(on(subject.aria), "aria-describedby")?.split(" ") ?? [];
  if (
    !describedBy.includes(PROBES["aria-describedby"]) ||
    !once(PROBES["aria-describedby"])
  ) {
    lost.push("aria-describedby");
  }
  if (
    attributeOf(on(subject.aria), "aria-details") !== PROBES["aria-details"] ||
    !once(" aria-details=")
  ) {
    lost.push("aria-details");
  }
  return lost;
}

/** The foreign attributes a rendering lets through. */
function foreignThrough(subject: Shape): string[] {
  const markup = renderToStaticMarkup(subject.render(FOREIGN));
  return ["probe-lang", 'tabindex="77"', "color:red", "probe-html"].filter(
    (text) => markup.toLowerCase().includes(text),
  );
}

/** The root of a rendering. */
const rootOf = (element: ReactElement) =>
  tagsOf(renderToStaticMarkup(element))[0] ?? "";

describe("RUB-T12: the catalogue passes id, data and aria attributes on (02c)", () => {
  it.each(CATALOGUE_MODULES)(
    "%s sets them on its root, or on its control, and passes nothing else on",
    (file) => {
      const name = file.replace(/\.tsx$/, "");
      const shapes = RENDERINGS[name as keyof typeof RENDERINGS] as
        Shape[] | undefined;
      expect(shapes, `no rendering for ${name}`).toBeDefined();
      for (const subject of shapes ?? []) {
        expect(lostProbes(subject), `${name} (${subject.form})`).toEqual([]);
        if (subject.element !== true) {
          expect(foreignThrough(subject), `${name} (${subject.form})`).toEqual(
            [],
          );
        }
      }
    },
  );

  it("detects a module that loses them, and one that keeps its id alone", () => {
    const losing = () => createElement("div");
    expect(lostProbes(shape("losing", losing, {}))).toEqual(
      Object.keys(PROBES),
    );
    const idOnly = ({ id }: { id?: string }) => createElement("div", { id });
    expect(lostProbes(shape("id only", idOnly, {}))).toEqual(
      Object.keys(PROBES).slice(1),
    );
    const everything = (properties: object) =>
      createElement("div", properties as Record<string, unknown>);
    expect(foreignThrough(shape("everything", everything, {}))).not.toEqual([]);
  });

  it("keeps id, data and aria alone among the properties left over", () => {
    expect(
      passThroughOf({
        ...PROBES,
        ...FOREIGN,
        className: "x",
        onClick: noop,
        role: "x",
      }),
    ).toEqual(PROBES);
  });

  it("adds the ids received after those the module writes, and keeps the aria the module manages", () => {
    const markup = renderToStaticMarkup(
      createElement(TextField, {
        ...TEXT,
        id: "title",
        help: "Help",
        error: "Why",
        "aria-describedby": "probe-text",
        "aria-invalid": false,
      } as Parameters<typeof TextField>[0]),
    );
    const input = /<input[^>]*>/.exec(markup)?.[0] ?? "";
    expect(attributeOf(input, "aria-describedby")).toBe(
      "title-help title-error probe-text",
    );
    expect(attributeOf(input, "aria-invalid")).toBe("true");
  });

  it("gives a root named by its module no other name, and keeps the data the module writes", () => {
    const received = {
      "aria-label": "Other",
      "aria-labelledby": "other",
    };
    const list = rootOf(
      createElement(RowList, {
        variant: "campaign",
        items: [],
        label: "Rows",
        ...received,
      }),
    );
    expect(attributeOf(list, "aria-label")).toBe("Rows");
    expect(attributeOf(list, "aria-labelledby")).toBeNull();
    const unnamed = rootOf(
      createElement(NumberedSteps, { items: [], ...received }),
    );
    expect(attributeOf(unnamed, "aria-label")).toBe("Other");
    const section = rootOf(
      createElement(Section, {
        title: "Title",
        variant: "page",
        children: "Body",
        "aria-labelledby": "other",
      } as Parameters<typeof Section>[0]),
    );
    expect(attributeOf(section, "aria-labelledby")).not.toBe("other");
    const badge = rootOf(
      createElement(Disclosure, {
        variant: "fold",
        summary: "More",
        "data-disclosure": "other",
      } as Parameters<typeof Disclosure>[0]),
    );
    expect(attributeOf(badge, "data-disclosure")).toBe("fold");
  });
});

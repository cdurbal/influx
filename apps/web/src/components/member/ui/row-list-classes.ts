// Classes of the list of rows of the connected spaces (docs/mvp/22-refonte-ux-ui/02a C06, 17 §2.4): a `ul`
// with a hairline above and between the rows, a row of 60 px at least (44 + 16), 8 × 12 of padding, 4 × 16
// of gap. The link of the title is stretched over the row; an action in the row stands above it. The ring is
// drawn inside the row, on the stretched link. A linked row takes `surface-raised` on hover (120 ms). The
// current row takes `surface-hover` and a transparent contour: the fills fall away under forced colours and
// the system then draws it (AP1, 20 §11.8). The eight variants (EC-RUB-2) are the keys of their object, not
// quoted strings (TK7.2); a form of the mockups that is not a variant is a combination of fields (RUB-B §4).
import { cn } from "@/components/ui/class-names";

/** What a variant decides: the classes of each part of a row, and the choices that are not classes. */
type RowParts = {
  list: string;
  row: string;
  media: string;
  body: string;
  text: string;
  trail: string;
  action: string;
  title: string;
  sub: string;
  /** A row that leads somewhere ends with a chevron. */
  chevron: boolean;
  /** The campaign row has columns from 768 px, by the fields it shows. */
  columns: boolean;
  /** Alignment and padding of a row without and with a `sub` line, where the variant has both (`mini`). */
  alone: string;
  withSub: string;
};

const ROW_SUBTLE_CLASSES = "border-border-subtle";
const ROW_DEFAULT_CLASSES = "border-border-default";

const ROW_LIST_CLASSES = "flex flex-col border-t-(length:--border-width-thin)";

/** 60 px: the touch target of the members and a 16 px breathing room (02a C06). */
const ROW_MIN_HEIGHT_CLASSES =
  "min-h-[calc(var(--size-touch-target)+var(--spacing-4))]";

const ROW_BASE_CLASSES =
  "relative flex gap-y-1 border-b-(length:--border-width-thin) px-2 transition-colors";

/** A row is its base, the colour of its hairline, then the height, the gap, the padding and the alignment it chooses. */
function rowOf(border: string, ...choices: ReadonlyArray<string | false>) {
  return cn(ROW_BASE_CLASSES, border, ...choices);
}

const ROW_TEXT_CLASSES = "flex min-w-0 flex-col gap-1";
const ROW_BODY_CLASSES = "flex min-w-0 flex-1 flex-col gap-1";
const ROW_TRAIL_CLASSES =
  "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary";
const ROW_MEDIA_CLASSES = "flex shrink-0 items-center";
/** An action in a row stands above the stretched link and keeps its own width. */
const ROW_ACTION_CLASSES = "relative z-(--z-raised) shrink-0";

/** The title: Manrope 700, 16 px (14 in the dense variants of the backoffice). */
const ROW_TITLE_CLASSES = "font-display text-md font-bold leading-snug";
const ROW_DENSE_TITLE_CLASSES = "font-display text-sm font-bold leading-snug";
const ROW_SUB_CLASSES = "text-sm text-text-secondary";

const ROW_STANDARD_PARTS: RowParts = {
  list: cn(ROW_LIST_CLASSES, ROW_SUBTLE_CLASSES),
  row: rowOf(
    ROW_SUBTLE_CLASSES,
    ROW_MIN_HEIGHT_CLASSES,
    "items-center gap-x-4 py-3",
  ),
  media: ROW_MEDIA_CLASSES,
  body: ROW_BODY_CLASSES,
  text: ROW_TEXT_CLASSES,
  trail: ROW_TRAIL_CLASSES,
  action: ROW_ACTION_CLASSES,
  title: ROW_TITLE_CLASSES,
  sub: ROW_SUB_CLASSES,
  chevron: false,
  columns: false,
  alone: "",
  withSub: "",
};

/**
 * `campaign` from 768 px: the title, then the state, then the date, then the chevron, in the columns of the
 * grid `--grid-campaign-row`; under it the state and the date stack under the title. In a grid, the body and
 * the trail dissolve (`contents`) so that their children are the cells; each cell names its column, a missing
 * field leaving its column empty. Without a grid they keep their boxes, the body taking the free width.
 */
const ROW_CAMPAIGN_FULL_CLASSES = {
  row: "md:grid md:grid-cols-(--grid-campaign-row)",
  dissolve: "md:contents",
  meta: "md:col-start-2",
  end: "md:col-start-3",
  chevron: "md:col-start-4",
};

/** `campaign` without a date: the state sits to the right, against the chevron (`1fr auto auto`). */
const ROW_CAMPAIGN_META_CLASSES = {
  row: "md:grid md:grid-cols-[minmax(0,1fr)_auto_auto]",
  dissolve: "md:contents",
  meta: "md:col-start-2",
  end: "md:col-start-2",
  chevron: "md:col-start-3",
};

const ROW_VARIANT_CLASSES = {
  campaign: {
    ...ROW_STANDARD_PARTS,
    chevron: true,
    columns: true,
  },
  feed: { ...ROW_STANDARD_PARTS, chevron: true },
  lists: {
    ...ROW_STANDARD_PARTS,
    media: cn(ROW_MEDIA_CLASSES, "max-form:hidden"),
    chevron: true,
  },
  tasks: {
    ...ROW_STANDARD_PARTS,
    list: cn(ROW_LIST_CLASSES, ROW_DEFAULT_CLASSES),
    row: rowOf(
      ROW_DEFAULT_CLASSES,
      ROW_MIN_HEIGHT_CLASSES,
      "flex-col items-stretch gap-x-4 py-3 form:flex-row form:items-center",
    ),
    body: cn(ROW_BODY_CLASSES, "form:contents"),
    text: cn(ROW_TEXT_CLASSES, "form:flex-1"),
    trail: cn(ROW_TRAIL_CLASSES, "form:shrink-0 form:whitespace-nowrap"),
  },
  hub: {
    ...ROW_STANDARD_PARTS,
    row: rowOf(
      ROW_SUBTLE_CLASSES,
      ROW_MIN_HEIGHT_CLASSES,
      "items-center gap-x-3 py-3",
    ),
    media: cn(ROW_MEDIA_CLASSES, "text-text-secondary"),
    chevron: true,
  },
  sessions: {
    ...ROW_STANDARD_PARTS,
    row: rowOf(
      ROW_SUBTLE_CLASSES,
      ROW_MIN_HEIGHT_CLASSES,
      "flex-wrap items-center gap-x-4 py-3 sm:flex-nowrap",
    ),
    action: cn(ROW_ACTION_CLASSES, "max-sm:basis-full"),
  },
  todo: {
    ...ROW_STANDARD_PARTS,
    row: rowOf(ROW_SUBTLE_CLASSES, "items-start gap-x-3 py-2 text-sm"),
    title: ROW_DENSE_TITLE_CLASSES,
    sub: "text-xs text-text-secondary",
  },
  mini: {
    ...ROW_STANDARD_PARTS,
    row: rowOf(ROW_SUBTLE_CLASSES, "min-h-(--size-tag) gap-x-3 text-sm"),
    title: ROW_DENSE_TITLE_CLASSES,
    alone: "items-center py-1",
    withSub: "items-start py-2",
  },
};

export type RowListVariant = keyof typeof ROW_VARIANT_CLASSES;

/**
 * The tone of a row: `done` marks a finished one with a check, `attention` one that waits for the member
 * with a warning sign. Both are a shape that comes with the words of the row's state, never the colour alone.
 */
export const ROW_TONE_ICON_CLASSES = {
  done: "size-(--size-icon-sm) shrink-0 text-feedback-success-icon",
  attention: "size-(--size-icon-sm) shrink-0 text-feedback-warning-icon",
};

export type RowTone = keyof typeof ROW_TONE_ICON_CLASSES;

/** What a row shows of its fields: the shape of its columns (RUB-B §4). */
export type RowShape = {
  meta: boolean;
  end: boolean;
  /** `sub` present: a `mini` row aligns its parts to the top. */
  sub: boolean;
};

/** The link of the title, stretched over the row, its ring drawn inside it. */
export const ROW_LINK_CLASSES = cn(
  "after:absolute after:inset-0",
  "focus-visible:outline-hidden focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-solid focus-visible:after:outline-focus-ring",
  "focus-visible:after:outline-offset-(--focus-ring-offset-inset)",
);

const ROW_CHEVRON_ICON_CLASSES =
  "size-(--size-icon-md) shrink-0 text-text-secondary";

/** The current row: the ground and the contour that forced colours draw (AP1), the contour inside the row. */
const ROW_CURRENT_CLASSES = cn(
  "bg-surface-hover outline-solid outline-(length:--border-width-thick) outline-transparent",
  "outline-offset-(--focus-ring-offset-inset)",
);
const ROW_LINKED_CLASSES = "hover:bg-surface-raised";

/** The columns of a campaign row, by the fields it shows; none when neither the state nor the date is there. */
function campaignOf(columns: boolean, shape: RowShape) {
  if (!columns) {
    return undefined;
  }
  if (shape.end) {
    return ROW_CAMPAIGN_FULL_CLASSES;
  }
  return shape.meta ? ROW_CAMPAIGN_META_CLASSES : undefined;
}

export function rowListClasses(variant: RowListVariant): string {
  return ROW_VARIANT_CLASSES[variant].list;
}

/** Whether the rows of a variant end with a chevron (when they lead somewhere). */
export function rowHasChevron(variant: RowListVariant): boolean {
  return ROW_VARIANT_CLASSES[variant].chevron;
}

/** The classes of every part of one row. */
export function rowParts(
  variant: RowListVariant,
  shape: RowShape,
  state: { linked: boolean; current: boolean },
) {
  const parts = ROW_VARIANT_CLASSES[variant];
  const campaign = campaignOf(parts.columns, shape);
  return {
    row: cn(
      parts.row,
      campaign?.row,
      shape.sub ? parts.withSub : parts.alone,
      state.current ? ROW_CURRENT_CLASSES : state.linked && ROW_LINKED_CLASSES,
    ),
    media: parts.media,
    body: cn(parts.body, campaign?.dissolve),
    text: parts.text,
    trail: cn(parts.trail, campaign?.dissolve),
    meta: cn(campaign?.meta),
    end: cn(campaign?.end),
    action: parts.action,
    title: parts.title,
    sub: parts.sub,
    chevron: cn(ROW_CHEVRON_ICON_CLASSES, campaign?.chevron),
  };
}

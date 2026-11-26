"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "@/components/ui/class-names";
import {
  SEGMENT_COUNT_CLASSES,
  SEGMENT_FIELDSET_CLASSES,
  SEGMENT_ITEM_CLASSES,
  SEGMENT_LEGEND_CLASSES,
  SEGMENT_LIST_CLASSES,
  SEGMENT_RADIO_CLASSES,
  segmentClasses,
  segmentedTrackClasses,
} from "./segmented-control-classes";

/** One segment: the value it stands for, its text and, if the screen counts, its count; a link or a panel for the kinds that need one. */
type SegmentedOption = {
  value: string;
  label: string;
  count?: number;
  /** `views`: where the segment goes. */
  href?: string;
  /** `tabs`: the id of the panel the tab shows. */
  controls?: string;
};

type SegmentedCommon = {
  /** What the control chooses or switches, already translated: the legend of the radios, the name of the list of tabs or of links. */
  label: string;
  options: readonly SegmentedOption[];
  /** The `value` of the chosen segment (of the one that shows, for the tabs and the views). */
  value: string;
  id?: string;
  className?: string;
};

type RadioSegmented = SegmentedCommon & {
  kind: "radio";
  /** The name the native radios share; generated when absent. */
  name?: string;
  onChange: (value: string) => void;
};

type TabsSegmented = SegmentedCommon & {
  kind: "tabs";
  onChange: (value: string) => void;
};

type ViewsSegmented = SegmentedCommon & {
  kind: "views";
  /** Called by a click on a link, which then goes on to its `href` unless the screen stops it. */
  onChange?: (value: string) => void;
};

export type SegmentedControlProps =
  RadioSegmented | TabsSegmented | ViewsSegmented;

function Count({ count }: { count: number | undefined }) {
  return count === undefined ? null : (
    <span className={SEGMENT_COUNT_CLASSES}>{count}</span>
  );
}

/** A choice among a few: native radios, one tab stop on the chosen one, the arrows choose (RUB-B §6). */
function RadioSegments({
  label,
  options,
  value,
  name,
  id,
  className,
  onChange,
}: RadioSegmented) {
  const generated = useId();
  const group = name ?? generated;
  return (
    <fieldset id={id} className={cn(SEGMENT_FIELDSET_CLASSES, className)}>
      <legend className={SEGMENT_LEGEND_CLASSES}>{label}</legend>
      <div className={segmentedTrackClasses("radio")}>
        {options.map((option) => (
          <label
            key={option.value}
            className={segmentClasses("radio", option.value === value)}
          >
            <input
              type="radio"
              name={group}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className={SEGMENT_RADIO_CLASSES}
            />
            {option.label}
            <Count count={option.count} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Tabs: a `tablist` named by its label, one tab stop (the chosen tab), the arrows loop and choose at once
 * (the panel is local), `Home` and `End` reach the ends, `Tab` leaves for the panel (RUB-B §6).
 */
function TabSegments({
  label,
  options,
  value,
  id,
  className,
  onChange,
}: TabsSegmented) {
  const base = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const chosen = options.findIndex((option) => option.value === value);
  const stop = chosen < 0 ? 0 : chosen;
  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const here = tabs.current.findIndex((tab) => tab === event.target);
    if (last < 0 || here < 0) {
      return;
    }
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = here === last ? 0 : here + 1;
        break;
      case "ArrowLeft":
        next = here === 0 ? last : here - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    tabs.current[next]?.focus();
    const target = options[next];
    if (target !== undefined) {
      onChange(target.value);
    }
  };
  return (
    <div
      id={id}
      role="tablist"
      aria-label={label}
      className={cn(segmentedTrackClasses("tabs"), className)}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            tabs.current[index] = element;
          }}
          type="button"
          role="tab"
          id={`${base}-tab-${option.value}`}
          aria-selected={option.value === value}
          aria-controls={option.controls}
          tabIndex={index === stop ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={move}
          className={segmentClasses("tabs", option.value === value)}
        >
          {option.label}
          <Count count={option.count} />
        </button>
      ))}
    </div>
  );
}

/** Views: a list of links in a named list, without a `nav` (D74); the current one says `true`, never `page` (TD5.1). */
function ViewSegments({
  label,
  options,
  value,
  id,
  className,
  onChange,
}: ViewsSegmented) {
  return (
    <ul
      id={id}
      aria-label={label}
      className={cn(
        segmentedTrackClasses("views"),
        SEGMENT_LIST_CLASSES,
        className,
      )}
    >
      {options.map((option) => (
        <li key={option.value} className={SEGMENT_ITEM_CLASSES}>
          <a
            href={option.href}
            aria-current={option.value === value ? "true" : undefined}
            onClick={() => onChange?.(option.value)}
            className={segmentClasses("views", option.value === value)}
          >
            {option.label}
            <Count count={option.count} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The segmented control (C22): three kinds of one track. `radio` is a choice (a `fieldset` of native radios),
 * `tabs` switch a panel, `views` (the backoffice) are links. The active segment is on `surface-active` with a
 * contour that forced colours draw; the count of an inactive segment stays in secondary text. It never
 * chooses on its own: a gesture only calls `onChange`.
 */
export function SegmentedControl(props: SegmentedControlProps) {
  switch (props.kind) {
    case "tabs":
      return <TabSegments {...props} />;
    case "views":
      return <ViewSegments {...props} />;
    default:
      return <RadioSegments {...props} />;
  }
}

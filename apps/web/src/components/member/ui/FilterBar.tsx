"use client";

import { cn } from "@/components/ui/class-names";
import { ChevronDownIcon, CloseIcon, FilterIcon } from "@/components/ui/icons";
import { CounterBadge } from "./CounterBadge";
import {
  FILTER_BAR_SEPARATOR_CLASSES,
  FILTER_PILL_BEFORE_CLEAR_CLASSES,
  FILTER_PILL_CHEVRON_CLASSES,
  FILTER_PILL_CHEVRON_OPEN_CLASSES,
  FILTER_PILL_CLEAR_CLASSES,
  FILTER_PILL_ICON_CLASSES,
  FILTER_SELECT_CLASSES,
  FILTER_SELECT_ICON_CLASSES,
  FILTER_SELECT_WRAPPER_CLASSES,
  filterBarClasses,
  filterPillClasses,
  filterPillControlClasses,
  filterPillStaticClasses,
  filterSearchClasses,
  type FilterBarDensity,
} from "./filter-bar-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type FilterPill = {
  id: string;
  /** Already translated: « Pays d'audience : Belgique ». */
  label: string;
  /** The criterion is on: the contour, the ground and the weight say it, `aria-pressed` for a toggle. */
  active?: boolean;
  /** A pill that switches a criterion on and off: `aria-pressed`, no chevron. */
  onToggle?: () => void;
  /** A pill that opens a menu or the dialog of the filters: `aria-haspopup` and `aria-expanded`, a chevron. */
  onOpen?: () => void;
  /** The menu of an `onOpen` pill is open (it is not drawn by the bar: the page draws it). */
  expanded?: boolean;
  /** The cross that retires the criterion, a button of its own beside the label; `clearLabel` names it. */
  onClear?: () => void;
  clearLabel?: string;
};

export type InlineSelect = {
  id: string;
  /** What the select chooses, already translated: its accessible name. */
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
};

export type FilterBarProps = {
  /** The name of the group, already translated: « Critères de recherche ». */
  label: string;
  pills: readonly FilterPill[];
  /** The pill « Filtres » that opens the dialog of all the criteria, with the number of criteria on. */
  filtersButton?: {
    label: string;
    count: number;
    /** What a screen reader says of the count: « 3 filtres actifs ». */
    countLabel: string;
    onOpen: () => void;
    expanded?: boolean;
  };
  /** The search of the backoffice: a field of 15 rem that submits on `Entrée`. */
  search?: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    label: string;
  };
  selects?: readonly InlineSelect[];
  /** `md` (members: 40 px, one line that scrolls) or `bo` (36 px, wrapping). */
  density?: FilterBarDensity;
  className?: string;
};

type PillViewProps = { pill: FilterPill; density: FilterBarDensity };

function PillView({ pill, density }: PillViewProps) {
  const { label, onOpen, onToggle, onClear, clearLabel } = pill;
  const active = pill.active === true;
  const clearable = onClear !== undefined && clearLabel !== undefined;
  const controlClasses = cn(
    filterPillControlClasses(density),
    clearable && FILTER_PILL_BEFORE_CLEAR_CLASSES,
  );
  let control;
  if (onOpen !== undefined) {
    const expanded = pill.expanded === true;
    control = (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        onClick={onOpen}
        className={controlClasses}
      >
        {label}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            FILTER_PILL_CHEVRON_CLASSES,
            expanded && FILTER_PILL_CHEVRON_OPEN_CLASSES,
          )}
        />
      </button>
    );
  } else if (onToggle !== undefined) {
    control = (
      <button
        type="button"
        aria-pressed={active}
        onClick={onToggle}
        className={controlClasses}
      >
        {label}
      </button>
    );
  } else {
    control = (
      <span
        className={cn(
          filterPillStaticClasses(density),
          clearable && FILTER_PILL_BEFORE_CLEAR_CLASSES,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      data-pill={pill.id}
      data-active={active ? "" : undefined}
      className={filterPillClasses(density, active)}
    >
      {control}
      {clearable ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={onClear}
          className={FILTER_PILL_CLEAR_CLASSES}
        >
          <CloseIcon aria-hidden="true" className={FILTER_PILL_ICON_CLASSES} />
        </button>
      ) : null}
    </span>
  );
}

/**
 * The bar of the criteria of a list (C30): a named group of pills, the members' one line that scrolls sideways (every
 * pill is a control, so the keyboard reaches and scrolls them: X8), the backoffice's wrapping. A pill is a toggle
 * (`aria-pressed`) or opens a menu (`aria-haspopup`, `aria-expanded`, a chevron that turns over when it is open); the
 * cross that retires a criterion is a control of its own. Nothing is changed by the bar: it calls what it was given.
 */
export function FilterBar({
  label,
  pills,
  filtersButton,
  search,
  selects,
  density = "md",
  className,
  ...rest
}: FilterBarProps & PassThroughProps) {
  return (
    <div
      {...passThroughOf(rest)}
      role="group"
      aria-labelledby={undefined}
      aria-label={label}
      data-filter-bar={density}
      className={cn(filterBarClasses(density), className)}
    >
      {filtersButton === undefined ? null : (
        <>
          <span className={filterPillClasses(density, false)}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={filtersButton.expanded === true}
              onClick={filtersButton.onOpen}
              className={filterPillControlClasses(density)}
            >
              <FilterIcon
                aria-hidden="true"
                className={FILTER_PILL_ICON_CLASSES}
              />
              {filtersButton.label}
              <CounterBadge
                variant="dot"
                count={filtersButton.count}
                label={filtersButton.countLabel}
              />
            </button>
          </span>
          {pills.length === 0 ? null : (
            <span aria-hidden="true" className={FILTER_BAR_SEPARATOR_CLASSES} />
          )}
        </>
      )}
      {pills.map((pill) => (
        <PillView key={pill.id} pill={pill} density={density} />
      ))}
      {search === undefined ? null : (
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            search.onSubmit();
          }}
          className="shrink-0"
        >
          <input
            type="search"
            aria-label={search.label}
            value={search.value}
            onChange={(event) => search.onChange(event.currentTarget.value)}
            className={filterSearchClasses(density)}
          />
        </form>
      )}
      {selects?.map((select) => (
        <span key={select.id} className={FILTER_SELECT_WRAPPER_CLASSES}>
          <select
            aria-label={select.label}
            value={select.value}
            onChange={(event) => select.onChange(event.currentTarget.value)}
            className={FILTER_SELECT_CLASSES}
          >
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className={FILTER_SELECT_ICON_CLASSES}
          />
        </span>
      ))}
    </div>
  );
}

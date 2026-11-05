// The filter bar of a queue (docs/mvp/15 RG33, RG121; 17b §4.2; L2C-16): the common filters in
// the order of 15 RG33, a separator, then those of the queue; each active filter is a removable
// chip, "Réinitialiser" appears as soon as one is active. The state is the address's: a change
// goes up to the screen, which writes it in the address bar (codes only, no personal data).
import { useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import {
  FIELD_CLASSES,
  ROW_GROUP_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import {
  chipText,
  chipWords,
  PERIOD_KEYS,
  type OwnFilter,
  type QueueFilters,
} from "./queue-view-model";

const t = messages.queueList;

type Option = { value: string; label: string };

function FilterSelect({
  filterKey,
  label,
  options,
  value,
  onChange,
}: {
  filterKey: string;
  label: string;
  options: readonly Option[];
  value: string | undefined;
  onChange: (value: string | null) => void;
}) {
  const id = `queue-filter-${filterKey}`;
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className={SELECT_CLASSES}
      >
        <option value="">{t.all}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function QueueFilterBar({
  filters,
  own,
  onChange,
  onReset,
}: {
  filters: QueueFilters;
  own: readonly OwnFilter[];
  onChange: (key: string, value: string | null) => void;
  onReset: () => void;
}) {
  const active = Object.entries(filters);
  const periodHelp = useId();
  return (
    <section aria-label={t.filters} className="flex flex-col gap-3">
      <div className={`${ROW_GROUP_CLASSES} items-end`}>
        <label className="flex min-h-(--size-bo-control) items-center gap-2 text-sm font-semibold text-text-primary">
          <input
            type="checkbox"
            checked={filters.overdue === "true"}
            onChange={(event) =>
              onChange("overdue", event.target.checked ? "true" : null)
            }
            className="size-(--size-checkbox)"
          />
          {t.overdueOnly}
        </label>
        <FilterSelect
          filterKey="holder"
          label={t.holder}
          options={[
            { value: "free", label: t.holderOptions.free },
            { value: "me", label: t.holderOptions.me },
          ]}
          value={filters.holder}
          onChange={(value) => onChange("holder", value)}
        />
        <FilterSelect
          filterKey="owner"
          label={t.owner}
          options={[{ value: "none", label: t.ownerOptions.none }]}
          value={filters.owner}
          onChange={(value) => onChange("owner", value)}
        />
        <FilterSelect
          filterKey="alert"
          label={t.alert}
          options={[{ value: "true", label: t.alertOptions.true }]}
          value={filters.alert}
          onChange={(value) => onChange("alert", value)}
        />
        {own.length === 0 ? null : (
          <span
            role="separator"
            aria-orientation="vertical"
            className="h-(--size-bo-control) w-(--border-width-thin) self-end bg-border-strong"
          />
        )}
        {own.map((filter) => (
          <FilterSelect
            key={filter.key}
            filterKey={filter.key}
            label={filter.label}
            options={filter.options}
            value={filters[filter.key]}
            onChange={(value) => onChange(filter.key, value)}
          />
        ))}
      </div>
      <fieldset aria-describedby={periodHelp} className={ROW_GROUP_CLASSES}>
        <legend className={SMALL_LABEL_CLASSES}>{t.period}</legend>
        {PERIOD_KEYS.map((key) => (
          <div key={key} className={FIELD_CLASSES}>
            <label
              htmlFor={`queue-period-${key}`}
              className={SMALL_LABEL_CLASSES}
            >
              {key === "from" ? t.periodFrom : t.periodTo}
            </label>
            <input
              id={`queue-period-${key}`}
              type="date"
              value={filters[key] ?? ""}
              onChange={(event) => onChange(key, event.target.value || null)}
              className={inputClasses(false)}
            />
          </div>
        ))}
      </fieldset>
      <p id={periodHelp} className={HELP_CLASSES}>
        {t.periodHelp}
      </p>
      {active.length === 0 ? null : (
        <div className={`${ROW_GROUP_CLASSES} items-center`}>
          <ul aria-label={t.chipsLabel} className="flex flex-wrap gap-2">
            {active.map(([key, value]) => {
              const words = chipWords(key, value, own);
              const text = chipText(words.name, words.value);
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-label={t.chipRemove(text)}
                    onClick={() => onChange(key, null)}
                    className={SMALL_SECONDARY_CLASSES}
                  >
                    {text}
                    <span aria-hidden="true" className="ml-2">
                      {t.chipMark}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onReset}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.reset}
          </button>
        </div>
      )}
    </section>
  );
}

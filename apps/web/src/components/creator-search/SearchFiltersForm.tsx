"use client";

// The criteria of M4 (docs/mvp/10 RG6, RG11, RG12, RG17; 17 §4.4; jalons/l3f, commit 10): the seven facets open at
// the pilot (F12 is suspended while D78 holds), one native control each, applied together by « Voir les résultats »
// (a search is one page of the bucket of the account, so no criterion searches on its own). There is NO free text:
// a line says why. A facet the base closed never appears; the codes offered are the active ones of the reference
// lists, the words the front's. Below lg the form sits behind a button, above it is the column on the left. The
// form holds a draft of the criteria and nothing else: the applied ones are the address's (creator-search-view.ts).
import type { BrandProfileReferences } from "@influx/contracts/brand-profile";
import type { CreatorSearchFilters } from "@influx/contracts/creator-search";
import { useLocale } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/member/ui/Button";
import { Notice } from "@/components/member/ui/Notice";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
  memberControlClasses,
  MEMBER_FIELD_LABEL_CLASSES,
} from "@/components/member/ui/field-classes";
import { ChevronDownIcon } from "@/components/ui/icons";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import {
  FILTER_ACTIONS_CLASSES,
  FILTER_CHOICES_CLASSES,
  FILTER_GROUP_CLASSES,
  FILTER_SUMMARY_CLASSES,
} from "./creator-search-classes";
import {
  AUDIENCE_BAND_CODES,
  BADGE_CODES,
  SHARE_BAND_CODES,
  criteriaCountOf,
  criterionValueLabel,
  toggledFilters,
  withCountry,
  withTopic,
  type ListFacet,
  type SearchLabels,
} from "./creator-search-view";
import type { SourceState } from "./use-search-sources";

type Choice = { code: string; label: string };

/** A facet of several choices: a native disclosure, open when it holds a choice, its count in its title. */
function FilterGroup({
  title,
  choices,
  chosen,
  onToggle,
  name,
}: {
  title: string;
  choices: readonly Choice[];
  chosen: readonly string[];
  onToggle: (code: string) => void;
  name: string;
}) {
  const groupId = useId();
  return (
    <details open={chosen.length > 0} className={FILTER_GROUP_CLASSES}>
      <summary className={FILTER_SUMMARY_CLASSES}>
        <span id={groupId}>
          {title}
          {chosen.length === 0 ? "" : ` (${chosen.length})`}
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="size-(--size-icon-md) shrink-0 text-text-secondary"
        />
      </summary>
      <div
        role="group"
        aria-labelledby={groupId}
        className={FILTER_CHOICES_CLASSES}
      >
        {choices.map((choice) => (
          <label key={choice.code} className={memberChoiceRowClasses()}>
            <input
              type="checkbox"
              name={name}
              value={choice.code}
              checked={chosen.includes(choice.code)}
              onChange={() => onToggle(choice.code)}
              className={memberChoiceInputClasses()}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

/** A facet of one choice (a topic, a country): a native select whose first choice is « all » (the facet unset). */
function FilterSelect({
  label,
  allLabel,
  choices,
  value,
  onChange,
  name,
}: {
  label: string;
  allLabel: string;
  choices: readonly Choice[];
  value: string | null;
  onChange: (code: string | null) => void;
  name: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={MEMBER_FIELD_LABEL_CLASSES}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : event.target.value)
        }
        className={memberControlClasses(false)}
      >
        <option value="">{allLabel}</option>
        {choices.map((choice) => (
          <option key={choice.code} value={choice.code}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SearchFiltersForm({
  filters,
  references,
  labels,
  onApply,
  onClear,
  onReload,
}: {
  /** The criteria applied: the draft starts from them (the form is remounted when they change). */
  filters: CreatorSearchFilters;
  references: SourceState<BrandProfileReferences>;
  labels: SearchLabels;
  onApply: (filters: CreatorSearchFilters) => void;
  onClear: () => void;
  onReload: () => void;
}) {
  const locale = useLocale();
  const [draft, setDraft] = useState<CreatorSearchFilters>(filters);
  const ready = references.phase === "ready" ? references.value : null;
  const t = labels.text;

  const choicesOf = useMemo(() => {
    const coded = (
      facet: "F1" | "F3" | "F8" | "F11" | "F4",
      codes: readonly string[],
    ): Choice[] =>
      codes.map((code) => ({
        code,
        label: criterionValueLabel(facet, code, labels),
      }));
    return {
      topics: coded("F1", ready?.topics ?? []),
      networks: coded("F3", ready?.networks ?? []),
      languages: coded("F8", ready?.languages ?? []).sort((a, b) =>
        a.label.localeCompare(b.label, locale),
      ),
      formats: coded("F11", ready?.formats ?? []),
      audienceBands: coded("F4", AUDIENCE_BAND_CODES),
      badges: BADGE_CODES.map((code) => ({
        code,
        label: t(`filters.badge.${code}`),
      })),
      countries: getLocalizedCountryOptions(locale).map((country) => ({
        code: country.code,
        label: country.name,
      })),
      shares: SHARE_BAND_CODES.map((code) => ({
        code,
        label: labels.card.has(`preview.share.${code}`)
          ? labels.card.text(`preview.share.${code}`)
          : code,
      })),
    };
  }, [ready, labels, locale, t]);

  const toggle = (facet: ListFacet) => (code: string) =>
    setDraft((previous) => toggledFilters(previous, facet, code));

  return (
    <form
      aria-label={t("filters.title")}
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-text-secondary">{t("filters.noFreeText")}</p>
      {references.phase === "failed" ? (
        <Notice tone="warning">
          <p>{t("filters.referencesFailed")}</p>
          <Button variant="text" onClick={onReload}>
            {t("filters.referencesRetry")}
          </Button>
        </Notice>
      ) : null}
      <FilterSelect
        name="F1"
        label={t("facets.F1")}
        allLabel={t("filters.all")}
        choices={choicesOf.topics}
        value={draft.F1 ?? null}
        onChange={(code) => setDraft((previous) => withTopic(previous, code))}
      />
      <FilterGroup
        name="F3"
        title={t("facets.F3")}
        choices={choicesOf.networks}
        chosen={draft.F3 ?? []}
        onToggle={toggle("F3")}
      />
      <FilterGroup
        name="F4"
        title={t("facets.F4")}
        choices={choicesOf.audienceBands}
        chosen={draft.F4 ?? []}
        onToggle={toggle("F4")}
      />
      <FilterSelect
        name="F6"
        label={t("facets.F6")}
        allLabel={t("filters.all")}
        choices={choicesOf.countries}
        value={draft.F6?.country ?? null}
        onChange={(code) => setDraft((previous) => withCountry(previous, code))}
      />
      {draft.F6 === undefined ? null : (
        <FilterGroup
          name="F6s"
          title={t("facets.F6s")}
          choices={choicesOf.shares}
          chosen={draft.F6.shareBands ?? []}
          onToggle={toggle("F6s")}
        />
      )}
      <FilterGroup
        name="F8"
        title={t("facets.F8")}
        choices={choicesOf.languages}
        chosen={draft.F8 ?? []}
        onToggle={toggle("F8")}
      />
      <FilterGroup
        name="F11"
        title={t("facets.F11")}
        choices={choicesOf.formats}
        chosen={draft.F11 ?? []}
        onToggle={toggle("F11")}
      />
      <FilterGroup
        name="F17"
        title={t("facets.F17")}
        choices={choicesOf.badges}
        chosen={draft.F17 ?? []}
        onToggle={toggle("F17")}
      />
      <div className={FILTER_ACTIONS_CLASSES}>
        <Button type="submit" block>
          {t("filters.apply")}
        </Button>
        {criteriaCountOf(draft) === 0 &&
        criteriaCountOf(filters) === 0 ? null : (
          <Button variant="secondary" block onClick={onClear}>
            {t("filters.clear")}
          </Button>
        )}
      </div>
    </form>
  );
}

"use client";

// The facets of the identified search (docs/mvp/10 RG11, RG12, RG16, RG17; 17b §3.3; jalons/l3g/modele.md §2; L3G-12): the
// facets of the brand's search, then the internal ones (G1, G2, G9, G10), one native control each, applied together
// by « Rechercher » because every search is journaled (a facet does not search on its own). G8 (the agent in charge)
// is drawn by the table, not offered here: no list of the agents is open to an agent. G3 is Lot 4. The form holds a
// draft and nothing else: the facets applied are the screen's (the form is remounted when they change). The base
// refuses a closed facet or a list out of its bounds; this form only offers the lists.
import { useId, useState } from "react";
import { messages } from "@/messages/fr";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import {
  choicesOf,
  shareChoices,
  toggledFilters,
  topicChoices,
  withCountry,
  withShareBand,
  withTopic,
  type Choice,
  type Filters,
  type ListFacet,
} from "./identified-search-view";
import { countryOptions } from "./view-model";

const t = messages.identifiedSearch.facets;

const GROUP_CLASSES =
  "flex flex-col gap-1 border-b-(length:--border-width-thin) border-border-subtle pb-2";
const SUMMARY_CLASSES =
  "flex min-h-(--size-bo-control) cursor-pointer items-center text-sm font-semibold text-text-primary";
const CHECK_ROW_CLASSES =
  "flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary";
const CHECK_CLASSES = "size-(--size-icon-sm) shrink-0 accent-brand-primary";

/** A facet of several choices: a native disclosure, open when it holds a choice, its count in its title. */
function CheckGroup({
  title,
  name,
  choices,
  chosen,
  onToggle,
}: {
  title: string;
  name: string;
  choices: readonly Choice[];
  chosen: readonly string[];
  onToggle: (code: string) => void;
}) {
  const titleId = useId();
  return (
    <details open={chosen.length > 0} className={GROUP_CLASSES}>
      <summary className={SUMMARY_CLASSES}>
        <span id={titleId}>
          {title}
          {chosen.length === 0 ? "" : ` (${chosen.length})`}
        </span>
      </summary>
      <div role="group" aria-labelledby={titleId} className="flex flex-col">
        {choices.map((choice) => (
          <label key={choice.code} className={CHECK_ROW_CLASSES}>
            <input
              type="checkbox"
              name={name}
              value={choice.code}
              checked={chosen.includes(choice.code)}
              onChange={() => onToggle(choice.code)}
              className={CHECK_CLASSES}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

/** A facet of one choice (a topic, a country): a native select whose first choice is « all » (the facet unset). */
function ChoiceSelect({
  label,
  name,
  choices,
  value,
  onChange,
}: {
  label: string;
  name: string;
  choices: readonly Choice[];
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const id = useId();
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : event.target.value)
        }
        className={SELECT_CLASSES}
      >
        <option value="">{t.all}</option>
        {choices.map((choice) => (
          <option key={choice.code} value={choice.code}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function IdentifiedFacets({
  applied,
  onApply,
  onReset,
}: {
  /** The facets applied: the draft starts from them. */
  applied: Filters;
  onApply: (filters: Filters) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(applied);
  const countries = countryOptions().map((country) => ({
    code: country.code,
    label: country.name,
  }));
  const toggle = (facet: ListFacet) => (code: string) =>
    setDraft((previous) => toggledFilters(previous, facet, code));
  const group = (facet: ListFacet, title: string) => (
    <CheckGroup
      title={title}
      name={facet}
      choices={choicesOf(facet)}
      chosen={draft[facet] ?? []}
      onToggle={toggle(facet)}
    />
  );
  return (
    <form
      aria-label={t.title}
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
      className={SECTION_CLASSES}
    >
      <h2 className="font-display text-sm font-bold text-text-primary">
        {t.shared}
      </h2>
      <ChoiceSelect
        label={t.topic}
        name="F1"
        choices={topicChoices()}
        value={draft.F1 ?? null}
        onChange={(code) => setDraft((previous) => withTopic(previous, code))}
      />
      {group("F3", t.networks)}
      {group("F4", t.audienceBands)}
      <ChoiceSelect
        label={t.audienceCountry}
        name="F6"
        choices={countries}
        value={draft.F6?.country ?? null}
        onChange={(code) =>
          setDraft((previous) => withCountry(previous, "F6", code))
        }
      />
      {draft.F6 === undefined ? null : (
        <CheckGroup
          title={t.shareBands}
          name="F6-share"
          choices={shareChoices()}
          chosen={draft.F6.shareBands ?? []}
          onToggle={(band) =>
            setDraft((previous) => withShareBand(previous, band))
          }
        />
      )}
      {group("F8", t.languages)}
      {group("F11", t.formats)}
      {group("F17", t.badges)}
      <h2 className="font-display text-sm font-bold text-text-primary">
        {t.internal}
      </h2>
      {group("G1", t.declaredStatus)}
      {group("G2", t.profileState)}
      <ChoiceSelect
        label={t.residence}
        name="G9"
        choices={countries}
        value={draft.G9?.country ?? null}
        onChange={(code) =>
          setDraft((previous) => withCountry(previous, "G9", code))
        }
      />
      {group("G10", t.refusedSectors)}
      <p className="text-sm text-text-secondary">{t.note}</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={SMALL_PRIMARY_CLASSES}>
          {t.submit}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft({});
            onReset();
          }}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.reset}
        </button>
      </div>
    </form>
  );
}

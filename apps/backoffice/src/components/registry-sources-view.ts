// The registry sources of a brand's registration, in words and in checks (docs/mvp/06 RG52, RG101; D79 (12);
// jalons/l2e/registres.md; 17b §3.11; L2E-23). Pure functions, outside the components: the split between the
// sources the agents consult and the ones that wait for an administrator, the draft of a change, the checks of
// its body, and the table "avant, après" shown before anything is saved. No rule is decided here: the
// database holds one active source per country, refuses a day in the future and writes the former and the new
// value in the register (RG101); this module words, gathers and parses what was typed.
import {
  registrySubdivisionCodeSchema,
  VERIFICATION_REGISTRY_SOURCE_NAME_MAX_LENGTH,
  VERIFICATION_REGISTRY_SOURCE_NAME_MIN_LENGTH,
  VERIFICATION_REGISTRY_SOURCE_URL_MAX_LENGTH,
  type AddVerificationRegistrySourceBody,
  type UpdateVerificationRegistrySourceBody,
  type VerificationRegistrySourceAdminRow,
} from "@influx/contracts/verification";
import { ISO_COUNTRY_CODES } from "@influx/contracts/countries";
import { messages } from "@/messages/fr";
import { registryLinkOf } from "./verification-decision-view";
import { countryName, formatDay } from "./view-model";

const t = messages.registrySources;

export type SourceRow = VerificationRegistrySourceAdminRow;

/** The sources an administrator is asked about (inactive) apart from the ones the agents consult (active). */
export function partitionSources(rows: readonly SourceRow[]): {
  inactive: SourceRow[];
  active: SourceRow[];
} {
  return {
    inactive: rows.filter((row) => !row.isActive),
    active: rows.filter((row) => row.isActive),
  };
}

/** The country of a source in words; GLEIF answers for every country, as the fallback of the others. */
export function sourceCountryWords(
  row: Pick<SourceRow, "countryCode">,
): string {
  return row.countryCode === null
    ? t.allCountries
    : countryName(row.countryCode);
}

/** The State of a source in words: its code (ISO 3166-2), or « Tout le pays » for the register of a country. */
export function sourceSubdivisionWords(
  row: Pick<SourceRow, "subdivisionCode">,
): string {
  return row.subdivisionCode ?? t.noSubdivision;
}

/** Only an administrator writes (RG101): the button is masked for an agent, and the server refuses it anyway. */
export function canEditSources(role: "agent" | "admin"): boolean {
  return role === "admin";
}

/** The link of a source's page: a plain https address, opened apart with no referrer; anything else is no link. */
export function sourceLinkOf(row: Pick<SourceRow, "url">): string | null {
  return registryLinkOf(row.url);
}

/** What the administrator types for one source; the country and the type are the source's own, never edited. */
export type SourceDraft = {
  name: string;
  url: string;
  checkedOn: string;
  isActive: boolean;
};

export function draftOf(row: SourceRow): SourceDraft {
  return {
    name: row.name,
    url: row.url,
    checkedOn: row.checkedOn,
    isActive: row.isActive,
  };
}

export type SourceFieldName = "name" | "url" | "checkedOn";

export type SourceProblem = { field: SourceFieldName; text: string };

export type SourceChecked =
  | { ok: true; body: UpdateVerificationRegistrySourceBody }
  | { ok: false; problem: SourceProblem };

// a control character in a name or an address is what the database refuses (0221)
const CONTROL = /[\u0000-\u001f\u007f]/;

/** The body of the change as the contract takes it, after the checks of the shapes (the database checks the rest). */
export function sourceChangeCheck(draft: SourceDraft): SourceChecked {
  const name = draft.name.trim();
  if (
    name.length < VERIFICATION_REGISTRY_SOURCE_NAME_MIN_LENGTH ||
    name.length > VERIFICATION_REGISTRY_SOURCE_NAME_MAX_LENGTH ||
    CONTROL.test(name)
  ) {
    return { ok: false, problem: { field: "name", text: t.problems.name } };
  }
  const url = draft.url.trim();
  if (
    url.length > VERIFICATION_REGISTRY_SOURCE_URL_MAX_LENGTH ||
    !/^https:\/\/\S+$/.test(url) ||
    CONTROL.test(url)
  ) {
    return { ok: false, problem: { field: "url", text: t.problems.url } };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.checkedOn)) {
    return {
      ok: false,
      problem: { field: "checkedOn", text: t.problems.checkedOn },
    };
  }
  return {
    ok: true,
    body: { name, url, checkedOn: draft.checkedOn, isActive: draft.isActive },
  };
}

export type ChangeLine = {
  key: "name" | "url" | "checkedOn" | "isActive";
  field: string;
  before: string;
  after: string;
};

/** The fields that change, the former value beside the new one: what the register will keep (RG101). */
export function changeLines(
  row: SourceRow,
  body: UpdateVerificationRegistrySourceBody,
): ChangeLine[] {
  const state = (active: boolean) =>
    active ? t.activeWords.yes : t.activeWords.no;
  const candidates: ChangeLine[] = [
    { key: "name", field: t.fields.name, before: row.name, after: body.name },
    { key: "url", field: t.fields.url, before: row.url, after: body.url },
    {
      key: "checkedOn",
      field: t.fields.checkedOn,
      before: formatDay(row.checkedOn),
      after: formatDay(body.checkedOn),
    },
    {
      key: "isActive",
      field: t.fields.active,
      before: state(row.isActive),
      after: state(body.isActive),
    },
  ];
  return candidates.filter((line) => line.before !== line.after);
}

/** The sentence of a refused save: a second active source for the country, or a field the database refuses. */
export function saveFailureText(code: string | undefined): string | null {
  if (code === "conflict") {
    return t.problems.activeExists;
  }
  if (code === "validation_failed") {
    return t.problems.fieldRefused;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The addition of a source (L2F-21, 0229): a register of type national for a country, or for one of its
// States. Same discipline: shapes checked here, the rest (the country, the State of that country, one
// active source per country and State) is the database's.
// ---------------------------------------------------------------------------------------------

/** What the administrator types for a new source; the type is always national, never chosen. */
export type NewSourceDraft = SourceDraft & {
  countryCode: string;
  subdivisionCode: string;
};

export const EMPTY_NEW_SOURCE: NewSourceDraft = {
  countryCode: "",
  subdivisionCode: "",
  name: "",
  url: "",
  checkedOn: "",
  isActive: false,
};

export type NewSourceFieldName =
  SourceFieldName | "countryCode" | "subdivisionCode";

export type NewSourceProblem = { field: NewSourceFieldName; text: string };

export type NewSourceChecked =
  | { ok: true; body: AddVerificationRegistrySourceBody }
  | { ok: false; problem: NewSourceProblem };

const COUNTRY_CODES: ReadonlySet<string> = new Set(ISO_COUNTRY_CODES);

/**
 * The State as the contract takes it: empty is the whole country; « CA » is read as « US-CA » for the country
 * chosen; the code is put in capitals and its prefix must be the country's own. Null when it cannot be one.
 */
export function subdivisionOf(
  countryCode: string,
  typed: string,
): string | null | undefined {
  const value = typed.trim().toUpperCase();
  if (value === "") {
    return null;
  }
  const full = value.includes("-") ? value : `${countryCode}-${value}`;
  return registrySubdivisionCodeSchema.safeParse(full).success &&
    full.startsWith(`${countryCode}-`)
    ? full
    : undefined;
}

/** The body of the addition as the contract takes it, after the checks of the shapes. */
export function newSourceCheck(draft: NewSourceDraft): NewSourceChecked {
  const p = t.add.problems;
  if (!COUNTRY_CODES.has(draft.countryCode)) {
    return { ok: false, problem: { field: "countryCode", text: p.country } };
  }
  const subdivisionCode = subdivisionOf(
    draft.countryCode,
    draft.subdivisionCode,
  );
  if (subdivisionCode === undefined) {
    return {
      ok: false,
      problem: { field: "subdivisionCode", text: p.subdivision },
    };
  }
  const checked = sourceChangeCheck(draft);
  if (!checked.ok) {
    return checked;
  }
  return {
    ok: true,
    body: {
      ...checked.body,
      countryCode:
        draft.countryCode as AddVerificationRegistrySourceBody["countryCode"],
      subdivisionCode,
    },
  };
}

export type AddLine = {
  key: "country" | "subdivision" | "name" | "url" | "checkedOn" | "isActive";
  field: string;
  value: string;
};

/** What will be journaled, field by field: the whole value of the new source (there is no former one). */
export function addLines(body: AddVerificationRegistrySourceBody): AddLine[] {
  return [
    {
      key: "country",
      field: t.add.country,
      value: countryName(body.countryCode),
    },
    {
      key: "subdivision",
      field: t.columns.subdivision,
      value: body.subdivisionCode ?? t.noSubdivision,
    },
    { key: "name", field: t.fields.name, value: body.name },
    { key: "url", field: t.fields.url, value: body.url },
    {
      key: "checkedOn",
      field: t.fields.checkedOn,
      value: formatDay(body.checkedOn),
    },
    {
      key: "isActive",
      field: t.fields.active,
      value: body.isActive ? t.activeWords.yes : t.activeWords.no,
    },
  ];
}

/** Where a source added stands, in words: its country, and its State when it has one. */
export function addedWhere(body: AddVerificationRegistrySourceBody): string {
  return body.subdivisionCode === null
    ? countryName(body.countryCode)
    : `${countryName(body.countryCode)}, ${body.subdivisionCode}`;
}

/**
 * The sentence of a refused addition, by the issues the API names (never a value): the country or the State
 * the base does not know, a second active source for the country and State, a field the base refuses.
 */
export function addFailureText(
  code: string | undefined,
  issues: readonly string[],
): string | null {
  if (issues.includes("invalid_country")) {
    return t.add.problems.unknownCountry;
  }
  if (issues.includes("invalid_subdivision")) {
    return t.add.problems.unknownSubdivision;
  }
  if (code === "conflict") {
    return t.add.problems.activeExists;
  }
  return saveFailureText(code);
}

/**
 * The value of a field's `aria-describedby`: its help and, when it is in error, the message that says why,
 * so that a screen reader reads both (WCAG 3.3.1). Nothing when neither exists.
 */
export function describedByOf(
  ...ids: readonly (string | null | undefined)[]
): string | undefined {
  const present = ids.filter(
    (id): id is string => id !== null && id !== undefined,
  );
  return present.length === 0 ? undefined : present.join(" ");
}

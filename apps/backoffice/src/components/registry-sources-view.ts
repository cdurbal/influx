// The registry sources of a brand's registration, in words and in checks (docs/mvp/06 RG52, RG101; D79 (12);
// jalons/l2e/registres.md; 17b §3.11; L2E-23). Pure functions, outside the components: the split between the
// sources the agents consult and the ones that wait for an administrator, the draft of a change, the checks of
// its body, and the table "avant, après" shown before anything is saved. No rule is decided here: the
// database holds one active source per country, refuses a day in the future and writes the former and the new
// value in the register (RG101); this module words, gathers and parses what was typed.
import {
  VERIFICATION_REGISTRY_SOURCE_NAME_MAX_LENGTH,
  VERIFICATION_REGISTRY_SOURCE_NAME_MIN_LENGTH,
  VERIFICATION_REGISTRY_SOURCE_URL_MAX_LENGTH,
  type UpdateVerificationRegistrySourceBody,
  type VerificationRegistrySourceAdminRow,
} from "@influx/contracts/verification";
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

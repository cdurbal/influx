// The registry sources of a brand's registration in words and in checks (docs/mvp/06 RG52, RG101; D79 (12);
// jalons/l2e/registres.md; 17b §3.11; L2E-23): pure functions of src/components/registry-sources-view.ts,
// without a browser. The database holds one active source per country, refuses a day in the future and
// writes the former and the new value in the register; these only split, word, parse what was typed and
// show the change before it is confirmed.
import type { VerificationRegistrySourceAdminRow } from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  canEditSources,
  changeLines,
  draftOf,
  partitionSources,
  saveFailureText,
  sourceChangeCheck,
  sourceCountryWords,
  sourceLinkOf,
} from "../src/components/registry-sources-view";
import { messages } from "../src/messages/fr";

const t = messages.registrySources;

function source(
  changes: Partial<VerificationRegistrySourceAdminRow> = {},
): VerificationRegistrySourceAdminRow {
  return {
    id: "aaaaaaaa-2222-4333-8444-555555555551",
    sourceType: "national",
    countryCode: "GB",
    name: "Companies House, Find and update company information",
    url: "https://find-and-update.company-information.service.gov.uk/",
    checkedOn: "2026-11-07",
    isActive: false,
    updatedAt: "2026-11-07T09:00:00.000Z",
    ...changes,
  };
}

describe("L2E-23: the sources an administrator is asked about are apart from the ones the agents consult (RG52, RG101)", () => {
  it("splits the inactive ones, « à confirmer », from the active ones, keeping the server's order", () => {
    const a = source({ id: "a", countryCode: "AU", isActive: true });
    const b = source({ id: "b", countryCode: "GB" });
    const c = source({ id: "c", countryCode: "CH" });
    const d = source({
      id: "d",
      sourceType: "gleif",
      countryCode: null,
      isActive: true,
    });
    const { inactive, active } = partitionSources([a, b, c, d]);
    expect(inactive.map((row) => row.id)).toEqual(["b", "c"]);
    expect(active.map((row) => row.id)).toEqual(["a", "d"]);
  });

  it("names the country of a source, and says GLEIF answers for every country", () => {
    expect(sourceCountryWords(source())).toBe("Royaume-Uni");
    expect(sourceCountryWords(source({ countryCode: null }))).toBe(
      t.allCountries,
    );
  });

  it("lets an administrator write and an agent only read (RG101): the button is masked, the server refuses anyway", () => {
    expect(canEditSources("admin")).toBe(true);
    expect(canEditSources("agent")).toBe(false);
  });

  it("links a source's page only when it is a plain https address", () => {
    expect(sourceLinkOf(source())).toBe(
      "https://find-and-update.company-information.service.gov.uk/",
    );
    expect(
      sourceLinkOf(source({ url: "http://abr.business.gov.au/" })),
    ).toBeNull();
    expect(
      sourceLinkOf(source({ url: "https://user:pw@abr.business.gov.au/" })),
    ).toBeNull();
  });
});

describe("L2E-23: a change is checked in its shapes, then shown as former and new value before it is saved (RG101)", () => {
  it("starts from the source as it is, and refuses a name, an address or a day that cannot be the database's", () => {
    const row = source();
    expect(draftOf(row)).toEqual({
      name: row.name,
      url: row.url,
      checkedOn: "2026-11-07",
      isActive: false,
    });
    expect(sourceChangeCheck({ ...draftOf(row), name: " a " })).toEqual({
      ok: false,
      problem: { field: "name", text: t.problems.name },
    });
    expect(
      sourceChangeCheck({ ...draftOf(row), name: "x".repeat(161) }),
    ).toEqual({
      ok: false,
      problem: { field: "name", text: t.problems.name },
    });
    for (const url of [
      "http://abr.business.gov.au/",
      "https://abr.business.gov.au/ with space",
      "ftp://abr.business.gov.au/",
      `https://${"a".repeat(500)}`,
    ]) {
      expect(sourceChangeCheck({ ...draftOf(row), url })).toEqual({
        ok: false,
        problem: { field: "url", text: t.problems.url },
      });
    }
    expect(sourceChangeCheck({ ...draftOf(row), checkedOn: "" })).toEqual({
      ok: false,
      problem: { field: "checkedOn", text: t.problems.checkedOn },
    });
  });

  it("sends the name and the address trimmed, the day, and the activation; never the country nor the type", () => {
    const checked = sourceChangeCheck({
      name: "  Companies House  ",
      url: " https://find-and-update.company-information.service.gov.uk/ ",
      checkedOn: "2026-11-08",
      isActive: true,
    });
    expect(checked).toEqual({
      ok: true,
      body: {
        name: "Companies House",
        url: "https://find-and-update.company-information.service.gov.uk/",
        checkedOn: "2026-11-08",
        isActive: true,
      },
    });
  });

  it("shows only the fields that change, the former value beside the new one, and nothing when nothing changes", () => {
    const row = source();
    const checked = sourceChangeCheck({
      ...draftOf(row),
      checkedOn: "2026-11-08",
      isActive: true,
    });
    if (!checked.ok) {
      throw new Error("the change was refused");
    }
    expect(changeLines(row, checked.body)).toEqual([
      {
        key: "checkedOn",
        field: t.fields.checkedOn,
        before: "07/11/2026",
        after: "08/11/2026",
      },
      {
        key: "isActive",
        field: t.fields.active,
        before: t.activeWords.no,
        after: t.activeWords.yes,
      },
    ]);
    const same = sourceChangeCheck(draftOf(row));
    if (!same.ok) {
      throw new Error("the unchanged draft was refused");
    }
    expect(changeLines(row, same.body)).toEqual([]);
  });

  it("says a second active source for the country, and a field the database refuses, in sentences; any other failure keeps the generic one", () => {
    expect(saveFailureText("conflict")).toBe(t.problems.activeExists);
    expect(saveFailureText("validation_failed")).toBe(t.problems.fieldRefused);
    expect(saveFailureText("forbidden")).toBeNull();
    expect(saveFailureText(undefined)).toBeNull();
  });

  it("states what the screen cannot do yet: no source for a country that has none, no State of the United States, and no internal ticket number on screen (L2EU-8)", () => {
    expect(t.addLimit).toMatch(/État américain/);
    expect(t.addLimit).not.toMatch(/EC-L2E-/);
    expect(t.leadAgent).toMatch(/Lecture seule/);
  });
});

// The registry sources of a brand's registration in words and in checks (docs/mvp/06 RG52, RG101; D79 (12);
// jalons/l2e/registres.md; 17b §3.11; L2E-23): pure functions of src/components/registry-sources-view.ts,
// without a browser. The database holds one active source per country, refuses a day in the future and
// writes the former and the new value in the register; these only split, word, parse what was typed and
// show the change before it is confirmed.
import type { VerificationRegistrySourceAdminRow } from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  addedWhere,
  addFailureText,
  addLines,
  canEditSources,
  changeLines,
  draftOf,
  EMPTY_NEW_SOURCE,
  newSourceCheck,
  partitionSources,
  saveFailureText,
  sourceChangeCheck,
  sourceCountryWords,
  sourceLinkOf,
  sourceSubdivisionWords,
  subdivisionOf,
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
    subdivisionCode: null,
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

  it("tells an agent the screen is read-only, and no longer says an addition is impossible (L2F-21)", () => {
    expect(t.leadAgent).toMatch(/Lecture seule/);
    expect(JSON.stringify(t)).not.toMatch(/pas encore possible|sans migration/);
  });
});

describe("L2F-21: a source for a country or for one of its States is checked in its shapes and shown before it is added (RG52, RG101; 0229)", () => {
  const typed = {
    ...EMPTY_NEW_SOURCE,
    countryCode: "US",
    subdivisionCode: "ca",
    name: "  California Secretary of State  ",
    url: " https://bizfileonline.sos.ca.gov/search/business ",
    checkedOn: "2026-11-09",
    isActive: true,
  };

  it("words the State of a source, and « Tout le pays » for the register of a whole country", () => {
    expect(sourceSubdivisionWords(source({ subdivisionCode: "US-CA" }))).toBe(
      "US-CA",
    );
    expect(sourceSubdivisionWords(source())).toBe(t.noSubdivision);
    expect(t.countryLine("États-Unis", "US-CA")).toBe(
      "Pays : États-Unis ; État : US-CA",
    );
    expect(t.countryLine("États-Unis", null)).toBe("Pays : États-Unis");
  });

  it("reads the State as typed: empty is the whole country, the end alone is completed, the prefix is the country's own", () => {
    expect(subdivisionOf("US", "")).toBeNull();
    expect(subdivisionOf("US", "  ")).toBeNull();
    expect(subdivisionOf("US", "ca")).toBe("US-CA");
    expect(subdivisionOf("US", " us-ny ")).toBe("US-NY");
    expect(subdivisionOf("US", "CA-ON")).toBeUndefined();
    expect(subdivisionOf("US", "California")).toBeUndefined();
    expect(subdivisionOf("US", "US-")).toBeUndefined();
  });

  it("sends the country, the State completed, the name and the address trimmed; never the type", () => {
    expect(newSourceCheck(typed)).toEqual({
      ok: true,
      body: {
        countryCode: "US",
        subdivisionCode: "US-CA",
        name: "California Secretary of State",
        url: "https://bizfileonline.sos.ca.gov/search/business",
        checkedOn: "2026-11-09",
        isActive: true,
      },
    });
    const whole = newSourceCheck({ ...typed, subdivisionCode: "" });
    expect(whole.ok && whole.body.subdivisionCode).toBeNull();
  });

  it("refuses, on its own field, no country, a country that is not one, a State of another country, then the shapes of the name, the page and the day", () => {
    const p = t.add.problems;
    expect(newSourceCheck({ ...typed, countryCode: "" })).toEqual({
      ok: false,
      problem: { field: "countryCode", text: p.country },
    });
    expect(newSourceCheck({ ...typed, countryCode: "ZZ" })).toEqual({
      ok: false,
      problem: { field: "countryCode", text: p.country },
    });
    expect(newSourceCheck({ ...typed, subdivisionCode: "CA-ON" })).toEqual({
      ok: false,
      problem: { field: "subdivisionCode", text: p.subdivision },
    });
    expect(newSourceCheck({ ...typed, name: "x" })).toMatchObject({
      ok: false,
      problem: { field: "name" },
    });
    expect(
      newSourceCheck({ ...typed, url: "http://bizfileonline.sos.ca.gov/" }),
    ).toMatchObject({ ok: false, problem: { field: "url" } });
    expect(newSourceCheck({ ...typed, checkedOn: "" })).toMatchObject({
      ok: false,
      problem: { field: "checkedOn" },
    });
  });

  it("shows every value before it is journaled, the State as « Tout le pays » when there is none, and says where the source stands once added", () => {
    const checked = newSourceCheck(typed);
    if (!checked.ok) {
      throw new Error("the addition was refused");
    }
    const lines = addLines(checked.body);
    expect(lines.map((line) => line.key)).toEqual([
      "country",
      "subdivision",
      "name",
      "url",
      "checkedOn",
      "isActive",
    ]);
    expect(lines.find((line) => line.key === "subdivision")?.value).toBe(
      "US-CA",
    );
    expect(lines.find((line) => line.key === "isActive")?.value).toBe(
      t.activeWords.yes,
    );
    expect(
      addLines({ ...checked.body, subdivisionCode: null }).find(
        (line) => line.key === "subdivision",
      )?.value,
    ).toBe(t.noSubdivision);
    expect(addedWhere(checked.body)).toBe("États-Unis, US-CA");
    expect(addedWhere({ ...checked.body, subdivisionCode: null })).toBe(
      "États-Unis",
    );
  });

  it("says the country or the State the base does not know, a second active source, and a field the base refuses; any other failure keeps the generic sentence", () => {
    const p = t.add.problems;
    expect(addFailureText("validation_failed", ["invalid_country"])).toBe(
      p.unknownCountry,
    );
    expect(addFailureText("validation_failed", ["invalid_subdivision"])).toBe(
      p.unknownSubdivision,
    );
    expect(addFailureText("conflict", ["active_source_exists"])).toBe(
      p.activeExists,
    );
    expect(addFailureText("validation_failed", ["invalid_checked_on"])).toBe(
      t.problems.fieldRefused,
    );
    expect(addFailureText("forbidden", [])).toBeNull();
    expect(addFailureText(undefined, [])).toBeNull();
  });
});

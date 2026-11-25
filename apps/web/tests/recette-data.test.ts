// RUA-04 (jalons/rua/04.md; docs/mvp/22-refonte-ux-ui/05 §4, 06b §5): the synthetic acceptance data set, without
// a browser or a base. Every state of the 23 mockups is creatable by a loader or is listed in
// NON_RECETTABLE (state, missing datum, decision), once; the loaders call the helpers the journeys
// already use and no SQL of their own; the data holds no amount on the creator side, no e-mail outside
// `example.test`, no telephone, no real address. File reading only: deterministic, run by `pnpm test`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BACKOFFICE_DATA,
  BRAND_DATA,
  CREATOR_DATA,
  LOADERS,
  NON_RECETTABLE,
  RECETTE_EMAIL_DOMAIN,
  STATE_RECIPES,
} from "../e2e/fixtures/recette";
import { MOCKUPS, statesOf } from "../e2e/support/visual/mockups";

const SUPPORT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "e2e",
  "support",
);
const LOADER_SOURCE = readFileSync(path.join(SUPPORT, "recette.ts"), "utf8");

const ALL_STATES = MOCKUPS.flatMap((mockup) =>
  statesOf(mockup).map((state) => `${mockup.file}#${state}`),
);

/** The names a source imports (values and types), by module. */
function importsOf(
  source: string,
): { module: string; names: string[]; type: boolean }[] {
  const found: { module: string; names: string[]; type: boolean }[] = [];
  for (const match of source.matchAll(
    /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g,
  )) {
    const names = (match[2] ?? "")
      .split(",")
      .map((name) => name.trim().replace(/^type\s+/, ""))
      .filter((name) => name !== "");
    found.push({ module: match[3] ?? "", names, type: match[1] !== undefined });
  }
  return found;
}

/** Whether a support module exports a name: a declaration, or a re-export list. */
function exportsName(source: string, name: string): boolean {
  if (
    source.includes(`export async function ${name}(`) ||
    source.includes(`export function ${name}(`) ||
    source.includes(`export const ${name}`) ||
    source.includes(`export type ${name} `)
  ) {
    return true;
  }
  for (const list of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    const names = (list[1] ?? "")
      .split(",")
      .map((entry) => entry.trim().replace(/^type\s+/, ""));
    if (names.includes(name)) return true;
  }
  return false;
}

describe("the states of the mockups (RUA-T7)", () => {
  it("holds the 147 states of the survey", () => {
    expect(ALL_STATES).toHaveLength(147);
  });

  it("creates or lists each state, once and only once", () => {
    const creatable = Object.keys(STATE_RECIPES);
    const listed = NON_RECETTABLE.flatMap((entry) => entry.states);
    expect(new Set(creatable).size).toBe(creatable.length);
    expect(new Set(listed).size).toBe(listed.length);
    expect(
      creatable.filter((key) => (listed as string[]).includes(key)),
    ).toEqual([]);
    expect([...creatable, ...listed].sort()).toEqual([...ALL_STATES].sort());
    expect(creatable).toHaveLength(134);
    expect(listed).toHaveLength(13);
  });

  it("names, for each state that cannot be created, the missing datum and the decision", () => {
    expect(new Set(NON_RECETTABLE.map((entry) => entry.id)).size).toBe(
      NON_RECETTABLE.length,
    );
    for (const entry of NON_RECETTABLE) {
      expect(entry.states.length, entry.id).toBeGreaterThan(0);
      expect(entry.missing.length, entry.id).toBeGreaterThan(40);
      expect(entry.decision, entry.id).toMatch(/RU-\d\d|Lot 4/);
    }
  });

  it("starts each creatable state from loaders that exist, and leaves no loader unused", () => {
    const used = new Set<string>();
    for (const [key, recipe] of Object.entries(STATE_RECIPES)) {
      if (recipe.kind === "anonymous") continue;
      expect(recipe.loaders.length, key).toBeGreaterThan(0);
      for (const loader of recipe.loaders) {
        expect(Object.keys(LOADERS), key).toContain(loader);
        used.add(loader);
      }
    }
    expect([...used].sort()).toEqual(Object.keys(LOADERS).sort());
  });
});

describe("the loaders (RUA-T7)", () => {
  const imports = importsOf(LOADER_SOURCE);

  it("call the helpers that exist in e2e/support, and no other", () => {
    for (const entry of imports) {
      if (entry.module === "@playwright/test") {
        expect(entry.type, "Playwright: a type only").toBe(true);
        continue;
      }
      if (entry.module === "../fixtures/recette") continue;
      expect(entry.module, "a sibling of e2e/support").toMatch(/^\.\/[a-z-]+$/);
      const source = readFileSync(
        path.join(SUPPORT, `${entry.module.slice(2)}.ts`),
        "utf8",
      );
      for (const name of entry.names) {
        expect(
          exportsName(source, name),
          `${entry.module} exports ${name}`,
        ).toBe(true);
      }
    }
  });

  it("name in the catalogue every helper they call, and call every helper it names", () => {
    const called = new Set(
      imports
        .filter((entry) => entry.module.startsWith("./") && !entry.type)
        .flatMap((entry) => entry.names)
        .filter((name) => !/^[A-Z]/.test(name)),
    );
    const cleanup = [
      "removeOwnCampaigns",
      "removeOwnSelections",
      "removeQueueLines",
      "retireInternals",
      "retireSearchCreators",
      "withdrawReviewEntries",
    ];
    const named = new Set<string>(
      Object.values(LOADERS).flatMap((loader) => [...loader.helpers]),
    );
    for (const helper of named) {
      expect(called.has(helper), `${helper} is imported by recette.ts`).toBe(
        true,
      );
    }
    for (const helper of called) {
      expect(
        named.has(helper) || cleanup.includes(helper),
        `${helper} is named`,
      ).toBe(true);
    }
    // PROFILE_COUNTRY is a constant, not a helper
    expect(LOADER_SOURCE).toContain("PROFILE_COUNTRY");
  });

  it("write no SQL and connect to nothing themselves (the helpers hold the base)", () => {
    expect(LOADER_SOURCE).not.toMatch(/connectAs|postgres|sql`|\.query\(/);
    expect(LOADER_SOURCE).not.toMatch(/page\.request|fetch\(/);
    expect(LOADER_SOURCE).not.toMatch(/railway|supabase\.co|INFLUX_ENV/i);
  });
});

describe("the data (RUA-T7; D46, D48, D78)", () => {
  const spaces = {
    brand: JSON.stringify(BRAND_DATA),
    creator: JSON.stringify(CREATOR_DATA),
    backoffice: JSON.stringify(BACKOFFICE_DATA),
  };

  it("holds no amount, price, rate or fee, on any side (a campaign has its band written by the helper, never here)", () => {
    for (const [space, json] of Object.entries(spaces)) {
      expect(json, space).not.toMatch(
        /[€$£]|\b(?:eur|usd|gbp)\b|\b(?:price|amount|budget|fee|rate|tarif|montant|commission|cachet)\b|\d\s?%/i,
      );
    }
  });

  it("holds no e-mail address outside example.test, no telephone and no address on the web", () => {
    for (const [space, json] of Object.entries(spaces)) {
      for (const address of json.match(/[\w.+-]+@[\w.-]+/g) ?? []) {
        expect(address, space).toMatch(/@example\.test$/);
      }
      expect(json, space).not.toMatch(/\+?\d[\d\s().-]{7,}\d/);
      for (const url of json.match(/https?:\/\/[^\s"]+/g) ?? []) {
        expect(new URL(url).hostname, space).toMatch(/\.test$/);
      }
    }
    expect(RECETTE_EMAIL_DOMAIN).toBe("example.test");
  });

  it("gives the creator handles of the data set, never a person's", () => {
    for (const handle of Object.values(CREATOR_DATA.handles)) {
      expect(handle).toMatch(/^azur_recette_[a-z]{2}$/);
    }
  });

  it("tells the six states of a campaign, once each, under the brand of the mockups", () => {
    expect(BRAND_DATA.campaigns.map((campaign) => campaign.state)).toEqual([
      "draft",
      "pending_review",
      "published",
      "paused",
      "closed",
      "rejected",
    ]);
    expect(
      new Set(BRAND_DATA.campaigns.map((campaign) => campaign.title)).size,
    ).toBe(6);
    expect(BRAND_DATA.mockupLabel).toBe(`Maison ${BRAND_DATA.name}`);
  });

  it("covers every level of a badge the verification hub tells, on lines of different networks", () => {
    const kinds = new Set(CREATOR_DATA.verification.map((line) => line.kind));
    expect([...kinds].sort()).toEqual(["badge", "refusal", "revoked"]);
    const states = new Set(
      CREATOR_DATA.verification.flatMap((line) =>
        line.kind === "badge" ? [line.state] : [],
      ),
    );
    expect(states.has("active")).toBe(true);
    expect(states.has("to_reconfirm")).toBe(true);
  });
});

// The labels of the reference lists the brand profile form draws from (jalons/l2b, commit 10; 04
// §4.2 R8: labels live in the translation files, never in the database). Every ACTIVE code of
// reference.topics, networks, formats, sectors and usage_rights has its label in French and in
// English under its `label_key`, and every label belongs to a code of its table (a retired code may
// keep its label: old profiles still show it). `usage_right.none` has none: it is no right and is
// never ticked among others (L2-amend). The files read are the web app's, the ones the screen shows.
import { readFileSync } from "node:fs";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { migrationRole } from "./support.ts";

type Labels = Record<string, Record<string, string>>;

const LOCALES = ["fr", "en"] as const;

/** The `reference` part of `apps/web/src/locales/<locale>/brand-profile.json`. */
function referenceLabels(locale: (typeof LOCALES)[number]): Labels {
  const file = new URL(
    `../../web/src/locales/${locale}/brand-profile.json`,
    import.meta.url,
  );
  const messages = JSON.parse(readFileSync(file, "utf8")) as {
    reference: Labels;
  };
  return messages.reference;
}

/** The table, the singular of its `label_key` prefix, and the codes the form must not label. */
const LISTS = [
  { table: "topics", prefix: "topic", unlabelled: [] },
  { table: "networks", prefix: "network", unlabelled: [] },
  { table: "formats", prefix: "format", unlabelled: [] },
  { table: "sectors", prefix: "sector", unlabelled: [] },
  { table: "usage_rights", prefix: "usage_right", unlabelled: ["none"] },
] as const;

let migration: postgres.Sql;

beforeAll(() => {
  migration = migrationRole();
});

async function rowsOf(
  table: string,
): Promise<{ code: string; label_key: string; active: boolean }[]> {
  return migration.unsafe(
    `select code, label_key, retired_at is null as active
       from reference.${table} order by code`,
  );
}

describe("labels of the reference lists of the brand profile (04 §4.2 R8)", () => {
  for (const locale of LOCALES) {
    for (const { table, prefix, unlabelled } of LISTS) {
      it(`${locale}: every active code of reference.${table} has its label under its label_key`, async () => {
        const labels = referenceLabels(locale)[prefix] ?? {};
        const missing: string[] = [];
        for (const row of await rowsOf(table)) {
          if (!row.active || unlabelled.some((code) => code === row.code)) {
            continue;
          }
          expect(row.label_key, row.code).toBe(`${prefix}.${row.code}`);
          if ((labels[row.code] ?? "").trim() === "") {
            missing.push(row.code);
          }
        }
        expect(missing).toEqual([]);
      });

      it(`${locale}: every label of ${prefix} belongs to a code of reference.${table}`, async () => {
        const known = new Set((await rowsOf(table)).map((row) => row.code));
        const labels = Object.keys(referenceLabels(locale)[prefix] ?? {});
        expect(labels.filter((code) => !known.has(code))).toEqual([]);
      });
    }
  }

  it("has no label for usage right none, in either language", async () => {
    const codes = (await rowsOf("usage_rights")).map((row) => row.code);
    expect(codes).toContain("none");
    for (const locale of LOCALES) {
      expect(
        Object.keys(referenceLabels(locale).usage_right ?? {}),
      ).not.toContain("none");
    }
  });
});

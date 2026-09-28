// S-1 (21 §4, security review of J3 commits 5 and 6): postgres.js `unsafe` runs a text as SQL
// without parameter binding. On the influx_auth pool, which reads the address and status of every
// account, an injection would read them all: `unsafe` is refused by ESLint in the whole of src/,
// except src/db/pool.ts and its constant identity query. Proven on the witness file of
// test-witnesses/s1/ first, then on each block of the ESLint configuration.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const WITNESS = path.resolve(
  API_ROOT,
  "../../test-witnesses/s1/unsafe-outside-pool.ts.txt",
);
const eslint = new ESLint({ cwd: API_ROOT });

const S1_MESSAGE =
  / unsafe runs unparameterised SQL: only the constant query of src\/db\/pool\.ts/;

/** Messages of no-restricted-properties for `source`, linted as if it were `file` of apps/api. */
async function restrictedProperties(
  source: string,
  file: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(source, {
    filePath: path.join(API_ROOT, file),
  });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "no-restricted-properties")
    .map((message) => message.message);
}

const UNSAFE_CALL = `declare const sql: { unsafe(query: string): Promise<unknown> };
export const rows = sql.unsafe("select 1");
`;

describe("postgres.js unsafe outside src/db/pool.ts (21 S-1)", () => {
  it("reports the three forms of the witness file (call, destructuring, computed name)", async () => {
    const source = readFileSync(WITNESS, "utf8");
    const messages = await restrictedProperties(
      source,
      "src/domains/identity/repository.ts",
    );
    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message).toMatch(S1_MESSAGE);
    }
  });

  it.each([
    ["src/domains/identity/repository.ts"],
    ["src/domains/leads/service.ts"],
    ["src/db/index.ts"],
    ["src/db/roles.ts"],
    ["src/platform/supabase.ts"],
    ["src/platform/other.ts"],
    ["src/server.ts"],
    ["src/main.ts"],
    ["src/config/index.ts"],
  ])("refuses unsafe in %s", async (file) => {
    expect(await restrictedProperties(UNSAFE_CALL, file)).toEqual([
      expect.stringMatching(S1_MESSAGE),
    ]);
  });

  it("accepts unsafe in src/db/pool.ts only", async () => {
    expect(await restrictedProperties(UNSAFE_CALL, "src/db/pool.ts")).toEqual(
      [],
    );
  });

  it("keeps the other restrictions of src/ in src/db/pool.ts", async () => {
    const source = `declare const request: { ip: string; raw: unknown };
export const a = request.ip;
export const b = request.raw;
export const c = process.env;
`;
    expect(await restrictedProperties(source, "src/db/pool.ts")).toEqual([
      expect.stringMatching(/ ip is never read/),
      expect.stringMatching(/ raw bypasses the response schemas/),
      expect.stringMatching(/ Read configuration through src\/config\//),
    ]);
  });
});

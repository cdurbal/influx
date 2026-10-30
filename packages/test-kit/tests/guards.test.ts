// Self-checks of the shared guard helpers: a detector that no longer detects is a test that lies
// (docs/mvp/18-plan-de-test-mvp.md §5, G7).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  classConflicts,
  classesOf,
  findClassListConflicts,
  findMatches,
  findNetworkOrStorageUse,
  findPagesRouterDirectories,
  findPrimitiveBaseClassConflicts,
  findRelayContentViolations,
  findRelayFingerprintMismatches,
  findRelayImporterViolations,
  findRouteFileViolations,
  HARD_CODED_COLOR_PATTERN,
  HARD_CODED_LENGTH_PATTERN,
  HEALTH_ROUTE_FILE,
  importSpecifiers,
  isValidUtf8,
  listFiles,
  RELAY_FILES,
} from "../src/guards.ts";

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-test-kit-"));

function writeFixture(relative: string, content: string): string {
  const file = path.join(TEMP_ROOT, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("isValidUtf8", () => {
  it("accepts UTF-8 and refuses a lone Latin-1 byte", () => {
    const good = writeFixture("utf8/good.css", "/* § and ç */");
    const bad = path.join(TEMP_ROOT, "utf8/bad.css");
    writeFileSync(bad, Buffer.from([0x2f, 0x2a, 0x20, 0xa7, 0x20]));
    expect(isValidUtf8(good)).toBe(true);
    expect(isValidUtf8(bad)).toBe(false);
  });
});

describe("file helpers", () => {
  it("lists files recursively and reports matches with a relative path and line", () => {
    const file = writeFixture("list/a/b.ts", "first\nmailto:x\n");
    expect(listFiles(path.join(TEMP_ROOT, "list"))).toEqual([file]);
    expect(findMatches(/mailto:/g, [file, file], TEMP_ROOT)).toEqual([
      "list/a/b.ts:2: mailto:x",
      "list/a/b.ts:2: mailto:x",
    ]);
  });
});

describe("G3 patterns", () => {
  it("detects hexadecimal colors, color functions and literal lengths", () => {
    expect(HARD_CODED_COLOR_PATTERN.test("color: #22c55e;")).toBe(true);
    expect(HARD_CODED_COLOR_PATTERN.test("rgba(0, 0, 0, 0.5)")).toBe(true);
    expect(HARD_CODED_LENGTH_PATTERN.test("margin: 12px")).toBe(true);
    expect(HARD_CODED_LENGTH_PATTERN.test("gap: 1.5rem")).toBe(true);
    expect(HARD_CODED_COLOR_PATTERN.test("var(--color-brand-primary)")).toBe(
      false,
    );
    expect(HARD_CODED_LENGTH_PATTERN.test("p-(--spacing-inset-card)")).toBe(
      false,
    );
  });
});

describe("G7 detector", () => {
  it("fails on a known conflicting example (self-check of the detector)", () => {
    expect(
      classConflicts(classesOf(`"w-full" "aspect-4/5 w-1/3 sm:w-full"`)),
    ).toEqual(["|width"]);
    expect(classConflicts(classesOf(`"w-1/3 sm:w-full"`))).toEqual([]);
  });

  it("checks each side of a ternary apart", () => {
    const file = writeFixture(
      "src/Ternary.tsx",
      `const c = cn("flex", open ? "w-full" : "w-1/2");\n`,
    );
    expect(findClassListConflicts([file], TEMP_ROOT)).toEqual([]);
    const conflicting = writeFixture(
      "src/Conflict.tsx",
      `export const X = <div className="w-full w-1/2" />;\n`,
    );
    expect(findClassListConflicts([conflicting], TEMP_ROOT)).toEqual([
      `src/Conflict.tsx: |width in "w-full w-1/2"`,
    ]);
  });

  it("flags a width in the base classes of a primitive, but not an opt-in class", () => {
    const file = writeFixture(
      "src/ui/Primitive.tsx",
      `cn("w-full whitespace-nowrap", fullWidth && "w-full", className)\n`,
    );
    expect(findPrimitiveBaseClassConflicts([file], TEMP_ROOT)).toEqual([
      "src/ui/Primitive.tsx: w-full",
      "src/ui/Primitive.tsx: whitespace-nowrap",
    ]);
  });
});

describe("relay guard detectors (21 J1-C)", () => {
  /** A minimal front whose relay chain is correct, under its own directory. */
  function writeFront(name: string, overrides: Record<string, string> = {}) {
    const root = path.join(TEMP_ROOT, name);
    const files: Record<string, string> = {
      [RELAY_FILES.route]: `import { relay } from "../../../server/relay";\nexport const GET = relay;\n`,
      [RELAY_FILES.relay]: `import type { X } from "@influx/contracts/errors";\nimport { callApi } from "./api-client";\n`,
      [RELAY_FILES.apiClient]: `import { readServerConfig } from "../config/server";\nfetch("x");\n`,
      [RELAY_FILES.config]: `export const url = process.env.INFLUX_API_INTERNAL_URL;\n`,
      "src/app/[locale]/page.tsx": `export default function Page() { return null; }\n`,
      ...overrides,
    };
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(root, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    return root;
  }

  it("parses static, type-only, re-export and dynamic import specifiers", () => {
    const source = [
      `import a from "a";`,
      `import type { B } from "b";`,
      `import {\n  c,\n  d,\n} from "@/c";`,
      `import "./side-effect";`,
      `export * from "../e";`,
      `const f = await import("f");`,
    ].join("\n");
    expect(importSpecifiers(source)).toEqual([
      "a",
      "b",
      "@/c",
      "./side-effect",
      "../e",
      "f",
    ]);
  });

  it("accepts a correct relay chain", () => {
    const root = writeFront("correct");
    expect(findRouteFileViolations(root)).toEqual([]);
    expect(findRelayContentViolations(root)).toEqual([]);
    expect(findRelayImporterViolations(root)).toEqual([]);
  });

  it("detects a Pages Router directory, at the root or under src/", () => {
    const clean = writeFront("no-pages");
    expect(findPagesRouterDirectories(clean)).toEqual([]);
    const both = writeFront("pages-router", {
      "pages/api/hello.ts": "export default function handler() {}\n",
      "src/pages/index.tsx":
        "export default function Page() { return null; }\n",
    });
    expect(findPagesRouterDirectories(both)).toEqual([
      "unexpected Pages Router directory: pages/",
      "unexpected Pages Router directory: src/pages/",
    ]);
  });

  it("detects an extra route file and a missing one", () => {
    const extra = writeFront("extra-route", {
      "src/app/admin/route.ts": "export const GET = () => null;\n",
    });
    expect(findRouteFileViolations(extra)).toEqual([
      "unexpected route file: src/app/admin/route.ts",
    ]);
  });

  it("allows the health route of web only when declared, as a second importer of the relay (EC-22)", () => {
    const withHealth = writeFront("health-route", {
      [HEALTH_ROUTE_FILE]: `import { relay } from "../../server/relay";\nexport const GET = relay;\n`,
    });
    expect(findRouteFileViolations(withHealth, { healthRoute: true })).toEqual(
      [],
    );
    expect(
      findRelayImporterViolations(withHealth, { healthRoute: true }),
    ).toEqual([]);
    // The backoffice declares none: the same file is an extra route and an extra importer.
    expect(findRouteFileViolations(withHealth)).toEqual([
      `unexpected route file: ${HEALTH_ROUTE_FILE}`,
    ]);
    expect(findRelayImporterViolations(withHealth)).toEqual([
      `src/server/relay.ts is imported by [${RELAY_FILES.route}, ${HEALTH_ROUTE_FILE}], expected ${RELAY_FILES.route} only`,
    ]);
    // Declared but absent: missing.
    expect(
      findRouteFileViolations(writeFront("no-health"), { healthRoute: true }),
    ).toEqual([`missing route file: ${HEALTH_ROUTE_FILE}`]);
  });

  it("applies the content rules to the health route (EC-22)", () => {
    const root = writeFront("bad-health", {
      [HEALTH_ROUTE_FILE]: `import postgres from "postgres";\nimport { relay } from "../../server/relay";\nconst u = process.env.X;\n`,
    });
    expect(findRelayContentViolations(root, { healthRoute: true })).toEqual([
      `${HEALTH_ROUTE_FILE}: imports postgres`,
      `${HEALTH_ROUTE_FILE}: reads process.env`,
    ]);
  });

  it("detects a data-layer import, a Server Action and an environment read in the relay", () => {
    const root = writeFront("bad-content", {
      [RELAY_FILES.relay]: `"use server";\nimport { createClient } from "@supabase/supabase-js";\nimport { callApi } from "./api-client";\nconst s = process.env.SECRET;\n`,
    });
    expect(findRelayContentViolations(root)).toEqual([
      "src/server/relay.ts: imports @supabase/supabase-js",
      'src/server/relay.ts: contains a "use server" directive',
      "src/server/relay.ts: reads process.env",
    ]);
  });

  it("detects a component that reaches the API client, even through the @/ alias", () => {
    const root = writeFront("bad-importer", {
      "src/components/Widget.tsx": `import { callApi } from "@/server/api-client";\n`,
    });
    expect(findRelayImporterViolations(root)).toEqual([
      "src/server/api-client.ts is imported by [src/components/Widget.tsx, src/server/relay.ts], expected src/server/relay.ts only",
    ]);
  });

  it("detects a relay file whose fingerprint differs from the pin", () => {
    const root = writeFront("unpinned");
    expect(findRelayFingerprintMismatches(root)).toHaveLength(4);
  });

  it("allows fetch in the API client only, and storage nowhere", () => {
    const root = writeFront("network", {
      "src/components/Widget.tsx": `fetch("/x");\nlocalStorage.getItem("k");\n`,
    });
    const files = listFiles(path.join(root, "src"));
    expect(findNetworkOrStorageUse(files, root)).toEqual([
      `src/components/Widget.tsx:2: localStorage.getItem("k");`,
      `src/components/Widget.tsx:1: fetch("/x");`,
    ]);
  });
});

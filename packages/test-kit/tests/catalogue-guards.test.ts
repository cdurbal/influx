// Self-checks of the catalogue guards of the member components (RUB, D89; docs/mvp/18-plan-de-test-mvp.md
// §12.8, RUB-T0; archives/jalons/rub/modele-archi.md §1, §2, §3, §7): a detector that no longer detects is a guard
// that lies. Each guard has its accepted case and its negative cases.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  findCatalogueProblems,
  findSharedCatalogueProblems,
  findTransitionalCopies,
} from "../src/guards.ts";

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-catalogue-guards-"));
let root = "";
let counter = 0;

function write(relative: string, content: string): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

beforeEach(() => {
  root = path.join(TEMP_ROOT, `case-${(counter += 1)}`);
  mkdirSync(root, { recursive: true });
});

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("RUB-T0: G8, the member component folder", () => {
  const UI = "src/components/member/ui";
  const RULES = {
    directory: UI,
    expectedModules: ["Card.tsx", "PageFrame.tsx"],
    uncalled: ["PageFrame"],
  };

  function writeFront(): void {
    write(`${UI}/Card.tsx`, "export const Card = 1;\n");
    write(`${UI}/card-classes.ts`, "export const X = 1;\n");
    write(
      `${UI}/PageFrame.tsx`,
      'import { Card } from "./Card";\nexport const PageFrame = Card;\n',
    );
    write(
      "src/app/state-board/page.board.tsx",
      'import { PageFrame } from "@/components/member/ui/PageFrame";\nexport default PageFrame;\n',
    );
    write(
      "src/components/account/Screen.tsx",
      'import { Card } from "@/components/member/ui/Card";\nexport const Screen = Card;\n',
    );
  }

  it("accepts the exact set, imported by the folder and the board, a called module imported by a screen", () => {
    writeFront();
    expect(findCatalogueProblems(root, RULES)).toEqual([]);
  });

  it("detects a module outside the list, a missing one and a rebuilt old name", () => {
    writeFront();
    write(`${UI}/MemberButton.tsx`, "export const MemberButton = 1;\n");
    expect(findCatalogueProblems(root, RULES)).toEqual([
      "the member component modules in [Card.tsx, MemberButton.tsx, PageFrame.tsx], expected [Card.tsx, PageFrame.tsx]",
    ]);
    rmSync(path.join(root, UI, "MemberButton.tsx"));
    rmSync(path.join(root, UI, "Card.tsx"));
    expect(findCatalogueProblems(root, RULES)).toEqual([
      "the member component modules in [PageFrame.tsx], expected [Card.tsx, PageFrame.tsx]",
    ]);
  });

  it("detects a barrel", () => {
    writeFront();
    write(`${UI}/index.ts`, 'export * from "./Card";\n');
    expect(findCatalogueProblems(root, RULES)).toEqual([
      `${UI}/index.ts: a barrel`,
    ]);
  });

  it("detects a screen that imports an uncalled module, by alias or by relative path, and an entry that is no module", () => {
    writeFront();
    write(
      "src/components/account/Peek.tsx",
      'import { PageFrame } from "@/components/member/ui/PageFrame";\nvoid PageFrame;\n',
    );
    write(
      "src/components/auth/Peek.tsx",
      'import { PageFrame } from "../member/ui/PageFrame";\nvoid PageFrame;\n',
    );
    expect(
      findCatalogueProblems(root, {
        ...RULES,
        uncalled: ["PageFrame", "Section"],
      }),
    ).toEqual([
      "Section: an uncalled module that is not a module of the folder",
      "src/components/account/Peek.tsx: imports PageFrame, which has no caller before RUE",
      "src/components/auth/Peek.tsx: imports PageFrame, which has no caller before RUE",
    ]);
  });
});

describe("RUB-T0: G8, the copies of screen in reprieve", () => {
  const RULES = [
    {
      name: "a live region",
      pattern: /role="status"|aria-live/,
      files: ["src/a/One.tsx", "src/a/Two.tsx"],
    },
    {
      name: "an ErrorNotice that is not announced",
      pattern: /<ErrorNotice\b[^>]*?\bannounce=\{false\}/,
      files: ["src/a/One.tsx"],
    },
  ];

  function writeScreens(): void {
    write(
      "src/a/One.tsx",
      'export const One = () => <><p role="status" /><ErrorNotice\n  id="x"\n  announce={false}\n/></>;\n',
    );
    write(
      "src/a/Two.tsx",
      'export const Two = () => <p aria-live="polite" />;\n',
    );
    write(
      "src/a/Three.tsx",
      '// a note that says role="status" and aria-live\nexport const Three = () => <ErrorNotice />;\n',
    );
  }

  it("accepts the listed files, a comment that names the pattern, a notice that is announced", () => {
    writeScreens();
    expect(findTransitionalCopies(root, RULES)).toEqual([]);
  });

  it("detects a file outside the list that holds a copy (the fortieth)", () => {
    writeScreens();
    write(
      "src/a/Fortieth.tsx",
      'export const F = () => <p role="status" />;\n',
    );
    write(
      "src/a/Silent.tsx",
      "export const S = () => <ErrorNotice announce={false} />;\n",
    );
    expect(findTransitionalCopies(root, RULES)).toEqual([
      "src/a/Fortieth.tsx: holds a live region, which is not listed",
      "src/a/Silent.tsx: holds an ErrorNotice that is not announced, which is not listed",
    ]);
  });

  it("detects a listed file that lost its copy or no longer exists (a stale entry)", () => {
    writeScreens();
    write("src/a/Two.tsx", "export const Two = () => <p />;\n");
    rmSync(path.join(root, "src/a/One.tsx"));
    expect(findTransitionalCopies(root, RULES)).toEqual([
      "a live region: src/a/One.tsx is listed and no longer holds it",
      "a live region: src/a/Two.tsx is listed and no longer holds it",
      "an ErrorNotice that is not announced: src/a/One.tsx is listed and no longer holds it",
    ]);
  });
});

describe("RUB-T0: G8, the shared catalogue", () => {
  const MEMBER = "web/src/components/member/ui";
  const BACKOFFICE = "backoffice/src/components/ui";
  const UI_PACKAGE = "packages/ui";
  const ROOTS = () => ({
    memberDirectory: path.join(root, MEMBER),
    backofficeDirectory: path.join(root, BACKOFFICE),
    uiPackageRoot: path.join(root, UI_PACKAGE),
  });
  const MODULE = [
    'import type { ReactNode } from "react";',
    'import type { SectionVariant } from "./section-classes";',
    "// the title and its body",
    "export type SectionProps = {",
    "  variant: SectionVariant;",
    "  children: ReactNode;",
    "};",
    "export function Section({ children }: SectionProps) {",
    "  return <section>{children}</section>;",
    "}",
    "",
  ].join("\n");
  const MANIFEST = JSON.stringify({
    exports: { "./tokens.css": "./a.css", "./fonts": "./b.ts" },
  });

  function writeFront(): void {
    write(`${MEMBER}/Section.tsx`, MODULE);
    write(`${UI_PACKAGE}/package.json`, MANIFEST);
    write(`${UI_PACKAGE}/src/styles/tokens.css`, ":root {}\n");
    write(`${UI_PACKAGE}/node_modules/dep/Thing.tsx`, "export {};\n");
  }
  const PENDING = [{ name: "Section", backoffice: "pending" as const }];
  const DELIVERED = [{ name: "Section", backoffice: "delivered" as const }];

  it("accepts a pending entry without a twin, and a delivered one whose twin differs by comments and blanks only", () => {
    writeFront();
    expect(findSharedCatalogueProblems(ROOTS(), PENDING)).toEqual([]);
    write(
      `${BACKOFFICE}/Section.tsx`,
      MODULE.replace("// the title and its body", "// another comment").replace(
        "  variant: SectionVariant;",
        "  variant:   SectionVariant;",
      ),
    );
    expect(findSharedCatalogueProblems(ROOTS(), DELIVERED)).toEqual([]);
  });

  it("detects a missing module and a module that exports no properties", () => {
    writeFront();
    expect(
      findSharedCatalogueProblems(ROOTS(), [
        ...PENDING,
        { name: "Missing", backoffice: "pending" },
      ]),
    ).toEqual(["Missing: the module is absent from the member folder"]);
    write(
      `${MEMBER}/Section.tsx`,
      "export function Section() { return null; }\n",
    );
    expect(findSharedCatalogueProblems(ROOTS(), PENDING)).toEqual([
      "Section: does not export SectionProps",
    ]);
  });

  it("detects a property typed from @influx/contracts, from a module of the front, or by an inline import", () => {
    writeFront();
    write(
      `${MEMBER}/Section.tsx`,
      [
        'import type { Role } from "@influx/contracts";',
        'import type { Row } from "@/lib/rows";',
        "export type SectionProps = {",
        "  role: Role;",
        "  rows: Row[];",
        '  other: import("@/lib/other").Other;',
        "};",
        "",
      ].join("\n"),
    );
    expect(findSharedCatalogueProblems(ROOTS(), PENDING)).toEqual([
      "Section: SectionProps is typed from Role of @influx/contracts",
      "Section: SectionProps is typed from Row of @/lib/rows",
      "Section: SectionProps is typed by an inline import",
    ]);
  });

  it("detects a pending entry whose twin exists, a delivered one without a twin and twins that differ in a property", () => {
    writeFront();
    write(`${BACKOFFICE}/Section.tsx`, MODULE);
    expect(findSharedCatalogueProblems(ROOTS(), PENDING)).toEqual([
      "Section: pending, and the backoffice twin exists",
    ]);
    write(
      `${BACKOFFICE}/Section.tsx`,
      MODULE.replace(
        "  children: ReactNode;",
        "  children: ReactNode;\n  dense?: boolean;",
      ),
    );
    expect(findSharedCatalogueProblems(ROOTS(), DELIVERED)).toEqual([
      "Section: the two twins differ",
    ]);
    rmSync(path.join(root, BACKOFFICE, "Section.tsx"));
    expect(findSharedCatalogueProblems(ROOTS(), DELIVERED)).toEqual([
      "Section: delivered, and the backoffice twin is absent",
    ]);
  });

  it("detects a component in packages/ui and an export that is not tokens or fonts, dependencies aside", () => {
    writeFront();
    write(`${UI_PACKAGE}/src/Button.tsx`, "export {};\n");
    write(
      `${UI_PACKAGE}/package.json`,
      JSON.stringify({
        exports: {
          "./tokens.css": "./a.css",
          "./fonts": "./b.ts",
          "./Button": "./c.tsx",
        },
      }),
    );
    expect(findSharedCatalogueProblems(ROOTS(), PENDING)).toEqual([
      "the exports of packages/ui in [./Button, ./fonts, ./tokens.css], expected [./fonts, ./tokens.css]",
      "packages/ui/src/Button.tsx: a component in the package of tokens",
    ]);
  });
});

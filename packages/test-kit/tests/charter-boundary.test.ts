// Self-checks of G8, the boundary between the two charters of a front (docs/mvp/18-plan-de-test-mvp.md
// §5.1 and §12.1, TD1.10; 02 §21.3 to §21.6): a detector that no longer detects is a guard that lies.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  findForbiddenClassPairs,
  findKeoActivationViolations,
  findMemberGroupMismatches,
  findPortalUse,
  findRoleColorUse,
  findStateTransforms,
  findVitrineImportsUnder,
  findVitrineTokenUse,
} from "../src/guards.ts";

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-charter-boundary-"));
let front = "";
let counter = 0;

const LAYOUT = "src/app/[locale]/(member)/layout.tsx";
const KEO_SCOPES = ["src/app/[locale]/(member)", "src/components/auth"];
const VITRINE_MODULES = ["src/components/landing", "src/content/landing.ts"];
const APP = "src/app/[locale]";
const GROUP = "(member)";
const MEMBER_PATHS = ["connexion", "sign-in", "compte"];

function write(relative: string, content: string): void {
  const file = path.join(front, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** A front shaped like apps/web: one KEO layout, member pages in their group, a landing outside. */
beforeEach(() => {
  front = path.join(TEMP_ROOT, `front-${(counter += 1)}`);
  write("src/styles/fonts.ts", "export const FONT_VARIABLE_CLASSES = '';\n");
  write(
    LAYOUT,
    [
      'import { FONT_VARIABLE_CLASSES } from "@/styles/fonts";',
      "// data-theme is set here only",
      "export default function Layout() {",
      '  return <div data-theme="keo" className={FONT_VARIABLE_CLASSES} />;',
      "}",
    ].join("\n"),
  );
  write(`${APP}/(member)/connexion/page.tsx`, "export default 1;\n");
  write(`${APP}/(member)/sign-in/page.tsx`, "export default 1;\n");
  write(`${APP}/(member)/(space)/compte/page.tsx`, "export default 1;\n");
  write(`${APP}/page.tsx`, 'import "@/components/landing/Hero";\n');
  write(`${APP}/cgu/page.tsx`, "export default 1;\n");
  write(
    "src/components/landing/Hero.tsx",
    'export const HERO = "bg-metal-card hover:scale-105 transition-all";\n',
  );
  write("src/content/landing.ts", "export const CONTENT = {};\n");
  write(
    "src/components/auth/AuthScreen.tsx",
    [
      'import { cn } from "@/components/ui/class-names";',
      "// never hover:scale-105, nor createPortal, nor bg-metal-card",
      'export const CENTER = "-translate-x-1/2 transition-colors text-text-inverse";',
    ].join("\n"),
  );
});

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("TD1.10: data-theme and fonts.ts, in the KEO layouts only", () => {
  it("accepts the layout alone, a comment that names the attribute aside", () => {
    expect(findKeoActivationViolations(front, [LAYOUT])).toEqual([]);
  });

  it("detects the attribute and an import of fonts.ts elsewhere, and a layout that lost them", () => {
    write(
      "src/components/auth/Shell.tsx",
      'import "../../styles/fonts";\nexport const A = { "data-theme": "keo" };\n',
    );
    expect(findKeoActivationViolations(front, [LAYOUT])).toEqual([
      `data-theme is written in [${LAYOUT}, src/components/auth/Shell.tsx], expected [${LAYOUT}]`,
      `src/styles/fonts.ts is imported in [${LAYOUT}, src/components/auth/Shell.tsx], expected [${LAYOUT}]`,
    ]);
    write(LAYOUT, "export default function Layout() { return null; }\n");
    expect(findKeoActivationViolations(front, [LAYOUT])).toEqual([
      `data-theme is written in [src/components/auth/Shell.tsx], expected [${LAYOUT}]`,
      `src/styles/fonts.ts is imported in [src/components/auth/Shell.tsx], expected [${LAYOUT}]`,
    ]);
  });
});

describe("TD1.10: no portal, anywhere in src/", () => {
  it("detects createPortal in code, never in a comment", () => {
    expect(findPortalUse(front)).toEqual([]);
    write(
      "src/components/landing/Menu.tsx",
      'import { createPortal } from "react-dom";\n',
    );
    expect(findPortalUse(front)).toEqual([
      "src/components/landing/Menu.tsx: createPortal",
    ]);
  });
});

describe("TD1.10: no module of the vitrine under the KEO scopes", () => {
  it("accepts shared modules and detects a vitrine module, by alias or relative path", () => {
    expect(findVitrineImportsUnder(front, KEO_SCOPES, VITRINE_MODULES)).toEqual(
      [],
    );
    write(
      `${APP}/(member)/connexion/page.tsx`,
      'import { HERO } from "@/components/landing/Hero";\n',
    );
    write(
      "src/components/auth/Doors.tsx",
      'import { CONTENT } from "../../content/landing";\n',
    );
    expect(findVitrineImportsUnder(front, KEO_SCOPES, VITRINE_MODULES)).toEqual(
      [
        `${APP}/(member)/connexion/page.tsx: imports @/components/landing/Hero`,
        "src/components/auth/Doors.tsx: imports ../../content/landing",
      ],
    );
  });

  it("reports a listed module that does not exist", () => {
    expect(
      findVitrineImportsUnder(front, KEO_SCOPES, [
        ...VITRINE_MODULES,
        "src/components/ui/Gone.tsx",
      ]),
    ).toEqual([
      "src/components/ui/Gone.tsx: listed as a vitrine module, does not exist",
    ]);
  });
});

describe("TD1.10: colors move, and the zoom and the lift only under motion-safe:", () => {
  it("accepts a state transformation under motion-safe:, refuses it without, and transition-all always", () => {
    expect(findStateTransforms(front, KEO_SCOPES)).toEqual([]);
    write(
      "src/components/auth/Card.tsx",
      [
        'export const A = "hover:scale-105";',
        'export const B = "motion-safe:hover:-translate-y-0.5";',
        'export const C = "group-hover:rotate-3 lg:focus-visible:skew-x-2";',
        'export const D = "transition-all duration-fast";',
        'export const E = "-translate-x-1/2 transition-colors hover:bg-surface-hover";',
        'export const F = "motion-safe:not-aria-disabled:hover:scale-(--scale-hover) transition-lift";',
        'export const G = "hover:motion-safe:translate-y-(--translate-lift)";',
        'export const H = "motion-safe:transition-all lg:hover:translate-y-1";',
        'export const I = "motion-safe:hover:scale-105 hover:rotate-3";',
      ].join("\n"),
    );
    expect(findStateTransforms(front, KEO_SCOPES)).toEqual([
      'src/components/auth/Card.tsx:1: export const A = "hover:scale-105";',
      'src/components/auth/Card.tsx:3: export const C = "group-hover:rotate-3 lg:focus-visible:skew-x-2";',
      'src/components/auth/Card.tsx:4: export const D = "transition-all duration-fast";',
      'src/components/auth/Card.tsx:8: export const H = "motion-safe:transition-all lg:hover:translate-y-1";',
      'src/components/auth/Card.tsx:9: export const I = "motion-safe:hover:scale-105 hover:rotate-3";',
    ]);
  });

  it("confines the role colors to the role component, which must require its label (G3g)", () => {
    const allowed = ["src/components/member/ui/RoleBadge.tsx"];
    expect(findRoleColorUse(front, allowed)).toEqual([
      "src/components/member/ui/RoleBadge.tsx: listed as a role component, does not exist",
    ]);
    write(
      allowed[0] ?? "",
      'export const DOT = "bg-role-creator"; // label: string is required\ntype P = { label: string };\n',
    );
    expect(findRoleColorUse(front, allowed)).toEqual([]);
    write(
      "src/components/auth/Name.tsx",
      [
        'export const A = "text-role-advertiser";',
        'export const B = "lg:hover:border-role-creator";',
        'export const C = "var(--color-role-creator)";',
        "// a comment may name bg-role-creator",
        'export const D = "text-roles-list role-advertiser";',
      ].join("\n"),
    );
    expect(findRoleColorUse(front, allowed)).toEqual([
      'src/components/auth/Name.tsx:1: export const A = "text-role-advertiser";',
      'src/components/auth/Name.tsx:2: export const B = "lg:hover:border-role-creator";',
      'src/components/auth/Name.tsx:3: export const C = "var(--color-role-creator)";',
    ]);
    write(allowed[0] ?? "", 'export const DOT = "bg-role-creator";\n');
    expect(findRoleColorUse(front, allowed)).toEqual([
      "src/components/member/ui/RoleBadge.tsx: a role component without a required label: string",
      'src/components/auth/Name.tsx:1: export const A = "text-role-advertiser";',
      'src/components/auth/Name.tsx:2: export const B = "lg:hover:border-role-creator";',
      'src/components/auth/Name.tsx:3: export const C = "var(--color-role-creator)";',
    ]);
  });

  it("detects a forbidden foreground on surface-active in one literal, not apart (G3h)", () => {
    const pairs = [
      {
        surface: "bg-surface-active",
        foregrounds: ["text-text-tertiary", "text-feedback-error-text"],
      },
    ];
    expect(findForbiddenClassPairs(front, KEO_SCOPES, pairs)).toEqual([]);
    write(
      "src/components/auth/Tabs.tsx",
      [
        'export const A = "bg-surface-active text-text-primary";',
        'export const B = "px-3 text-text-tertiary aria-selected:bg-surface-active";',
        'export const C = "hover:bg-surface-active lg:text-feedback-error-text";',
        'export const D = "bg-surface-active-ish text-text-tertiary";',
        'export const E = "text-text-tertiary"; export const F = "bg-surface-active";',
      ].join("\n"),
    );
    expect(findForbiddenClassPairs(front, KEO_SCOPES, pairs)).toEqual([
      'src/components/auth/Tabs.tsx: text-text-tertiary on bg-surface-active in "px-3 text-text-tertiary aria-selected:bg-surface-active"',
      'src/components/auth/Tabs.tsx: text-feedback-error-text on bg-surface-active in "hover:bg-surface-active lg:text-feedback-error-text"',
    ]);
  });

  it("detects a vitrine token, not a longer or a shorter name", () => {
    const fragments = ["metal-card", "text-inverse-secondary"];
    expect(findVitrineTokenUse(front, KEO_SCOPES, fragments)).toEqual([]);
    write(
      "src/components/auth/Badge.tsx",
      [
        'export const A = "bg-metal-card";',
        'export const B = "text-text-inverse-secondary";',
        'export const C = "shadow-metal-card-soft text-text-inverse";',
      ].join("\n"),
    );
    expect(findVitrineTokenUse(front, KEO_SCOPES, fragments)).toEqual([
      'src/components/auth/Badge.tsx:1: export const A = "bg-metal-card";',
      'src/components/auth/Badge.tsx:2: export const B = "text-text-inverse-secondary";',
    ]);
  });
});

describe("TD1.10: the member pages are exactly those of the group", () => {
  it("accepts the pages of the group, route groups nested or not", () => {
    expect(findMemberGroupMismatches(front, APP, GROUP, MEMBER_PATHS)).toEqual(
      [],
    );
  });

  it("detects a member page left outside, a missing one and a foreign page inside", () => {
    write(`${APP}/compte/page.tsx`, "export default 1;\n");
    write(`${APP}/(member)/cookies/page.tsx`, "export default 1;\n");
    expect(
      findMemberGroupMismatches(front, APP, GROUP, [...MEMBER_PATHS, "marque"]),
    ).toEqual([
      "/compte: a member page outside (member)",
      "/marque: no page in (member)",
      "/cookies: in (member), not a member page",
    ]);
  });
});

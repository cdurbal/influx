// Guard tests of the landing page mockup (docs/landing-page/01-architecture.md §9.3).
// File reading only: deterministic, no browser, no network.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SRC = path.join(WEB_ROOT, "src");
const PLACEHOLDERS_DIR = path.join(SRC, "content", "placeholders");
const IMAGES_DIR = path.join(PLACEHOLDERS_DIR, "images");

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function relative(file: string): string {
  return path.relative(WEB_ROOT, file).split(path.sep).join("/");
}

/** Scope of G1 to G3: Landing page mockup files (docs/landing-page/01-architecture.md §9.3) */
const MVP_APP_DIRS = [
  "dev",
  "auth",
  "creator",
  "brand",
  "campaign",
  "search",
  "creator-campaigns",
  "space",
];
const SCOPED_FILES = listFiles(SRC)
  .filter(
    (file) =>
      !MVP_APP_DIRS.some((dir) =>
        file.includes(path.join("src", "components", dir)),
      ),
  )
  .filter((file) => /\.(ts|tsx|json|css)$/.test(file));

function findMatches(pattern: RegExp, files: readonly string[]): string[] {
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        pattern.test(line)
          ? [`${relative(file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

describe("G1: no mailto or tel shortcut (CA6, revised 00-cadrage.md §8)", () => {
  // href= itself was reintroduced on 2026-09-17 for in-app navigation between the account/login
  // pages (docs/landing-page/00-cadrage.md §8): only the CA6, no-href part is abrogated. Direct
  // mailto:/tel: shortcuts stay forbidden — the contact e-mail remains plain text (CA6 residual).
  it("finds no mailto: or tel:", () => {
    expect(findMatches(/mailto:|\btel:/, SCOPED_FILES)).toEqual([]);
  });
});

describe("G2: no third-party URL (CA11)", () => {
  it("finds no http:// or https:// URL", () => {
    expect(findMatches(/https?:\/\//, SCOPED_FILES)).toEqual([]);
  });
});

describe("G3: no hard-coded color or length outside the token files (CA22)", () => {
  const TOKEN_FILES = new Set([
    "src/styles/tokens.css",
    "src/styles/image-sizes.ts",
  ]);
  const files = SCOPED_FILES.filter((file) => !TOKEN_FILES.has(relative(file)));

  it("finds no hexadecimal color or color function", () => {
    const colorPattern =
      /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/;
    expect(findMatches(colorPattern, files)).toEqual([]);
  });

  it("finds no literal length (px, rem, em, vh, vw, ch)", () => {
    const lengthPattern = /\b\d*\.?\d+(?:px|rem|em|d?vh|d?vw|ch)\b/;
    expect(findMatches(lengthPattern, files)).toEqual([]);
  });

  it("keeps a single tokens file, marked with its D6 status", () => {
    const cssFiles = listFiles(SRC)
      .filter((file) => file.endsWith(".css"))
      .map(relative);
    expect(cssFiles.sort()).toEqual([
      "src/app/globals.css",
      "src/styles/tokens.css",
    ]);
    const tokens = readFileSync(path.join(SRC, "styles", "tokens.css"), "utf8");
    expect(tokens.slice(0, 200)).toContain("D6 tranchée");
    expect(
      readFileSync(path.join(SRC, "app", "globals.css"), "utf8"),
    ).not.toMatch(/--color-[\w-]+\s*:/);
  });
});

describe("G4: every photo is credited, and every credit has a photo (CA26)", () => {
  const images = readdirSync(IMAGES_DIR).sort();
  const credits = readFileSync(
    path.join(PLACEHOLDERS_DIR, "CREDITS.md"),
    "utf8",
  );
  const creditedFiles = [...credits.matchAll(/^\|\s*(img-[\w-]+\.jpg)\s*\|/gm)]
    .map((match) => match[1])
    .sort();

  it("lists the 31 photos of 05-images.md", () => {
    expect(images).toHaveLength(31);
  });

  it("matches the image folder and CREDITS.md exactly", () => {
    expect(creditedFiles).toEqual(images);
  });

  it("gives an author, a Pexels source page and the license for each photo", () => {
    for (const file of images) {
      // Table cells may be padded by Prettier: compare trimmed first cells.
      const line = credits
        .split("\n")
        .find((row) => row.split("|")[1]?.trim() === file);
      expect(line, file).toBeDefined();
      expect(line, file).toMatch(/https:\/\/www\.pexels\.com\/@/);
      expect(line, file).toMatch(/https:\/\/www\.pexels\.com\/photo\//);
      expect(line, file).toContain("Licence Pexels");
    }
  });

  it("keeps no photo in public/ (01 §6.1, 05 §5)", () => {
    const publicDir = path.join(WEB_ROOT, "public");
    const publicImages = existsSync(publicDir)
      ? listFiles(publicDir).filter((file) =>
          /\.(jpe?g|png|webp|avif|gif)$/i.test(file),
        )
      : [];
    expect(publicImages).toEqual([]);
  });
});

describe("G5: no server endpoint (CA8)", () => {
  it("has no route.ts or route.tsx under src/app", () => {
    const routes = listFiles(path.join(SRC, "app")).filter((file) =>
      /[\\/]route\.tsx?$/.test(file),
    );
    expect(routes).toEqual([]);
  });
});

describe("G6: the mockup banner cannot be hidden while fictitious content exists (CA13, CA14)", () => {
  it("keeps IS_MOCKUP set to true", () => {
    const source = readFileSync(
      path.join(PLACEHOLDERS_DIR, "index.ts"),
      "utf8",
    );
    expect(source).toMatch(/export const IS_MOCKUP: boolean = true;/);
  });
});

describe("Additional guards", () => {
  it("has identical FR and EN translation keys (CA23)", () => {
    type Messages = { [key: string]: string | Messages };
    const flatten = (messages: Messages, prefix = ""): string[] =>
      Object.entries(messages).flatMap(([key, value]) =>
        typeof value === "string"
          ? [`${prefix}${key}`]
          : flatten(value, `${prefix}${key}.`),
      );
    const read = (locale: string) =>
      JSON.parse(
        readFileSync(path.join(SRC, "locales", locale, "landing.json"), "utf8"),
      ) as Messages;
    expect(flatten(read("en")).sort()).toEqual(flatten(read("fr")).sort());
  });

  it("uses no network or storage API in the source code (CA8, CA11)", () => {
    const codeFiles = SCOPED_FILES.filter((file) => /\.tsx?$/.test(file));
    const forbidden =
      /\bfetch\(|XMLHttpRequest|\bWebSocket\b|\bEventSource\b|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|cookieStore/;
    expect(findMatches(forbidden, codeFiles)).toEqual([]);
  });

  it("keeps fictitious values inside src/content/placeholders only (CA15)", () => {
    const outside = listFiles(SRC).filter(
      (file) =>
        !file.startsWith(PLACEHOLDERS_DIR) && /\.(ts|tsx|json|css)$/.test(file),
    );
    const fictitiousValues = [
      "contact@influx.example",
      "Lysmouré",
      "Kaffrune",
      "Ondarive",
      "Bolbruyère",
      "Clavembre",
      "Cousevaine",
      "Pédalune",
      "Aurifane",
      "Crêtenval",
      "Vuescarde",
      "Fjelmora",
      "Flammoisy",
      "Croquembel",
      "Semavrille",
      "Infuvelle",
      "contenus fictifs",
      "fictitious content",
      "rien n’a été envoyé",
      "nothing was sent",
      "Votre univers cuisine",
      "Your cooking content",
      "Donnée fictive",
      "Fictitious figure",
    ];
    // Comments may name the fictitious module: only code and messages are checked.
    const stripComments = (source: string) =>
      source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const leaks = outside.flatMap((file) => {
      const content = stripComments(readFileSync(file, "utf8"));
      return fictitiousValues
        .filter((value) => content.includes(value))
        .map((value) => `${relative(file)}: ${value}`);
    });
    expect(leaks).toEqual([]);
  });

  it("gives the CreatorCard type no identity field (D16, CA17)", () => {
    const source = readFileSync(
      path.join(SRC, "content", "landing-content.ts"),
      "utf8",
    );
    const block = source.match(/export type CreatorCard = \{([\s\S]*?)\n\};/);
    expect(block).not.toBeNull();
    const fields = [...(block?.[1] ?? "").matchAll(/^\s*(\w+)\??:/gm)].map(
      (match) => match[1],
    );
    expect(fields.sort()).toEqual(
      [
        "audienceMax",
        "audienceMin",
        "country",
        "id",
        "image",
        "theme",
        "verified",
      ].sort(),
    );
  });

  it("imports the fictitious module only from the locale layout and page (CA15)", () => {
    const importers = listFiles(SRC)
      .filter(
        (file) => !file.startsWith(PLACEHOLDERS_DIR) && /\.tsx?$/.test(file),
      )
      .filter((file) =>
        /from "[^"]*placeholders[^"]*"/.test(readFileSync(file, "utf8")),
      )
      .map(relative)
      .sort();
    expect(importers).toEqual([
      "src/app/[locale]/layout.tsx",
      "src/app/[locale]/page.tsx",
    ]);
  });
});

describe("G7: no Tailwind class conflict that cn() cannot resolve (10 #10)", () => {
  // cn() only joins classes: when two utilities of the same group apply at the same variant, the
  // order of the compiled CSS wins, not the order of the call (cause of 09 A1 and 10 #1 to #3).
  // Checked groups are those that broke the page: width and white-space.
  const CONFLICT_GROUPS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
    { name: "width", pattern: /^w-/ },
    { name: "white-space", pattern: /^whitespace-/ },
  ];
  const COMPONENT_FILES = listFiles(SRC).filter((file) =>
    file.endsWith(".tsx"),
  );

  /** Returns the argument text of every cn(...) call, with balanced parentheses. */
  function cnCalls(source: string): string[] {
    const calls: string[] = [];
    for (const match of source.matchAll(/\bcn\(/g)) {
      const start = match.index + match[0].length;
      let depth = 1;
      let end = start;
      while (end < source.length && depth > 0) {
        if (source[end] === "(") depth += 1;
        if (source[end] === ")") depth -= 1;
        end += 1;
      }
      calls.push(source.slice(start, end - 1));
    }
    return calls;
  }

  function classesOf(text: string): string[] {
    return [...text.matchAll(/"([^"]*)"/g)].flatMap((literal) =>
      (literal[1] ?? "").split(/\s+/).filter(Boolean),
    );
  }

  /** Group keys ("sm:|width") that appear more than once in the class list. */
  function conflicts(classes: readonly string[]): string[] {
    const seen = new Map<string, number>();
    for (const className of classes) {
      const separator = className.lastIndexOf(":");
      const variant = className.slice(0, separator + 1);
      const utility = className.slice(separator + 1);
      const group = CONFLICT_GROUPS.find(({ pattern }) =>
        pattern.test(utility),
      );
      if (group) {
        const key = `${variant}|${group.name}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    return [...seen].filter(([, count]) => count > 1).map(([key]) => key);
  }

  it("never sets two widths or two white-space values at the same variant in one class list", () => {
    const findings = COMPONENT_FILES.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const lists = [
        ...[...source.matchAll(/className="([^"]*)"/g)].map(
          (match) => `"${match[1] ?? ""}"`,
        ),
        ...cnCalls(source),
      ];
      return lists.flatMap((list) => {
        // Alternatives of a ternary never apply together: check each side apart.
        const sides = list.includes("?") ? list.split(/[?:]\s*(?=")/) : [list];
        return sides.flatMap((side) =>
          conflicts(classesOf(side)).map(
            (key) => `${relative(file)}: ${key} in ${side.trim()}`,
          ),
        );
      });
    });
    expect(findings).toEqual([]);
  });

  it("keeps width and white-space out of the base classes of primitives that accept className", () => {
    const findings = listFiles(path.join(SRC, "components", "ui"))
      .filter((file) => file.endsWith(".tsx"))
      .flatMap((file) =>
        cnCalls(readFileSync(file, "utf8"))
          .filter((call) => /\bclassName\b/.test(call))
          .flatMap((call) =>
            // Opt-in classes such as `fullWidth && "w-full"` are chosen by the caller: allowed.
            classesOf(
              call
                .slice(0, call.search(/\bclassName\b/))
                .replace(/&&\s*"[^"]*"/g, ""),
            )
              .filter((className) =>
                CONFLICT_GROUPS.some(({ pattern }) => pattern.test(className)),
              )
              .map((className) => `${relative(file)}: ${className}`),
          ),
      );
    expect(findings).toEqual([]);
  });

  it("fails on a known conflicting example (self-check of the detector)", () => {
    expect(
      conflicts(classesOf(`"w-full" "aspect-4/5 w-1/3 sm:w-full"`)),
    ).toEqual(["|width"]);
    expect(conflicts(classesOf(`"w-1/3 sm:w-full"`))).toEqual([]);
  });
});

// Shared guard helpers of the front applications (docs/mvp/18-plan-de-test-mvp.md §5,
// docs/mvp/21-plan-de-developpement.md §4, J1-C and J1-E).
// File reading only: deterministic, no browser, no network. Each helper returns its findings;
// the assertion (an empty list) stays in the guard test of each application.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Every file under a directory, recursively. */
export function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

/** Path of a file relative to a root, with forward slashes on every platform. */
export function relativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

/** Every line matching the pattern, as "relative/path:line: text". */
export function findMatches(
  pattern: RegExp,
  files: readonly string[],
  root: string,
): string[] {
  // A global or sticky regular expression keeps state between calls to test(): drop those flags.
  const matcher = new RegExp(
    pattern.source,
    pattern.flags.replace(/[gy]/g, ""),
  );
  return files.flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        matcher.test(line)
          ? [`${relativePath(root, file)}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  );
}

// ---------------------------------------------------------------------------------------------
// G3: no hard-coded color or length outside the token files (CA22, CLAUDE.md §10.3 rule 7)
// ---------------------------------------------------------------------------------------------

/** Hexadecimal color or CSS color function. */
export const HARD_CODED_COLOR_PATTERN =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/;

/** Literal length (px, rem, em, vh, vw, ch). */
export const HARD_CODED_LENGTH_PATTERN =
  /\b\d*\.?\d+(?:px|rem|em|d?vh|d?vw|ch)\b/;

// ---------------------------------------------------------------------------------------------
// G7: no Tailwind class conflict that cn() cannot resolve (10 #10)
// ---------------------------------------------------------------------------------------------
// cn() only joins classes: when two utilities of the same group apply at the same variant, the
// order of the compiled CSS wins, not the order of the call (cause of 09 A1 and 10 #1 to #3).
// Checked groups are those that broke the page: width and white-space.

export const TAILWIND_CONFLICT_GROUPS: ReadonlyArray<{
  name: string;
  pattern: RegExp;
}> = [
  { name: "width", pattern: /^w-/ },
  { name: "white-space", pattern: /^whitespace-/ },
];

/** Returns the argument text of every cn(...) call, with balanced parentheses. */
export function cnCalls(source: string): string[] {
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

/** Class names found in the double-quoted string literals of a text. */
export function classesOf(text: string): string[] {
  return [...text.matchAll(/"([^"]*)"/g)].flatMap((literal) =>
    (literal[1] ?? "").split(/\s+/).filter(Boolean),
  );
}

/** Group keys ("sm:|width") that appear more than once in the class list. */
export function classConflicts(classes: readonly string[]): string[] {
  const seen = new Map<string, number>();
  for (const className of classes) {
    const separator = className.lastIndexOf(":");
    const variant = className.slice(0, separator + 1);
    const utility = className.slice(separator + 1);
    const group = TAILWIND_CONFLICT_GROUPS.find(({ pattern }) =>
      pattern.test(utility),
    );
    if (group) {
      const key = `${variant}|${group.name}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen].filter(([, count]) => count > 1).map(([key]) => key);
}

/** Two widths or two white-space values at the same variant in one class list. */
export function findClassListConflicts(
  componentFiles: readonly string[],
  root: string,
): string[] {
  return componentFiles.flatMap((file) => {
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
        classConflicts(classesOf(side)).map(
          (key) => `${relativePath(root, file)}: ${key} in ${side.trim()}`,
        ),
      );
    });
  });
}

/** Width or white-space in the base classes of a primitive that accepts className. */
export function findPrimitiveBaseClassConflicts(
  primitiveFiles: readonly string[],
  root: string,
): string[] {
  return primitiveFiles.flatMap((file) =>
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
            TAILWIND_CONFLICT_GROUPS.some(({ pattern }) =>
              pattern.test(className),
            ),
          )
          .map((className) => `${relativePath(root, file)}: ${className}`),
      ),
  );
}

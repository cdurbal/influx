// Source files scanned by the static checks of 18 T6 and T16: tracked by Git or not, but never
// node_modules, .next or build outputs.
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  "test-results",
  ".turbo",
]);

export function listSourceFiles(
  directory: string,
  extensions: readonly string[],
): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return listSourceFiles(fullPath, extensions);
    }
    return extensions.some((extension) => entry.endsWith(extension))
      ? [fullPath]
      : [];
  });
}

export const SCRIPT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
] as const;

/** Script kind by extension; witness files (`.ts.txt`) are read as TypeScript. */
export function scriptKindOf(file: string): ts.ScriptKind {
  if (file.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (file.endsWith(".js") || file.endsWith(".mjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

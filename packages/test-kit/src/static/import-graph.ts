// 18 T6.3: separation by process, on the import graph. Only relative imports and the
// workspace packages (@influx/*, through their `exports`) are followed; external packages are
// leaves. The names found in a module are its identifiers and string literals — never its
// comments, which reference nothing.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { scriptKindOf } from "./source-files.ts";

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(file),
  );
}

function workspaceTarget(
  specifier: string,
  packagesRoot: string,
): string | null {
  const match = /^@influx\/([a-z-]+)(\/.*)?$/.exec(specifier);
  if (match === null) {
    return null;
  }
  const packageRoot = path.join(packagesRoot, match[1] ?? "");
  const manifestPath = path.join(packageRoot, "package.json");
  if (!existsSync(manifestPath)) {
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    exports?: Record<string, string>;
  };
  const target = manifest.exports?.[`.${match[2] ?? ""}`];
  return target === undefined ? null : path.join(packageRoot, target);
}

/** Every module reachable from an entry point, the entry included. */
export function reachableModules(
  entry: string,
  packagesRoot: string,
): string[] {
  const seen = new Set<string>();
  const pending = [path.resolve(entry)];
  while (pending.length > 0) {
    const file = pending.pop();
    if (file === undefined || seen.has(file) || !existsSync(file)) {
      continue;
    }
    seen.add(file);
    const source = parse(file);
    source.forEachChild((node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier !== undefined &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text;
        const target = specifier.startsWith(".")
          ? path.resolve(path.dirname(file), specifier)
          : workspaceTarget(specifier, packagesRoot);
        if (target !== null) {
          pending.push(target);
        }
      }
    });
  }
  return [...seen];
}

/** Identifiers and string literals of a module. */
export function namesIn(file: string): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) {
      names.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return names;
}

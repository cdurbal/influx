// 18 T6.1: the set A of operations passed, AS A LITERAL, to withElevatedTransaction. Anything
// that makes A unverifiable is a finding: a non-literal operation, an alias, a re-export, a
// reference that is not a direct call.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { scriptKindOf } from "./source-files.ts";

export const ELEVATED_FUNCTION = "withElevatedTransaction";
/** Index of the operation among the arguments of withElevatedTransaction(database, operation…). */
const OPERATION_ARGUMENT = 1;

export type ElevatedCallReport = {
  operations: string[];
  findings: string[];
};

export function scanElevatedCalls(
  files: readonly string[],
  declarationFile: string,
): ElevatedCallReport {
  const operations: string[] = [];
  const findings: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes(ELEVATED_FUNCTION)) {
      continue;
    }
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      scriptKindOf(file),
    );
    const at = (node: ts.Node) =>
      `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === ELEVATED_FUNCTION) {
        const parent = node.parent;
        if (ts.isCallExpression(parent) && parent.expression === node) {
          const argument = parent.arguments[OPERATION_ARGUMENT];
          if (argument !== undefined && ts.isStringLiteralLike(argument)) {
            operations.push(argument.text);
          } else {
            findings.push(`${at(node)}: operation is not a string literal`);
          }
        } else if (
          ts.isFunctionDeclaration(parent) &&
          file === declarationFile
        ) {
          // The declaration itself.
        } else if (
          ts.isImportSpecifier(parent) &&
          parent.propertyName === undefined
        ) {
          // A plain named import, needed to call it.
        } else {
          findings.push(`${at(node)}: reference that is not a direct call`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { operations, findings };
}

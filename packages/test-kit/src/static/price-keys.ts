// T16-L2D (jalons/l2d commit 11; D78, D48): no price, rate, net, currency or amount key in what a
// creator profile contract or translation declares. A key is compared whole, after its case and
// separators are dropped: `engagementRateBp` is not `rate`, `price` and `Price` are. Both scanners
// are proven on witnesses in tests/t16-static.test.ts.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { scriptKindOf } from "./source-files.ts";

/** The words a creator profile never declares as a key (and their plurals). */
export const PRICE_KEYS: readonly string[] = [
  "price",
  "prices",
  "rate",
  "rates",
  "net",
  "currency",
  "currencies",
  "amount",
  "amounts",
];

const PRICE_KEY_SET = new Set(PRICE_KEYS);

function isPriceKey(name: string): boolean {
  return PRICE_KEY_SET.has(name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase());
}

/**
 * The property names of a TypeScript file (object literals, interfaces, types, shorthand) and the
 * string literals that equal a price word, as `name (line n)`. Comments are never read.
 */
export function priceKeysInScript(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(file),
  );
  const found: string[] = [];
  const note = (node: ts.Node, name: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${name} (line ${line + 1})`);
  };
  const visit = (node: ts.Node) => {
    if (
      (ts.isPropertyAssignment(node) ||
        ts.isPropertySignature(node) ||
        ts.isShorthandPropertyAssignment(node) ||
        ts.isPropertyDeclaration(node)) &&
      (ts.isIdentifier(node.name) ||
        ts.isStringLiteral(node.name) ||
        ts.isNoSubstitutionTemplateLiteral(node.name)) &&
      isPriceKey(node.name.text)
    ) {
      note(node, node.name.text);
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isPriceKey(node.text) &&
      !(
        node.parent !== undefined &&
        (ts.isPropertyAssignment(node.parent) ||
          ts.isPropertySignature(node.parent)) &&
        node.parent.name === node
      )
    ) {
      note(node, `"${node.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The keys of a JSON translation file, at any depth, that are price words: `a.b.price`. */
export function priceKeysInJson(text: string): string[] {
  const found: string[] = [];
  const visit = (value: unknown, prefix: string) => {
    if (typeof value !== "object" || value === null) {
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const here = prefix === "" ? key : `${prefix}.${key}`;
      if (key.split(".").some(isPriceKey)) {
        found.push(here);
      }
      visit(child, here);
    }
  };
  visit(JSON.parse(text) as unknown, "");
  return found;
}

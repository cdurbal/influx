// 18 T16.1, T16.2 and T16.7: no commission computation anywhere (CLAUDE.md §3, transitional
// regime of the MVP). Definitions of 18 T16 ("Définitions de l'analyse statique"), amended by
// the J2 security review (C-3: literals compared BY VALUE, and 35/100-like quotients).
import { readFileSync } from "node:fs";
import ts from "typescript";
import { scriptKindOf } from "./source-files.ts";

const MONEY_WORDS = new Set([
  "amount",
  "amounts",
  "montant",
  "commission",
  "commissions",
  "minor",
  "net",
  "fee",
  "fees",
]);
const RATE_WORDS = new Set([
  "rate",
  "rates",
  "taux",
  "percent",
  "percentage",
  "pct",
  "bps",
]);
/** Decimal values of the commission scale (35 %, 20 %, 15 %, 65 %), compared by value. */
const SCALE_PERCENTS = ["35", "20", "15", "65"];
// Derived, not written as decimal literals: this file must pass its own check.
const SCALE_VALUES = SCALE_PERCENTS.map((value) => Number(value) / 100);
const PERCENT_TEXT = /\b(?:35|20|15|65)\s?%/;

/** Words of an identifier: camelCase / PascalCase, `_`, `-` and digits split it. */
export function wordsOf(identifier: string): string[] {
  return identifier
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_\-0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

export function isMoneyIdentifier(identifier: string): boolean {
  return wordsOf(identifier).some((word) => MONEY_WORDS.has(word));
}

export function isRateIdentifier(identifier: string): boolean {
  const words = wordsOf(identifier);
  return words.some(
    (word, index) =>
      RATE_WORDS.has(word) &&
      !(word === "rate" && words[index + 1] === "limit"),
  );
}

function isScreamingConstant(identifier: string): boolean {
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$|^[A-Z]{2,}$/.test(identifier);
}

type OperandKind = "money" | "rate" | "literal" | "constant" | "other";

function classifyName(name: string): OperandKind {
  if (isMoneyIdentifier(name)) {
    return "money";
  }
  if (isRateIdentifier(name)) {
    return "rate";
  }
  if (isScreamingConstant(name)) {
    return "constant";
  }
  return "other";
}

const UNWRAPPED_CALLS = new Set([
  "Number",
  "BigInt",
  "Math.round",
  "Math.floor",
  "Math.ceil",
  "Math.trunc",
]);

function classifyOperand(node: ts.Expression): OperandKind {
  let current: ts.Expression = node;
  for (;;) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    } else if (
      ts.isPrefixUnaryExpression(current) &&
      (current.operator === ts.SyntaxKind.MinusToken ||
        current.operator === ts.SyntaxKind.PlusToken)
    ) {
      current = current.operand;
    } else if (
      ts.isCallExpression(current) &&
      current.arguments.length === 1 &&
      UNWRAPPED_CALLS.has(current.expression.getText())
    ) {
      current = current.arguments[0] as ts.Expression;
    } else {
      break;
    }
  }
  if (ts.isNumericLiteral(current) || ts.isBigIntLiteral(current)) {
    return "literal";
  }
  if (ts.isIdentifier(current)) {
    return classifyName(current.text);
  }
  if (ts.isPropertyAccessExpression(current)) {
    return classifyName(current.name.text);
  }
  return "other";
}

const MULTIPLICATIVE = new Set([
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.AsteriskAsteriskToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
]);

function isForbiddenPair(left: OperandKind, right: OperandKind): boolean {
  const sensitive = (kind: OperandKind) => kind === "money" || kind === "rate";
  const partner = (kind: OperandKind) => kind !== "other";
  return (
    (sensitive(left) && partner(right)) || (sensitive(right) && partner(left))
  );
}

function numericValue(node: ts.Node): number | undefined {
  return ts.isNumericLiteral(node)
    ? Number(node.text.replace(/_/g, ""))
    : undefined;
}

function isScaleValue(value: number | undefined): boolean {
  return (
    value !== undefined &&
    SCALE_VALUES.some((scale) => Math.abs(scale - value) < 1e-12)
  );
}

/** `35/100`, `20 / 100`…: a percentage written as a quotient (C-3). */
function isScaleQuotient(node: ts.BinaryExpression): boolean {
  return (
    node.operatorToken.kind === ts.SyntaxKind.SlashToken &&
    SCALE_PERCENTS.includes(String(numericValue(node.left))) &&
    numericValue(node.right) === 100
  );
}

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** T16.7: at J2 no exemption annotation is admitted anywhere (the conversion function does not exist). */
const EXEMPTION_MARKER = /t16[-_ ]?exempt/i;

export function scanScriptForCommission(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(file),
  );
  const findings: string[] = [];
  const at = (node: ts.Node) =>
    `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  if (EXEMPTION_MARKER.test(text)) {
    findings.push(
      `${file}: T16.7 exemption annotation (none is admitted at J2)`,
    );
  }

  // T16.2 state of the innermost function (or of the module).
  type Scope = { node: ts.Node; scale: ts.Node[]; sensitive: boolean };
  const scopes: Scope[] = [];

  const visit = (node: ts.Node, scope: Scope): void => {
    let current = scope;
    if (isFunctionLike(node)) {
      current = { node, scale: [], sensitive: false };
      scopes.push(current);
    }
    if (
      ts.isBinaryExpression(node) &&
      MULTIPLICATIVE.has(node.operatorToken.kind)
    ) {
      if (
        isForbiddenPair(classifyOperand(node.left), classifyOperand(node.right))
      ) {
        findings.push(
          `${at(node)}: T16.1 multiplication of an amount or a rate: ${node.getText()}`,
        );
      }
      if (isScaleQuotient(node)) {
        current.scale.push(node);
      }
    }
    if (ts.isNumericLiteral(node) && isScaleValue(numericValue(node))) {
      current.scale.push(node);
    }
    if (
      (ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)) &&
      PERCENT_TEXT.test(node.text)
    ) {
      current.scale.push(node);
    }
    if (
      ts.isIdentifier(node) &&
      (isMoneyIdentifier(node.text) || isRateIdentifier(node.text))
    ) {
      current.sensitive = true;
    }
    ts.forEachChild(node, (child) => visit(child, current));
  };
  const moduleScope: Scope = { node: source, scale: [], sensitive: false };
  scopes.push(moduleScope);
  visit(source, moduleScope);

  for (const scope of scopes) {
    if (scope.sensitive) {
      for (const node of scope.scale) {
        findings.push(
          `${at(node)}: T16.2 commission scale next to an amount or a rate: ${node.getText()}`,
        );
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------------------------
// SQL (supabase/migrations, supabase/seed)
// ---------------------------------------------------------------------------------------------

/** Removes comments; string literals are blanked (their length kept) for T16.1 only. */
function stripSqlComments(text: string): string {
  return text.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function blankStrings(text: string): string {
  return text.replace(
    /'(?:[^']|'')*'/g,
    (literal) => `'${" ".repeat(literal.length - 2)}'`,
  );
}

const SQL_TOKEN =
  /[A-Za-z_][A-Za-z0-9_$]*|[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?|\S/gi;

function classifySqlToken(token: string | undefined): OperandKind {
  if (token === undefined) {
    return "other";
  }
  if (/^[0-9]/.test(token)) {
    return "literal";
  }
  if (/^[A-Za-z_]/.test(token)) {
    return isMoneyIdentifier(token)
      ? "money"
      : isRateIdentifier(token)
        ? "rate"
        : "other";
  }
  return "other";
}

export function scanSqlForCommission(file: string): string[] {
  const raw = stripSqlComments(readFileSync(file, "utf8"));
  const findings: string[] = [];
  if (EXEMPTION_MARKER.test(readFileSync(file, "utf8"))) {
    findings.push(
      `${file}: T16.7 exemption annotation (none is admitted at J2)`,
    );
  }
  // T16.1: token adjacent to `*` or `/`, strings blanked.
  const tokens = blankStrings(raw).match(SQL_TOKEN) ?? [];
  tokens.forEach((token, index) => {
    if (token === "*" || token === "/") {
      if (
        isForbiddenPair(
          classifySqlToken(tokens[index - 1]),
          classifySqlToken(tokens[index + 1]),
        )
      ) {
        findings.push(
          `${file}: T16.1 SQL multiplication of an amount or a rate: ${tokens[index - 1]} ${token} ${tokens[index + 1]}`,
        );
      }
    }
  });
  // T16.2: per statement, strings kept (a "35 %" label counts).
  for (const statement of raw.split(";")) {
    const statementTokens = blankStrings(statement).match(SQL_TOKEN) ?? [];
    const sensitive = statementTokens.some(
      (token) =>
        classifySqlToken(token) === "money" ||
        classifySqlToken(token) === "rate",
    );
    if (!sensitive) {
      continue;
    }
    const decimals = [
      ...statement.matchAll(/(?<![\w.])(\d*\.\d+(?:e[+-]?\d+)?|\d+e-\d+)/gi),
    ].map((match) => Number(match[1]));
    const quotient = /\b(?:35|20|15|65)\s*\/\s*100\b/.test(statement);
    if (
      decimals.some(isScaleValue) ||
      quotient ||
      PERCENT_TEXT.test(statement)
    ) {
      findings.push(
        `${file}: T16.2 commission scale in a statement naming an amount or a rate`,
      );
    }
  }
  return findings;
}

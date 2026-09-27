// 18 T6.6: no session state (03 P7, rules 1, 2 and 4). Session-level SET ROLE, RESET, any SET
// but SET LOCAL and SET CONSTRAINTS, a set_config whose third argument is not the literal `true`,
// LISTEN / UNLISTEN, session advisory locks and disabled certificate verification are forbidden in
// the scanned sources, SQL texts included. Deliberately simple, proven on witness files.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { scriptKindOf } from "./source-files.ts";

const RULES: readonly { name: string; pattern: RegExp }[] = [
  {
    name: "role taken for the whole session",
    pattern: /\bset\s+(?:session\s+)?role\b/i,
  },
  { name: "role or settings reset", pattern: /\breset\s+(?:role|all)\b/i },
  {
    name: "session-wide setting (only LOCAL settings and constraint modes)",
    pattern:
      /(?:^|[`'"(;]\s*)set\s+(?!local\b|constraints\b)[a-z_.]+\s*(?:=|\bto\b)/im,
  },
  {
    name: "notification channel subscription",
    pattern: /(?:^|[`'"(;]\s*)(?:un)?listen\s+[a-z_"]/im,
  },
  {
    name: "session advisory lock",
    pattern: /pg_(?:try_)?advisory_(?:un)?lock(?:_shared|_all)?\s*\(/i,
  },
  {
    name: "certificate verification disabled",
    pattern: /rejectUnauthorized\s*:\s*false/,
  },
];

/** The code of a file without its comments (a comment references nothing). */
function codeOf(file: string): string {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(file),
  );
  return ts.createPrinter({ removeComments: true }).printFile(source);
}

/**
 * The top-level arguments of the call whose opening parenthesis is at `open`, or null when the
 * call is not closed. Parentheses, brackets and braces (`${…}` placeholders) are balanced.
 */
function argumentsOf(text: string, open: number): string[] | null {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let index = open; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      if (depth === 0) {
        args.push(text.slice(start, index));
        return args;
      }
    } else if (char === "," && depth === 1) {
      args.push(text.slice(start, index));
      start = index + 1;
    }
  }
  return null;
}

/**
 * Does the text call set_config with a third argument other than the literal `true`? A bound
 * value (`${isLocal}`, `$3`), `false` or a missing argument would let a setting outlive the
 * transaction (S1 of the end-of-J2 security review, 21 §4).
 */
function hasNonLocalSetConfig(text: string): boolean {
  for (const call of text.matchAll(/set_config\s*\(/gi)) {
    const args = argumentsOf(text, call.index + call[0].length - 1);
    if (args?.length !== 3 || args[2]?.trim().toLowerCase() !== "true") {
      return true;
    }
  }
  return false;
}

export function scanSessionState(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const text = codeOf(file);
    const findings = RULES.filter((rule) => rule.pattern.test(text)).map(
      (rule) => `${file}: ${rule.name}`,
    );
    if (hasNonLocalSetConfig(text)) {
      findings.push(
        `${file}: set_config whose third argument is not the literal true`,
      );
    }
    return findings;
  });
}

/**
 * Files whose text contains `set local role` (T6.6, S1): exactly one place in apps/api/src and
 * the src folder of each package, plus the role harness of test-kit, the one named exemption.
 */
export function filesTakingARole(files: readonly string[]): string[] {
  return files.filter((file) => /\bset\s+local\s+role\b/i.test(codeOf(file)));
}

// 18 T6.6: no session state (03 P7, rules 1, 2 and 4). Session-level SET ROLE, RESET, any SET
// but SET LOCAL and SET CONSTRAINTS, set_config(…, false), LISTEN / UNLISTEN, session advisory
// locks and disabled certificate verification are forbidden in the scanned sources, SQL texts
// included. Line-based, deliberately simple, proven on witness files.
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
    name: "session-wide set_config",
    pattern: /set_config\s*\((?:[^()]|\([^()]*\))*?,\s*false\s*\)/i,
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

export function scanSessionState(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const text = codeOf(file);
    return RULES.filter((rule) => rule.pattern.test(text)).map(
      (rule) => `${file}: ${rule.name}`,
    );
  });
}

/** Files whose text contains `set local role` (T6.6: exactly one place in src/db/). */
export function filesTakingARole(files: readonly string[]): string[] {
  return files.filter((file) => /\bset\s+local\s+role\b/i.test(codeOf(file)));
}

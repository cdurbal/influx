// D77 read guard (PreToolUse on Read): a large file of docs/mvp/ is never read whole. Above
// 30 KB, a Read needs a `limit` of 400 lines at most; the agent finds the slice first, in
// docs/mvp/INDEX.md by Grep (CLAUDE.md, reference documents). Small files (a milestone sheet,
// a commit prompt, run.md) pass. Any unexpected input lets the call through: this guard saves
// tokens, it is not a security boundary.
import { statSync } from "node:fs";

const MAX_BYTES = 30 * 1024;
const MAX_LINES = 400;

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

try {
  const { tool_name: tool, tool_input: input = {} } = JSON.parse(raw);
  const path = String(input.file_path ?? "").replaceAll("\\", "/");
  if (tool !== "Read" || !/\/docs\/mvp\/.+\.md$/i.test(path)) process.exit(0);
  const limit = Number(input.limit);
  if (Number.isFinite(limit) && limit > 0 && limit <= MAX_LINES) process.exit(0);
  const bytes = statSync(path).size;
  if (bytes <= MAX_BYTES) process.exit(0);
  const kTokens = Math.round(bytes / 3500);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `D77: ${path.split("/").slice(-2).join("/")} is ${Math.round(bytes / 1024)} KB ` +
          `(~${kTokens}k tokens). Find the slice first (Grep "^## <file>" -A 56 in ` +
          `docs/mvp/INDEX.md, or Grep the rule id), then Read with offset and a limit of ` +
          `${MAX_LINES} lines at most.`,
      },
    }),
  );
} catch {
  process.exit(0);
}

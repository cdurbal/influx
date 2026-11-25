// D77 read guard (PreToolUse on Read, Bash and PowerShell): a large file of docs/mvp/ is never
// read whole. Above 30 KB, a Read needs a `limit` of 400 lines at most and the slice itself must
// stay under 32 KB; the agent finds the slice first, in docs/mvp/INDEX.md by Grep (CLAUDE.md,
// reference documents). A shell command that dumps such a file whole (cat, type, Get-Content,
// less, more, git show <rev>:<file>) without a range or a filter (head, tail, sed -n, grep,
// Select-Object -First...) is refused too (amendment of 2026-11-13). Small files (a milestone
// sheet, a commit prompt, run.md) pass. Any unexpected input lets the call through: this guard
// saves tokens, it is not a security boundary.
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const MAX_BYTES = 30 * 1024;
const MAX_LINES = 400;
const MAX_SLICE_BYTES = 32 * 1024;
const HINT =
  'Find the slice first (Grep "^## <file>" -A 70 in docs/mvp/INDEX.md, or Grep the rule id), ' +
  `then Read with offset and a limit of ${MAX_LINES} lines at most.`;

const DOC_PATH = /\/docs\/mvp\/.+\.md$/i;
const SHELL_DOC_PATH = /[^\s"'`;|&<>()]*docs[\\/]+mvp[\\/]+[^\s"'`;|&<>()]+?\.md\b/gi;
const WHOLE_READER =
  /(?:^|[\s;|&(])(?:cat|type|gc|get-content|less|more|bat|nl)(?=\s)|\bgit\s+show\s+\S*:/i;
// Filters count as commands only (`git show HEAD:...` is not `head`).
const RANGE_OR_FILTER =
  /(?:^|[\s;|&(])(?:head|tail|grep|rg|wc|awk|select-string|sls|findstr)(?=\s|$)|\bsed\s+-n\b|\s-(?:TotalCount|Tail|First|Last|Skip)\b/i;

const kb = (bytes) => Math.round(bytes / 1024);
const shortName = (path) => path.replaceAll("\\", "/").split("/").slice(-2).join("/");

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `D77: ${reason}`,
      },
    }),
  );
  process.exit(0);
}

function sizeOf(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function guardRead(input) {
  const path = String(input.file_path ?? "").replaceAll("\\", "/");
  if (!DOC_PATH.test(path)) return;
  const bytes = sizeOf(path);
  if (bytes <= MAX_BYTES) return;
  const limit = Number(input.limit);
  if (!(Number.isFinite(limit) && limit > 0 && limit <= MAX_LINES)) {
    deny(`${shortName(path)} is ${kb(bytes)} KB (~${Math.round(bytes / 3500)}k tokens). ${HINT}`);
  }
  const offset = Math.max(Number(input.offset) || 1, 1);
  const lines = readFileSync(path, "utf8").split("\n").slice(offset - 1, offset - 1 + limit);
  const sliceBytes = Buffer.byteLength(lines.join("\n"), "utf8");
  if (sliceBytes > MAX_SLICE_BYTES) {
    deny(
      `${shortName(path)}, lines ${offset} to ${offset + limit - 1}, is ${kb(sliceBytes)} KB ` +
        `(cap ${kb(MAX_SLICE_BYTES)} KB). Read a smaller limit, or Grep the rule id first.`,
    );
  }
}

function toLocalPath(path, cwd) {
  const gitBashDrive = /^\/([a-z])\//i.exec(path);
  if (gitBashDrive) return `${gitBashDrive[1]}:/${path.slice(3)}`;
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function guardShell(input, cwd) {
  const command = String(input.command ?? "");
  if (!WHOLE_READER.test(command) || RANGE_OR_FILTER.test(command)) return;
  for (const [match] of command.matchAll(SHELL_DOC_PATH)) {
    const path = toLocalPath(match.replace(/^\S*?:(?=docs[\\/])/, ""), cwd);
    const bytes = sizeOf(path);
    if (bytes > MAX_BYTES) {
      deny(
        `${shortName(path)} is ${kb(bytes)} KB: never dump it whole from a shell ` +
          `(cat, type, Get-Content...). ${HINT}`,
      );
    }
  }
}

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

try {
  const { tool_name: tool, tool_input: input = {}, cwd } = JSON.parse(raw);
  const base = cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (tool === "Read") guardRead(input);
  else if (tool === "Bash" || tool === "PowerShell") guardShell(input, base);
} catch {
  process.exit(0);
}

// D76: when a commit stages a spec, a milestone sheet or the index builder, docs/mvp/INDEX.md is
// regenerated from the STAGED files (what the commit will hold, as the CI sees it) and staged with
// them. Without it, each spec commit pushed a stale index, the CI failed in 35 s and a second
// "refresh the index" commit followed. When INDEX.md carries changes of its own that are not
// staged, nothing is overwritten: the commit stops and says what to do.
// Enabled once per clone: `git config core.hooksPath .githooks`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as prettier from "prettier";

const INDEX = "docs/mvp/INDEX.md";
// What docs/mvp/build-index.mjs reads, and the builder itself.
const SOURCE =
  /^docs\/mvp\/(\d{2}b?-[^/]+\.md|jalons\/[^/]+-fiche\.md|build-index\.mjs)$/;

const git = (args, input) =>
  execFileSync("git", args, { encoding: "utf8", input });
const lf = (text) => text.replace(/\r\n/g, "\n");

const staged = git(["diff", "--cached", "--name-only", "--no-renames"]).split(
  "\n",
);
if (!staged.some((file) => SOURCE.test(file))) process.exit(0);

const work = mkdtempSync(join(tmpdir(), "influx-index-"));
try {
  // The staged builder and sources, never the working tree (a file may be partly staged).
  const sources = git(["ls-files", "--cached", "--", "docs/mvp"])
    .split("\n")
    .filter((file) => SOURCE.test(file));
  git(
    ["checkout-index", `--prefix=${work.replaceAll("\\", "/")}/`, "--stdin"],
    sources.join("\n"),
  );
  execFileSync(process.execPath, [join(work, "docs/mvp/build-index.mjs")], {
    stdio: "inherit",
  });

  // Formatted as `pnpm docs:index` does: Prettier, unless .prettierignore leaves it out.
  const raw = readFileSync(join(work, INDEX), "utf8");
  const { ignored } = await prettier.getFileInfo(INDEX, {
    ignorePath: ".prettierignore",
  });
  const options = (await prettier.resolveConfig(INDEX)) ?? {};
  const generated = lf(
    ignored ? raw : await prettier.format(raw, { ...options, filepath: INDEX }),
  );

  let inIndex = "";
  try {
    inIndex = lf(git(["show", `:${INDEX}`]));
  } catch {
    // Not in the index yet: a first index.
  }
  if (generated === inIndex) process.exit(0);

  let inTree = "";
  try {
    inTree = lf(readFileSync(INDEX, "utf8"));
  } catch {
    // Absent from the working tree.
  }
  if (inTree !== inIndex) {
    console.error(
      `${INDEX} has unstaged changes and is stale for this commit: run 'pnpm docs:index', ` +
        `stage ${INDEX}, then commit again.`,
    );
    process.exit(1);
  }
  writeFileSync(INDEX, generated);
  git(["add", "--", INDEX]);
  console.log(`${INDEX} regenerated from the staged specs and staged (D76).`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

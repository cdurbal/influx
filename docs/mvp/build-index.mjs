// Generates docs/mvp/INDEX.md: for each spec, its "## " sections with start line,
// length and the business rules (RGn) they contain, so agents read only the slice they need.
// Run: pnpm docs:index
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dirname;
const BYTES_PER_TOKEN = 3.5;
// Sections longer than this are also listed by "### " subsection.
const LARGE_SECTION_LINES = 300;

const files = readdirSync(DIR)
  .filter((f) => /^\d{2}b?-.*\.md$/.test(f))
  .sort();

// Work sheets (jalons/*-fiche.md): numbered milestones (jN) first in milestone order, then
// out-of-milestone sheets alphabetically. The entry point of a milestone session.
const milestoneNumber = (f) => (/^j\d+-/.test(f) ? Number.parseInt(f.slice(1), 10) : Infinity);
const sheets = readdirSync(join(DIR, "jalons"))
  .filter((f) => /-fiche\.md$/.test(f))
  .sort((a, b) => milestoneNumber(a) - milestoneNumber(b) || a.localeCompare(b));

const out = [
  "# Index des spécifications du MVP",
  "",
  "> Fichier généré par `pnpm docs:index` : ne pas modifier à la main, régénérer après toute",
  "> modification d'une spécification.",
  ">",
  "> **Ne jamais lire une spécification en entier.** Repérer ici la section utile, puis la lire avec",
  "> `Read` (`offset` = ligne de départ, `limit` = nombre de lignes), ou chercher une règle précise",
  "> avec `Grep` (exemple : `RG113` dans le fichier concerné).",
  ...(sheets.length === 0
    ? []
    : [
        ">",
        "> **Session de jalon : lire d'abord sa fiche**, qui cite déjà les tranches utiles :",
        `> ${sheets.map((f) => `\`jalons/${f}\``).join(", ")}.`,
      ]),
  "",
];

for (const file of files) {
  // LF only: a Windows checkout (core.autocrlf) must produce the same index as the CI.
  const text = readFileSync(join(DIR, file), "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const sections = [];
  lines.forEach((line, i) => {
    if (line.startsWith("## ")) sections.push({ title: line.slice(3).trim(), start: i + 1, sub: false });
    if (line.startsWith("### ")) sections.push({ title: line.slice(4).trim(), start: i + 1, sub: true });
  });
  const kTokens = Math.round(Buffer.byteLength(text) / BYTES_PER_TOKEN / 1000);
  out.push(`## ${file} (~${kTokens}k tokens)`, "");
  out.push("| Ligne | Lignes | Section | RG citées |", "|---|---|---|---|");
  const tops = sections.filter((s) => !s.sub);
  const endOf = (list, idx) => (idx + 1 < list.length ? list[idx + 1].start - 1 : lines.length);
  const rows = [];
  tops.forEach((s, idx) => {
    const end = endOf(tops, idx);
    rows.push({ ...s, end });
    if (end - s.start + 1 <= LARGE_SECTION_LINES) return;
    const subs = sections.filter((x) => x.sub && x.start > s.start && x.start <= end);
    subs.forEach((x, j) => rows.push({ ...x, end: j + 1 < subs.length ? subs[j + 1].start - 1 : end }));
  });
  rows.forEach((s) => {
    const end = s.end;
    const body = lines.slice(s.start, end).join("\n");
    const rules = [...new Set(body.match(/\bRG\d+(?:bis|ter)?\b/g) ?? [])]
      .map((r) => Number.parseInt(r.slice(2), 10))
      .sort((a, b) => a - b);
    const first = rules[0];
    const last = rules[rules.length - 1];
    const range = rules.length === 0 ? "" : first === last ? `RG${first}` : `RG${first}–RG${last}`;
    const title = (s.sub ? "↳ " : "") + s.title.replaceAll("|", "\\|");
    out.push(`| ${s.start} | ${end - s.start + 1} | ${title} | ${range} |`);
  });
  out.push("");
}

writeFileSync(join(DIR, "INDEX.md"), out.join("\n"));

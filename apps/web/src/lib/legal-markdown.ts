// The restricted Markdown of the public documents (docs/mvp/21 EC-62): headings `#` to `###`,
// paragraphs, lists `- `, and `**bold**`. Nothing else is recognised: a link, an HTML tag, a
// fourth heading level, a numbered list or any other pattern stays as TEXT, and React escapes it
// when it is displayed. The result is a tree of plain values; no HTML string is ever produced, so
// nothing reaches `dangerouslySetInnerHTML` (src/components/legal/LegalMarkdown.tsx renders it).

/** A run of text, bold or not. */
export type LegalInline = { kind: "text" | "strong"; text: string };

export type LegalBlock =
  | { kind: "heading"; level: 1 | 2 | 3; content: LegalInline[] }
  | { kind: "paragraph"; content: LegalInline[] }
  | { kind: "list"; items: LegalInline[][] };

const HEADING_PATTERN = /^(#{1,3}) (\S.*)$/;
const LIST_ITEM_PATTERN = /^- (\S.*)$/;
/** A bold run: the shortest non-empty text between two `**`, neither starting nor ending with `*`. */
const STRONG_PATTERN = /\*\*(?!\*)(.+?)(?<!\*)\*\*/g;

/** Splits a line into text and bold runs; an unpaired `**` stays as text. */
export function parseLegalInline(text: string): LegalInline[] {
  const runs: LegalInline[] = [];
  let index = 0;
  for (const match of text.matchAll(STRONG_PATTERN)) {
    if (match.index > index) {
      runs.push({ kind: "text", text: text.slice(index, match.index) });
    }
    runs.push({ kind: "strong", text: match[1] ?? "" });
    index = match.index + match[0].length;
  }
  if (index < text.length) {
    runs.push({ kind: "text", text: text.slice(index) });
  }
  return runs;
}

export function parseLegalMarkdown(source: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let list: LegalInline[][] | null = null;

  const closeOpenBlock = () => {
    if (paragraph.length > 0) {
      blocks.push({
        kind: "paragraph",
        content: parseLegalInline(paragraph.join(" ")),
      });
      paragraph = [];
    }
    if (list !== null) {
      blocks.push({ kind: "list", items: list });
      list = null;
    }
  };

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      closeOpenBlock();
      continue;
    }
    const heading = HEADING_PATTERN.exec(line);
    if (heading !== null) {
      closeOpenBlock();
      const level = (heading[1] ?? "#").length as 1 | 2 | 3;
      blocks.push({
        kind: "heading",
        level,
        content: parseLegalInline(heading[2] ?? ""),
      });
      continue;
    }
    const item = LIST_ITEM_PATTERN.exec(line);
    if (item !== null) {
      if (paragraph.length > 0) {
        closeOpenBlock();
      }
      list ??= [];
      list.push(parseLegalInline(item[1] ?? ""));
      continue;
    }
    if (list !== null) {
      closeOpenBlock();
    }
    paragraph.push(line);
  }
  closeOpenBlock();
  return blocks;
}

// The message of a brand, served to an agent as PLAIN text (docs/mvp/10 RG61; jalons/l3g/modele.md §5; l3g-fiche
// invariant 11; L3FS-7). The text is never interpreted by the server nor, by the screen, as markup: what the
// server does is take out the characters that change how a line is read or laid out without being text:
//   - the bidirectional controls (U+061C, U+200E, U+200F, U+202A to U+202E, U+2066 to U+2069), which flip
//     the order of what surrounds them (a "Trojan source" for a human reader);
//   - the control characters (C0 and C1) but the tab, the line feed and the carriage return;
//   - the lone surrogates, which no encoding can carry.
// The line breaks are kept (a message has paragraphs), a carriage return folded into a line feed. HTML, a link
// or a mention stay what they are: characters, shown as such (`dir="auto"`, never `innerHTML`).

const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

function isRemoved(codePoint: number): boolean {
  return (
    (codePoint <= 0x1f &&
      codePoint !== TAB &&
      codePoint !== LINE_FEED &&
      codePoint !== CARRIAGE_RETURN) ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    codePoint === 0x061c ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  );
}

/** The message as an agent reads it: plain text, bidirectional controls and control characters removed. */
export function plainTextOf(message: string): string {
  let text = "";
  for (const character of message) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (!isRemoved(codePoint)) {
      text += character;
    }
  }
  return text.replace(/\r\n?/g, "\n");
}

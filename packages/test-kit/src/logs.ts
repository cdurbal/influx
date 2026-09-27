// C-1 (end-of-J1 security review, 21 J1-J): every authentication test captures the log stream
// and checks BY VALUE that no e-mail address, login code, TOTP code, recovery code nor marker
// cookie reaches it. A check by key only finds what was anticipated; a search for the value also
// finds it under an unexpected key, in a message, in a stack, or re-encoded on the way.

/** A pino destination that keeps every written line in memory. */
export type LogCapture = {
  destination: { write(line: string): void };
  /** Everything written, lines joined as they came. */
  text(): string;
  /** The written lines, without their line breaks. */
  lines(): string[];
};

export function captureLogStream(): LogCapture {
  const written: string[] = [];
  return {
    destination: {
      write(line: string) {
        written.push(line);
      },
    },
    text: () => written.join(""),
    lines: () => written.map((line) => line.replace(/\r?\n$/, "")),
  };
}

/** A way a value can be written: its name, and the text searched. */
export type ValueForm = { form: string; text: string };

/**
 * The forms under which a value may reach a log line: as is, escaped by JSON (a quote or a
 * backslash in it), percent-encoded (a URL or a query), and in base64 or base64url (a cookie, a
 * token, a basic authorization). Letter case is ignored when searching.
 */
export function formsOf(value: string): ValueForm[] {
  const bytes = Buffer.from(value, "utf8");
  const forms: ValueForm[] = [
    { form: "raw", text: value },
    { form: "json", text: JSON.stringify(value).slice(1, -1) },
    { form: "percent-encoded", text: encodeURIComponent(value) },
    { form: "base64", text: bytes.toString("base64").replace(/=+$/, "") },
    { form: "base64url", text: bytes.toString("base64url") },
  ];
  const unique = new Map<string, ValueForm>();
  for (const form of forms) {
    if (!unique.has(form.text)) {
      unique.set(form.text, form);
    }
  }
  return [...unique.values()];
}

/** Base64 of a value is case-sensitive; the other forms are searched without regard to case. */
const CASE_SENSITIVE_FORMS: ReadonlySet<string> = new Set([
  "base64",
  "base64url",
]);

/**
 * The values of `values` found in `text`, as `value (form)`; an empty list means none leaked.
 * A value shorter than 6 characters is refused: it would be found by chance in a date or an
 * identifier, and a test built on it would prove nothing.
 */
export function valuesFoundIn(
  text: string,
  values: readonly string[],
): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  for (const value of values) {
    if (value.length < 6) {
      throw new Error(
        `valuesFoundIn: "${value}" is too short to be searched reliably (6 characters at least)`,
      );
    }
    for (const { form, text: searched } of formsOf(value)) {
      const isFound = CASE_SENSITIVE_FORMS.has(form)
        ? text.includes(searched)
        : lowerText.includes(searched.toLowerCase());
      if (isFound) {
        found.push(`${value} (${form})`);
      }
    }
  }
  return found;
}

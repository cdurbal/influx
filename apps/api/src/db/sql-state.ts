// SQLSTATE of a database error, shared by the repositories of every domain (02 §4 rule 2: a domain
// never imports another domain's repository).

/** The SQLSTATE of a database error, through the wrapping of drizzle (`cause`). */
export function sqlStateOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code: unknown = (current as Error & { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
    current = current.cause;
  }
  return null;
}

/** The DETAIL of a database error (`RAISE … USING DETAIL`), through the wrapping of drizzle. */
export function sqlDetailOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const detail: unknown = (current as Error & { detail?: unknown }).detail;
    if (typeof detail === "string" && detail !== "") {
      return detail;
    }
    current = current.cause;
  }
  return null;
}

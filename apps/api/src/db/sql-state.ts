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

/** The constraint a database error names (`constraint_name`), through the wrapping of drizzle. */
export function sqlConstraintOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const name: unknown = (current as Error & { constraint_name?: unknown })
      .constraint_name;
    if (typeof name === "string" && name !== "") {
      return name;
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

/** The MESSAGE of a database error (`RAISE EXCEPTION 'message'`), through the wrapping of drizzle. */
export function sqlMessageOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code: unknown = (current as Error & { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return current.message;
    }
    current = current.cause;
  }
  return null;
}

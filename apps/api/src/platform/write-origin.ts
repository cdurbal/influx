// Origin check of writes, against cross-site request forgery (docs/mvp/03 §6.4 A4, 18 T8.13,
// 21 §4 J3 point 10). The relay forwards `origin` and `sec-fetch-site` untouched (03 PP-5): a
// page's script can forge neither. This check reads THOSE TWO HEADERS ONLY — not
// `sec-fetch-mode`, which Node's fetch rewrites to `cors` on the way (21 J1-J C-2).
// It adds to SameSite (03 §6.5), it does not replace it.
import type { IncomingHttpHeaders } from "node:http";

/** Methods that never write: every other one is checked (03 §6.4 lists POST, PATCH, PUT, DELETE). */
const READ_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD"]);

export function isWriteMethod(method: string): boolean {
  return !READ_METHODS.has(method);
}

/**
 * A write is accepted only when `sec-fetch-site` is `same-origin`, or when that header is absent
 * and `origin` is exactly the public origin of the calling surface. `same-site` is refused (the
 * backoffice is a sub-domain of the same site), and so are `cross-site`, `none`, `Origin: null`,
 * the origin of the other surface, and a request without either header.
 */
export function isWriteOriginAllowed(
  headers: IncomingHttpHeaders,
  surfaceOrigin: string,
): boolean {
  const site = headers["sec-fetch-site"];
  if (site !== undefined) {
    return site === "same-origin";
  }
  return headers.origin === surfaceOrigin;
}

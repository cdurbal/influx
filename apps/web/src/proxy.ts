import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Language handling only: redirects "/" to "/fr" (01 §2 and §5). Never used for authorization.
export default createMiddleware(routing);

export const config = {
  // Skip the relay to apps/api (/api/…, 21 §4 J1-C), Next.js internals and files with an
  // extension (images, icons). The dot is escaped TWICE: once for the string, once for the
  // pattern. "\." alone is a plain "." in a string, and ".*..*" excluded every non-empty path
  // (21 J1-J T-3). The compiled pattern is checked after the build (18 T7.10).
  matcher: "/((?!api/|_next|_vercel|.*\\..*).*)",
};

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Language handling only: redirects "/" to "/fr" (01 §2 and §5). Never used for authorization.
export default createMiddleware(routing);

export const config = {
  // Skip Next.js internals and files with an extension (images, icons).
  matcher: "/((?!_next|_vercel|.*\..*).*)",
};

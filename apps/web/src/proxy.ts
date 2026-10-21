import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { pageContentSecurityPolicy } from "./config/security-headers";
import { routing } from "./i18n/routing";

// Language handling: redirects "/" to "/fr" (01 §2 and §5). Never used for authorization.
const handleLocale = createMiddleware(routing);

/**
 * Also the CSP with a nonce of every page, new for each request (03 §6.5, 18 T10): set on the
 * request, where Next.js reads the nonce to put it on its scripts and styles (next-intl forwards
 * the request headers), and on the response, redirects included.
 */
export default function proxy(request: NextRequest) {
  const policy = pageContentSecurityPolicy();
  request.headers.set("Content-Security-Policy", policy);
  const response = withoutTrailingSlash(request) ?? handleLocale(request);
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

/**
 * The redirect of "/fr/" to "/fr", made here rather than by Next.js (`skipTrailingSlashRedirect`,
 * next.config.ts): the router answers it before the headers of next.config.ts apply, so it went
 * out with none (18 T10, "redirects included"). Same origin always: only the path changes.
 */
function withoutTrailingSlash(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname === "/" || !pathname.endsWith("/")) {
    return null;
  }
  const target = request.nextUrl.clone();
  target.pathname = pathname.replace(/\/+$/, "") || "/";
  return NextResponse.redirect(target, 308);
}

export const config = {
  // Skip the relay to apps/api (/api/…, 21 §4 J1-C), Next.js internals and files with an
  // extension (images, icons). The dot is escaped TWICE: once for the string, once for the
  // pattern. "\." alone is a plain "." in a string, and ".*..*" excluded every non-empty path
  // (21 J1-J T-3). The compiled pattern is checked after the build (18 T7.10).
  matcher: "/((?!api/|_next|_vercel|.*\\..*).*)",
};

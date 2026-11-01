import { NextResponse, type NextRequest } from "next/server";
import { pageContentSecurityPolicy } from "./config/security-headers";

/**
 * The CSP with a nonce of every page, new for each request (03 §6.5, 18 T10): set on the
 * request, where Next.js reads the nonce to put it on its scripts and styles, and on the
 * response. Never used for authorization: the session is checked by apps/api.
 */
export default function proxy(request: NextRequest) {
  const policy = pageContentSecurityPolicy();
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response =
    withoutTrailingSlash(request) ??
    NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

/**
 * The redirect of "/accueil/" to "/accueil", made here rather than by Next.js
 * (`skipTrailingSlashRedirect`, next.config.ts): the router answers it before the headers of
 * next.config.ts apply, so it went out without X-Robots-Tag (18 T10.4). Same origin always.
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
  // Skip the relay to apps/api (/api/…), Next.js internals and files with an extension, as in
  // apps/web (the dot escaped twice: once for the string, once for the pattern, 21 J1-J T-3).
  matcher: "/((?!api/|_next|_vercel|.*\\..*).*)",
};

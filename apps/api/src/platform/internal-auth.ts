// Internal secret of the relay and calling surface (docs/mvp/03 §6.4 PP-8, docs/mvp/21 §4 J1-G).
// Each front holds its own secret: apps/api deduces the calling surface from it and serves
// `/v1/bo/…` to the backoffice only, the rest of `/v1/…` to web only, except shared routes.
import { createHash, timingSafeEqual } from "node:crypto";
import type { InternalSecrets } from "../config/schema.ts";

export const INTERNAL_SECRET_HEADER = "x-influx-internal";

/** The only route served without the internal secret: Railway's health check (J1-G). */
export const HEALTH_ROUTE = "/health";

export const API_PREFIX = "/v1/";
export const BACKOFFICE_PREFIX = "/v1/bo/";

export type Surface = "web" | "backoffice";

/** Declared in the route config; only for routes that both fronts may call. */
export type RouteSurface = Surface | "shared";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Returns the function that identifies the calling surface from the header value, or null.
 * Comparison in constant time: both secrets are always compared, on fixed-length digests, so
 * neither the length nor the matching secret can be told from the response time.
 */
export function createSurfaceIdentifier(
  secrets: InternalSecrets,
): (headerValue: string | string[] | undefined) => Surface | null {
  const webDigest = sha256(secrets.web);
  const backofficeDigest = sha256(secrets.backoffice);
  return (headerValue) => {
    if (typeof headerValue !== "string" || headerValue.length === 0) {
      return null;
    }
    const candidate = sha256(headerValue);
    const isWeb = timingSafeEqual(candidate, webDigest);
    const isBackoffice = timingSafeEqual(candidate, backofficeDigest);
    if (isWeb) {
      return "web";
    }
    if (isBackoffice) {
      return "backoffice";
    }
    return null;
  };
}

/** Surface that owns a route: declared "shared", or deduced from the prefix. */
export function routeSurface(
  routeUrl: string,
  declared: RouteSurface | undefined,
): RouteSurface {
  if (declared === "shared") {
    return "shared";
  }
  return prefixSurface(routeUrl);
}

export function isReachableFrom(owner: RouteSurface, caller: Surface): boolean {
  return owner === "shared" || owner === caller;
}

/** Surface deduced from the prefix alone: `/v1/bo/…` is the backoffice, any other `/v1/…` web. */
function prefixSurface(routeUrl: string): Surface {
  return routeUrl.startsWith(BACKOFFICE_PREFIX) ? "backoffice" : "web";
}

/**
 * The routes that both fronts may call: a constant, closed list (21 J1-G, J1-J A2). A new shared
 * route is added here, a gesture visible in review.
 */
export const SHARED_ROUTES: readonly string[] = [
  "/v1/status",
  "/v1/ops/client-errors",
];

/**
 * Startup guard of the surface ↔ prefix binding (21 J1-G, J1-J A2), called when a `/v1/` route is
 * registered. Throws, so that the server refuses to start, when:
 * 1. the surface declared by the route differs from the one deduced from its prefix;
 * 2. the route is declared shared outside SHARED_ROUTES, or under `/v1/bo/`;
 * 3. the route is `/v1/bo` exactly, or its first segment after `/v1/` is a parameter or a
 *    wildcard (`/v1/:x`, `/v1/*`), which would capture `bo`.
 */
export function checkRouteSurface(
  routeUrl: string,
  declared: RouteSurface | undefined,
): void {
  const firstSegment = routeUrl.slice(API_PREFIX.length).split("/")[0] ?? "";
  if (
    routeUrl === "/v1/bo" ||
    firstSegment.includes(":") ||
    firstSegment.includes("*")
  ) {
    throw new Error(
      `Route ${routeUrl}: /v1/bo alone, or a parameter or wildcard as first segment, would blur the backoffice prefix`,
    );
  }
  const deduced = prefixSurface(routeUrl);
  if (declared === "shared") {
    if (deduced === "backoffice" || !SHARED_ROUTES.includes(routeUrl)) {
      throw new Error(
        `Route ${routeUrl} is declared shared but is not in the closed list of shared routes`,
      );
    }
    return;
  }
  if (declared !== undefined && declared !== deduced) {
    throw new Error(
      `Route ${routeUrl} declares the ${declared} surface, but its prefix makes it a ${deduced} route`,
    );
  }
}

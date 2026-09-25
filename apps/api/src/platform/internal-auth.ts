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
  return routeUrl.startsWith(BACKOFFICE_PREFIX) ? "backoffice" : "web";
}

export function isReachableFrom(owner: RouteSurface, caller: Surface): boolean {
  return owner === "shared" || owner === caller;
}

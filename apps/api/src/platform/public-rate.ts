// Rate of the public routes (docs/mvp/18 T15, 03 §8 T15; 21 §J9 commit 7). Every route that
// answers without a session is bounded per client address and per instance, per minute, here in
// apps/api and never in a front (T15.3), before its body is read. The address key is the HMAC of
// A5 (03 §6.4), never the address; an absent or invalid address shares ONE bucket, so that it is
// the strictest case (A5 point 5). The routes with counters of their own in the database (codes,
// backoffice sign-in, rescue channel) keep them: this bound comes first, on top of them, and is
// always above their hourly ceilings (identity/settings.ts), so that THEY answer a burst (RG44).
// Over a bound: 429 rate_limited with Retry-After, the same answer on every route (server.ts).
import type { ClientAddress } from "./client-address.ts";
import { MinuteCounter } from "./minute-counter.ts";

export type PublicRouteRate = {
  /** Calls per minute from one client address (its /32 or /64). */
  address: number;
  /** Calls per minute for the whole instance. */
  instance: number;
};

/**
 * The closed list of the routes reached without a session, `METHOD /path` as registered. A route
 * without a session that is missing here fails its inventory test (tests/public-rate.test.ts).
 */
export const PUBLIC_ROUTE_RATES = {
  "POST /v1/auth/request-code": { address: 30, instance: 600 },
  "POST /v1/auth/verify-code": { address: 40, instance: 600 },
  "GET /v1/auth/journey": { address: 60, instance: 3000 },
  "POST /v1/auth/journey/reset": { address: 20, instance: 600 },
  "POST /v1/auth/logout": { address: 20, instance: 600 },
  "POST /v1/support/code-not-received": { address: 15, instance: 120 },
  "POST /v1/signup": { address: 10, instance: 600 },
  // 21 EC-62: the public documents, read by every sign-up and by the legal pages.
  "GET /v1/terms/current": { address: 30, instance: 1200 },
  // Called by the fronts' health route (EC-22) from their own server, without a client address.
  "GET /v1/status": { address: 600, instance: 6000 },
  "POST /v1/bo/auth/login": { address: 30, instance: 300 },
  "POST /v1/bo/auth/enroll": { address: 30, instance: 300 },
  "POST /v1/bo/auth/enroll/confirm": { address: 30, instance: 300 },
  "POST /v1/bo/auth/invitation/accept": { address: 30, instance: 300 },
  "POST /v1/bo/auth/logout": { address: 20, instance: 300 },
} as const satisfies Readonly<Record<string, PublicRouteRate>>;

const RATE_OF: Readonly<Record<string, PublicRouteRate | undefined>> =
  PUBLIC_ROUTE_RATES;

/**
 * Routes reached without a session that this bound leaves out, with the reason. A second entry is
 * a decision of expert-cybersecurite, like an exception of write-origin.ts.
 */
export const PUBLIC_RATE_EXEMPTIONS: Readonly<Record<string, string>> = {
  // Brevo's webhook (21 EC-12): server to server, authenticated before its body is read (address
  // in Brevo's ranges, two tokens in constant time); a 429 would drop an unsubscription Brevo
  // may not send again, a compliance loss worse than the load.
  "POST /v1/webhooks/brevo/:pathToken":
    "authenticated server-to-server webhook (21 EC-12)",
};

export type PublicRateRefusal = {
  scope: "address" | "instance";
  retryAfterSeconds: number;
};

export class PublicRateLimiter {
  private readonly counter: MinuteCounter;

  constructor(now: () => Date) {
    this.counter = new MinuteCounter(now);
  }

  /** Null when the call is under both bounds of its route (and counts it), else the refusal. */
  take(routeKey: string, address: ClientAddress): PublicRateRefusal | null {
    const rate = RATE_OF[routeKey];
    if (rate === undefined) {
      return null;
    }
    const network =
      address.status === "known" ? address.throttleKey : "unknown";
    if (!this.counter.take(`${routeKey}|address:${network}`, rate.address)) {
      return {
        scope: "address",
        retryAfterSeconds: this.counter.secondsLeft(),
      };
    }
    if (!this.counter.take(`${routeKey}|instance`, rate.instance)) {
      return {
        scope: "instance",
        retryAfterSeconds: this.counter.secondsLeft(),
      };
    }
    return null;
  }
}

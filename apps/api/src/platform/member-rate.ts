// Rate per client address of the member routes that read another member's published data in bulk
// (docs/mvp/11 RG21, CA18; 18 T15.3, T15.4; jalons/l3d/modele.md §5). The account has its own bucket,
// in the database (search.campaign_read_retry_after, 0314): this bound is the second one, per client
// address and per instance, per minute, in memory, checked by server.ts BEFORE the session is read,
// so that a burst spread over many accounts from one network is refused too. The address key is the
// HMAC of A5 (03 §6.4), never the address, and never written to the base nor to a log line (D60); an
// absent or invalid address shares ONE bucket, the strictest case (A5 point 5), as public-rate.ts.
// Over the bound: 429 rate_limited with Retry-After, the same answer as every other 429.
import type { ClientAddress } from "./client-address.ts";
import { MinuteCounter } from "./minute-counter.ts";

/**
 * Calls per minute from one client address, `METHOD /path` as registered. The logo is a relay of
 * the cards' images: several per page of the feed, outside the account's bucket (modele §5).
 */
export const MEMBER_ROUTE_ADDRESS_RATES = {
  "GET /v1/open-campaigns": 60,
  "GET /v1/open-campaigns/:id": 60,
  "GET /v1/open-campaigns/:id/brand-logo": 240,
} as const satisfies Readonly<Record<string, number>>;

const RATE_OF: Readonly<Record<string, number | undefined>> =
  MEMBER_ROUTE_ADDRESS_RATES;

export type MemberRateRefusal = { retryAfterSeconds: number };

export class MemberAddressRateLimiter {
  private readonly counter: MinuteCounter;

  constructor(now: () => Date) {
    this.counter = new MinuteCounter(now);
  }

  /** Null when the call is under the bound of its route (and counts it), else the refusal. */
  take(routeKey: string, address: ClientAddress): MemberRateRefusal | null {
    const rate = RATE_OF[routeKey];
    if (rate === undefined) {
      return null;
    }
    const network =
      address.status === "known" ? address.throttleKey : "unknown";
    if (!this.counter.take(`${routeKey}|address:${network}`, rate)) {
      return { retryAfterSeconds: this.counter.secondsLeft() };
    }
    return null;
  }
}

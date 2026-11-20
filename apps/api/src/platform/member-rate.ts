// Rate per client address of the member routes that read another member's published data in bulk
// (docs/mvp/11 RG21, CA18; 10 RG64; 18 T15.3, T15.4; jalons/l3d/modele.md §5, l3e/modele.md §8). The
// account has its own bucket, in the database (search.campaign_read_retry_after, 0314;
// search.creator_search_retry_after, 0319; search.creator_open_retry_after, 0323): this bound is the
// second one, per client
// address and per instance, per minute, in memory, checked by server.ts BEFORE the session is read,
// so that a burst spread over many accounts from one network is refused too. The address key is the
// HMAC of A5 (03 §6.4), never the address, and never written to the base nor to a log line (D60); an
// absent or invalid address shares ONE bucket, the strictest case (A5 point 5), as public-rate.ts.
// Over the bound: 429 rate_limited with Retry-After, the same answer as every other 429.
import type { ClientAddress } from "./client-address.ts";
import { MinuteCounter } from "./minute-counter.ts";

/**
 * Writes per minute from one client address on each route of the brand's shortlists (L3G 03, L3FS-3):
 * a bound before the session, so that the engine the doors run under the account's lock is never
 * driven by a burst of one network. A brand edits a list a few times a minute; 30 is far above it.
 */
export const SHORTLIST_WRITE_ADDRESS_RATE = 30;

/**
 * Calls per minute from one client address, `METHOD /path` as registered. The logo is a relay of
 * the cards' images: several per page of the feed, outside the account's bucket (modele §5).
 */
export const MEMBER_ROUTE_ADDRESS_RATES = {
  "GET /v1/open-campaigns": 60,
  "GET /v1/open-campaigns/:id": 60,
  "GET /v1/open-campaigns/:id/brand-logo": 240,
  // L3E 08 (10 RG64, 18 T15.4; l3e/modele.md §8): the brand's creator search, a page per call
  "POST /v1/creator-search": 60,
  // L3F 07 (18 T15.2 to T15.4; l3f/modele.md §2, §3): the profile a brand opens, and its visuals, a
  // relay of the images of a profile outside the account's bucket
  "GET /v1/creator-search/profiles/:alias": 60,
  "GET /v1/creator-search/profiles/:alias/visuals/:visualId": 240,
  // L3F 08 (l3f/modele.md §5, §8): the brand's lists, read with their cards (no journal, no bucket of
  // the account), and its request for a selection by the team (10 a minute, the bucket of the account
  // being 5 a day in base)
  "GET /v1/me/shortlists": 60,
  "GET /v1/me/shortlists/:id": 60,
  "POST /v1/me/selection-requests": 10,
  // L3G 03 (L3FS-3): the six writes of the shortlists, each route counted on its own
  "POST /v1/me/shortlists": SHORTLIST_WRITE_ADDRESS_RATE,
  "PUT /v1/me/shortlists/:id": SHORTLIST_WRITE_ADDRESS_RATE,
  "DELETE /v1/me/shortlists/:id": SHORTLIST_WRITE_ADDRESS_RATE,
  "PUT /v1/me/shortlists/:id/items/:alias": SHORTLIST_WRITE_ADDRESS_RATE,
  "DELETE /v1/me/shortlists/:id/items/:alias": SHORTLIST_WRITE_ADDRESS_RATE,
  "PUT /v1/me/shortlists/:id/items/:alias/note": SHORTLIST_WRITE_ADDRESS_RATE,
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

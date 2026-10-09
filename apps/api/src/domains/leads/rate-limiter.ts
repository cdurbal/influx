// One rate budget per category of call, never a global counter (lead-pipeline "Indépendance des
// consommateurs", T5; 16 §M2): a 429 on the Brevo contacts never slows a transactional e-mail.
// The calls of a category are spaced evenly (60 000 / limit ms apart), so that no burst ever
// leaves (16 RG139). The limit is passed at each call: it is read at consumption (05 RG81).
// In memory, for the one worker instance of the MVP (02 §11.2).
export class CategoryRateLimiter {
  readonly #now: () => number;
  /** Per category, the earliest instant of the next call. */
  readonly #nextCall = new Map<string, number>();
  /** Per category, the end of a pause asked by the provider (429, Retry-After). */
  readonly #pausedUntil = new Map<string, number>();

  constructor(now: () => number) {
    this.#now = now;
  }

  /** How long a call of this category would wait now, without reserving it. */
  delayMs(category: string): number {
    return Math.max(0, this.#earliest(category) - this.#now());
  }

  /** Reserves the next slot of the category; returns how long to wait before calling. */
  reserve(category: string, perMinute: number): number {
    const now = this.#now();
    const slot = Math.max(now, this.#earliest(category));
    this.#nextCall.set(category, slot + 60_000 / perMinute);
    return slot - now;
  }

  /** No call of this category for `ms` from now. */
  pause(category: string, ms: number): void {
    const until = this.#now() + ms;
    this.#pausedUntil.set(
      category,
      Math.max(until, this.#pausedUntil.get(category) ?? 0),
    );
  }

  #earliest(category: string): number {
    return Math.max(
      this.#nextCall.get(category) ?? 0,
      this.#pausedUntil.get(category) ?? 0,
    );
  }
}

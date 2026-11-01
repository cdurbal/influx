// Fixed one-minute windows, in memory (21 §4 J4 point 3; J9 commit 7): one instance at the MVP,
// so a counter of the process is the counter of the platform (EC, J4). Shared by the rate of the
// public routes (public-rate.ts) and the browser error reports (domains/ops/routes.ts).

export class MinuteCounter {
  private minute = -1;
  private readonly counts = new Map<string, number>();
  private readonly now: () => Date;

  constructor(now: () => Date) {
    this.now = now;
  }

  /** True when `key` is still under `limit` for the current minute (and counts it). */
  take(key: string, limit: number): boolean {
    const minute = Math.floor(this.now().getTime() / 60_000);
    if (minute !== this.minute) {
      this.minute = minute;
      this.counts.clear();
    }
    const count = this.counts.get(key) ?? 0;
    if (count >= limit) {
      return false;
    }
    this.counts.set(key, count + 1);
    return true;
  }

  /** Whole seconds until the current window ends, 1 to 60: the Retry-After of a refusal. */
  secondsLeft(): number {
    const milliseconds = 60_000 - (this.now().getTime() % 60_000);
    return Math.max(1, Math.ceil(milliseconds / 1_000));
  }
}

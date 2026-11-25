// J9S-6 (PL-03), PLT-6 and PLS-3 (L2A-05): the answer of GET /v1/status kept in the memory of THIS
// process for a few seconds, success and failure alike, so that a flood on /health spends one call
// upstream per window and not the instance bucket of /v1/status (a misleading 503 for everyone).
// Per process, on purpose: no state shared between instances.
// - The window opens when the call SETTLES, not when it starts: a slow upstream cannot let a second
//   call leave while the first is still running. Callers arriving before then share that one call.
// - A load that throws (even synchronously) is a failed status like any other, never rethrown.
// - A "throttled" answer (a 429 for the caller's address) is never kept: this pass answers false
//   (503 on the route), the next pass goes upstream again.

export type StatusOutcome = "healthy" | "unhealthy" | "throttled";
export type StatusCache = (
  load: () => Promise<StatusOutcome>,
) => Promise<boolean>;

export function createStatusCache(
  ttlMs: number,
  now: () => number = () => Date.now(),
): StatusCache {
  let kept: { healthy: boolean; expiresAt: number } | null = null;
  let pending: Promise<boolean> | null = null;

  // An async wrapper turns a synchronous throw of load() into a rejection caught here.
  async function settle(
    load: () => Promise<StatusOutcome>,
  ): Promise<StatusOutcome> {
    try {
      return await load();
    } catch {
      return "unhealthy";
    }
  }

  return (load) => {
    if (pending !== null) {
      return pending;
    }
    if (kept !== null && now() < kept.expiresAt) {
      return Promise.resolve(kept.healthy);
    }
    const call = settle(load).then((outcome) => {
      pending = null;
      if (outcome === "throttled") {
        kept = null;
        return false;
      }
      const healthy = outcome === "healthy";
      kept = { healthy, expiresAt: now() + ttlMs };
      return healthy;
    });
    pending = call;
    return call;
  };
}

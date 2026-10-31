// J9S-6 (PL-03): the answer of GET /v1/status kept in the memory of THIS process for a few seconds,
// success and failure alike, so that a flood on /health spends one call upstream per window and
// not the instance bucket of /v1/status (a misleading 503 for everyone). Per process, on purpose:
// no state shared between instances. Concurrent callers of one window share the same call.

export type StatusCache = (load: () => Promise<boolean>) => Promise<boolean>;

export function createStatusCache(
  ttlMs: number,
  now: () => number = () => Date.now(),
): StatusCache {
  let expiresAt = 0;
  let pending: Promise<boolean> | null = null;
  return (load) => {
    if (pending !== null && now() < expiresAt) {
      return pending;
    }
    expiresAt = now() + ttlMs;
    // A load that throws is a failed status like any other: kept for the window, never rethrown.
    const call = load().catch(() => false);
    pending = call;
    return call;
  };
}

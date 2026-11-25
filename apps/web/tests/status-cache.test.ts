// J9S-6 (PL-03), PLT-6 and PLS-3 (L2A-05): the in-memory status window of the /health route of web.
import { describe, expect, it, vi } from "vitest";
import { createStatusCache, type StatusOutcome } from "@/server/status-cache";

describe("createStatusCache (J9S-6)", () => {
  it("makes one upstream call for two reads less than the window apart, then a new one", async () => {
    let clock = 1_000;
    const cached = createStatusCache(5_000, () => clock);
    const load = vi.fn(async (): Promise<StatusOutcome> => "healthy");
    expect(await cached(load)).toBe(true);
    clock += 4_999;
    expect(await cached(load)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    clock += 1;
    expect(await cached(load)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps a failure for the window, a thrown load included, and never rethrows", async () => {
    let clock = 0;
    const cached = createStatusCache(5_000, () => clock);
    const load = vi.fn(async (): Promise<StatusOutcome> => {
      throw new Error("down");
    });
    expect(await cached(load)).toBe(false);
    expect(await cached(async () => "healthy")).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    clock = 5_000;
    expect(await cached(async () => "healthy")).toBe(true);
  });

  it("shares one pending call between concurrent readers", async () => {
    const cached = createStatusCache(5_000, () => 0);
    let release: (value: StatusOutcome) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<StatusOutcome>((resolve) => {
          release = resolve;
        }),
    );
    const readers = [cached(load), cached(load), cached(load)];
    release("healthy");
    expect(await Promise.all(readers)).toEqual([true, true, true]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("createStatusCache, window from the answer (PLT-6)", () => {
  it("opens the window when the call settles, not when it starts", async () => {
    let clock = 0;
    const cached = createStatusCache(5_000, () => clock);
    let release: (value: StatusOutcome) => void = () => {};
    const slow = vi.fn(
      () =>
        new Promise<StatusOutcome>((resolve) => {
          release = resolve;
        }),
    );
    const first = cached(slow);
    // The upstream takes 8 s, longer than the window: a second reader still shares the first call.
    clock = 8_000;
    const second = cached(slow);
    expect(slow).toHaveBeenCalledTimes(1);
    release("healthy");
    expect(await Promise.all([first, second])).toEqual([true, true]);
    // The window runs from 8 000 (the answer), not from 0 (the departure).
    clock = 12_999;
    const fresh = vi.fn(async (): Promise<StatusOutcome> => "unhealthy");
    expect(await cached(fresh)).toBe(true);
    expect(fresh).not.toHaveBeenCalled();
    clock = 13_000;
    expect(await cached(fresh)).toBe(false);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("catches a load that throws synchronously and treats it as a failed status", async () => {
    let clock = 0;
    const cached = createStatusCache(5_000, () => clock);
    const load = vi.fn((): Promise<StatusOutcome> => {
      throw new Error("sync");
    });
    expect(await cached(load)).toBe(false);
    expect(await cached(load)).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    clock = 5_000;
    expect(await cached(async () => "healthy")).toBe(true);
  });
});

describe("createStatusCache, a 429 is never kept (PLS-3)", () => {
  it("answers false for the throttled pass and goes upstream again on the next one", async () => {
    const cached = createStatusCache(5_000, () => 0);
    const load = vi
      .fn<() => Promise<StatusOutcome>>()
      .mockResolvedValueOnce("throttled")
      .mockResolvedValueOnce("healthy");
    expect(await cached(load)).toBe(false);
    expect(await cached(load)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("drops a healthy answer kept before when the next window ends throttled", async () => {
    let clock = 0;
    const cached = createStatusCache(5_000, () => clock);
    expect(await cached(async () => "healthy")).toBe(true);
    clock = 5_000;
    expect(await cached(async () => "throttled")).toBe(false);
    // Same instant: nothing is kept from the throttled pass.
    expect(await cached(async () => "healthy")).toBe(true);
  });
});

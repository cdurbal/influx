// J9S-6 (PL-03): the in-memory status window of the /health route of web.
import { describe, expect, it, vi } from "vitest";
import { createStatusCache } from "@/server/status-cache";

describe("createStatusCache (J9S-6)", () => {
  it("makes one upstream call for two reads less than the window apart, then a new one", async () => {
    let clock = 1_000;
    const cached = createStatusCache(5_000, () => clock);
    const load = vi.fn(async () => true);
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
    const load = vi.fn(async (): Promise<boolean> => {
      throw new Error("down");
    });
    expect(await cached(load)).toBe(false);
    expect(await cached(async () => true)).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    clock = 5_000;
    expect(await cached(async () => true)).toBe(true);
  });

  it("shares one pending call between concurrent readers", async () => {
    const cached = createStatusCache(5_000, () => 0);
    let release: (value: boolean) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve;
        }),
    );
    const readers = [cached(load), cached(load), cached(load)];
    release(true);
    expect(await Promise.all(readers)).toEqual([true, true, true]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

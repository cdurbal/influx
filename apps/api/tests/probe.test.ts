// The internal probe of D60 (02 §20.5; 15 RG165, AL49 and AL54): the four targets by their origin,
// a 200 alone is up, a redirect is a failure, each failure has a closed code, the duration is
// measured body included. A fake fetch, never the network.
import { describe, expect, it } from "vitest";
import {
  probeAll,
  probeTarget,
  probeUrlsOf,
  PROBE_USER_AGENT,
} from "../src/domains/ops/probe.ts";

const ORIGINS = {
  web: "https://influx.example",
  backoffice: "https://bo.influx.example",
  api: "http://api.railway.internal:3100",
};

const NOW = new Date("2026-10-22T08:00:00Z");

function clock(stepMs: number) {
  let at = 0;
  return () => {
    const value = at;
    at += stepMs;
    return value;
  };
}

function dependencies(fetch: typeof globalThis.fetch, stepMs = 40) {
  return { fetch, now: () => NOW, elapsed: clock(stepMs), timeoutMs: 50 };
}

describe("probeUrlsOf: the four targets (02 §20.5)", () => {
  it("loads /fr and /en of the site, / of the backoffice and /health of the api", () => {
    expect(probeUrlsOf(ORIGINS)).toEqual({
      web_home_fr: "https://influx.example/fr",
      web_home_en: "https://influx.example/en",
      backoffice_sign_in: "https://bo.influx.example/",
      api_health: "http://api.railway.internal:3100/health",
    });
  });
});

describe("probeTarget: one check, judged and timed", () => {
  it("is up on a 200, its body read, with the probe's agent and no redirect followed", async () => {
    const seen: RequestInit[] = [];
    const result = await probeTarget(
      "web_home_fr",
      "https://influx.example/fr",
      dependencies(async (_url, init) => {
        seen.push(init ?? {});
        return new Response("<html></html>", { status: 200 });
      }),
    );
    expect(result).toEqual({
      target: "web_home_fr",
      checkedAt: NOW.toISOString(),
      outcome: "up",
      statusCode: 200,
      failureCode: null,
      durationMs: 40,
    });
    expect(seen[0]?.redirect).toBe("manual");
    expect(new Headers(seen[0]?.headers).get("user-agent")).toBe(
      PROBE_USER_AGENT,
    );
  });

  it.each<[number, string]>([
    [302, "redirect"],
    [308, "redirect"],
    [503, "status"],
    [404, "status"],
    [204, "status"],
  ])("is down on a %i (%s)", async (status, failureCode) => {
    const result = await probeTarget(
      "api_health",
      "http://api.railway.internal:3100/health",
      dependencies(
        async () => new Response(status === 204 ? null : "x", { status }),
      ),
    );
    expect(result).toEqual(
      expect.objectContaining({
        outcome: "down",
        statusCode: status,
        failureCode,
      }),
    );
  });

  it("is down on a refused connection, and on a time-out", async () => {
    const refused = await probeTarget(
      "backoffice_sign_in",
      "https://bo.influx.example/",
      dependencies(() => Promise.reject(new TypeError("fetch failed"))),
    );
    expect(refused).toEqual(
      expect.objectContaining({
        outcome: "down",
        statusCode: null,
        failureCode: "connection",
      }),
    );
    const late = await probeTarget(
      "backoffice_sign_in",
      "https://bo.influx.example/",
      dependencies(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(init.signal?.reason);
            });
          }),
      ),
    );
    expect(late).toEqual(
      expect.objectContaining({ outcome: "down", failureCode: "timeout" }),
    );
  });

  it("checks the four targets side by side", async () => {
    const urls: string[] = [];
    const results = await probeAll(
      ORIGINS,
      dependencies(async (url) => {
        urls.push(String(url));
        return new Response("ok", { status: 200 });
      }),
    );
    expect(results.map((result) => [result.target, result.outcome])).toEqual([
      ["web_home_fr", "up"],
      ["web_home_en", "up"],
      ["backoffice_sign_in", "up"],
      ["api_health", "up"],
    ]);
    expect(urls.sort()).toEqual(Object.values(probeUrlsOf(ORIGINS)).sort());
  });
});

// Every log line is a JSON object without a duplicated key, checked on the raw text (docs/mvp/18
// T13.7, docs/mvp/21 §4 J1-J T-2; non-regression of 279d0aa). A duplicated key lets a value that
// is not masked, or a chosen requestId, win over the legitimate one, depending on the reader.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  captureLogs,
  duplicateJsonKeys,
  TEST_DATABASE_URLS,
  testApiConfig,
  WEB_SECRET,
} from "./helpers.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** Every line of a log stream, parsed (a line that is not JSON fails), with its duplicated keys. */
function duplicatesByLine(text: string): Array<[string, string[]]> {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      expect(() => JSON.parse(line) as unknown, line).not.toThrow();
      return [line, duplicateJsonKeys(line)];
    });
}

describe("duplicate key detector (self-check)", () => {
  it("finds a repeated key at any depth, and nothing else", () => {
    expect(duplicateJsonKeys(`{"a":1,"a":2}`)).toEqual(["a"]);
    expect(
      duplicateJsonKeys(`{"a":{"b":1,"c":[{"d":1,"d":2}],"b":2}}`),
    ).toEqual(["a.c[].d", "a.b"]);
    // An escaped key is compared once decoded.
    expect(duplicateJsonKeys(`{"a\\u0062":1,"ab":2}`)).toEqual(["ab"]);
    expect(
      duplicateJsonKeys(`{"msg":"{\\"a\\":1,\\"a\\":2}","list":[1,"x",null]}`),
    ).toEqual([]);
    expect(duplicateJsonKeys(`{"a":1,"b":{"a":2}}`)).toEqual([]);
  });
});

describe("api log lines", () => {
  it("never repeat a key: success, 4xx and 500", async () => {
    const logs = captureLogs();
    app = buildServer(testApiConfig(), {
      logDestination: logs.destination,
      isDatabaseReachable: async () => true,
    });
    app.get(
      "/v1/failing",
      { schema: { response: { 200: z.object({ status: z.literal("ok") }) } } },
      async () => {
        throw new Error("failure");
      },
    );
    app.post(
      "/v1/echo",
      {
        schema: {
          body: z.object({ email: z.email() }),
          response: { 200: z.object({ status: z.literal("ok") }) },
        },
      },
      async () => ({ status: "ok" as const }),
    );
    const secret = { "x-influx-internal": WEB_SECRET };
    const requestId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const statuses = [];
    for (const request of [
      { url: "/v1/status", headers: { ...secret, "x-request-id": requestId } },
      { url: "/v1/status", headers: { "x-request-id": requestId } },
      { url: "/v1/unknown", headers: secret },
      { url: "/v1/failing", headers: secret },
      { url: "/health", headers: {} },
    ]) {
      statuses.push(
        (await app.inject({ method: "GET", ...request })).statusCode,
      );
    }
    statuses.push(
      (
        await app.inject({
          method: "POST",
          url: "/v1/echo",
          // A write from the same origin (03 §6.4 A4).
          headers: { ...secret, "sec-fetch-site": "same-origin" },
          payload: { email: "not-an-address" },
        })
      ).statusCode,
    );
    expect(statuses).toEqual([200, 401, 404, 500, 200, 400]);
    const lines = duplicatesByLine(logs.text());
    expect(lines.length).toBeGreaterThanOrEqual(statuses.length);
    expect(lines.filter(([, duplicates]) => duplicates.length > 0)).toEqual([]);
  });
});

describe("worker log lines", () => {
  it("never repeat a key, on the real entry point", async () => {
    const systemRoot = process.env.SYSTEMROOT;
    const env: Record<string, string> = {
      INFLUX_ENV: "development",
      WORKER_DATABASE_URL: TEST_DATABASE_URLS.WORKER_DATABASE_URL,
    };
    if (systemRoot !== undefined) {
      env.SYSTEMROOT = systemRoot;
    }
    const worker = spawn(process.execPath, [path.join("src", "worker.ts")], {
      cwd: API_ROOT,
      env,
    });
    let output = "";
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`No start line from the worker: ${output}`)),
          15_000,
        );
        worker.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString("utf8");
          if (output.includes("worker started")) {
            clearTimeout(timer);
            resolve();
          }
        });
        worker.on("exit", () => {
          clearTimeout(timer);
          reject(new Error(`The worker stopped: ${output}`));
        });
      });
    } finally {
      worker.kill();
    }
    const lines = duplicatesByLine(output);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter(([, duplicates]) => duplicates.length > 0)).toEqual([]);
  }, 20_000);
});

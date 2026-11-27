// Self-checks of the T11 artifact scanner: it must find what it is meant to find.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  API_RUNTIME_DIRECTORIES,
  findStateBoardInBuild,
  readBuiltStylesheets,
  STATE_BOARD_MARKER,
  scanApiRuntimeFiles,
  scanBuildArtifacts,
} from "../src/artifacts.ts";
import { rawRequest } from "../src/relay-integration.ts";

let appRoot = "";
let nextDirectory = "";

function writeArtifact(relative: string, content: string): void {
  const file = path.join(nextDirectory, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// Fake values assembled at run time, so that this source file never holds a secret-like literal.
const FAKE_JWT = [
  "eyJhbGciOiJIUzI1NiJ9",
  "eyJzdWIiOiJ0ZXN0In0",
  "c2lnbmF0dXJlLXZhbHVl",
].join(".");
const FAKE_POSTGRES_URL = [
  "postgresql",
  "://user:password",
  "@host:5432/postgres",
].join("");
const FAKE_SUPABASE_SECRET = ["sb", "secret", "AbCdEfGh12345678ijkl"].join("_");
const FAKE_BREVO_KEY = ["xkeysib", "0123456789abcdef".repeat(4)].join("-");

beforeEach(() => {
  appRoot = mkdtempSync(path.join(tmpdir(), "influx-artifacts-"));
  nextDirectory = path.join(appRoot, ".next");
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

describe("readBuiltStylesheets (G3i b)", () => {
  it("throws when there is no built stylesheet", () => {
    expect(() => readBuiltStylesheets(nextDirectory)).toThrow(/run the build/);
    writeArtifact("static/chunks/app.js", "console.log('hello');");
    expect(() => readBuiltStylesheets(nextDirectory)).toThrow(/run the build/);
  });

  it("joins the stylesheets of .next/static, and nothing else", () => {
    writeArtifact("static/chunks/a.css", ".a{color:red}");
    writeArtifact("static/chunks/b.css", ".b{color:blue}");
    writeArtifact("server/app/c.css", ".c{color:green}");
    const css = readBuiltStylesheets(nextDirectory);
    expect(css).toContain(".a{color:red}");
    expect(css).toContain(".b{color:blue}");
    expect(css).not.toContain(".c{");
  });
});

describe("findStateBoardInBuild (RUA-T8)", () => {
  it("throws when there is no build output", () => {
    expect(() => findStateBoardInBuild(nextDirectory)).toThrow(/run the build/);
  });

  it("accepts a build without the board, and leaves its cache alone", () => {
    writeArtifact("static/chunks/app.js", "console.log('hello');");
    writeArtifact(
      "server/app-paths-manifest.json",
      '{"/[locale]/connexion/page":"app/[locale]/connexion/page.js"}',
    );
    writeArtifact("cache/turbopack/a.bin", `x ${STATE_BOARD_MARKER} x`);
    expect(findStateBoardInBuild(nextDirectory)).toEqual([]);
  });

  it("finds the marker in a bundle, a path of the board and its route in a manifest", () => {
    writeArtifact("static/chunks/board.js", `<main ${STATE_BOARD_MARKER}="">`);
    writeArtifact("server/app/fr/state-board/page.js", "export {};");
    writeArtifact(
      "server/app-paths-manifest.json",
      '{"/[locale]/state-board/page":"app/[locale]/state-board/page.js"}',
    );
    writeArtifact("server/other.json", '{"/state-board":1}');
    expect(findStateBoardInBuild(nextDirectory).sort()).toEqual([
      ".next/server/app-paths-manifest.json: the route state-board in a manifest",
      ".next/server/app/fr/state-board/page.js: a path of the state board",
      ".next/static/chunks/board.js: the marker data-state-board",
    ]);
  });
});

describe("scanBuildArtifacts (T11)", () => {
  it("throws when there is no build output", () => {
    expect(() => scanBuildArtifacts(nextDirectory)).toThrow(/run the build/);
  });

  it("accepts a clean build", () => {
    writeArtifact("static/chunks/app.js", "console.log('hello');");
    writeArtifact("server/app/page.js", "process.env.SOME_SERVER_VALUE;");
    expect(scanBuildArtifacts(nextDirectory)).toEqual([]);
  });

  it("finds a server variable name in browser code only", () => {
    writeArtifact("static/chunks/app.js", "const k = 'BREVO_API_KEY';");
    // Server bundles may name server variables: only `.next/static` reaches the browser.
    writeArtifact("server/relay.js", "process.env.INFLUX_API_INTERNAL_SECRET;");
    expect(scanBuildArtifacts(nextDirectory)).toEqual([
      ".next/static/chunks/app.js: server name BREVO_",
    ]);
  });

  it("R2A-T2: finds every R2_* variable name in browser static chunks", () => {
    writeArtifact(
      "static/chunks/app.js",
      "const cfg = ['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_PREFIX'];",
    );
    expect(scanBuildArtifacts(nextDirectory)).toEqual([
      ".next/static/chunks/app.js: server name R2_",
    ]);
  });

  it("R2A-T2: allows R2_* variable names in server bundles only", () => {
    writeArtifact("static/chunks/app.js", "console.log('ok');");
    writeArtifact(
      "server/relay.js",
      "process.env.R2_ENDPOINT; process.env.R2_ACCESS_KEY_ID; process.env.R2_SECRET_ACCESS_KEY; process.env.R2_BUCKET_PREFIX;",
    );
    expect(scanBuildArtifacts(nextDirectory)).toEqual([]);
  });

  it("finds a JWT-like string and a Postgres connection string anywhere in the build", () => {
    writeArtifact("static/chunks/app.js", "ok");
    writeArtifact("server/a.js", `const token = "${FAKE_JWT}";`);
    writeArtifact("cache/b.bin", `x${FAKE_POSTGRES_URL}x`);
    expect(scanBuildArtifacts(nextDirectory).sort()).toEqual([
      ".next/cache/b.bin: Postgres connection string",
      ".next/server/a.js: JWT-like string",
    ]);
  });

  it("finds the value of a Supabase secret key and of a Brevo key anywhere in the build", () => {
    writeArtifact("static/chunks/app.js", "ok");
    writeArtifact("server/c.js", `const a = "${FAKE_SUPABASE_SECRET}";`);
    writeArtifact("server/d.js", `const b = "${FAKE_BREVO_KEY}";`);
    expect(scanBuildArtifacts(nextDirectory).sort()).toEqual([
      ".next/server/c.js: Supabase secret key",
      ".next/server/d.js: Brevo key",
    ]);
  });
});

describe("scanApiRuntimeFiles (T11, the third artifact: apps/api runs its sources)", () => {
  function writeRuntime(relative: string, content: string): void {
    const file = path.join(appRoot, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  it("throws when a runtime directory is missing", () => {
    expect(() => scanApiRuntimeFiles(appRoot)).toThrow(
      /Missing runtime directory/,
    );
  });

  it("finds a secret value in any runtime directory, never in the tests", () => {
    for (const directory of API_RUNTIME_DIRECTORIES) {
      writeRuntime(`${directory}/clean.ts`, "export const ok = 1;");
    }
    writeRuntime(
      "apps/api/src/config/leak.ts",
      `const url = "${FAKE_POSTGRES_URL}";`,
    );
    writeRuntime("deploy/railway/leak.json", `{"key":"${FAKE_BREVO_KEY}"}`);
    writeRuntime("apps/api/tests/fixture.ts", `const jwt = "${FAKE_JWT}";`);
    expect(scanApiRuntimeFiles(appRoot).sort()).toEqual([
      "apps/api/src/config/leak.ts: Postgres connection string",
      "deploy/railway/leak.json: Brevo key",
    ]);
  });
});

/**
 * An API that refuses a body before reading it all, on its own thread: it closes while the client
 * writes. "/at-once" refuses on the headers and Node's server closes by itself (the request asks
 * for it), draining the body meanwhile, as `next start` does under the relay. "/after-1-mib"
 * refuses in the middle of the upload and cuts the socket.
 */
const REFUSING_SERVER = `
const { createServer } = require("node:http");
const { parentPort, workerData } = require("node:worker_threads");
const { body, cutDelayMs } = workerData;
const server = createServer((request, response) => {
  const head = () => response.writeHead(413, { "content-length": Buffer.byteLength(body) });
  const cut = () => request.socket.destroy();
  const refuseAndCut = () => {
    head();
    response.write(body, () => (cutDelayMs === 0 ? cut() : setTimeout(cut, cutDelayMs)));
  };
  if (request.url === "/at-once") {
    if (cutDelayMs === 0) {
      head();
      response.end(body);
    } else {
      refuseAndCut();
    }
    return;
  }
  let received = 0;
  request.on("data", function count(chunk) {
    received += chunk.byteLength;
    if (received > 1048576) {
      request.off("data", count);
      refuseAndCut();
    }
  });
});
server.listen(0, "127.0.0.1", () => parentPort.postMessage(server.address().port));
`;

describe("rawRequest (T7.3, RUBT-5: an answer given during the upload)", () => {
  const upload = () => Buffer.alloc(8_388_608 + 1, 0x61);

  it("reads the 413 of a server that closes while 8 MiB + 1 are being sent, declared or streamed", async () => {
    const refusal = JSON.stringify({ error: { code: "payload_too_large" } });
    // Linux, the CI, keeps a received answer after the reset: the close is immediate. Windows
    // drops it with the reset, whatever the client does: there, the cut waits, long enough on a
    // loaded machine (the client does not wait for it).
    const worker = new Worker(REFUSING_SERVER, {
      eval: true,
      workerData: {
        body: refusal,
        cutDelayMs: process.platform === "win32" ? 1_000 : 0,
      },
    });
    try {
      const port = await new Promise<number>((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
      });
      // A race: ten tries of each form on each path, so that a client that loses the answer
      // cannot pass.
      for (const target of ["/at-once", "/after-1-mib"]) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const answer = await rawRequest(`http://127.0.0.1:${port}`, target, {
            method: "PUT",
            body: upload(),
            chunked: attempt % 2 === 1,
          });
          expect(answer.status).toBe(413);
          expect(answer.body).toBe(refusal);
        }
      }
    } finally {
      await worker.terminate();
    }
  });

  it("rejects when the connection is cut during the upload with no answer", async () => {
    const server = createServer((request) => {
      request.socket.destroy();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    try {
      for (const chunked of [false, true]) {
        await expect(
          rawRequest(`http://127.0.0.1:${port}`, "/", {
            method: "PUT",
            body: upload(),
            chunked,
          }),
        ).rejects.toThrow(/EPIPE|ECONNRESET|ECONNABORTED|socket hang up/);
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });
});

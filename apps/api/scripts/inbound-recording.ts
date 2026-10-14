// The `inbound` mode of the manual trial (J7 commit 10; 16 §M6 RG146; D62): a throwaway receiver
// on the workstation's loopback, reached by Brevo's TEST account through a quick tunnel, to record
// the bodies Brevo really posts to a webhook. Conditions of expert-cybersecurite (blocking):
// - bound to the literal 127.0.0.1 only, a port of 1024 to 65535;
// - a path token and a header token of 32 random bytes each, printed once by the script, never
//   written to the recording, a log or a file; both compared in constant time on equal-length
//   digests (the approach of src/domains/leads/brevo-webhook.ts);
// - only POST /<path token> with application/json: any other call, a wrong token or a body that is
//   not JSON gets the same bare 404; a body over 64 KiB a bare 413, read no further;
// - it stops after N minutes, N bodies or Ctrl+C, the server closed;
// - a record is exactly {kind, receivedAt, contentType, body}: no address, no other header.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  BREVO_WEBHOOK_BODY_LIMIT_BYTES,
  BREVO_WEBHOOK_TOKEN_HEADER,
} from "@influx/contracts/brevo-webhook";

/** The only address the receiver binds to: never `localhost`, `0.0.0.0` nor `::`. */
export const INBOUND_HOST = "127.0.0.1";

export type InboundRecord = {
  kind: "inbound";
  receivedAt: string;
  contentType: string;
  body: unknown;
};

export type InboundArguments = {
  port: number;
  minutes: number;
  maxBodies: number;
};

export type InboundStopReason = "time" | "count" | "signal";

const DEFAULTS: InboundArguments = { port: 8790, minutes: 30, maxBodies: 20 };
const BOUNDS: Record<keyof InboundArguments, [number, number]> = {
  port: [1024, 65_535],
  minutes: [1, 120],
  maxBodies: [1, 100],
};
const FLAGS: Record<string, keyof InboundArguments> = {
  "--port": "port",
  "--minutes": "minutes",
  "--max-bodies": "maxBodies",
};

/** `--port=N --minutes=N --max-bodies=N`, each an integer within its bounds; anything else refused. */
export function parseInboundArguments(
  argv: readonly string[],
): InboundArguments {
  const parsed = { ...DEFAULTS };
  for (const argument of argv) {
    const [flag = "", value = ""] = argument.split("=", 2);
    const name = FLAGS[flag];
    if (name === undefined || !/^\d+$/.test(value)) {
      throw new Error(
        "usage: pnpm trial:record inbound [--port=N] [--minutes=N] [--max-bodies=N]",
      );
    }
    const number = Number(value);
    const [low, high] = BOUNDS[name];
    if (!Number.isSafeInteger(number) || number < low || number > high) {
      throw new Error(`${flag} must be an integer from ${low} to ${high}`);
    }
    parsed[name] = number;
  }
  return parsed;
}

/** The literal loopback address only (a name may resolve elsewhere, the wildcards expose it). */
export function assertInboundHost(host: string): void {
  if (host !== INBOUND_HOST) {
    throw new Error(`the inbound receiver binds to ${INBOUND_HOST} only`);
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function isJson(contentType: string | undefined): boolean {
  const mediaType = (contentType ?? "").split(";", 1)[0] ?? "";
  return mediaType.trim().toLowerCase() === "application/json";
}

/** No body, no header that says why: the refusal of an unknown route. */
function bare(response: ServerResponse, status: 404 | 413): void {
  response.writeHead(status, { "content-length": "0", connection: "close" });
  response.end();
}

export type InboundRecorder = {
  port: number;
  pathToken: string;
  headerToken: string;
  /** Settles once the server is closed, with why it stopped. */
  stopped: Promise<InboundStopReason>;
  stop(reason: InboundStopReason): Promise<void>;
};

export async function startInboundRecorder(options: {
  host: string;
  /** 0 in the tests only: the script passes the port of parseInboundArguments(). */
  port: number;
  durationMs: number;
  maxBodies: number;
  sink: (record: InboundRecord) => void;
  now?: () => Date;
}): Promise<InboundRecorder> {
  assertInboundHost(options.host);
  const now = options.now ?? (() => new Date());
  const pathToken = randomBytes(32).toString("base64url");
  const headerToken = randomBytes(32).toString("base64url");
  const pathDigest = digest(`/${pathToken}`);
  const headerDigest = digest(headerToken);
  let stored = 0;

  const isAuthorised = (request: IncomingMessage): boolean => {
    const header = request.headers[BREVO_WEBHOOK_TOKEN_HEADER];
    // Both always compared, so that a wrong path costs the same as a wrong header.
    const pathMatches = timingSafeEqual(digest(request.url ?? ""), pathDigest);
    const headerMatches = timingSafeEqual(
      digest(typeof header === "string" ? header : ""),
      headerDigest,
    );
    return (
      request.method === "POST" &&
      pathMatches &&
      headerMatches &&
      isJson(request.headers["content-type"])
    );
  };

  const receive = (
    request: IncomingMessage,
    response: ServerResponse,
  ): void => {
    if (!isAuthorised(request) || stored >= options.maxBodies) {
      request.resume();
      bare(response, 404);
      return;
    }
    const declared = Number(request.headers["content-length"] ?? "0");
    if (declared > BREVO_WEBHOOK_BODY_LIMIT_BYTES) {
      // Announced too long: nothing of the body is read.
      response.on("finish", () => request.destroy());
      bare(response, 413);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let refused = false;
    request.on("data", (chunk: Buffer) => {
      if (refused) {
        return;
      }
      size += chunk.length;
      if (size > BREVO_WEBHOOK_BODY_LIMIT_BYTES) {
        // Read no further: the answer, then the connection cut.
        refused = true;
        chunks.length = 0;
        request.pause();
        response.on("finish", () => request.destroy());
        bare(response, 413);
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (refused) {
        return;
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      } catch {
        // Not JSON: the same bare 404 as any other refusal, nothing logged.
        bare(response, 404);
        return;
      }
      // Two bodies read at once: the count is checked again before storing.
      if (stored >= options.maxBodies) {
        bare(response, 404);
        return;
      }
      options.sink({
        kind: "inbound",
        receivedAt: now().toISOString(),
        contentType: request.headers["content-type"] ?? "",
        body,
      });
      stored += 1;
      response.writeHead(200, { "content-length": "0" });
      // The last body answered first, then the server closed.
      response.end(() => {
        if (stored >= options.maxBodies) {
          void recorder.stop("count");
        }
      });
    });
  };

  const server = createServer(receive);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  let settle: (reason: InboundStopReason) => void = () => undefined;
  const stopped = new Promise<InboundStopReason>((resolve) => {
    settle = resolve;
  });
  let stopping: Promise<void> | null = null;
  const onSignal = (): void => {
    void recorder.stop("signal");
  };
  const timer = setTimeout(() => {
    void recorder.stop("time");
  }, options.durationMs);

  const recorder: InboundRecorder = {
    port: (server.address() as AddressInfo).port,
    pathToken,
    headerToken,
    stopped,
    stop(reason) {
      if (stopping === null) {
        clearTimeout(timer);
        process.off("SIGINT", onSignal);
        stopping = new Promise<void>((resolve) => {
          server.close(() => {
            settle(reason);
            resolve();
          });
          server.closeAllConnections();
        });
      }
      return stopping;
    },
  };
  process.once("SIGINT", onSignal);
  return recorder;
}

// THE cleaning function of the ops schema (docs/mvp/02 §20.8; 18 T13.6): every message, stack,
// page and route goes through it before it is fingerprinted or written, the browser's included.
// It removes what may identify a person or open an account — e-mail addresses, codes and other
// digit runs, identifiers, tokens, IP addresses, query strings, absolute paths — and bounds the
// length. Pure, deterministic, without any I/O.
import { KNOWN_ROUTE_MODELS } from "@influx/contracts/route-models";
import { createHash } from "node:crypto";

/**
 * Control, format (bidirectional overrides, zero-width), private-use and lone surrogate
 * characters: stored text is strict text, shown as received (J4S-6).
 */
const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}]+/gu;
const EMAIL = /[^\s@"'<>()[\],;:]+@[^\s@"'<>()[\],;:]+/g;
const URL_QUERY_OR_FRAGMENT = /([?#])[^\s"'<>)]*/g;
const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const IPV6 = /\b(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}\b/gi;
/** A run of 16 or more token characters holding a digit: a key, a hash, a session identifier. */
const TOKEN = /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{16,}\b/g;
const DIGITS = /\d{2,}/g;
const QUOTED = /(["'`])(?:(?!\1).){1,200}\1/g;

/** Text cleaned of every value of 02 §20.8, then bounded. */
export function scrubText(value: string, maxLength: number): string {
  const cleaned = value
    .replace(CONTROL_CHARACTERS, " ")
    .replace(EMAIL, "<email>")
    .replace(URL_QUERY_OR_FRAGMENT, "$1<removed>")
    .replace(UUID, "<id>")
    .replace(IPV4, "<ip>")
    .replace(IPV6, (match) => (match.split(":").length > 2 ? "<ip>" : match))
    .replace(TOKEN, "<token>")
    .replace(DIGITS, "<n>")
    // J4S-2: a quoted value may be a name or a handle (an engine message quotes the data).
    .replace(QUOTED, "$1<value>$1")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length <= maxLength
    ? cleaned
    : `${cleaned.slice(0, maxLength - 1).replace(/[\uD800-\uDBFF]$/, "")}…`;
}

/**
 * A message as it enters a fingerprint: cleaned, quoted values and every remaining digit removed,
 * so that two occurrences of one bug share their group.
 */
export function normalizeMessage(value: string, maxLength: number): string {
  const normalized = scrubText(value, 2 * maxLength).replace(/\d/g, "<n>");
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

/** Folders whose frames are our code (02 §20.5: "premières lignes de la pile qui appartiennent à notre code"). */
const OWN_CODE = /(?:apps|packages)\/[a-z-]+\/src\/[^\s)]+/;

/**
 * Stack frames, cleaned: absolute paths reduced to the path inside the repository, everything
 * else of a frame scrubbed. Lines that are not frames (the message, repeated by V8) are dropped.
 */
export function scrubStack(
  stack: string | undefined,
  maxLength: number,
): string | null {
  if (stack === undefined || stack === "") {
    return null;
  }
  const frames = stack
    .split("\n")
    .filter((line) => /^\s*at\s/.test(line) || /@\S+:\d+:\d+/.test(line))
    .map((line) => {
      const own = OWN_CODE.exec(line.replace(/\\/g, "/"));
      const location = own === null ? "<external>" : own[0];
      const name =
        /^\s*at\s+([A-Za-z0-9_$.<> ]{1,80}?)\s+\(/.exec(line)?.[1] ?? "";
      return `at ${name === "" ? "" : `${scrubText(name, 80)} `}(${location})`.replace(
        /\(\)$/,
        "",
      );
    });
  if (frames.length === 0) {
    return null;
  }
  const text = frames.join("\n");
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

/** Frames of our code only, without line numbers: stable across deployments. */
function ownFrames(stack: string | null, count: number): string[] {
  if (stack === null) {
    return [];
  }
  return stack
    .split("\n")
    .filter((frame) => !frame.includes("<external>"))
    .slice(0, count)
    .map((frame) => frame.replace(/:\d+(?::\d+)?/g, ""));
}

/** SHA-256 of type + normalised message + route model + the first three frames of our code. */
export function fingerprintOf(parts: {
  errorType: string;
  message: string;
  route: string | null;
  stack: string | null;
}): Buffer {
  return createHash("sha256")
    .update(
      [
        parts.errorType,
        parts.message,
        parts.route ?? "",
        ...ownFrames(parts.stack, 3),
      ].join("\n"),
      "utf8",
    )
    .digest();
}

const ROUTE_MODEL = /^\/[A-Za-z0-9/_:.*[\]-]{0,199}$/;

/** Whether a route model is on the closed list of packages/contracts (L2AS-2). */
export type RouteModelFilter = (model: string) => boolean;

const isKnownRouteModel: RouteModelFilter = (model) =>
  KNOWN_ROUTE_MODELS.has(model);

/**
 * A route model, as stored (0016): a pathname whose identifiers and digit segments become `:id`,
 * kept only when it is on the closed list (L2AS-2, `@influx/contracts/route-models`). Anything
 * else — a path no page or route serves, a name or a handle in an address, anything that is not a
 * plain path — becomes null rather than being stored (a request counts it as `unmatched`).
 * `isKnown` is replaced by tests only, for synthetic routes.
 */
export function routeModelOf(
  path: string | null | undefined,
  isKnown: RouteModelFilter = isKnownRouteModel,
): string | null {
  if (path === null || path === undefined || path === "") {
    return null;
  }
  const model = path
    .split(/[?#]/, 1)[0]
    ?.split("/")
    .map((segment) =>
      /^\d+$/.test(segment) ||
      /\d{3,}/.test(segment) ||
      /^[0-9a-f]{8}-/i.test(segment) ||
      segment.length > 40 ||
      segment.includes("@")
        ? ":id"
        : segment,
    )
    .join("/");
  return model !== undefined && ROUTE_MODEL.test(model) && isKnown(model)
    ? model
    : null;
}

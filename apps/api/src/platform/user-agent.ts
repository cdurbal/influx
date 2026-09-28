// Browser of the client, as a summary of a closed list (docs/mvp/05 Q14, RG135 and RG141; 03
// PP-5; 21 §4, "Revue de sécurité des commits 1 à 4 du J3", decision on 05 Q14).
// - Source: the `client-user-agent` header written by the relay from the browser's `user-agent`,
//   only when it matches ^[\x20-\x7E]{1,512}$. Read only AFTER the internal secret identified the
//   calling surface (server.ts), re-validated here with the same pattern; a list is ignored. The
//   `user-agent` header received by apps/api is the relay's own, never read.
// - Only a summary "family + system" of @influx/contracts/user-agent leaves this module, computed
//   when a consumer asks for it (login code e-mail, session creation), like clientAddressOf().
//   The raw string is kept out of the request object, in a WeakMap of this module: it is never
//   stored, never logged, never sent to GoTrue or Brevo. Neither is the summary logged.
// - No library, and no regular expression that can backtrack: families and systems are found by
//   `includes`, in a fixed order. Never an authorisation decision (05 RG146).
import {
  UNIDENTIFIED_USER_AGENT,
  type UserAgentFamily,
  type UserAgentSummary,
  type UserAgentSystem,
} from "@influx/contracts/user-agent";
import type { FastifyRequest } from "fastify";
import * as z from "zod";

export const CLIENT_USER_AGENT_HEADER = "client-user-agent";

/** 03 PP-5: visible ASCII and space, 512 characters at most. One class, bounded: linear. */
const CLIENT_USER_AGENT_PATTERN = /^[\x20-\x7E]{1,512}$/;

const clientUserAgentSchema = z.string().regex(CLIENT_USER_AGENT_PATTERN);

/**
 * Families in the order they are tested, first match wins: in-app browsers and browsers built on
 * Chromium or WebKit also carry the markers of Chrome or Safari, so they come first.
 */
const FAMILY_MARKERS: readonly (readonly [
  UserAgentFamily,
  readonly string[],
])[] = [
  ["instagram", ["Instagram"]],
  ["facebook", ["FBAN/", "FBAV/", "FB_IAB/"]],
  ["tiktok", ["musical_ly", "BytedanceWebview", "TikTok"]],
  ["samsung_internet", ["SamsungBrowser/"]],
  ["edge", ["Edg/", "EdgA/", "EdgiOS/", "Edge/"]],
  ["opera", ["OPR/", "OPiOS/"]],
  ["firefox", ["Firefox/", "FxiOS/"]],
  ["chrome", ["CriOS/", "Chrome/", "Chromium/"]],
];

/**
 * Systems in the order they are tested: an iOS agent says "like Mac OS X", an Android one says
 * "Linux", a ChromeOS one says "X11" and sometimes "Linux".
 */
const SYSTEM_MARKERS: readonly (readonly [
  UserAgentSystem,
  readonly string[],
])[] = [
  ["ios", ["iPhone", "iPad", "iPod"]],
  ["android", ["Android"]],
  ["chromeos", ["CrOS"]],
  ["windows", ["Windows"]],
  ["macos", ["Macintosh", "Mac OS X"]],
  ["linux", ["Linux"]],
];

function firstMatch<T>(
  agent: string,
  markers: readonly (readonly [T, readonly string[]])[],
): T | null {
  for (const [value, needles] of markers) {
    if (needles.some((needle) => agent.includes(needle))) {
      return value;
    }
  }
  return null;
}

function familyOf(agent: string): UserAgentFamily | null {
  const family = firstMatch(agent, FAMILY_MARKERS);
  if (family !== null) {
    return family;
  }
  // Safari says "Version/x Safari/y"; so do other WebKit browsers, already matched above.
  return agent.includes("Safari/") && agent.includes("Version/")
    ? "safari"
    : null;
}

/**
 * The summary of an agent string: its family and its system, or UNIDENTIFIED_USER_AGENT when
 * either is not recognised, or when the string does not have the relayed form.
 */
export function summarizeUserAgent(agent: string): UserAgentSummary {
  if (!clientUserAgentSchema.safeParse(agent).success) {
    return UNIDENTIFIED_USER_AGENT;
  }
  const family = familyOf(agent);
  const system = firstMatch(agent, SYSTEM_MARKERS);
  return family === null || system === null
    ? UNIDENTIFIED_USER_AGENT
    : `${family}.${system}`;
}

/** Raw agents of the requests whose internal secret was valid, out of reach of any logger. */
const relayedAgents = new WeakMap<FastifyRequest, string>();

/**
 * Keeps the relayed agent of a request, when it has the relayed form. Called by server.ts once the
 * internal secret is validated, never before: without the secret, the header is never read.
 */
export function readClientUserAgent(request: FastifyRequest): void {
  const header: unknown = request.headers[CLIENT_USER_AGENT_HEADER];
  if (typeof header !== "string") {
    return; // Absent, or several values: ignored.
  }
  const parsed = clientUserAgentSchema.safeParse(header);
  if (parsed.success) {
    relayedAgents.set(request, parsed.data);
  }
}

/** The browser summary of a request, for a consumer that needs it (e-mail, session). */
export function userAgentSummaryOf(request: FastifyRequest): UserAgentSummary {
  const agent = relayedAgents.get(request);
  return agent === undefined
    ? UNIDENTIFIED_USER_AGENT
    : summarizeUserAgent(agent);
}

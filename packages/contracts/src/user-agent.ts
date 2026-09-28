// The closed list of browser summaries, "family + system" (docs/mvp/05 Q14 and RG141, 21 RG-J3-5):
// written by apps/api (src/platform/user-agent.ts), stored in identity.sessions.user_agent_summary,
// shown by both fronts ("My sessions", 17b §3.14) and in the login code e-mail. Never a version,
// never a device model: a summary must not come close to a device fingerprint.
//
// PROVISIONAL (21 §3 EC-54): the content of the list belongs to product-owner, its place to
// architecte (packages/contracts is an assumption, reversible). The labels shown to members are
// translations of these keys, written by the fronts and the e-mail templates, never these keys.
import * as z from "zod";

/** Browser families, in-app browsers of Instagram, Facebook and TikTok included. */
export const USER_AGENT_FAMILIES = [
  "chrome",
  "edge",
  "firefox",
  "safari",
  "samsung_internet",
  "opera",
  "instagram",
  "facebook",
  "tiktok",
] as const;

export type UserAgentFamily = (typeof USER_AGENT_FAMILIES)[number];

/** Operating systems. */
export const USER_AGENT_SYSTEMS = [
  "windows",
  "macos",
  "ios",
  "android",
  "linux",
  "chromeos",
] as const;

export type UserAgentSystem = (typeof USER_AGENT_SYSTEMS)[number];

/**
 * The "unidentified" summary: no agent relayed, or its family or its system is not recognised. A
 * value like any other for the "new browser" signal (05 RG141); never quoted in an e-mail, which
 * is then written without the browser (05 RG135, `contextNoBrowser`).
 */
export const UNIDENTIFIED_USER_AGENT = "unidentified.unidentified";

export type UserAgentSummary =
  `${UserAgentFamily}.${UserAgentSystem}` | typeof UNIDENTIFIED_USER_AGENT;

/** Every summary: each family on each system, and the unidentified one. */
export const USER_AGENT_SUMMARIES: readonly UserAgentSummary[] = [
  ...USER_AGENT_FAMILIES.flatMap((family) =>
    USER_AGENT_SYSTEMS.map((system): UserAgentSummary => `${family}.${system}`),
  ),
  UNIDENTIFIED_USER_AGENT,
];

/**
 * Format of a summary key, also enforced by a constraint of the database (21 §4, decision on 05
 * Q14, point 3): a raw agent string can never be stored by mistake.
 */
export const USER_AGENT_SUMMARY_KEY_PATTERN =
  /^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$/;

export const userAgentSummarySchema = z.enum(USER_AGENT_SUMMARIES);

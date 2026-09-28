// Browser summary of the client (docs/mvp/05 Q14, RG135 and RG141; 03 PP-5; 21 §4, decision on
// 05 Q14, point 7). The relay side (client-user-agent written only for a well-formed agent) is
// tested by the relay tests of both fronts. The C-1 checks on identity.sessions,
// leads.transactional_sends and the Brevo double come with their consumers (commits 8 and 9).
import {
  UNIDENTIFIED_USER_AGENT,
  USER_AGENT_SUMMARIES,
  userAgentSummarySchema,
  type UserAgentSummary,
} from "@influx/contracts/user-agent";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { createLogger } from "../src/platform/logger.ts";
import {
  summarizeUserAgent,
  userAgentSummaryOf,
} from "../src/platform/user-agent.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "./helpers.ts";

const WINDOWS = "Windows NT 10.0; Win64; x64";
const MACOS = "Macintosh; Intel Mac OS X 10_15_7";
const LINUX = "X11; Linux x86_64";
const CHROMEOS = "X11; CrOS x86_64 14541.0.0";
const ANDROID = "Linux; Android 14; SM-S918B";
const IPHONE = "iPhone; CPU iPhone OS 17_5 like Mac OS X";
const IPAD = "iPad; CPU OS 17_5 like Mac OS X";

const CHROME = "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0";
const WEBKIT = "AppleWebKit/605.1.15 (KHTML, like Gecko)";

/** Real-shaped agents: each family, each system, and agents that must stay unidentified. */
const AGENTS: [string, string, UserAgentSummary][] = [
  [
    "Chrome, Windows",
    `Mozilla/5.0 (${WINDOWS}) ${CHROME} Safari/537.36`,
    "chrome.windows",
  ],
  [
    "Chrome, macOS",
    `Mozilla/5.0 (${MACOS}) ${CHROME} Safari/537.36`,
    "chrome.macos",
  ],
  [
    "Chrome, Linux",
    `Mozilla/5.0 (${LINUX}) ${CHROME} Safari/537.36`,
    "chrome.linux",
  ],
  [
    "Chrome, ChromeOS",
    `Mozilla/5.0 (${CHROMEOS}) ${CHROME} Safari/537.36`,
    "chrome.chromeos",
  ],
  [
    "Chrome, Android",
    `Mozilla/5.0 (${ANDROID}) ${CHROME} Mobile Safari/537.36`,
    "chrome.android",
  ],
  [
    "Chrome, iOS",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1`,
    "chrome.ios",
  ],
  [
    "Edge, Windows",
    `Mozilla/5.0 (${WINDOWS}) ${CHROME} Safari/537.36 Edg/126.0.2592.68`,
    "edge.windows",
  ],
  [
    "Edge, macOS",
    `Mozilla/5.0 (${MACOS}) ${CHROME} Safari/537.36 Edg/126.0.2592.68`,
    "edge.macos",
  ],
  [
    "Edge, Android",
    `Mozilla/5.0 (${ANDROID}) ${CHROME} Mobile Safari/537.36 EdgA/126.0.2592.80`,
    "edge.android",
  ],
  [
    "Edge, iOS",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} Version/17.0 EdgiOS/126.2592.86 Mobile/15E148 Safari/605.1.15`,
    "edge.ios",
  ],
  [
    "Firefox, Windows",
    `Mozilla/5.0 (${WINDOWS}; rv:127.0) Gecko/20100101 Firefox/127.0`,
    "firefox.windows",
  ],
  [
    "Firefox, macOS",
    `Mozilla/5.0 (${MACOS}; rv:127.0) Gecko/20100101 Firefox/127.0`,
    "firefox.macos",
  ],
  [
    "Firefox, Linux",
    `Mozilla/5.0 (${LINUX}; rv:127.0) Gecko/20100101 Firefox/127.0`,
    "firefox.linux",
  ],
  [
    "Firefox, Android",
    `Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0`,
    "firefox.android",
  ],
  [
    "Firefox, iOS",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} FxiOS/127.0 Mobile/15E148 Safari/605.1.15`,
    "firefox.ios",
  ],
  [
    "Safari, macOS",
    `Mozilla/5.0 (${MACOS}) ${WEBKIT} Version/17.5 Safari/605.1.15`,
    "safari.macos",
  ],
  [
    "Safari, iPhone",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} Version/17.5 Mobile/15E148 Safari/604.1`,
    "safari.ios",
  ],
  [
    "Safari, iPad",
    `Mozilla/5.0 (${IPAD}) ${WEBKIT} Version/17.5 Mobile/15E148 Safari/604.1`,
    "safari.ios",
  ],
  [
    "Samsung Internet, Android",
    `Mozilla/5.0 (${ANDROID}) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 ${CHROME} Mobile Safari/537.36`,
    "samsung_internet.android",
  ],
  [
    "Opera, Windows",
    `Mozilla/5.0 (${WINDOWS}) ${CHROME} Safari/537.36 OPR/111.0.0.0`,
    "opera.windows",
  ],
  [
    "Instagram, iOS",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} Mobile/15E148 Instagram 339.0.3.12.91 (iPhone15,3; iOS 17_5; fr_FR)`,
    "instagram.ios",
  ],
  [
    "Instagram, Android",
    `Mozilla/5.0 (${ANDROID}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ${CHROME} Mobile Safari/537.36 Instagram 339.0.0.34.123 Android`,
    "instagram.android",
  ],
  [
    "Facebook, iOS",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.106;FBBV/612345678;FBDV/iPhone15,3]`,
    "facebook.ios",
  ],
  [
    "Facebook, Android",
    `Mozilla/5.0 (${ANDROID}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ${CHROME} Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.43.109;]`,
    "facebook.android",
  ],
  [
    "TikTok, iOS",
    `Mozilla/5.0 (${IPHONE}) ${WEBKIT} Mobile/15E148 musical_ly_35.2.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/fr Region/FR`,
    "tiktok.ios",
  ],
  [
    "TikTok, Android",
    `Mozilla/5.0 (${ANDROID}; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ${CHROME} Mobile Safari/537.36 trill_350203 BytedanceWebview/d8a21c6`,
    "tiktok.android",
  ],
  ["curl", "curl/8.7.1", UNIDENTIFIED_USER_AGENT],
  ["a bare Mozilla", "Mozilla/5.0", UNIDENTIFIED_USER_AGENT],
  [
    "a crawler",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    UNIDENTIFIED_USER_AGENT,
  ],
  [
    "a known family on an unknown system",
    "Mozilla/5.0 (PlayStation 5) Firefox/127.0",
    UNIDENTIFIED_USER_AGENT,
  ],
  [
    "a known system with an unknown family",
    `Mozilla/5.0 (${WINDOWS}) SomeBrowser/1.0`,
    UNIDENTIFIED_USER_AGENT,
  ],
];

describe("summarizeUserAgent: a closed list, family + system (05 Q14, RG-J3-5)", () => {
  it.each(AGENTS)("%s", (_case, agent, expected) => {
    expect(summarizeUserAgent(agent)).toBe(expected);
  });

  it("covers every family and every system of the list in the table above", () => {
    const summaries = new Set(AGENTS.map(([, , summary]) => summary));
    for (const family of [
      "chrome",
      "edge",
      "firefox",
      "safari",
      "samsung_internet",
      "instagram",
      "facebook",
      "tiktok",
    ]) {
      expect(
        [...summaries].some((summary) => summary.startsWith(`${family}.`)),
        family,
      ).toBe(true);
    }
    for (const system of [
      "windows",
      "macos",
      "ios",
      "android",
      "linux",
      "chromeos",
    ]) {
      expect(
        [...summaries].some((summary) => summary.endsWith(`.${system}`)),
        system,
      ).toBe(true);
    }
  });

  it("only ever answers a value of the list, never a digit (no version, no device model)", () => {
    for (const [, agent] of AGENTS) {
      const summary = summarizeUserAgent(agent);
      expect(USER_AGENT_SUMMARIES).toContain(summary);
      expect(summary).not.toMatch(/\d/);
    }
  });

  it.each([
    ["513 characters", `Mozilla/5.0 (${WINDOWS}) ${CHROME}`.padEnd(513, "x")],
    ["a tab", `Mozilla/5.0 (${WINDOWS})\t${CHROME}`],
    ["a DEL", `Mozilla/5.0 (${WINDOWS}) ${CHROME}\x7F`],
    ["a non-ASCII character", `Mozilla/5.0 (${WINDOWS}) ${CHROME} é`],
    ["an empty string", ""],
  ])(
    "answers unidentified for an agent of invalid form: %s",
    (_case, agent) => {
      expect(summarizeUserAgent(agent)).toBe(UNIDENTIFIED_USER_AGENT);
    },
  );

  // No regular expression that can backtrack (decision on 05 Q14, point 2). The best of three
  // runs is kept: a backtracking pattern would be slow on every run, a pause of the test runner
  // on one only.
  it.each([
    ["repeated markers", "Safari/Version/".repeat(40).slice(0, 512)],
    [
      "a near-miss of every marker",
      "Chrom Firefo Edg SamsungBrowse Instagra iPhon Androi Window "
        .repeat(9)
        .slice(0, 512),
    ],
    ["one character repeated", "a".repeat(512)],
    ["spaces then a stop", `${" ".repeat(511)}!`],
  ])(
    "summarizes a pathological 512-character agent in under 5 ms: %s",
    (_case, agent) => {
      expect(agent).toHaveLength(512);
      const durations = [0, 1, 2].map(() => {
        const start = performance.now();
        summarizeUserAgent(agent);
        return performance.now() - start;
      });
      expect(Math.min(...durations)).toBeLessThan(5);
    },
  );
});

describe("client-user-agent in apps/api (05 Q14, points 2 and 4)", () => {
  const CHROME_WINDOWS = `Mozilla/5.0 (${WINDOWS}) ${CHROME} Safari/537.36`;
  const MARKER = "ua-marker-Qx81zT";

  let app: ApiServer | undefined;
  let logs = captureLogs();

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  /** A server with a probe route answering the summary; `seen` gets it for every request. */
  function server(seen: UserAgentSummary[] = []): ApiServer {
    logs = captureLogs();
    const api = buildServer(testApiConfig(), {
      logDestination: logs.destination,
    });
    app = api;
    api.addHook("onResponse", async (request) => {
      seen.push(userAgentSummaryOf(request));
    });
    api.get(
      "/v1/agent",
      {
        schema: {
          response: {
            200: z.strictObject({ summary: userAgentSummarySchema }),
          },
        },
      },
      async (request) => ({ summary: userAgentSummaryOf(request) }),
    );
    return api;
  }

  async function summaryFor(headers: Record<string, string | string[]>) {
    const response = await server().inject({
      method: "GET",
      url: "/v1/agent",
      headers: { "x-influx-internal": WEB_SECRET, ...headers },
    });
    expect(response.statusCode).toBe(200);
    return (response.json() as { summary: UserAgentSummary }).summary;
  }

  it("summarizes a relayed agent", async () => {
    expect(await summaryFor({ "client-user-agent": CHROME_WINDOWS })).toBe(
      "chrome.windows",
    );
  });

  it("never reads user-agent, which is the relay's own", async () => {
    expect(await summaryFor({ "user-agent": CHROME_WINDOWS })).toBe(
      UNIDENTIFIED_USER_AGENT,
    );
  });

  it.each([
    ["absent", {}],
    ["of invalid form", { "client-user-agent": `${CHROME_WINDOWS}\x7F` }],
    [
      "over 512 characters",
      { "client-user-agent": CHROME_WINDOWS.padEnd(513, "x") },
    ],
  ])("answers unidentified for an agent %s", async (_case, headers) => {
    expect(await summaryFor(headers)).toBe(UNIDENTIFIED_USER_AGENT);
  });

  it("ignores client-user-agent without a valid internal secret", async () => {
    const seen: UserAgentSummary[] = [];
    const api = server(seen);
    for (const secret of [{}, { "x-influx-internal": `${WEB_SECRET}x` }]) {
      const response = await api.inject({
        method: "GET",
        url: "/v1/agent",
        headers: { ...secret, "client-user-agent": CHROME_WINDOWS },
      });
      expect(response.statusCode).toBe(401);
    }
    expect(seen).toEqual([UNIDENTIFIED_USER_AGENT, UNIDENTIFIED_USER_AGENT]);
  });

  it("C-1: neither the raw agent nor its summary reaches a log line", async () => {
    const agent = `${CHROME_WINDOWS} ${MARKER}`;
    const api = server();
    const answered = await api.inject({
      method: "GET",
      url: "/v1/agent",
      headers: { "x-influx-internal": WEB_SECRET, "client-user-agent": agent },
    });
    expect(answered.json()).toEqual({ summary: "chrome.windows" });
    // A refused request, and an unknown route, with the same agent.
    await api.inject({
      method: "GET",
      url: "/v1/agent",
      headers: { "client-user-agent": agent },
    });
    await api.inject({
      method: "GET",
      url: "/v1/unknown",
      headers: { "x-influx-internal": WEB_SECRET, "client-user-agent": agent },
    });
    expect(logs.lines().length).toBeGreaterThan(0);
    expect(valuesFoundIn(logs.text(), [MARKER, "chrome.windows"])).toEqual([]);
  });
});

describe("the agent keys are censored (05 Q14, point 4)", () => {
  const KEYS = [
    "user-agent",
    "userAgent",
    "user_agent",
    "client-user-agent",
    "clientUserAgent",
    "userAgentSummary",
    "user_agent_summary",
  ];

  it.each(KEYS)(
    "censors %s from the first to the fourth level, and in an array",
    (key) => {
      const logs = captureLogs();
      const logger = createLogger(
        { service: "api", environment: "staging", version: "local" },
        logs.destination,
      );
      const value = `agent-of-${key}-Zq81x`;
      logger.info({ [key]: value }, "level 1");
      logger.info({ a: { [key]: value } }, "level 2");
      logger.info({ a: { b: { [key]: value } } }, "level 3");
      logger.info({ a: { b: { c: { [key]: value } } } }, "level 4");
      logger.info({ list: [{ [key]: value }] }, "in an array");
      expect(valuesFoundIn(logs.text(), [value])).toEqual([]);
      expect(logs.lines()).toHaveLength(5);
    },
  );
});

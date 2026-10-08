// POST /v1/signup without a database (docs/mvp/05 RG10; 18 TM10.3; 21 EC-4): what is refused
// BEFORE the elevated transaction — a body outside the contract (400, every field listed, CA69)
// and a missing, forged, expired or misplaced sign-up token (401). The database is a pool that
// reaches nothing: a test that touched it would fail. The whole path on the local stack is
// db-tests/tm10-signup-route.test.ts.
import { CONSENT_WORDING_KEYS } from "@influx/contracts/signup";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAuthTokenCodec,
  SIGNUP_TOKEN_TTL_SECONDS,
} from "../src/platform/auth-tokens.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  TOKEN_SIGNING_SECRET,
  WEB_SECRET,
} from "./helpers.ts";

const tokens = createAuthTokenCodec(TOKEN_SIGNING_SECRET);
const NOW = new Date("2026-10-08T10:00:00.000Z");

const CREATOR = {
  role: "creator",
  countryCode: "FR",
  preferredLanguage: "fr",
  declaredStatus: "individual",
  adultAttested: true,
  termsVersionId: randomUUID(),
  termsAccepted: true,
  marketingConsent: true,
  consentWordingKey: CONSENT_WORDING_KEYS.creator,
  consentWording: "J'accepte qu'INFLUX enregistre mes coordonnées.",
  displayLocale: "fr",
};

let app: ApiServer | undefined;

function server() {
  const logs = captureLogs();
  app = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    identity: { now: () => NOW },
  });
  return { api: app, logs };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function signupToken(issuedAt: Date): string {
  return tokens.issueSignup(
    {
      verifiedAt: Math.floor(issuedAt.getTime() / 1000),
      authUserId: randomUUID(),
      email: "tm10-unit@example.test",
      door: "creator",
    },
    issuedAt,
  );
}

function post(
  api: ApiServer,
  body: unknown,
  options: { cookie?: string; secret?: string } = {},
) {
  return api.inject({
    method: "POST",
    url: "/v1/signup",
    headers: {
      "x-influx-internal": options.secret ?? WEB_SECRET,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...(options.cookie === undefined
        ? {}
        : { cookie: `__Host-influx-signup=${options.cookie}` }),
    },
    payload: JSON.stringify(body),
  });
}

function clearedSignupCookie(headers: Record<string, unknown>): boolean {
  const header = headers["set-cookie"];
  const cookies = Array.isArray(header) ? header : [header];
  return cookies.some(
    (cookie) =>
      typeof cookie === "string" &&
      cookie.startsWith("__Host-influx-signup=;") &&
      cookie.includes("Max-Age=0"),
  );
}

describe("POST /v1/signup: the sign-up token (EC-4)", () => {
  it("answers 401 without a token, and sets no cookie", async () => {
    const { api } = server();
    const response = await post(api, CREATOR);
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthenticated");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it.each([
    ["forged", () => `${signupToken(NOW)}x`],
    [
      "expired (30 minutes after the verification)",
      () =>
        signupToken(
          new Date(NOW.getTime() - (SIGNUP_TOKEN_TTL_SECONDS + 1) * 1000),
        ),
    ],
    [
      "a login token",
      () =>
        tokens.issueLogin(
          {
            ref: randomUUID(),
            email: "tm10-unit@example.test",
            phrase: "two words",
          },
          NOW,
        ),
    ],
  ])("answers 401 to a %s token and clears it", async (_label, value) => {
    const { api } = server();
    const response = await post(api, CREATOR, {
      cookie: encodeURIComponent(value()),
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthenticated");
    expect(clearedSignupCookie(response.headers)).toBe(true);
  });

  it("does not exist on the backoffice surface", async () => {
    const { api } = server();
    const response = await post(api, CREATOR, {
      secret: BACKOFFICE_SECRET,
      cookie: encodeURIComponent(signupToken(NOW)),
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("POST /v1/signup: the body, refused before any write (05 RG10, TM10.3)", () => {
  it("lists every invalid field in one 400, without the values (CA69)", async () => {
    const { api } = server();
    const response = await post(api, {
      ...CREATOR,
      countryCode: "ZZ",
      declaredStatus: undefined,
      adultAttested: false,
    });
    expect(response.statusCode).toBe(400);
    const { error } = response.json();
    expect(error.code).toBe("validation_failed");
    expect(
      error.details.map((detail: { path: string }) => detail.path).sort(),
    ).toEqual(["adultAttested", "countryCode", "declaredStatus"]);
    expect(response.body).not.toContain("ZZ");
  });

  it.each([
    [
      "an advertiser with a declared status (RG22)",
      {
        ...CREATOR,
        role: "advertiser",
        companyName: "Maison Test",
        adultAttested: undefined,
        consentWordingKey: CONSENT_WORDING_KEYS.advertiser,
      },
    ],
    [
      "a creator without the adult attestation (D15, CA8)",
      {
        ...CREATOR,
        adultAttested: undefined,
      },
    ],
    ["unchecked terms (CA4)", { ...CREATOR, termsAccepted: false }],
    ["an agent role (EC-30)", { ...CREATOR, role: "agent" }],
    [
      "an address in the body (EC-4)",
      {
        ...CREATOR,
        email: "other@example.test",
      },
    ],
  ])("refuses %s with 400, token or not", async (_label, body) => {
    const { api } = server();
    const response = await post(api, body, {
      cookie: encodeURIComponent(signupToken(NOW)),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_failed");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});

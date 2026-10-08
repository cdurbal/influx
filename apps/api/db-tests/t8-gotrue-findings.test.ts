// Findings on the local Supabase Auth (GoTrue v2.196 of CLI 2.117), J3 commit 7 (docs/mvp/21 §4):
// the column « Test » of J3-A, J3-C rules 1 and 2, EC-41 point 4, the /recover oracle, G-1
// point 3, EC-38 point 2, EC-50 and, since the e-mail provider is on, EC-55 (a) to (g). A finding that differs from the decisions is written in 21
// §3 and ASSERTED AS FOUND here, with its gap number: when the setting or the decision changes,
// this file changes with it, visibly.
// - apps/api's calls go through its adapter (src/platform/supabase.ts), with the secret key.
// - An attacker's calls (G-1) are plain HTTP with the publishable key, in this file only.
// - GoTrue's native sends would land in Mailpit locally: "nothing is sent" is read there.
// - Every user is created in example.test and deleted at the end.
import { randomUUID } from "node:crypto";
import {
  mailpitMessagesTo,
  requireLocalAuth,
  type LocalAuthStack,
} from "@influx/test-kit/db";
import { millisecondsLeftInPeriod, totpCode } from "@influx/test-kit/totp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createSupabaseAuth,
  type GoTrueRequestContext,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig } from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

type GoTrueAnswer = {
  status: number;
  body: Record<string, unknown>;
};

let local: LocalAuthStack;
let adapter: SupabaseAuth;
const warnings: string[] = [];
const createdUsers: string[] = [];

const CONTEXT: GoTrueRequestContext = { forwardedFor: null, timeoutMs: 5_000 };

/** A plain call to GoTrue, as anyone holding the key could make it. */
async function gotrue(
  method: "GET" | "POST" | "PUT",
  path: string,
  options: {
    key: "publishable" | "secret";
    jwt?: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<GoTrueAnswer> {
  const key = options.key === "secret" ? local.secretKey : local.publishableKey;
  const response = await fetch(`${local.authUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${options.jwt ?? key}`,
      "content-type": "application/json",
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  const body = text === "" ? {} : (JSON.parse(text) as Record<string, unknown>);
  return { status: response.status, body };
}

/** Status and GoTrue error code of an answer: what the findings compare. */
function outcomeOf(answer: GoTrueAnswer): { status: number; code: unknown } {
  return { status: answer.status, code: answer.body.error_code };
}

function newAddress(label: string): string {
  return `j3-${label}-${randomUUID()}@example.test`;
}

/** A GoTrue user created by apps/api's adapter, deleted after the file. */
async function newUser(label: string): Promise<{ id: string; email: string }> {
  const email = newAddress(label);
  const created = await adapter.createUser(email);
  if (!created.ok) {
    throw new Error(
      `createUser failed: ${created.errorCode ?? created.reason}`,
    );
  }
  createdUsers.push(created.value.userId);
  return { id: created.value.userId, email };
}

async function newCode(email: string): Promise<string> {
  const generated = await adapter.generateEmailCode(email);
  if (!generated.ok) {
    throw new Error(
      `generateEmailCode failed: ${generated.errorCode ?? generated.reason}`,
    );
  }
  return generated.value.code;
}

/** A GoTrue session obtained DIRECTLY, with the publishable key: the premise of G-1. */
async function directSession(
  email: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const code = await newCode(email);
  const answer = await gotrue("POST", "/verify", {
    key: "publishable",
    body: { type: "email", email, token: code },
    headers,
  });
  const token = answer.body.access_token;
  if (answer.status !== 200 || typeof token !== "string") {
    throw new Error(`direct verification failed: ${answer.status}`);
  }
  return token;
}

/** The claims of a JWT, read without verification: a finding on its content, nothing more. */
function claimsOf(jwt: string): Record<string, unknown> {
  const [, payload = ""] = jwt.split(".");
  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

async function sessionsOf(userId: string): Promise<number> {
  const [row] = await migrationRole()<{ count: number }[]>`
    select count(*)::int as count from auth.sessions where user_id = ${userId}`;
  return row?.count ?? -1;
}

/** Enrols and verifies a TOTP factor on a session; returns the factor, its secret and aal2 token. */
async function enrolTotp(jwt: string, friendlyName: string) {
  // A code computed in the last seconds of its period may reach GoTrue in the next one.
  const left = millisecondsLeftInPeriod();
  if (left < 3_000) {
    await new Promise((resolve) => setTimeout(resolve, left + 100));
  }
  const enrolled = await gotrue("POST", "/factors", {
    key: "publishable",
    jwt,
    body: { factor_type: "totp", friendly_name: friendlyName },
  });
  const factorId = String(enrolled.body.id);
  const totp = enrolled.body.totp as { secret: string };
  const challenge = await gotrue("POST", `/factors/${factorId}/challenge`, {
    key: "publishable",
    jwt,
    body: {},
  });
  const code = totpCode(totp.secret);
  const verified = await gotrue("POST", `/factors/${factorId}/verify`, {
    key: "publishable",
    jwt,
    body: { challenge_id: challenge.body.id, code },
  });
  return { enrolled, factorId, secret: totp.secret, code, verified };
}

beforeAll(async () => {
  local = await requireLocalAuth();
  adapter = createSupabaseAuth(
    { url: local.apiUrl, secretKey: local.secretKey },
    { warn: (_object, message) => warnings.push(message) },
  );
});

afterAll(async () => {
  for (const id of createdUsers) {
    await fetch(`${local.authUrl}/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        apikey: local.secretKey,
        authorization: `Bearer ${local.secretKey}`,
      },
    });
  }
  expect(warnings).toEqual([]);
});

// ---------------------------------------------------------------------------------------------
// J3-A a: settings
// ---------------------------------------------------------------------------------------------

describe("J3-A a: settings, as GoTrue applies them", () => {
  it("a1, b1: generateLink gives a 6-digit code, sends nothing, and has no 60 s window", async () => {
    const user = await newUser("a1");
    const first = await newCode(user.email);
    const second = await newCode(user.email);
    expect(first).toMatch(/^\d{6}$/);
    expect(second).toMatch(/^\d{6}$/);
    expect(await mailpitMessagesTo(local, user.email)).toBe(0);
  });

  it("a3: public sign-up is refused, the administration API creates users", async () => {
    const email = newAddress("a3");
    const signup = await gotrue("POST", "/signup", {
      key: "publishable",
      body: { email, password: "a-long-enough-password-1" },
    });
    expect(outcomeOf(signup)).toEqual({ status: 422, code: "signup_disabled" });
    const user = await newUser("a3-admin");
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("b7: creating a known address answers email_exists", async () => {
    const user = await newUser("b7");
    expect(await adapter.createUser(user.email)).toEqual({
      ok: false,
      reason: "rejected",
      errorCode: "email_exists",
      status: 422,
    });
  });

  it("jwt_expiry = 300 is accepted: a GoTrue access token lives 300 s, signed in ES256", async () => {
    const user = await newUser("jwt");
    const token = await directSession(user.email);
    const claims = claimsOf(token);
    expect(Number(claims.exp) - Number(claims.iat)).toBe(300);
    const [header = ""] = token.split(".");
    expect(
      (
        JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as {
          alg: string;
        }
      ).alg,
    ).toBe("ES256");
  });

  // Re-measured on 2026-10-08 (J5): since the J4 link to staging, the local stack runs the GoTrue
  // version of staging (supabase/.temp/gotrue-version, v2.197.0). Unlike the version measured at
  // J3, it applies minimum_password_length to the administration API and refuses 73 bytes with a
  // 400 instead of failing the hash with a 500. apps/api's own rules (B-1) stay the first guard.
  it("EC-57: the administration API refuses 11 characters, accepts 12 and 72 bytes, refuses 73 bytes", async () => {
    const create = (label: string, password: string) =>
      gotrue("POST", "/admin/users", {
        key: "secret",
        body: { email: newAddress(label), password, email_confirm: true },
      });
    const eleven = await create("pw11", "a".repeat(11));
    const twelve = await create("pw12", "a".repeat(12));
    const seventyTwo = await create("pw72", "é".repeat(36));
    const seventyThree = await create("pw73", `${"é".repeat(36)}a`);
    for (const created of [twelve, seventyTwo]) {
      expect(created.status).toBe(200);
      createdUsers.push(String(created.body.id));
    }
    expect(outcomeOf(eleven)).toEqual({ status: 422, code: "weak_password" });
    expect(outcomeOf(seventyThree)).toEqual({
      status: 400,
      code: "validation_failed",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// J3-A a4, EC-41 point 4, the /recover oracle, EC-50 and EC-55 (cases (a) to (g) of the
// "Arbitrages après le commit 7"): the e-mail provider is ON, sign-up stays closed by [auth]
// enable_signup = false.
// ---------------------------------------------------------------------------------------------

/** A user created by the administration API WITHOUT confirming its address (never by apps/api). */
async function unconfirmedUser(
  label: string,
): Promise<{ id: string; email: string }> {
  const email = newAddress(label);
  const created = await gotrue("POST", "/admin/users", {
    key: "secret",
    body: { email, email_confirm: false },
  });
  if (created.status !== 200) {
    throw new Error(`unconfirmed user not created: ${created.status}`);
  }
  createdUsers.push(String(created.body.id));
  return { id: String(created.body.id), email };
}

async function usersWithEmail(email: string): Promise<number> {
  const [row] = await migrationRole()<{ count: number }[]>`
    select count(*)::int as count from auth.users where email = ${email}`;
  return row?.count ?? -1;
}

/**
 * max_frequency (60 s) also applies after a generateLink: without waiting a minute, /otp would be
 * refused by the frequency check (429) before reaching the sink hook. The clock of THIS user is
 * moved back instead, by the migration role of the local stack (test only).
 */
async function moveRecoveryClockBack(userId: string): Promise<void> {
  await migrationRole()`
    update auth.users set recovery_sent_at = recovery_sent_at - interval '2 minutes'
     where id = ${userId}`;
}

const SINK_REFUSAL = { status: 403, msg: "Native e-mails are disabled." };

function refusalOf(answer: GoTrueAnswer): { status: number; msg: unknown } {
  return { status: answer.status, msg: answer.body.msg };
}

describe("EC-50, EC-55: the e-mail provider is on, sign-up stays closed", () => {
  it("(a) POST /signup answers signup_disabled and creates nobody", async () => {
    const email = newAddress("ec55-a");
    const signup = await gotrue("POST", "/signup", {
      key: "publishable",
      body: { email, password: "a-long-enough-password-1" },
    });
    expect(outcomeOf(signup)).toEqual({ status: 422, code: "signup_disabled" });
    expect(await usersWithEmail(email)).toBe(0);
  });

  it("(b) /otp with create_user for an unknown address is refused and creates nobody", async () => {
    const email = newAddress("ec55-b");
    const otp = await gotrue("POST", "/otp", {
      key: "publishable",
      body: { email, create_user: true },
    });
    expect(outcomeOf(otp)).toEqual({ status: 422, code: "signup_disabled" });
    expect(await usersWithEmail(email)).toBe(0);
    expect(await mailpitMessagesTo(local, email)).toBe(0);
  });

  it("(c) /otp, /magiclink, /recover and /resend reach the sink hook, send nothing, and the code in progress stays valid", async () => {
    const user = await newUser("ec55-c");
    const code = await newCode(user.email);
    await moveRecoveryClockBack(user.id);
    const calls = {
      otp: await gotrue("POST", "/otp", {
        key: "publishable",
        body: { email: user.email, create_user: false },
      }),
      magiclink: await gotrue("POST", "/magiclink", {
        key: "publishable",
        body: { email: user.email },
      }),
      recover: await gotrue("POST", "/recover", {
        key: "publishable",
        body: { email: user.email },
      }),
    };
    // /resend only sends for an address awaiting confirmation, as in the experiment of EC-55:
    // apps/api never creates one (createUser confirms the address), so the probe makes one.
    const unconfirmed = await unconfirmedUser("ec55-c-unconfirmed");
    const resend = await gotrue("POST", "/resend", {
      key: "publishable",
      body: { type: "signup", email: unconfirmed.email },
    });
    expect({
      otp: refusalOf(calls.otp),
      magiclink: refusalOf(calls.magiclink),
      recover: refusalOf(calls.recover),
      resend: refusalOf(resend),
    }).toEqual({
      otp: SINK_REFUSAL,
      magiclink: SINK_REFUSAL,
      recover: SINK_REFUSAL,
      resend: SINK_REFUSAL,
    });
    expect(await mailpitMessagesTo(local, user.email)).toBe(0);
    expect(await mailpitMessagesTo(local, unconfirmed.email)).toBe(0);
    expect(await adapter.verifyEmailCode(CONTEXT, user.email, code)).toEqual({
      ok: true,
      value: { userId: user.id, email: user.email },
    });
  });

  it("(c) as found: /resend of a CONFIRMED user sends nothing and answers like an unknown address", async () => {
    const user = await newUser("ec55-c-confirmed");
    const unknown = newAddress("ec55-c-unknown");
    const resend = async (email: string) =>
      outcomeOf(
        await gotrue("POST", "/resend", {
          key: "publishable",
          body: { type: "signup", email },
        }),
      );
    expect(await resend(user.email)).toEqual({ status: 200, code: undefined });
    expect(await resend(unknown)).toEqual({ status: 200, code: undefined });
    expect(await mailpitMessagesTo(local, user.email)).toBe(0);
    expect(await mailpitMessagesTo(local, unknown)).toBe(0);
  });

  it("reaches the sink hook on an address change: constant refusal, address unchanged (G-1 point 3 c)", async () => {
    const user = await newUser("sink");
    const token = await directSession(user.email);
    const newEmail = newAddress("sink-new");
    const change = await gotrue("PUT", "/user", {
      key: "publishable",
      jwt: token,
      body: { email: newEmail },
    });
    expect(refusalOf(change)).toEqual(SINK_REFUSAL);
    const after = await adapter.getUser(user.id);
    expect(after).toEqual({
      ok: true,
      value: { userId: user.id, email: user.email },
    });
    const stored = await gotrue("GET", `/admin/users/${user.id}`, {
      key: "secret",
    });
    expect(stored.body.new_email ?? null).toBeNull();
    expect(await mailpitMessagesTo(local, user.email)).toBe(0);
    expect(await mailpitMessagesTo(local, newEmail)).toBe(0);
  });

  it("(d) as found (S-11): /recover and /otp tell an existing GoTrue user from an unknown address", async () => {
    const user = await newUser("oracle");
    await newCode(user.email);
    await moveRecoveryClockBack(user.id);
    const unknown = newAddress("oracle-unknown");
    const recover = async (email: string) =>
      outcomeOf(
        await gotrue("POST", "/recover", {
          key: "publishable",
          body: { email },
        }),
      );
    const otp = async (email: string) =>
      outcomeOf(
        await gotrue("POST", "/otp", {
          key: "publishable",
          body: { email, create_user: false },
        }),
      );
    expect(await recover(user.email)).toEqual({ status: 403, code: "unknown" });
    expect(await recover(unknown)).toEqual({ status: 200, code: undefined });
    expect(await otp(user.email)).toEqual({ status: 403, code: "unknown" });
    expect(await otp(unknown)).toEqual({ status: 422, code: "otp_disabled" });
    expect(await mailpitMessagesTo(local, unknown)).toBe(0);
  });

  it("(e) the code and the password are both verified through the adapter, and no GoTrue session remains", async () => {
    const user = await newUser("ec55-e");
    const code = await newCode(user.email);
    expect((await adapter.verifyEmailCode(CONTEXT, user.email, code)).ok).toBe(
      true,
    );
    const password = "a-password-of-the-local-stack-1";
    const set = await gotrue("PUT", `/admin/users/${user.id}`, {
      key: "secret",
      body: { password },
    });
    expect(set.status).toBe(200);
    expect(await adapter.verifyPassword(CONTEXT, user.email, password)).toEqual(
      { ok: true, value: { userId: user.id, email: user.email } },
    );
    expect(await sessionsOf(user.id)).toBe(0);
  });

  it("(g) EC-57 (c) as found: /token with 73 bytes answers alike for a password holder, a member and an unknown address", async () => {
    const holder = await newUser("ec57-holder");
    const set = await gotrue("PUT", `/admin/users/${holder.id}`, {
      key: "secret",
      body: { password: "a-password-of-the-local-stack-1" },
    });
    expect(set.status).toBe(200);
    const withoutPassword = await newUser("ec57-member");
    const seventyThreeBytes = `${"é".repeat(36)}a`;
    const token = async (email: string) =>
      outcomeOf(
        await gotrue("POST", "/token?grant_type=password", {
          key: "publishable",
          body: { email, password: seventyThreeBytes },
        }),
      );
    const expected = { status: 400, code: "invalid_credentials" };
    expect(await token(holder.email)).toEqual(expected);
    expect(await token(withoutPassword.email)).toEqual(expected);
    expect(await token(newAddress("ec57-unknown"))).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------------------------
// J3-A b: codes
// ---------------------------------------------------------------------------------------------

describe("J3-A b: the login code", () => {
  it("b3, b5: verifies with type email, once only", async () => {
    const user = await newUser("b5");
    const code = await newCode(user.email);
    expect((await adapter.verifyEmailCode(CONTEXT, user.email, code)).ok).toBe(
      true,
    );
    expect(await adapter.verifyEmailCode(CONTEXT, user.email, code)).toEqual({
      ok: false,
      reason: "rejected",
      errorCode: "otp_expired",
      status: 403,
    });
  });

  it("b4: a new code invalidates the previous one", async () => {
    const user = await newUser("b4");
    const previous = await newCode(user.email);
    const current = await newCode(user.email);
    expect(
      await adapter.verifyEmailCode(CONTEXT, user.email, previous),
    ).toMatchObject({
      ok: false,
      errorCode: "otp_expired",
    });
    expect(
      (await adapter.verifyEmailCode(CONTEXT, user.email, current)).ok,
    ).toBe(true);
  });

  it("b6: GoTrue counts no failure: six wrong codes, then the right one is accepted", async () => {
    const user = await newUser("b6");
    const code = await newCode(user.email);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 6; attempt += 1) {
      expect(
        (await adapter.verifyEmailCode(CONTEXT, user.email, wrong)).ok,
      ).toBe(false);
    }
    expect((await adapter.verifyEmailCode(CONTEXT, user.email, code)).ok).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// J3-C rules 1 and 2
// ---------------------------------------------------------------------------------------------

describe("J3-C rules 1 and 2, on the real GoTrue", () => {
  it("rule 2: no GoTrue session remains after a verification through the adapter", async () => {
    const user = await newUser("rule2");
    const code = await newCode(user.email);
    expect((await adapter.verifyEmailCode(CONTEXT, user.email, code)).ok).toBe(
      true,
    );
    expect(await sessionsOf(user.id)).toBe(0);
  });

  it("rule 1: two concurrent verifications never cross", async () => {
    const [a, b] = await Promise.all([newUser("rule1-a"), newUser("rule1-b")]);
    const [codeA, codeB] = await Promise.all([
      newCode(a.email),
      newCode(b.email),
    ]);
    const [resultA, resultB] = await Promise.all([
      adapter.verifyEmailCode(CONTEXT, a.email, codeA),
      adapter.verifyEmailCode(CONTEXT, b.email, codeB),
    ]);
    expect(resultA).toEqual({
      ok: true,
      value: { userId: a.id, email: a.email },
    });
    expect(resultB).toEqual({
      ok: true,
      value: { userId: b.id, email: b.email },
    });
    expect(await sessionsOf(a.id)).toBe(0);
    expect(await sessionsOf(b.id)).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// J3-A c: TOTP, and G-1 point 3
// ---------------------------------------------------------------------------------------------

describe("J3-A c: TOTP", () => {
  it("a5, c1: enrols a factor (QR code as SVG, secret, otpauth URI) and verifies it into aal2", async () => {
    const user = await newUser("a5");
    const token = await directSession(user.email);
    const { enrolled, verified } = await enrolTotp(token, "a5");
    expect(enrolled.status).toBe(200);
    const totp = enrolled.body.totp as Record<string, string>;
    // Raw SVG text, not a data URL (J3-C rule 5: shown by the backoffice through a blob: URL).
    expect(totp.qr_code).toMatch(/^<\?xml version="1\.0"\?>[\s\S]*<svg /);
    expect(totp.secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(totp.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(verified.status).toBe(200);
    expect(claimsOf(String(verified.body.access_token)).aal).toBe("aal2");
  });

  it("c4: the same code is accepted again with a new challenge (no anti-replay: EC-39 is ours)", async () => {
    const user = await newUser("c4");
    const token = await directSession(user.email);
    const { factorId, code, verified } = await enrolTotp(token, "c4");
    const aal2 = String(verified.body.access_token);
    const challenge = await gotrue("POST", `/factors/${factorId}/challenge`, {
      key: "publishable",
      jwt: aal2,
      body: {},
    });
    const replay = await gotrue("POST", `/factors/${factorId}/verify`, {
      key: "publishable",
      jwt: aal2,
      body: { challenge_id: challenge.body.id, code },
    });
    // GoTrue accepts the adjacent period too (J3-A c4): a period boundary between the two
    // verifications does not change the finding.
    expect(replay.status).toBe(200);
  });

  it("c6 (EC-56): a new enrolment keeps the unverified factor, and refuses the same friendly name", async () => {
    const user = await newUser("c6");
    const token = await directSession(user.email);
    const first = await gotrue("POST", "/factors", {
      key: "publishable",
      jwt: token,
      body: { factor_type: "totp", friendly_name: "backoffice" },
    });
    expect(first.status).toBe(200);
    const again = await gotrue("POST", "/factors", {
      key: "publishable",
      jwt: token,
      body: { factor_type: "totp", friendly_name: "backoffice" },
    });
    expect(outcomeOf(again)).toEqual({
      status: 422,
      code: "mfa_factor_name_conflict",
    });
    const other = await gotrue("POST", "/factors", {
      key: "publishable",
      jwt: token,
      body: { factor_type: "totp", friendly_name: "backoffice-2" },
    });
    expect(other.status).toBe(200);
    const factors = await gotrue("GET", `/admin/users/${user.id}/factors`, {
      key: "secret",
    });
    const listed = factors.body as unknown as { id: string; status: string }[];
    expect(listed.map((factor) => factor.status)).toEqual([
      "unverified",
      "unverified",
    ]);
  });
});

describe("G-1 point 3: a GoTrue session obtained directly", () => {
  it("cannot change the password or the address, nor enrol, in aal1 once a TOTP is verified", async () => {
    const user = await newUser("g1");
    const first = await directSession(user.email);
    expect((await enrolTotp(first, "g1")).verified.status).toBe(200);
    const aal1 = await directSession(user.email);
    expect(claimsOf(aal1).aal).toBe("aal1");
    const password = await gotrue("PUT", "/user", {
      key: "publishable",
      jwt: aal1,
      body: { password: "another-password-of-the-attacker" },
    });
    const address = await gotrue("PUT", "/user", {
      key: "publishable",
      jwt: aal1,
      body: { email: newAddress("g1-new") },
    });
    const enrol = await gotrue("POST", "/factors", {
      key: "publishable",
      jwt: aal1,
      body: { factor_type: "totp", friendly_name: "attacker" },
    });
    expect({
      password: outcomeOf(password),
      address: outcomeOf(address),
      enrol: outcomeOf(enrol),
    }).toEqual({
      password: { status: 401, code: "insufficient_aal" },
      address: { status: 401, code: "insufficient_aal" },
      enrol: { status: 403, code: "insufficient_aal" },
    });
  });

  it("(f) as found (G-1 c, EC-55, S-11): a member without TOTP sets a GoTrue password, which then opens GoTrue sessions, never an INFLUX one", async () => {
    const user = await newUser("g1-member");
    const token = await directSession(user.email);
    const password = "a-password-chosen-by-the-attacker";
    const set = await gotrue("PUT", "/user", {
      key: "publishable",
      jwt: token,
      body: { password },
    });
    expect(set.status).toBe(200);
    const signIn = await gotrue("POST", "/token?grant_type=password", {
      key: "publishable",
      body: { email: user.email, password },
    });
    expect(signIn.status).toBe(200);
    expect(typeof signIn.body.access_token).toBe("string");
  });

  it("is refused by apps/api, in Authorization or in an sb-* cookie (401)", async () => {
    const user = await newUser("g1-api");
    const token = await directSession(user.email);
    const api = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    try {
      for (const url of ["/v1/status", "/v1/me", "/v1/bo/me"]) {
        const response = await api.inject({
          method: "GET",
          url,
          headers: {
            authorization: `Bearer ${token}`,
            cookie: `sb-127-auth-token=${token}; sb-access-token=${token}`,
          },
        });
        expect(response.statusCode, url).toBe(401);
      }
    } finally {
      await api.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// EC-38 point 2, and the addresses kept by GoTrue (J3 conformity opinion, EC-38 condition (3))
// ---------------------------------------------------------------------------------------------

describe("EC-38: Sb-Forwarded-For on the local stack", () => {
  it("is accepted without effect: the option is not available locally, GoTrue keeps the gateway's address", async () => {
    const user = await newUser("ec38");
    const pseudonym = "fd12:3456:789a:bcde:f012:3456:789a:bcde";
    const code = await newCode(user.email);
    const answer = await gotrue("POST", "/verify", {
      key: "secret",
      body: { type: "email", email: user.email, token: code },
      headers: { "sb-forwarded-for": pseudonym },
    });
    expect(answer.status).toBe(200);
    const rows = await migrationRole()<{ ip: string | null }[]>`
      select host(ip) as ip from auth.sessions where user_id = ${user.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ip).not.toBe(pseudonym);
    await fetch(`${local.authUrl}/logout?scope=local`, {
      method: "POST",
      headers: {
        apikey: local.secretKey,
        authorization: `Bearer ${String(answer.body.access_token)}`,
      },
    });
    expect(await sessionsOf(user.id)).toBe(0);
  });

  it("lists where GoTrue keeps an address after the code and TOTP journeys", async () => {
    const user = await newUser("ip");
    const code = await newCode(user.email);
    expect((await adapter.verifyEmailCode(CONTEXT, user.email, code)).ok).toBe(
      true,
    );
    const token = await directSession(user.email);
    await enrolTotp(token, "ip");
    const sql = migrationRole();
    const [audit] = await sql<{ with_ip: number; total: number }[]>`
      select count(*) filter (where ip_address <> '')::int as with_ip, count(*)::int as total
        from auth.audit_log_entries where payload->>'actor_id' = ${user.id}`;
    const [challenges] = await sql<{ with_ip: number }[]>`
      select count(*)::int as with_ip from auth.mfa_challenges c
        join auth.mfa_factors f on f.id = c.factor_id
       where f.user_id = ${user.id} and c.ip_address is not null`;
    const [flows] = await sql<{ count: number }[]>`
      select count(*)::int as count from auth.flow_state where user_id = ${user.id}`;
    // Audit log: GoTrue writes it (EC-38 point 3: kept, purged at 90 days); the challenge keeps
    // the address it must match at verification (J3-A c5); no PKCE flow is used.
    expect(audit?.total).toBeGreaterThan(0);
    expect(audit?.with_ip).toBeGreaterThan(0);
    expect(challenges?.with_ip).toBeGreaterThan(0);
    expect(flows?.count).toBe(0);
  });
});

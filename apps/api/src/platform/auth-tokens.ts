// Short signed tokens of the authentication journeys (docs/mvp/21 §4, J3-C rule 8; §3 EC-3, EC-4
// and EC-24): the login journey (15 min) and the sign-up token (30 min). The session identifier
// is NOT one of them: it is opaque, never signed, and only its SHA-256 hash is stored.
// - Signed by the signer of @fastify/cookie (HMAC-SHA-256), key AUTH_TOKEN_SIGNING_SECRET, which
//   signs nothing else. The signature is checked in constant time (timingSafeEqual, read in
//   @fastify/cookie 11.1.2) BEFORE anything of the value is decoded; then zod.
// - The expiry is inside the signed value: the cookie's Max-Age is only a hint to the browser,
//   which the client controls.
// - The type is part of the value and of the schema: a login token is never accepted as a
//   sign-up token, nor the reverse.
// - Readable by the browser's owner (base64url JSON, signed, not encrypted): it never holds a
//   code, a password or a GoTrue token (RG-J3-7 of the J3 conformity opinion).
import { Signer } from "@fastify/cookie";
import * as z from "zod";

/** Version of the token format: a change of content makes the previous tokens unreadable. */
export const AUTH_TOKEN_VERSION = 1;

/** Lifetimes, in seconds (J3-C rule 8). */
export const LOGIN_TOKEN_TTL_SECONDS = 15 * 60;
export const SIGNUP_TOKEN_TTL_SECONDS = 30 * 60;

/** A signed value longer than this is refused before any computation. */
const MAX_TOKEN_LENGTH = 2_048;

const epochSeconds = z.number().int().positive();
const normalisedEmail = z.email().max(254);

/** The login journey: which send it follows, for which address, with which phrase (RG47, RG48). */
const loginTokenSchema = z.strictObject({
  typ: z.literal("login"),
  v: z.literal(AUTH_TOKEN_VERSION),
  exp: epochSeconds,
  /** Random reference (uuid v4) of the leads.transactional_sends row (EC-3 point 1). */
  ref: z.uuid({ version: "v4" }),
  email: normalisedEmail,
  /** Matching phrase shown on the page and in the e-mail (05 RG128 to RG134). */
  phrase: z.string().min(1).max(64),
});

/** Emitted after a verified code when no account exists yet (EC-4 point 1). */
const signupTokenSchema = z.strictObject({
  typ: z.literal("signup"),
  v: z.literal(AUTH_TOKEN_VERSION),
  exp: epochSeconds,
  verifiedAt: epochSeconds,
  authUserId: z.uuid(),
  email: normalisedEmail,
  /** Door the person came through: a default only, the role is chosen on screen 3 (EC-4 (3)). */
  door: z.enum(["advertiser", "creator"]),
});

export type LoginToken = z.infer<typeof loginTokenSchema>;
export type SignupToken = z.infer<typeof signupTokenSchema>;
export type LoginTokenContent = Omit<LoginToken, "typ" | "v" | "exp">;
export type SignupTokenContent = Omit<SignupToken, "typ" | "v" | "exp">;

export type AuthTokenCodec = {
  issueLogin(content: LoginTokenContent, now: Date): string;
  issueSignup(content: SignupTokenContent, now: Date): string;
  /** The token if its signature, type, version and expiry hold at `now`; null otherwise. */
  readLogin(value: string | undefined, now: Date): LoginToken | null;
  readSignup(value: string | undefined, now: Date): SignupToken | null;
};

function secondsOf(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function createAuthTokenCodec(signingSecret: string): AuthTokenCodec {
  const signer = new Signer(signingSecret, "sha256");

  function issue(payload: LoginToken | SignupToken): string {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    return signer.sign(encoded);
  }

  function read<Schema extends z.ZodType<{ exp: number }>>(
    schema: Schema,
    value: string | undefined,
    now: Date,
  ): z.infer<Schema> | null {
    if (value === undefined || value.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    // Signature first, in constant time: nothing of an unsigned value is decoded.
    const unsigned = signer.unsign(value);
    if (!unsigned.valid || unsigned.value === null) {
      return null;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(
        Buffer.from(unsigned.value, "base64url").toString("utf8"),
      );
    } catch {
      // A signed value that is not JSON: only a change of format can produce it. Refused.
      return null;
    }
    const parsed = schema.safeParse(decoded);
    if (!parsed.success || parsed.data.exp <= secondsOf(now)) {
      return null;
    }
    return parsed.data;
  }

  return {
    issueLogin(content, now) {
      // Type, version and expiry last: nothing of the content can replace them.
      return issue({
        ...content,
        typ: "login",
        v: AUTH_TOKEN_VERSION,
        exp: secondsOf(now) + LOGIN_TOKEN_TTL_SECONDS,
      });
    },
    issueSignup(content, now) {
      // Type, version and expiry last: nothing of the content can replace them.
      return issue({
        ...content,
        typ: "signup",
        v: AUTH_TOKEN_VERSION,
        exp: secondsOf(now) + SIGNUP_TOKEN_TTL_SECONDS,
      });
    },
    readLogin(value, now) {
      return read(loginTokenSchema, value, now);
    },
    readSignup(value, now) {
      return read(signupTokenSchema, value, now);
    },
  };
}

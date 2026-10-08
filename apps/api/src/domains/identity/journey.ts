// GET /v1/auth/journey (D66; docs/mvp/05 RG111; 17 §3 "Changement de langue"): where a reloaded
// journey resumes. The state is already held by the server, in the two signed httpOnly journey
// cookies (auth-tokens.ts): nothing is stored for it, the database and GoTrue are never called.
//
//   1  A valid sign-up token: the address is verified and has no account -> `details`. It wins
//      over a login token: it is the later step of the same journey.
//   2  Else a valid login token: a code was sent -> `code`, with the address, the matching
//      phrase and the seconds left before a new code may be asked for (05 RG50).
//   3  Else `none`; a cookie present but unreadable (forged, expired, other format) is cleared.
// The door is never returned: it comes from the URL, never from a token. The address goes back
// to the browser that received the code or verified it, during the token's life only.
import {
  RESEND_DELAY_SECONDS,
  type JourneyResponse,
} from "@influx/contracts/auth";
import {
  LOGIN_TOKEN_TTL_SECONDS,
  type AuthTokenCodec,
} from "../../platform/auth-tokens.ts";

export type JourneyRequest = {
  loginCookie: string | null;
  signupCookie: string | null;
};

export type JourneyResult = {
  response: JourneyResponse;
  /** The cookies to clear: present, but unreadable at `now`. */
  clearLogin: boolean;
  clearSignup: boolean;
};

function secondsOf(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function readJourney(
  tokens: Pick<AuthTokenCodec, "readLogin" | "readSignup">,
  request: JourneyRequest,
  now: Date,
): JourneyResult {
  const signup = tokens.readSignup(request.signupCookie ?? undefined, now);
  const clearSignup = request.signupCookie !== null && signup === null;
  if (signup !== null) {
    // The login cookie is consumed by verify-code; one left over is simply not read.
    return {
      response: { step: "details", email: signup.email },
      clearLogin: false,
      clearSignup,
    };
  }

  const login = tokens.readLogin(request.loginCookie ?? undefined, now);
  const clearLogin = request.loginCookie !== null && login === null;
  if (login === null) {
    return { response: { step: "none" }, clearLogin, clearSignup };
  }
  // The request instant is the expiry of the signed token minus its lifetime (as verify-code).
  const requestedAt = login.exp - LOGIN_TOKEN_TTL_SECONDS;
  const retryAfterSeconds = Math.min(
    RESEND_DELAY_SECONDS,
    Math.max(0, requestedAt + RESEND_DELAY_SECONDS - secondsOf(now)),
  );
  return {
    response: {
      step: "code",
      email: login.email,
      matchingPhrase: login.phrase,
      retryAfterSeconds,
    },
    clearLogin,
    clearSignup,
  };
}

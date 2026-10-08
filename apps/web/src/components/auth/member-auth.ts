// Calls of the member sign-in and sign-up screens (docs/mvp/17 §3; 21 §4, §5.2). Each one goes
// through the same-origin relay (src/browser/relay-client.ts) and reads the answer with the
// schema of packages/contracts. No rule lives here: apps/api decides, the screen displays.
import {
  journeyResetResponseSchema,
  journeyResponseSchema,
  logoutResponseSchema,
  meResponseSchema,
  requestCodeResponseSchema,
  verifyCodeResponseSchema,
  type JourneyResetResponse,
  type JourneyResponse,
  type MeResponse,
  type RequestCodeResponse,
  type SignupDoor,
  type UiLocale,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";
import {
  signupResponseSchema,
  type SignupBodyInput,
  type SignupResponse,
} from "@influx/contracts/signup";
import { callRelay, type RelayResult } from "@/browser/relay-client";

export function requestCode(
  email: string,
  locale: UiLocale,
): Promise<RelayResult<RequestCodeResponse>> {
  return callRelay("POST", "/v1/auth/request-code", requestCodeResponseSchema, {
    email,
    locale,
  });
}

export function verifyCode(
  code: string,
  door: SignupDoor,
): Promise<RelayResult<VerifyCodeResponse>> {
  return callRelay("POST", "/v1/auth/verify-code", verifyCodeResponseSchema, {
    code,
    door,
  });
}

/** D66 (05 RG111): the step a reloaded journey resumes at, read from the journey cookies. */
export function readJourney(): Promise<RelayResult<JourneyResponse>> {
  return callRelay("GET", "/v1/auth/journey", journeyResponseSchema);
}

/** D66: "change address" ends the journey of this browser (both journey cookies cleared). */
export function resetJourney(): Promise<RelayResult<JourneyResetResponse>> {
  return callRelay(
    "POST",
    "/v1/auth/journey/reset",
    journeyResetResponseSchema,
  );
}

/** Screen 3 (J5 commit 4): the sign-up token is the httpOnly cookie set by verify-code. */
export function signUp(
  body: SignupBodyInput,
): Promise<RelayResult<SignupResponse>> {
  return callRelay("POST", "/v1/signup", signupResponseSchema, body);
}

export function readMe(): Promise<RelayResult<MeResponse>> {
  return callRelay("GET", "/v1/me", meResponseSchema);
}

export function signOut(): Promise<RelayResult<{ outcome: "signed_out" }>> {
  return callRelay("POST", "/v1/auth/logout", logoutResponseSchema);
}

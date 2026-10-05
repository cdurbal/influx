// Calls of the member sign-in screens (docs/mvp/17 §3.7; 21 §4, J3 commit 12). Each one goes
// through the same-origin relay (src/browser/relay-client.ts) and reads the answer with the
// schema of packages/contracts. No rule lives here: apps/api decides, the screen displays.
import {
  logoutResponseSchema,
  meResponseSchema,
  requestCodeResponseSchema,
  verifyCodeResponseSchema,
  type MeResponse,
  type RequestCodeResponse,
  type SignupDoor,
  type UiLocale,
  type VerifyCodeResponse,
} from "@influx/contracts/auth";
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

export function readMe(): Promise<RelayResult<MeResponse>> {
  return callRelay("GET", "/v1/me", meResponseSchema);
}

export function signOut(): Promise<RelayResult<{ outcome: "signed_out" }>> {
  return callRelay("POST", "/v1/auth/logout", logoutResponseSchema);
}

// Calls of the backoffice sign-in screens (docs/mvp/17b §3.14; 21 §4, J3 commit 12), through the
// same-origin relay and read with the schemas of packages/contracts. No rule lives here: apps/api
// decides (uniform refusal, aal2, anti-replay), the screen displays.
import {
  backofficeEnrollConfirmResponseSchema,
  backofficeEnrollResponseSchema,
  backofficeLoginResponseSchema,
  backofficeLogoutResponseSchema,
  backofficeMeResponseSchema,
  type BackofficeEnrollConfirmResponse,
  type BackofficeEnrollResponse,
  type BackofficeLoginResponse,
  type BackofficeMeResponse,
} from "@influx/contracts/backoffice-auth";
import { callRelay, type RelayResult } from "@/browser/relay-client";

export type SecondFactor =
  { kind: "totp"; code: string } | { kind: "recovery"; code: string };

export function signIn(
  email: string,
  password: string,
  factor: SecondFactor,
): Promise<RelayResult<BackofficeLoginResponse>> {
  return callRelay("POST", "/v1/bo/auth/login", backofficeLoginResponseSchema, {
    email,
    password,
    ...(factor.kind === "totp"
      ? { totpCode: factor.code }
      : { recoveryCode: factor.code }),
  });
}

export function startEnrollment(
  email: string,
  password: string,
  enrollmentToken: string,
): Promise<RelayResult<BackofficeEnrollResponse>> {
  return callRelay(
    "POST",
    "/v1/bo/auth/enroll",
    backofficeEnrollResponseSchema,
    {
      email,
      password,
      enrollmentToken,
    },
  );
}

export function confirmEnrollment(
  email: string,
  password: string,
  enrollmentToken: string,
  code: string,
): Promise<RelayResult<BackofficeEnrollConfirmResponse>> {
  return callRelay(
    "POST",
    "/v1/bo/auth/enroll/confirm",
    backofficeEnrollConfirmResponseSchema,
    { email, password, enrollmentToken, code },
  );
}

export function readMe(): Promise<RelayResult<BackofficeMeResponse>> {
  return callRelay("GET", "/v1/bo/me", backofficeMeResponseSchema);
}

export function signOut(): Promise<RelayResult<{ outcome: "signed_out" }>> {
  return callRelay(
    "POST",
    "/v1/bo/auth/logout",
    backofficeLogoutResponseSchema,
  );
}

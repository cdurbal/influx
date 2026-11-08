// Calls of the ownership journey of a creator (docs/mvp/08 RG21 to RG24, RG60; jalons/l2e, commit 18).
// Each one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the answer
// with the schema of packages/contracts. No rule lives here: apps/api decides, the screen displays.
// The account is always the session's: no call names an account, and a request is named by its own
// identifier. The deposit of a piece (PUT …/evidence, DELETE …/evidence/:id) is commit 19's.
import {
  creatorVerificationResponseSchema,
  verificationRequestResponseSchema,
  type CreatorVerificationLevel,
  type CreatorVerificationResponse,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const VERIFICATION_PATH = "/v1/me/verification";
const REQUESTS_PATH = `${VERIFICATION_PATH}/requests`;

/** The lines of the creator, network by network: badges obtained and requests in course (08 RG13). */
export function readCreatorVerification(): Promise<
  RelayResult<CreatorVerificationResponse>
> {
  return callRelay("GET", VERIFICATION_PATH, creatorVerificationResponseSchema);
}

/** Opens the request of a (network, level), or takes the open draft back; the line is named by its network. */
export function openVerificationRequest(
  networkCode: string,
  level: CreatorVerificationLevel,
): Promise<RelayResult<VerificationRequestResponse>> {
  return callRelay("POST", REQUESTS_PATH, verificationRequestResponseSchema, {
    networkCode,
    level,
  });
}

/** A new code on the draft: the former one is revoked in the same transaction (08 RG23). */
export function renewVerificationCode(
  requestId: string,
): Promise<RelayResult<VerificationRequestResponse>> {
  return callRelay(
    "POST",
    `${REQUESTS_PATH}/${requestId}/code`,
    verificationRequestResponseSchema,
  );
}

/** "J'ai collé le code": the draft goes to the queue. */
export function submitVerificationRequest(
  requestId: string,
): Promise<RelayResult<VerificationRequestResponse>> {
  return callRelay(
    "POST",
    `${REQUESTS_PATH}/${requestId}/submit`,
    verificationRequestResponseSchema,
  );
}

/** The request withdrawn, before any decision. */
export function cancelVerificationRequest(
  requestId: string,
): Promise<RelayResult<VerificationRequestResponse>> {
  return callRelay(
    "POST",
    `${REQUESTS_PATH}/${requestId}/cancel`,
    verificationRequestResponseSchema,
  );
}

// Calls of "mon profil de marque" (docs/mvp/17 §4.2; 06 RG14, RG83; jalons/l2b, commits 07 and 11).
// Each one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the
// answer with the schema of packages/contracts. No rule lives here: apps/api decides, the screen
// displays. The account is always the session's: no call names an account.
import {
  brandProfileResponseSchema,
  submitBrandProfileResponseSchema,
  updateBrandProfileResponseSchema,
  type BrandProfileResponse,
  type SubmitBrandProfileResponse,
  type UpdateBrandProfileBody,
  type UpdateBrandProfileResponse,
} from "@influx/contracts/brand-profile";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const PROFILE_PATH = "/v1/me/brand-profile";

export function readBrandProfile(): Promise<RelayResult<BrandProfileResponse>> {
  return callRelay("GET", PROFILE_PATH, brandProfileResponseSchema);
}

/** The autosave: the fields that changed only; a list is sent whole (06 RG83). */
export function saveBrandProfileFields(
  body: UpdateBrandProfileBody,
): Promise<RelayResult<UpdateBrandProfileResponse>> {
  return callRelay(
    "PATCH",
    PROFILE_PATH,
    updateBrandProfileResponseSchema,
    body,
  );
}

export function submitBrandProfile(): Promise<
  RelayResult<SubmitBrandProfileResponse>
> {
  return callRelay(
    "POST",
    `${PROFILE_PATH}/submit`,
    submitBrandProfileResponseSchema,
  );
}

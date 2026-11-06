// Calls of "mon profil" of a creator (docs/mvp/17 §5.2; 07 RG14, RG111; jalons/l2d, commit 12). Each
// one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the answer
// with the schema of packages/contracts. No rule lives here: apps/api decides, the screen displays.
// The account is always the session's: no call names an account.
import {
  creatorProfileResponseSchema,
  updateCreatorProfileResponseSchema,
  type CreatorProfileResponse,
  type UpdateCreatorProfileBody,
  type UpdateCreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const PROFILE_PATH = "/v1/me/creator-profile";

export function readCreatorProfile(): Promise<
  RelayResult<CreatorProfileResponse>
> {
  return callRelay("GET", PROFILE_PATH, creatorProfileResponseSchema);
}

/** The autosave: the fields that changed only; a list is sent whole (07 RG111). */
export function saveCreatorProfileFields(
  body: UpdateCreatorProfileBody,
): Promise<RelayResult<UpdateCreatorProfileResponse>> {
  return callRelay(
    "PATCH",
    PROFILE_PATH,
    updateCreatorProfileResponseSchema,
    body,
  );
}

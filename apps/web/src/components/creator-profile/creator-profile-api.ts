// Calls of "mon profil" of a creator (docs/mvp/17 §5.2; 07 RG14, RG111; jalons/l2d, commit 12). Each
// one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the answer
// with the schema of packages/contracts. No rule lives here: apps/api decides, the screen displays.
// The account is always the session's: no call names an account.
import {
  creatorNetworksResponseSchema,
  creatorProfileResponseSchema,
  creatorVisibilityResponseSchema,
  submitCreatorProfileResponseSchema,
  updateCreatorProfileResponseSchema,
  type ConfirmCreatorFiguresBody,
  type CreateCreatorNetworkBody,
  type PutCreatorNetworkAudienceBody,
  type CreatorNetworksResponse,
  type CreatorProfileResponse,
  type CreatorVisibilityResponse,
  type SubmitCreatorProfileResponse,
  type UpdateCreatorNetworkBody,
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

// --- Block 3: the network lines (commit 13). The line is named by its identifier in the path; the
// account is the session's, never a parameter. Every call answers the whole list of lines.

const NETWORKS_PATH = `${PROFILE_PATH}/networks`;

export function readCreatorNetworks(): Promise<
  RelayResult<CreatorNetworksResponse>
> {
  return callRelay("GET", NETWORKS_PATH, creatorNetworksResponseSchema);
}

export function addCreatorNetwork(
  body: CreateCreatorNetworkBody,
): Promise<RelayResult<CreatorNetworksResponse>> {
  return callRelay("POST", NETWORKS_PATH, creatorNetworksResponseSchema, body);
}

export function saveCreatorNetworkFields(
  lineId: string,
  body: UpdateCreatorNetworkBody,
): Promise<RelayResult<CreatorNetworksResponse>> {
  return callRelay(
    "PATCH",
    `${NETWORKS_PATH}/${lineId}`,
    creatorNetworksResponseSchema,
    body,
  );
}

export function removeCreatorNetwork(
  lineId: string,
): Promise<RelayResult<CreatorNetworksResponse>> {
  return callRelay(
    "DELETE",
    `${NETWORKS_PATH}/${lineId}`,
    creatorNetworksResponseSchema,
  );
}

/** "Confirmer mes chiffres": the one call that renews the date of the figures (07 RG50, EC-L2D-6). */
export function confirmCreatorNetworkFigures(
  lineId: string,
  body: ConfirmCreatorFiguresBody,
): Promise<RelayResult<CreatorNetworksResponse>> {
  return callRelay(
    "POST",
    `${NETWORKS_PATH}/${lineId}/figures`,
    creatorNetworksResponseSchema,
    body,
  );
}

// --- Block 4: the exact audience of a line (commit 14). The whole audience is replaced in one call
// (07 RG56 to RG61): what the creator typed, by country, age band and gender.

export function saveCreatorNetworkAudience(
  lineId: string,
  body: PutCreatorNetworkAudienceBody,
): Promise<RelayResult<CreatorNetworksResponse>> {
  return callRelay(
    "PUT",
    `${NETWORKS_PATH}/${lineId}/audience`,
    creatorNetworksResponseSchema,
    body,
  );
}

// --- Publication (commit 13): "Publier mon profil" and the switch of RG8. Neither names an account;
// the answer of a submission lists what is still missing (07 RG4, RG90).

export function submitCreatorProfile(): Promise<
  RelayResult<SubmitCreatorProfileResponse>
> {
  return callRelay(
    "POST",
    `${PROFILE_PATH}/submit`,
    submitCreatorProfileResponseSchema,
  );
}

export function saveCreatorVisibility(
  isSearchable: boolean,
): Promise<RelayResult<CreatorVisibilityResponse>> {
  return callRelay(
    "PUT",
    `${PROFILE_PATH}/visibility`,
    creatorVisibilityResponseSchema,
    { isSearchable },
  );
}

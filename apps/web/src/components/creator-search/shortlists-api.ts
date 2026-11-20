// Calls of the brand's private lists and of its request to the INFLUX team (docs/mvp/10 RG51, RG61, RG63, RG65; 17
// §4.4, §4.9; jalons/l3f, commit 11). Each one goes through the same-origin relay and reads the answer with the schema
// of packages/contracts. No rule lives here: the base and apps/api decide what a list holds, what a creator may be
// added, how many lists and how often. A list is its opaque identifier, a creator its alias; nothing else is sent.
import {
  selectionRequestResponseSchema,
  type SelectionRequestBody,
  type SelectionRequestResponse,
} from "@influx/contracts/selection-requests";
import {
  shortlistAddResponseSchema,
  shortlistDeleteResponseSchema,
  shortlistNoteResponseSchema,
  shortlistReadResponseSchema,
  shortlistRemoveResponseSchema,
  shortlistResponseSchema,
  shortlistsResponseSchema,
  type ShortlistAddResponse,
  type ShortlistDeleteResponse,
  type ShortlistNoteResponse,
  type ShortlistReadResponse,
  type ShortlistRemoveResponse,
  type ShortlistResponse,
  type ShortlistsResponse,
} from "@influx/contracts/shortlists";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const LISTS_PATH = "/v1/me/shortlists";

export function readShortlists(): Promise<RelayResult<ShortlistsResponse>> {
  return callRelay("GET", LISTS_PATH, shortlistsResponseSchema);
}

export function createShortlist(
  name: string,
  campaignId: string | null,
): Promise<RelayResult<ShortlistResponse>> {
  return callRelay("POST", LISTS_PATH, shortlistResponseSchema, {
    name,
    campaignId,
  });
}

/** A replacement: the name and the campaign (null detaches the list from its campaign). */
export function updateShortlist(
  id: string,
  name: string,
  campaignId: string | null,
): Promise<RelayResult<ShortlistResponse>> {
  return callRelay("PUT", `${LISTS_PATH}/${id}`, shortlistResponseSchema, {
    name,
    campaignId,
  });
}

export function deleteShortlist(
  id: string,
): Promise<RelayResult<ShortlistDeleteResponse>> {
  return callRelay(
    "DELETE",
    `${LISTS_PATH}/${id}`,
    shortlistDeleteResponseSchema,
  );
}

export function readShortlist(
  id: string,
): Promise<RelayResult<ShortlistReadResponse>> {
  return callRelay("GET", `${LISTS_PATH}/${id}`, shortlistReadResponseSchema);
}

/** Idempotent: adding a creator already in the list answers the same. Nothing reaches the creator (D45). */
export function addToShortlist(
  id: string,
  alias: string,
): Promise<RelayResult<ShortlistAddResponse>> {
  return callRelay(
    "PUT",
    `${LISTS_PATH}/${id}/items/${alias}`,
    shortlistAddResponseSchema,
  );
}

export function removeFromShortlist(
  id: string,
  alias: string,
): Promise<RelayResult<ShortlistRemoveResponse>> {
  return callRelay(
    "DELETE",
    `${LISTS_PATH}/${id}/items/${alias}`,
    shortlistRemoveResponseSchema,
  );
}

/** The brand's own note on a creator of a list; null clears it. Read by nobody else. */
export function noteShortlistItem(
  id: string,
  alias: string,
  note: string | null,
): Promise<RelayResult<ShortlistNoteResponse>> {
  return callRelay(
    "PUT",
    `${LISTS_PATH}/${id}/items/${alias}/note`,
    shortlistNoteResponseSchema,
    { note },
  );
}

/** The request for a selection by the INFLUX team (RG61): the criteria, the campaign, a message read by agents alone. */
export function requestTeamSelection(
  body: SelectionRequestBody,
): Promise<RelayResult<SelectionRequestResponse>> {
  return callRelay(
    "POST",
    "/v1/me/selection-requests",
    selectionRequestResponseSchema,
    body,
  );
}

// The call of the public document pages (docs/mvp/21 EC-62): GET /v1/terms/current through the
// same-origin relay (src/browser/relay-client.ts), read with the schema of packages/contracts.
// No rule lives here: apps/api chooses the version in force and its language (05 RG25).
import type { UiLocale } from "@influx/contracts/auth";
import {
  currentTermsResponseSchema,
  type CurrentTermsResponse,
  type PublicDocument,
} from "@influx/contracts/terms";
import { callRelay, type RelayResult } from "@/browser/relay-client";

export function readCurrentTerms(
  document: PublicDocument,
  locale: UiLocale,
): Promise<RelayResult<CurrentTermsResponse>> {
  return callRelay(
    "GET",
    "/v1/terms/current",
    currentTermsResponseSchema,
    undefined,
    { document, locale },
  );
}

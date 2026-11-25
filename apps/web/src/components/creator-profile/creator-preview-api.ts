// The call of "ce que voit une marque" (docs/mvp/07 RG104; 17 §5.2; jalons/l2g, commit 14): ONE read,
// through the same-origin relay, answered with the schema of packages/contracts. What the API serves is
// what the screen shows: nothing is added, recomputed or rebuilt here. The account is the session's.
// The pictures come through the portfolio's own route (creator-portfolio-api.ts, readPortfolioImage)
// with the identifiers of the projection.
import {
  creatorPreviewResponseSchema,
  type CreatorPreviewResponse,
} from "@influx/contracts/creator-projection";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

export function readCreatorPreview(): Promise<
  RelayResult<CreatorPreviewResponse>
> {
  return callRelay(
    "GET",
    "/v1/me/creator-profile/preview",
    creatorPreviewResponseSchema,
  );
}

// Calls of block 6 of "mon profil" of a creator, the portfolio (docs/mvp/17 §5.2; 07 RG77 to RG85; jalons/
// l2g, commit 13). Each one goes through the same-origin relay (@influx/web-platform/relay-client) and
// reads the answer with the schema of packages/contracts. No rule lives here: apps/api decides, the
// screen displays. The account is always the session's; the only identifier on a path is the creator's
// own visual. A deposit carries the raw bytes of ONE file, as they are: neither its declared type nor
// its name ever leaves the browser (T9.5).
import {
  portfolioCaptionResponseSchema,
  portfolioImageResponseSchema,
  portfolioRemovalResponseSchema,
  portfolioResponseSchema,
  portfolioUploadResponseSchema,
  type PortfolioCaptionBody,
  type PortfolioCaptionResponse,
  type PortfolioImageResponse,
  type PortfolioRemovalResponse,
  type PortfolioResponse,
  type PortfolioUploadResponse,
} from "@influx/contracts/creator-portfolio";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

const PORTFOLIO_PATH = "/v1/me/creator-profile/portfolio";

export function readPortfolio(): Promise<RelayResult<PortfolioResponse>> {
  return callRelay("GET", PORTFOLIO_PATH, portfolioResponseSchema);
}

/** The deposit: `replaces` names an approved visual of the account the new file stands for (RG81). */
export function uploadPortfolioItem(
  file: Blob,
  replaces: string | null,
): Promise<RelayResult<PortfolioUploadResponse>> {
  return callRelay(
    "PUT",
    PORTFOLIO_PATH,
    portfolioUploadResponseSchema,
    file,
    replaces === null ? undefined : { replaces },
  );
}

/** The placed visuals in the creator's order, each one once (RG84). */
export function orderPortfolio(
  itemIds: readonly string[],
): Promise<RelayResult<PortfolioResponse>> {
  return callRelay("PUT", `${PORTFOLIO_PATH}/order`, portfolioResponseSchema, {
    itemIds,
  });
}

export function savePortfolioCaption(
  itemId: string,
  body: PortfolioCaptionBody,
): Promise<RelayResult<PortfolioCaptionResponse>> {
  return callRelay(
    "PATCH",
    `${PORTFOLIO_PATH}/${itemId}`,
    portfolioCaptionResponseSchema,
    body,
  );
}

export function removePortfolioItem(
  itemId: string,
): Promise<RelayResult<PortfolioRemovalResponse>> {
  return callRelay(
    "DELETE",
    `${PORTFOLIO_PATH}/${itemId}`,
    portfolioRemovalResponseSchema,
  );
}

/** One of the creator's visuals as JSON in base64, never an address (T9.2). */
export function readPortfolioImage(
  itemId: string,
): Promise<RelayResult<PortfolioImageResponse>> {
  return callRelay(
    "GET",
    `${PORTFOLIO_PATH}/${itemId}/image`,
    portfolioImageResponseSchema,
  );
}

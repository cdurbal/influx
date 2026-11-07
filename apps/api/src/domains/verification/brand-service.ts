// The brand's own verification request (docs/mvp/06 RG46, RG47, RG49 to RG52, RG59, CA26 to CA29;
// jalons/l2e commit 15). The state of the badge « Marque vérifiée », and the acts of a brand on its single
// request: save its internal block, open, renew the domain code, submit, cancel.
// - The account is always the session's. A creator, a missing profile and a suspended account are one
//   and the same thing for the database (42501): the API answers them as an address that does not exist
//   (18 T14), never as a refusal that tells them apart.
// - The rules are the database's (0222): CA26 (no domain, no request), RG47 (the block asked at the
//   request), RG23 (one live code), RG14 live in its doors once. This file says WHICH refusal came back,
//   as the code and the issue of the contract, never a value typed by anyone.
// - The internal block (legal name, country, number) goes to its OWNER only: no creator, no Brevo, no
//   Apollo, no log (RG48, invariant 17). It is a field of the answer of the brand's own routes, which
//   TM11 knows by name. The agent's constat (what was observed, who, the comment) never appears here.
// - Filing or withdrawing the request moves the completeness (RG59): the stored score is recomputed
//   after it, as the creator's.
import {
  brandInternalDetailsSchema,
  brandVerificationResponseSchema,
  verificationRequestResponseSchema,
  type BrandInternalDetails,
  type BrandVerificationResponse,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import type { Transaction } from "../../db/index.ts";
import { sqlDetailOf, sqlMessageOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import { refreshStoredScore } from "../profiles/brand-profile.ts";
import {
  cancelOwnBrandRequest,
  openOwnBrandRequest,
  readBrandVerificationInstant,
  readOwnBrandVerification,
  renewOwnBrandCode,
  saveOwnBrandInternalDetails,
  submitOwnBrandRequest,
  type OwnBrandVerificationRow,
} from "./brand/repository.ts";
import { refusalOf } from "./service.ts";

/** The field of the contract each DETAIL of `internal_details_invalid` names (0222). */
const DETAILS_FIELD_OF: Readonly<Record<string, string>> = {
  legal_name: "legalName",
  registration_country_code: "registrationCountryCode",
  registration_number: "registrationNumber",
};

/**
 * The refusal of a brand door as the API answers it: the two blocks the request needs (23514, CA26 and
 * RG47), a field of the internal block the database refuses (22023), else what the creator's doors
 * answer too (42501, 55000 by its DETAIL); the rest unchanged (a 500).
 */
export function brandRefusalOf(error: unknown): unknown {
  const detail = sqlDetailOf(error);
  switch (sqlStateOf(error)) {
    case "23514":
      return detail === "website_domain_required" ||
        detail === "internal_details_required"
        ? new ApiError("conflict", [{ path: "request", issue: detail }])
        : error;
    case "22023": {
      if (sqlMessageOf(error) !== "internal_details_invalid") {
        return error;
      }
      const field = detail === null ? undefined : DETAILS_FIELD_OF[detail];
      return field === undefined
        ? error
        : new RequestValidationError([
            {
              path: field,
              // a country is refused as unknown, never echoed (06 RG46: `reference.countries`)
              issue:
                field === "registrationCountryCode" ? "unknown" : "invalid",
            },
          ]);
    }
    default:
      return refusalOf(error);
  }
}

/** Runs a door of the database: its refusal becomes the answer of the API, what else, unchanged. */
async function through<T>(door: () => Promise<T>): Promise<T> {
  try {
    return await door();
  } catch (error) {
    throw brandRefusalOf(error);
  }
}

function badgeOf(row: OwnBrandVerificationRow) {
  if (row.badgeState === null || row.badgeGrantedAt === null) {
    return null;
  }
  return {
    level: "brand_verified",
    networkCode: null,
    state: row.badgeState,
    grantedAt: row.badgeGrantedAt,
    periodStart: null,
    periodEnd: null,
    // what a brand badge rests on: its domain and a public register (06 RG49), no piece
    evidenceSource: "domain_and_registry",
    expiresAt: row.badgeExpiresAt,
  };
}

function requestOf(row: OwnBrandVerificationRow) {
  if (
    row.requestId === null ||
    row.requestStatus === null ||
    row.requestedAt === null
  ) {
    return null;
  }
  const open = row.requestStatus === "draft" || row.requestStatus === "pending";
  // A refusal, or a closure for an unavailable account (modele §3: `closed` is `account_unavailable`)
  const refused =
    (row.requestStatus === "rejected" || row.requestStatus === "closed") &&
    row.rejectionReasonCode !== null &&
    row.decidedAt !== null;
  return {
    id: row.requestId,
    level: "brand_verified",
    status: row.requestStatus,
    networkCode: null,
    createdAt: row.requestedAt,
    submittedAt: row.submittedAt,
    // the live domain code of an open request only (RG23), to publish in a DNS record or on a page
    code:
      open && row.code !== null && row.codeExpiresAt !== null
        ? { code: row.code, expiresAt: row.codeExpiresAt }
        : null,
    // a brand deposits no piece (EC-L2E-10: the domain and the register are looked at online)
    evidence: [],
    refusal: refused
      ? {
          reasonCode: row.rejectionReasonCode,
          // the agent's own words (`other`), else none: the text of a typed reason is the screen's,
          // drawn from the reason code (EC-L2E-12-2)
          message: row.memberMessage ?? "",
          decidedAt: row.decidedAt,
        }
      : null,
  };
}

function internalDetailsOf(
  row: OwnBrandVerificationRow,
): BrandInternalDetails | null {
  if (
    row.legalName === null ||
    row.registrationCountryCode === null ||
    row.registrationNumber === null
  ) {
    return null;
  }
  return brandInternalDetailsSchema.parse({
    legalName: row.legalName,
    registrationCountryCode: row.registrationCountryCode,
    registrationNumber: row.registrationNumber,
  });
}

/** GET (and the answer of the block): the badge, the latest request and the internal block of the brand. */
export async function readBrandVerification(
  tx: Transaction,
): Promise<BrandVerificationResponse> {
  const asOf = await readBrandVerificationInstant(tx);
  const row = await through(() => readOwnBrandVerification(tx));
  return brandVerificationResponseSchema.parse({
    asOf,
    badge: badgeOf(row),
    request: requestOf(row),
    internalDetails: internalDetailsOf(row),
  });
}

/** What a request act answers: the request as it now stands, and whether this call created it. */
async function answerOf(
  tx: Transaction,
  created: boolean,
): Promise<VerificationRequestResponse> {
  const request = requestOf(await through(() => readOwnBrandVerification(tx)));
  if (request === null) {
    throw new ApiError("not_found");
  }
  return verificationRequestResponseSchema.parse({ request, created });
}

/**
 * PUT …/internal-details: legal name, country and number of registration, asked at the request and
 * never at the creation of the profile (06 RG47); it may be saved at any time, a change during the
 * examination being caught by the review token (EC-L2E-06-7).
 */
export async function saveBrandInternalDetails(
  tx: Transaction,
  details: BrandInternalDetails,
): Promise<BrandVerificationResponse> {
  await through(() => saveOwnBrandInternalDetails(tx, details));
  return readBrandVerification(tx);
}

/**
 * POST …/request: opens the single brand request, its domain code issued with it (06 CA27); no domain,
 * no request (CA26: 409 `website_domain_required`). An open draft comes back as it is (`created` false);
 * a pending one is refused with the date it has been open since (RG14); 24 hours after a refusal and
 * after the third refusal in 30 days are refused with the delay left (RG60).
 */
export async function openBrandRequest(
  tx: Transaction,
): Promise<VerificationRequestResponse> {
  const opened = await through(() => openOwnBrandRequest(tx));
  return answerOf(tx, opened.created);
}

/** POST …/request/code: a new domain code on the draft, the former one revoked in the same transaction (RG23). */
export async function renewBrandCode(
  tx: Transaction,
): Promise<VerificationRequestResponse> {
  await through(() => renewOwnBrandCode(tx));
  return answerOf(tx, false);
}

/**
 * POST …/request/submit: the draft goes to queue 4, only with a domain, its internal block and a live
 * code (CA26, RG47, EC-L2E-06-3). A request FILED counts in the completeness (06 RG59), so the stored
 * score is recomputed once it is in.
 */
export async function submitBrandRequest(
  tx: Transaction,
): Promise<VerificationRequestResponse> {
  await through(() => submitOwnBrandRequest(tx));
  await refreshStoredScore(tx);
  return answerOf(tx, false);
}

/** POST …/request/cancel: before any decision; a request withdrawn no longer counts as filed (RG59). */
export async function cancelBrandRequest(
  tx: Transaction,
): Promise<VerificationRequestResponse> {
  await through(() => cancelOwnBrandRequest(tx));
  await refreshStoredScore(tx);
  return answerOf(tx, false);
}

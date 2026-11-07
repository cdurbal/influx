// The creator's own verification requests (docs/mvp/08 RG11 to RG14, RG21 to RG23, RG56, RG60;
// jalons/l2e commit 12). The state of each network line, and the four acts of a creator on a request:
// open (or take back the draft), renew the code, submit, cancel.
// - The account is always the session's. A line of another creator, a request of another creator and
//   an unknown identifier are one and the same thing for the database (42501): the API answers them as
//   an address that does not exist (18 T14), never as a refusal that tells them apart.
// - The rules are the database's (0222): RG12, RG14, RG23, RG60 live in its doors once. This file says
//   WHICH refusal came back, as the code and the issue of the contract, never a value typed by anyone.
// - A double click has no second effect: opening an open draft returns it, submitting a pending
//   request and cancelling a cancelled one write nothing (the doors say so, `changed` false).
// - The member reads no lock, no agent, no deadline, no comment, no re-examination, no gap, and never
//   the bytes nor the key of a piece (the contract is closed and the reads select granted columns).
import {
  creatorVerificationResponseSchema,
  verificationRequestResponseSchema,
  type CreatorVerificationResponse,
  type OpenVerificationRequestBody,
  type VerificationRefusalIssue,
  type VerificationRequestResponse,
} from "@influx/contracts/verification";
import type { ValidationIssue } from "@influx/contracts/errors";
import type { Transaction } from "../../db/index.ts";
import { sqlDetailOf, sqlMessageOf, sqlStateOf } from "../../db/sql-state.ts";
import {
  ApiError,
  RequestValidationError,
  RetryLaterError,
} from "../../platform/errors.ts";
import { refreshStoredCreatorScore } from "../profiles/creator/profile.ts";
import {
  cancelOwnRequest,
  openOwnRequest,
  readOwnBadges,
  readOwnCurrentRequests,
  readOwnEvidence,
  readOwnLiveCodes,
  readOwnRequest,
  readOwnVerifiableLines,
  readVerificationInstant,
  renewOwnCode,
  submitOwnRequest,
  type OwnCodeRow,
  type OwnEvidenceRow,
  type OwnRequestRow,
} from "./repository.ts";

/** The issues a door says in its DETAIL, besides the two that carry a value (a date, seconds). */
const NAMED_ISSUES: ReadonlySet<string> = new Set<VerificationRefusalIssue>([
  "rejection_cap",
  "ownership_prerequisite",
  "already_verified",
  "request_not_draft",
  "missing_evidence",
  "code_expired",
  "entry_closed",
]);

const INSTANT_DETAIL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const SECONDS_DETAIL = /^\d{1,9}$/;

function conflict(
  issue: VerificationRefusalIssue,
  extra: ValidationIssue[] = [],
) {
  return new ApiError("conflict", [{ path: "request", issue }, ...extra]);
}

/**
 * The refusal of a door as the API answers it, or the error itself (an internal one, 500).
 * - 42501: not his, not there, not a creator: "no such route" (T14).
 * - 55000, by its DETAIL: a date (`duplicate_request`: the request open since that instant, RG14), a
 *   number of seconds (`retry_after`: RG60, 24 hours after a refusal; the seconds go in Retry-After
 *   and nowhere else), or the name of the issue. No DETAIL and the message `duplicate_request`: the
 *   triplet was opened in the meantime by another request.
 * - 22023: `level`, a renewal asked on an audience request.
 */
export function refusalOf(error: unknown): unknown {
  switch (sqlStateOf(error)) {
    case "42501":
      return new ApiError("not_found");
    case "55000": {
      const detail = sqlDetailOf(error);
      if (detail !== null && INSTANT_DETAIL.test(detail)) {
        // the date is the member's own: when his request was submitted
        return conflict("duplicate_request", [
          { path: "submittedAt", issue: detail },
        ]);
      }
      if (detail !== null && SECONDS_DETAIL.test(detail)) {
        return new RetryLaterError("conflict", Number(detail), [
          { path: "request", issue: "retry_after" },
        ]);
      }
      if (detail !== null && NAMED_ISSUES.has(detail)) {
        return conflict(detail as VerificationRefusalIssue);
      }
      return sqlMessageOf(error) === "duplicate_request"
        ? conflict("duplicate_request")
        : error;
    }
    case "22023":
      return sqlDetailOf(error) === "level"
        ? new RequestValidationError([
            { path: "level", issue: "invalid_level" },
          ])
        : error;
    default:
      return error;
  }
}

/** Runs a door of the database: its refusal becomes the answer of the API, what else, unchanged. */
async function through<T>(door: () => Promise<T>): Promise<T> {
  try {
    return await door();
  } catch (error) {
    throw refusalOf(error);
  }
}

function requestViewOf(
  row: OwnRequestRow,
  codes: readonly OwnCodeRow[],
  evidence: readonly OwnEvidenceRow[],
) {
  const code =
    (row.status === "draft" || row.status === "pending") &&
    row.level === "account_verified"
      ? codes.find((candidate) => candidate.requestId === row.id)
      : undefined;
  // A refusal, or a closure for an unavailable account (modele §3: `closed` is `account_unavailable`)
  const refused =
    (row.status === "rejected" || row.status === "closed") &&
    row.rejectionReasonCode !== null &&
    row.decidedAt !== null;
  return {
    id: row.id,
    level: row.level,
    status: row.status,
    networkCode: row.networkCode,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    code:
      code === undefined
        ? null
        : { code: code.code, expiresAt: code.expiresAt },
    evidence: evidence
      .filter((piece) => piece.requestId === row.id)
      .map((piece) => ({
        id: piece.id,
        state: piece.state,
        createdAt: piece.createdAt,
        width: piece.width,
        height: piece.height,
        byteSize: piece.byteSize,
      })),
    refusal: refused
      ? {
          reasonCode: row.rejectionReasonCode,
          // The agent's own words (`other`, `terms_breach`), else none: the text of a typed reason is
          // the screen's, drawn from the reason code (EC-L2E-12-2, the translated text arrives with
          // the e-mail texts of commit 16, read from the same file).
          message: row.memberMessage ?? "",
          decidedAt: row.decidedAt,
        }
      : null,
  };
}

/** GET: the creator's lines, network by network (08 RG13): badges obtained and requests in course. */
export async function readCreatorVerification(
  tx: Transaction,
): Promise<CreatorVerificationResponse> {
  const asOf = await readVerificationInstant(tx);
  const lines = await readOwnVerifiableLines(tx);
  const badges = await readOwnBadges(tx);
  const requests = await readOwnCurrentRequests(tx);
  const codes = await readOwnLiveCodes(tx);
  const evidence = await readOwnEvidence(tx);
  return creatorVerificationResponseSchema.parse({
    asOf,
    lines: lines.map((line) => ({
      networkCode: line.networkCode,
      badges: badges
        .filter((badge) => badge.socialAccountId === line.id)
        .map((badge) => ({
          level: badge.level,
          networkCode: badge.networkCode,
          state: badge.state,
          grantedAt: badge.grantedAt,
          periodStart: badge.periodStart,
          periodEnd: badge.periodEnd,
          evidenceSource: badge.evidenceSource,
          expiresAt: badge.expiresAt,
        })),
      requests: requests
        .filter((request) => request.socialAccountId === line.id)
        .map((request) => requestViewOf(request, codes, evidence)),
    })),
  });
}

/** What a write answers: the request as it now stands, and whether this call created it. */
export async function answerOf(
  tx: Transaction,
  requestId: string,
  created: boolean,
): Promise<VerificationRequestResponse> {
  const row = await readOwnRequest(tx, requestId);
  if (row === null) {
    throw new ApiError("not_found");
  }
  const request = requestViewOf(
    row,
    await readOwnLiveCodes(tx),
    await readOwnEvidence(tx),
  );
  return verificationRequestResponseSchema.parse({ request, created });
}

/**
 * POST …/requests: opens the request of (line, level), the line named by its network. A draft already
 * open comes back as it is (`created` false); a pending one is refused with the date it has been open
 * since (RG14); 24 hours after a refusal and after the third refusal in 30 days are refused with the
 * delay left and the cap (RG60, CA37, CA38). A network the creator has no line on is an unknown one.
 */
export async function openCreatorRequest(
  tx: Transaction,
  body: OpenVerificationRequestBody,
): Promise<VerificationRequestResponse> {
  const line = (await readOwnVerifiableLines(tx)).find(
    (candidate) => candidate.networkCode === body.networkCode,
  );
  if (line === undefined) {
    throw new ApiError("not_found");
  }
  const opened = await through(() => openOwnRequest(tx, line.id, body.level));
  return answerOf(tx, opened.requestId, opened.created);
}

/** POST …/code: a new code on the draft, the former one revoked in the same transaction (RG23, CA12). */
export async function renewCreatorCode(
  tx: Transaction,
  requestId: string,
): Promise<VerificationRequestResponse> {
  await through(() => renewOwnCode(tx, requestId));
  return answerOf(tx, requestId, false);
}

/**
 * POST …/submit: the draft goes to the queue. The completeness counts a request FILED (07 RG88), so
 * the stored score is recomputed here, once the request is in.
 */
export async function submitCreatorRequest(
  tx: Transaction,
  requestId: string,
): Promise<VerificationRequestResponse> {
  await through(() => submitOwnRequest(tx, requestId));
  await refreshStoredCreatorScore(tx);
  return answerOf(tx, requestId, false);
}

/** POST …/cancel: before any decision; a request withdrawn no longer counts as filed (RG88). */
export async function cancelCreatorRequest(
  tx: Transaction,
  requestId: string,
): Promise<VerificationRequestResponse> {
  await through(() => cancelOwnRequest(tx, requestId));
  await refreshStoredCreatorScore(tx);
  return answerOf(tx, requestId, false);
}

// What the decision screen of a creator's verification request decides to show and to send, computed from
// the answers of apps/api (docs/mvp/08 RG43 to RG55, RG56 to RG59, CA25 to CA33; 17b §3.7; jalons/l2e/
// modele.md §4, -19; L2E-22). Pure functions, outside the components: the mode of the screen, its banners,
// the draft of what the agent TYPES (never pre-filled, CA25), the checks of the bodies, what a refused call
// means, the comparison table. No rule is decided here: the database says who holds the request, which
// version a decision binds, which reasons exist, whether a period or a code is acceptable; the gap alert
// comes from apps/api. This module words, gathers and parses what was typed.
import type {
  CompareFiguresRequest,
  CompareFiguresResponse,
  GrantAccountRequest,
  GrantAudienceRequest,
  GrantBrandRequest,
  ObservedFigures,
  ReexamineVerificationRequest,
  RejectVerificationRequest,
  VerificationOpenResponse,
  VerificationReasonRow,
  VerificationRegistrySourceRow,
} from "@influx/contracts/verification";
import {
  BRAND_OBSERVED_CHANNELS,
  VERIFICATION_REEXAMINE_REASON_CODES,
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { messages } from "@/messages/fr";
import { durationWords, minutesBetween } from "./queue-view-model";
import { REMIND_BEFORE_MS, type Banner } from "./queue-review-view";
import { networkWords } from "./verification-queue-view";
import { failureOf, formatDateTime, formatDay, formatTime } from "./view-model";

type ReexamineReasonCode = ReexamineVerificationRequest["reasonCode"];

const t = messages.verificationReview;
const queue = messages.verificationQueue;

export type { Banner };

/** The three ways the screen can be: it decides, it reads, or the request is no longer in the queue. */
export type VerificationMode = "deciding" | "readOnly" | "closed";

export function modeOf(view: VerificationOpenResponse): VerificationMode {
  if (view.entry.status !== "pending" || view.outcome === "closed") {
    return "closed";
  }
  return view.outcome === "read_only" || view.reviewToken === null
    ? "readOnly"
    : "deciding";
}

/** The level of the request is the one the screen decides: account or audience for a creator. */
export function isAudience(view: VerificationOpenResponse): boolean {
  return view.entry.level === "audience_verified";
}

/** A brand's request, « Marque vérifiée » (06 RG49 to RG52): a screen of its own, none in common with the creator's (RG61). */
export function isBrand(view: VerificationOpenResponse): boolean {
  return view.entry.level === "brand_verified";
}

/** The member the decision speaks to: the words of the refusal and of the notices follow it. */
export type Who = "creator" | "brand";

export function whoOf(view: VerificationOpenResponse): Who {
  return isBrand(view) ? "brand" : "creator";
}

export function levelName(level: VerificationOpenResponse["entry"]["level"]) {
  return queue.levels[level];
}

export function titleOf(view: VerificationOpenResponse): string {
  if (isBrand(view)) {
    return t.titleBrand(view.dossier?.brand?.tradeName ?? t.unset);
  }
  return t.titleCreator(
    networkWords(view.entry.networkCode),
    levelName(view.entry.level),
  );
}

// --- Banners and the delay of the claim (08 RG64; file.md A9) -------------------------------------

export function claimBanner(view: VerificationOpenResponse): Banner | null {
  const mode = modeOf(view);
  if (mode === "closed") {
    return null;
  }
  const { claim } = view.entry;
  const banner = messages.queueReview.banner;
  if (mode === "deciding") {
    return {
      tone: "info",
      lines: [banner.byMe(formatTime(claim.claimedAt ?? view.asOf))],
    };
  }
  const name = claim.holder?.displayName ?? null;
  return {
    tone: "info",
    lines: [
      name === null || claim.claimedAt === null
        ? banner.byOtherUnknown
        : banner.byOther(name, formatTime(claim.claimedAt)),
      banner.readOnly,
    ],
  };
}

export function overdueBanner(view: VerificationOpenResponse): Banner | null {
  if (view.entry.status !== "pending" || !view.entry.overdue) {
    return null;
  }
  const since = durationWords(minutesBetween(view.entry.slaDueAt, view.asOf));
  const banner = messages.queueReview.banner;
  return {
    tone: "alert",
    lines: [
      modeOf(view) === "deciding"
        ? banner.overdue(since)
        : banner.overdueRead(since),
    ],
  };
}

/** The notice of a claim an administrator lifted (08 RG64): told at the next opening. */
export function forcedReleaseNotice(
  view: VerificationOpenResponse,
): string | null {
  const lifted = view.entry.lastForcedRelease;
  if (lifted === null || !lifted.holderIsCaller || modeOf(view) === "closed") {
    return null;
  }
  const reasons = messages.queueReview.force.reasons as Readonly<
    Record<string, string>
  >;
  const banner = messages.queueReview.banner;
  return banner.forcedRelease(
    lifted.releasedBy?.displayName ?? banner.forcedReleaseUnknown,
    formatTime(lifted.releasedAt),
    (reasons[lifted.reasonCode] ?? lifted.reasonCode).toLowerCase(),
  );
}

export function loggedLine(
  view: VerificationOpenResponse,
  fallbackName: string,
): string {
  const holder = view.entry.claim.heldByCaller
    ? view.entry.claim.holder?.displayName
    : null;
  return messages.queueReview.loggedLine(
    holder ?? fallbackName,
    formatDateTime(view.asOf),
  );
}

export type Expiry =
  | { kind: "none" }
  | { kind: "ok" }
  | { kind: "soon"; minutes: number }
  | { kind: "expired" };

export function expiryOf(
  view: VerificationOpenResponse,
  nowMs: number,
  offsetMs: number,
): Expiry {
  const { claimExpiresAt } = view.entry.claim;
  if (modeOf(view) !== "deciding" || claimExpiresAt === null) {
    return { kind: "none" };
  }
  const left = Date.parse(claimExpiresAt) - (nowMs + offsetMs);
  if (left <= 0) {
    return { kind: "expired" };
  }
  return left <= REMIND_BEFORE_MS
    ? { kind: "soon", minutes: Math.max(1, Math.ceil(left / 60_000)) }
    : { kind: "ok" };
}

/** The same view with the new expiry of the caller's claim (after an extension). */
export function withClaimExpiry(
  view: VerificationOpenResponse,
  claimExpiresAt: string,
): VerificationOpenResponse {
  return {
    ...view,
    entry: { ...view.entry, claim: { ...view.entry.claim, claimExpiresAt } },
  };
}

// --- A request that left the queue (08 RG61) ------------------------------------------------------

export function reasonLabel(code: string): string {
  return t.decision.reasonLabels[code] ?? code;
}

/** What a closed request says: how it ended, by whom, the reason and the text added for the creator. */
export function closedLines(view: VerificationOpenResponse): string[] {
  const { entry } = view;
  const c = t.closed;
  const lines: string[] = [
    entry.decision?.status === "approved"
      ? c.approved
      : entry.decision?.status === "rejected"
        ? c.rejected
        : entry.decision?.status === "closed"
          ? c.closed
          : c.other,
  ];
  const { decision } = entry;
  if (decision !== null) {
    lines.push(
      decision.decidedBy === null
        ? c.decidedAt(formatDateTime(decision.decidedAt))
        : c.decidedBy(
            decision.decidedBy.displayName ??
              messages.queueReview.banner.forcedReleaseUnknown,
            formatDateTime(decision.decidedAt),
          ),
    );
    if (decision.late) {
      lines.push(c.late);
    }
    if (decision.reasonCode !== null) {
      lines.push(c.reason(reasonLabel(decision.reasonCode)));
    }
  }
  return lines;
}

// --- The dossier in words -------------------------------------------------------------------------

/**
 * The profile link of the dossier, only when it is an https address whose authority is plain (the shape
 * the database holds since 0220, L2DS-1, held again here before a creator-supplied address becomes a link
 * an agent clicks). Anything else is no link: the identifier stays readable as text.
 */
export function profileLinkOf(url: string | null): string | null {
  if (url === null) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    !/^[A-Za-z0-9.-]+(:[0-9]{1,5})?$/.test(parsed.host) ||
    url.includes("\\")
  ) {
    return null;
  }
  return parsed.href;
}

export function badgeLine(
  badge: NonNullable<VerificationOpenResponse["dossier"]>["badges"][number],
  network: string | null,
): string {
  const line = t.badges.line(
    levelName(badge.level),
    network,
    t.badges.states[badge.state],
    formatDateTime(badge.grantedAt),
  );
  return badge.expiresAt === null
    ? line
    : `${line} · ${t.badges.expires(formatDateTime(badge.expiresAt))}`;
}

export function alertLine(
  alert: NonNullable<VerificationOpenResponse["dossier"]>["alerts"][number],
): string {
  switch (alert.code) {
    case "prior_rejections":
      return t.alerts.prior_rejections(alert.count);
    case "same_handle_elsewhere":
      return t.alerts.same_handle_elsewhere(alert.accounts);
    case "handle_verified_elsewhere":
      return t.alerts.handle_verified_elsewhere;
  }
}

export function reexamineMarkLine(
  view: VerificationOpenResponse,
): string | null {
  const mark = view.entry.reexamine;
  return mark === null
    ? null
    : t.reexamineMark(
        queue.reexamineReasons[mark.reasonCode],
        formatDateTime(mark.reexaminedAt),
      );
}

// --- What the agent types (CA25: nothing is pre-filled, nothing is copied from the declared) ------------

export type FieldName =
  | "handle"
  | "code"
  | "domain"
  | "channel"
  | "registry"
  | "followers"
  | "period"
  | "posts"
  | "comments"
  | "engagement"
  | "reason"
  | "memberMessage"
  | "internalComment"
  | "stop"
  | "reexamine";

export type Problem = { field: FieldName | null; text: string };

/** Kept across every error, reload of the dossier and closed panel (08 RG116): the typed text is never lost. */
export type Draft = {
  handle: string;
  code: string;
  /** A brand: the domain where the code was read, the way it was published, the register consulted. */
  domain: string;
  channel: GrantBrandRequest["observedChannel"] | null;
  registrySourceId: string | null;
  followers: string;
  periodStart: string;
  periodEnd: string;
  posts: string;
  comments: string;
  engagement: string;
  internalComment: string;
  reasonCode: VerificationReasonRow["code"] | null;
  memberMessage: string;
  stopConfirmed: boolean;
  reexamineCode: ReexamineReasonCode | null;
};

export const EMPTY_DRAFT: Draft = {
  handle: "",
  code: "",
  domain: "",
  channel: null,
  registrySourceId: null,
  followers: "",
  periodStart: "",
  periodEnd: "",
  posts: "",
  comments: "",
  engagement: "",
  internalComment: "",
  reasonCode: null,
  memberMessage: "",
  stopConfirmed: false,
  reexamineCode: null,
};

/**
 * What giving the request back asks first (L2EU-7): the work typed on the screen (identifier, figures,
 * period, code, comment) lives nowhere else, so a gesture that would drop it opens a confirmation, and
 * an untouched screen gives the request back at once. The screen keeps nothing, hence the comparison
 * with the empty draft.
 */
export function releaseStepOf(draft: Draft): "confirm" | "release" {
  const keys = Object.keys(EMPTY_DRAFT) as (keyof Draft)[];
  return keys.some((key) => draft[key] !== EMPTY_DRAFT[key])
    ? "confirm"
    : "release";
}

export type Checked<Body> =
  { ok: true; body: Body } | { ok: false; problem: Problem };

function fail(field: FieldName, text: string): { ok: false; problem: Problem } {
  return { ok: false, problem: { field, text } };
}

/** A whole number typed by a person: digits, the spaces of a thousands separator allowed; never a sign nor a decimal. */
export function parseCount(text: string): number | null {
  const digits = text.replace(/[\s  ]/g, "");
  if (!/^\d{1,15}$/.test(digits)) {
    return null;
  }
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : null;
}

/** A percentage typed by a person ("12,5", "12.5", "8"), 0 to 100, two decimals at most, as basis points. */
export function parsePercentAsBasisPoints(text: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (match === null) {
    return null;
  }
  const whole = Number(match[1]);
  const hundredths = Number((match[2] ?? "").padEnd(2, "0"));
  const basisPoints = whole * 100 + hundredths;
  return basisPoints <= 10_000 ? basisPoints : null;
}

/** An ISO day typed in a date field ("2026-11-03"); a field that holds anything else is empty for the screen. */
function dayOf(text: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/** The three figures, the facultative engagement and the period, as typed (08 RG38, RG38bis). */
function figuresCheck(draft: Draft): Checked<ObservedFigures> {
  const followers = parseCount(draft.followers);
  if (followers === null) {
    return fail("followers", t.problems.followers);
  }
  const posts = parseCount(draft.posts);
  if (posts === null) {
    return fail("posts", t.problems.posts);
  }
  const comments = parseCount(draft.comments);
  if (comments === null) {
    return fail("comments", t.problems.comments);
  }
  let engagementBp: number | null = null;
  if (draft.engagement.trim() !== "") {
    engagementBp = parsePercentAsBasisPoints(draft.engagement);
    if (engagementBp === null) {
      return fail("engagement", t.problems.engagement);
    }
  }
  return {
    ok: true,
    body: {
      followers,
      postsLast30Days: posts,
      avgComments: comments,
      engagementBp,
    },
  };
}

export function commentOf(draft: Draft): Checked<string | null> {
  const comment = draft.internalComment.trim();
  if (comment.length > VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH) {
    return fail("internalComment", t.decision.commentTooLong);
  }
  return { ok: true, body: comment === "" ? null : comment };
}

export function handleOf(draft: Draft): Checked<string> {
  const handle = draft.handle.trim();
  if (handle === "") {
    return fail("handle", t.problems.handle);
  }
  if (handle.length > VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH) {
    return fail("handle", t.problems.handleInvalid);
  }
  return { ok: true, body: handle };
}

const CODE_SHAPE = /^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

/** `grant-account`: the handle and the code the agent read, as typed; the database compares the code (CA13, CA14). */
export function accountGrantCheck(
  draft: Draft,
  reviewToken: string,
): Checked<GrantAccountRequest> {
  const handle = handleOf(draft);
  if (!handle.ok) {
    return handle;
  }
  const code = draft.code.trim();
  if (code === "") {
    return fail("code", t.problems.code);
  }
  if (!CODE_SHAPE.test(code)) {
    return fail("code", t.problems.codeShape);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      reviewToken,
      observedCode: code,
      observedHandle: handle.body,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

/** The domain as the contract takes it: lower case, letters, digits, dots and hyphens, 3 to 100 signs. */
const DOMAIN_SHAPE = /^[a-z0-9.-]{3,100}$/;

/**
 * `grant` of a brand (06 RG49 to RG52, CA28): the domain where the agent read the code, the way it was
 * published, the code as read, and the register he consulted, chosen among the sources the dossier served
 * (never typed: RG52, D79 (12)). The database compares the code, the domain and the source.
 */
export function brandGrantCheck(
  draft: Draft,
  reviewToken: string,
  sources: readonly VerificationRegistrySourceRow[],
): Checked<GrantBrandRequest> {
  const domain = draft.domain.trim().toLowerCase();
  if (domain === "") {
    return fail("domain", t.brand.problems.domain);
  }
  if (!DOMAIN_SHAPE.test(domain)) {
    return fail("domain", t.brand.problems.domainShape);
  }
  const channel = BRAND_OBSERVED_CHANNELS.find(
    (candidate) => candidate === draft.channel,
  );
  if (channel === undefined) {
    return fail("channel", t.brand.problems.channel);
  }
  const code = draft.code.trim();
  if (code === "") {
    return fail("code", t.brand.problems.code);
  }
  if (!CODE_SHAPE.test(code)) {
    return fail("code", t.problems.codeShape);
  }
  if (sources.length === 0) {
    return fail("registry", t.brand.problems.noSource);
  }
  const source = sources.find(
    (candidate) => candidate.id === draft.registrySourceId,
  );
  if (source === undefined) {
    return fail("registry", t.brand.problems.registry);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      reviewToken,
      observedCode: code,
      observedDomain: domain,
      observedChannel: channel,
      registrySourceId: source.id,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

/** A register of the dossier in one line: its name, what kind it is, the day its page was last checked. */
export function registrySourceWords(source: {
  name: string;
  sourceType: VerificationRegistrySourceRow["sourceType"];
  checkedOn: string;
}): string {
  return t.brand.source.line(
    source.name,
    t.brand.source.types[source.sourceType],
    formatDay(source.checkedOn),
  );
}

/** The link of a register: the same plain https address as a profile's, opened in a new window with no referrer. */
export function registryLinkOf(url: string): string | null {
  return profileLinkOf(url);
}

/**
 * The reasons about a piece of evidence or about the coherence of the pieces: a request for « Compte
 * vérifié » holds no piece (the code is read on the public profile, never from a capture, CA14), so the
 * refusal of an ownership does not offer them (L2E-25). `evidence_suspected_forgery` stays (08 RG59).
 */
const PIECE_REASON_CODES: ReadonlySet<string> = new Set([
  "missing_evidence",
  "evidence_too_old",
  "evidence_unreadable",
  "evidence_wrong_source",
  "evidence_too_wide",
  "evidence_inconsistent",
]);

/**
 * The reasons the agent can pick for a refusal, from the closed list the opening returned: on the
 * ownership of an account, those about a piece are left out, and `rejectCheck` refuses a code that is not
 * in what this returns. The database still holds the whole list; nothing here adds a reason.
 */
export function rejectionReasonsOf(
  view: VerificationOpenResponse,
): readonly VerificationReasonRow[] {
  return view.entry.level === "account_verified"
    ? view.reasons.filter((reason) => !PIECE_REASON_CODES.has(reason.code))
    : view.reasons;
}

/** The reasons of the « à réexaminer » mark a request of this level may carry (the database holds one closed list). */
export function reexamineReasonsOf(
  view: VerificationOpenResponse,
): readonly ReexamineReasonCode[] {
  return isBrand(view)
    ? ["registry_unavailable", "network_unreachable"]
    : VERIFICATION_REEXAMINE_REASON_CODES;
}

/** The period typed, both days required and in order; whether it is fresh is the database's (RG37, RG100). */
function periodCheck(
  draft: Draft,
): Checked<{ periodStart: string; periodEnd: string }> {
  const periodStart = dayOf(draft.periodStart);
  const periodEnd = dayOf(draft.periodEnd);
  if (periodStart === null || periodEnd === null) {
    return fail("period", t.problems.period);
  }
  if (periodStart > periodEnd) {
    return fail("period", t.problems.periodOrder);
  }
  return { ok: true, body: { periodStart, periodEnd } };
}

/** `compare`: the figures typed, nothing else; the declared ones come back after (modele -19). */
export function compareCheck(
  draft: Draft,
  reviewToken: string,
): Checked<CompareFiguresRequest> {
  const figures = figuresCheck(draft);
  if (!figures.ok) {
    return figures;
  }
  return { ok: true, body: { reviewToken, ...figures.body } };
}

/** `grant-audience`: the handle, the figures and the period, as typed (08 RG36 to RG38bis, CA27). */
export function audienceGrantCheck(
  draft: Draft,
  reviewToken: string,
): Checked<GrantAudienceRequest> {
  const handle = handleOf(draft);
  if (!handle.ok) {
    return handle;
  }
  const figures = figuresCheck(draft);
  if (!figures.ok) {
    return figures;
  }
  const period = periodCheck(draft);
  if (!period.ok) {
    return period;
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body: {
      reviewToken,
      ...figures.body,
      ...period.body,
      observedHandle: handle.body,
      ...(comment.body === null ? {} : { internalComment: comment.body }),
    },
  };
}

/** The reason is `minor`: everything stops, and the agent confirms it (08 RG54, RG59). */
export function stopsEverything(reason: VerificationReasonRow): boolean {
  return reason.code === "minor";
}

/**
 * The refusal as the API takes it. The reason must be of the closed list the opening returned; the text
 * for the creator is for the reasons that ask for it, and only theirs (the database refuses the others);
 * the lengths are the contract's, the contact detector is the server's.
 */
export function rejectCheck(
  draft: Draft,
  reasons: readonly VerificationReasonRow[],
  reviewToken: string,
  who: Who = "creator",
): Checked<RejectVerificationRequest> {
  const reason = reasons.find(
    (candidate) => candidate.code === draft.reasonCode,
  );
  if (reason === undefined) {
    return fail("reason", t.decision.reasonRequired);
  }
  if (stopsEverything(reason) && !draft.stopConfirmed) {
    return fail("stop", t.decision.stopRequired);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  const body: RejectVerificationRequest = {
    reviewToken,
    reasonCode: reason.code,
    ...(comment.body === null ? {} : { internalComment: comment.body }),
  };
  if (!reason.requiresMemberMessage) {
    return { ok: true, body };
  }
  const message = draft.memberMessage.trim();
  if (message.length < VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH) {
    return fail(
      "memberMessage",
      who === "brand"
        ? t.brand.decision.messageTooShort
        : t.decision.messageTooShort,
    );
  }
  if (message.length > VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH) {
    return fail(
      "memberMessage",
      who === "brand"
        ? t.brand.decision.messageTooLong
        : t.decision.messageTooLong,
    );
  }
  return { ok: true, body: { ...body, memberMessage: message } };
}

export function reexamineCheck(
  draft: Draft,
  reviewToken: string,
): Checked<ReexamineVerificationRequest> {
  if (draft.reexamineCode === null) {
    return fail("reexamine", t.decision.reexamineRequired);
  }
  return { ok: true, body: { reviewToken, reasonCode: draft.reexamineCode } };
}

/** What the creator will read for the reason picked: its sentence, the agent's own text when it has one, what to do next. */
export function messagePreview(
  reason: VerificationReasonRow,
  draft: Draft,
): { paragraphs: string[]; nextStep: string } {
  const paragraphs = [reason.message];
  if (reason.requiresMemberMessage) {
    const own = draft.memberMessage.trim();
    if (own !== "") {
      paragraphs.push(own);
    }
  }
  return { paragraphs, nextStep: reason.nextStep ?? t.decision.nextStepNone };
}

/** The figures typed, in one line of the recap of the grant (no judgment: what the agent typed). */
export function figuresRecap(draft: Draft): string {
  const figures = (value: string) => {
    const count = parseCount(value);
    return count === null ? value : count.toLocaleString("fr-FR");
  };
  return t.decision.figuresLine(
    figures(draft.followers),
    figures(draft.posts),
    figures(draft.comments),
    dayOf(draft.periodStart) === null
      ? draft.periodStart
      : formatDay(draft.periodStart),
    dayOf(draft.periodEnd) === null
      ? draft.periodEnd
      : formatDay(draft.periodEnd),
  );
}

// --- The comparison, shown after the typing only (08 RG41, RG42, RG48; modele -19) ----------------------

export type ComparisonRow = {
  key: keyof typeof t.comparison.figures;
  figure: string;
  declared: string;
  observed: string;
  gap: string;
};

function countWords(value: number): string {
  return value.toLocaleString("fr-FR");
}

function percentWords(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

/** The gap of one figure: the subtraction, observed minus declared (08 RG41); the alert is the server's. */
function gapWords(
  declared: number | null,
  observed: number,
  asPoints: boolean,
): string {
  if (declared === null) {
    return t.comparison.notDeclared;
  }
  const difference = observed - declared;
  if (difference === 0) {
    return t.comparison.noGap;
  }
  const sign = difference > 0 ? "+" : "−";
  return asPoints
    ? `${sign}${(Math.abs(difference) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} pt`
    : `${sign}${countWords(Math.abs(difference))}`;
}

export function comparisonRows(
  typed: ObservedFigures,
  comparison: CompareFiguresResponse,
): ComparisonRow[] {
  const { declared } = comparison;
  const figure = (
    key: ComparisonRow["key"],
    declaredValue: number | null,
    observedValue: number | null,
    asPercent: boolean,
  ): ComparisonRow => ({
    key,
    figure: t.comparison.figures[key],
    declared:
      declaredValue === null
        ? t.comparison.notDeclared
        : asPercent
          ? percentWords(declaredValue)
          : countWords(declaredValue),
    observed:
      observedValue === null
        ? t.comparison.notTyped
        : asPercent
          ? percentWords(observedValue)
          : countWords(observedValue),
    gap:
      observedValue === null
        ? t.comparison.notTyped
        : gapWords(declaredValue, observedValue, asPercent),
  });
  return [
    figure("followers", declared.followers, typed.followers, false),
    figure(
      "postsLast30Days",
      declared.postsLast30Days,
      typed.postsLast30Days,
      false,
    ),
    figure("avgComments", declared.avgComments, typed.avgComments, false),
    figure("engagementBp", declared.engagementBp, typed.engagementBp, true),
  ];
}

// --- What a refused call means --------------------------------------------------------------------

export type ReopenWhy =
  "heldByOther" | "lifted" | "notHeld" | "stale" | "closed";

export type Refusal =
  | { kind: "signedOut" }
  | { kind: "reopen"; why: ReopenWhy }
  | { kind: "text"; text: string; field: FieldName | null };

const REOPEN_BY_ISSUE: Readonly<Record<string, ReopenWhy>> = {
  held_by_other: "heldByOther",
  claim_lifted: "lifted",
  claim_not_held: "notHeld",
  stale_token: "stale",
  entry_closed: "closed",
};

const PERIOD_ISSUES: ReadonlySet<string> = new Set([
  "period_missing",
  "period_order",
  "period_future",
  "period_too_old",
]);

const CONFLICT_TEXT: Readonly<Record<string, string>> = {
  account_unavailable: t.notices.accountUnavailable,
  no_registry_source: t.brand.problems.noSourceRefused,
  website_domain_required: t.brand.problems.domainRequired,
  internal_details_required: t.brand.problems.detailsRequired,
  ownership_prerequisite: t.problems.prerequisite,
  missing_evidence: t.problems.missingEvidence,
  declared_figures_required: t.problems.declaredFigures,
};

/**
 * Apps/api's answer to a decision, an extension or a release, in what the screen does about it. Lost
 * claim, stale version, closed request: read the dossier again (POST …/open) and say why; the typed text
 * is never lost. A Storage that does not answer is the 503 `decision_blocked` of the piece.
 */
export function refusalOf(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
  who: Who = "creator",
): Refusal {
  if (result.kind === "unauthenticated") {
    return { kind: "signedOut" };
  }
  const issues = result.issues ?? [];
  switch (result.code) {
    case "conflict": {
      for (const [issue, why] of Object.entries(REOPEN_BY_ISSUE)) {
        if (issues.includes(issue)) {
          return { kind: "reopen", why };
        }
      }
      for (const [issue, text] of Object.entries(CONFLICT_TEXT)) {
        if (issues.includes(issue)) {
          return { kind: "text", text, field: null };
        }
      }
      break;
    }
    case "forbidden":
      return {
        kind: "text",
        text: issues.includes("conflict_of_interest")
          ? t.errors.conflictOfInterest
          : messages.failure.forbidden,
        field: null,
      };
    case "validation_failed":
      if (issues.includes("code_mismatch")) {
        return {
          kind: "text",
          text:
            who === "brand"
              ? t.brand.problems.codeMismatch
              : t.problems.codeMismatch,
          field: "code",
        };
      }
      if (issues.includes("invalid_observed_domain")) {
        return {
          kind: "text",
          text: t.brand.problems.domainRefused,
          field: "domain",
        };
      }
      if (issues.includes("invalid_observed_channel")) {
        return {
          kind: "text",
          text: t.brand.problems.channel,
          field: "channel",
        };
      }
      if (issues.includes("direct_contact")) {
        return {
          kind: "text",
          text: t.decision.directContact,
          field: "memberMessage",
        };
      }
      if (issues.includes("invalid_reason")) {
        return {
          kind: "text",
          text: t.decision.invalidReason,
          field: "reason",
        };
      }
      if (issues.includes("invalid_member_message")) {
        return {
          kind: "text",
          text:
            who === "brand"
              ? t.brand.decision.invalidMessage
              : t.decision.invalidMessage,
          field: "memberMessage",
        };
      }
      if (issues.includes("invalid_internal_comment")) {
        return {
          kind: "text",
          text: t.decision.invalidComment,
          field: "internalComment",
        };
      }
      if (issues.includes("invalid_observed_handle")) {
        return {
          kind: "text",
          text: t.problems.handleInvalid,
          field: "handle",
        };
      }
      if (issues.some((issue) => PERIOD_ISSUES.has(issue))) {
        return {
          kind: "text",
          text: t.problems.periodRefused,
          field: "period",
        };
      }
      if (issues.includes("figures_invalid")) {
        return { kind: "text", text: t.problems.figuresRefused, field: null };
      }
      break;
    default:
      break;
  }
  const generic = failureOf(result);
  return {
    kind: "text",
    text:
      generic === "reauth" || generic === "signedOut"
        ? messages.failure.unavailable
        : generic,
    field: null,
  };
}

/** The sentence of a request that cannot be opened (a 403, a 404, a failure); no retry for the first two. */
export function openFailure(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
): { text: string; retry: boolean } | "signedOut" {
  if (result.kind === "unauthenticated") {
    return "signedOut";
  }
  if (result.code === "forbidden") {
    return {
      text: (result.issues ?? []).includes("conflict_of_interest")
        ? t.errors.conflictOfInterest
        : t.errors.forbidden,
      retry: false,
    };
  }
  if (result.code === "not_found") {
    return { text: t.errors.notFound, retry: false };
  }
  return { text: t.errors.unavailable, retry: true };
}

/** Storage that does not answer for a piece: the 503 `decision_blocked` (D82 (5)), not a failed piece. */
export function isDecisionBlocked(
  result: Exclude<RelayResult<unknown>, { kind: "ok" }>,
): boolean {
  return (
    result.kind === "failed" &&
    result.code === "service_unavailable" &&
    (result.issues ?? []).includes("decision_blocked")
  );
}

export function reopenNotice(why: ReopenWhy): string {
  return t.notices[why];
}

// --- The exit (17b §2.6) ---------------------------------------------------------------------------

/** The confirmation that stays above the next request: what was decided, in a sentence. */
export function grantedNotice(
  view: VerificationOpenResponse,
  outcome: "granted" | "handle_already_verified",
  late: boolean,
): string[] {
  const network = networkWords(view.entry.networkCode);
  const lines =
    outcome === "granted"
      ? [
          isBrand(view)
            ? t.brand.decision.grantedNotice(
                view.dossier?.brand?.tradeName ?? t.unset,
              )
            : t.decision.grantedNotice(levelName(view.entry.level), network),
        ]
      : [t.decision.alreadyVerified];
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

export function rejectedNotice(
  view: VerificationOpenResponse,
  reasonCode: string,
  status: "rejected" | "closed",
  escalated: boolean,
  late: boolean,
): string[] {
  const network = networkWords(view.entry.networkCode);
  const reason = reasonLabel(reasonCode).toLowerCase();
  const brand = view.dossier?.brand?.tradeName ?? t.unset;
  const lines = [
    isBrand(view)
      ? status === "closed"
        ? t.brand.decision.closedNotice(brand, reason)
        : t.brand.decision.refusedNotice(brand, reason)
      : status === "closed"
        ? t.decision.closedNotice(network, reason)
        : t.decision.refusedNotice(network, reason),
  ];
  if (escalated) {
    lines.push(t.decision.escalatedMark);
  }
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

export function reexaminedNotice(view: VerificationOpenResponse): string[] {
  return [
    isBrand(view)
      ? t.brand.decision.reexaminedNotice(
          view.dossier?.brand?.tradeName ?? t.unset,
        )
      : t.decision.reexaminedNotice(networkWords(view.entry.networkCode)),
  ];
}

// --- The comparison asked for, and whether it still speaks of what is typed ----------------------

/** The figures as typed, in one string: a comparison made on another one is told to be old (modele -19). */
export function figuresKeyOf(draft: Draft): string {
  return [draft.followers, draft.posts, draft.comments, draft.engagement]
    .map((value) => value.trim())
    .join("|");
}

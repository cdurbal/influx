// What the decision screen of queue 7 shows and sends (docs/mvp/09 RG5, RG6, RG21 to RG23, RG85, RG88 to RG95;
// 15 RG27 C1 to C8; 17b §3.8; jalons/l3c/modele.md §1, §3, §4; l3c-fiche invariants 2, 5, 12; L3C-08), computed
// from the answers of apps/api. Pure functions, outside the components: the facts of the brand and of the
// campaign, the budget by the label of its band (D78), the alerts in words, how a closed entry ended, the
// phase of the review, the draft of the three decisions and their checks, the notices of the chain. No rule is
// decided here: the database says who holds the entry, which version a decision binds, which phase the review
// is in, which reasons exist and whether a message is acceptable; this module words and gathers. The shared
// parts (the mode, the banners, the claim, the refused calls) are `claimed-entry-view.ts`.
import { INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/backoffice-queues";
import {
  CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH,
  CAMPAIGN_MEMBER_MESSAGE_MIN_LENGTH,
  CAMPAIGN_OPINION_MAX_LENGTH,
  CAMPAIGN_OPINION_MIN_LENGTH,
  type CampaignRejectionReasonCode,
  type CampaignReviewReason,
  type CampaignTextAlert,
  type FirstReviewCampaignEntryRequest,
  type OpenCampaignEntryResponse,
  type PublishCampaignEntryRequest,
  type RejectCampaignEntryRequest,
} from "@influx/contracts/campaign-review";
import { messages } from "@/messages/fr";
import { humanCode } from "./queue-review-facts";
import type { Banner } from "./queue-review-view";
import type { ClaimedMode } from "./claimed-entry-view";
import {
  type Checked,
  type Draft,
  type Problem,
} from "./verification-decision-view";
import { networkWords } from "./verification-queue-view";
import { countryName, formatDateTime, formatDay } from "./view-model";

const t = messages.campaignReview;

// --- The title ----------------------------------------------------------------------------------

export function entryTitle(view: OpenCampaignEntryResponse): string {
  return t.title(view.campaign.title, view.brand.name);
}

export function entrySubtitle(view: OpenCampaignEntryResponse): string {
  return t.subtitle(formatDateTime(view.entry.createdAt));
}

// --- The review of a sensitive sector (09 RG85, 17b §3.8, amended by D84) -----------------------------

/**
 * The sentence of the enhanced review: one person decides, a second opinion is facultative (D84, never a
 * blocking phase); null for a campaign of an ordinary sector. When an opinion was asked the sentence names who
 * asked it and when, and tells the holder whether it is his own request (he takes the entry back) or a
 * colleague's (he is the second look).
 */
export function reviewBanner(
  view: {
    entry: Pick<OpenCampaignEntryResponse["entry"], "review" | "claim">;
  },
  mode: ClaimedMode,
): Banner | null {
  const { review, claim } = view.entry;
  if (!review.enhancedReview || mode === "closed") {
    return null;
  }
  const deciding = mode === "deciding";
  if (review.phase === "second_opinion") {
    const own =
      deciding &&
      review.firstReviewer !== null &&
      review.firstReviewer.accountId === claim.holder?.accountId;
    return {
      tone: "info",
      lines: [
        t.enhanced.title,
        t.enhanced.asked(
          review.firstReviewer?.displayName ?? null,
          review.firstReviewedAt === null
            ? null
            : formatDateTime(review.firstReviewedAt),
        ),
        ...(deciding
          ? [own ? t.enhanced.askedByYou : t.enhanced.askedOfYou]
          : []),
      ],
    };
  }
  return {
    tone: "info",
    lines: [
      t.enhanced.title,
      deciding ? t.enhanced.singleYou : t.enhanced.single,
    ],
  };
}

/** The note of the request of a second opinion: served to the holder of the live claim only, never guessed otherwise. */
export function firstOpinionOf(view: {
  entry: Pick<OpenCampaignEntryResponse["entry"], "review">;
}): string | null {
  const opinion = view.entry.review.firstOpinion;
  return opinion === null || opinion.trim() === "" ? null : opinion;
}

// --- The facts ----------------------------------------------------------------------------------

/** One line of a block: a label, its value; a free text keeps its line breaks. */
export type Fact = {
  key: string;
  label: string;
  value: string;
  multiline: boolean;
};

function fact(
  key: keyof typeof t.facts,
  value: string | null,
  multiline = false,
): Fact {
  return {
    key,
    label: t.facts[key],
    value: value === null || value.trim() === "" ? t.unset : value,
    multiline,
  };
}

function languageName(code: string): string {
  const known = messages.languages as Readonly<Record<string, string>>;
  return known[code] ?? humanCode(code);
}

function listOf(
  values: readonly string[],
  render: (value: string) => string,
): string | null {
  return values.length === 0 ? null : values.map(render).join(", ");
}

function wordsOf(
  words: Readonly<Record<string, string>>,
  code: string | null,
): string | null {
  return code === null ? null : (words[code] ?? humanCode(code));
}

function yesNo(value: boolean | null): string | null {
  return value === null ? null : value ? t.yes : t.no;
}

/** Block ① — the brand, as the agent who examines the campaign sees it (17b §3.8). */
export function brandFacts(
  view: Pick<OpenCampaignEntryResponse, "brand">,
): Fact[] {
  const { brand } = view;
  return [
    fact("brandName", brand.name),
    fact("country", countryName(brand.countryCode)),
    fact("language", languageName(brand.preferredLanguage)),
    fact("verified", brand.verified ? t.verified.yes : t.verified.no),
    fact("published", String(brand.publishedCount)),
    fact("owner", brand.owner?.displayName ?? null),
  ];
}

/**
 * The budget by the label of its band alone (D78, l3c-fiche invariant 12): the key `price_band.<code>` the API
 * serves, read in the table of labels. No bound, no total, no currency and no amount is served or computed; a
 * key this table does not know is said, never guessed from the code.
 */
export function budgetWords(labelKey: string | null): string | null {
  if (labelKey === null) {
    return null;
  }
  return t.priceBands[labelKey] ?? t.unknownBand;
}

/** What the facts of the campaign read: the fields as stored, in the opening of an entry or in the record. */
type WithCampaign = Pick<OpenCampaignEntryResponse, "campaign">;

function deliverableLines(view: WithCampaign): string | null {
  const { deliverables } = view.campaign;
  return deliverables.length === 0
    ? null
    : deliverables
        .map((item) =>
          t.deliverable(
            item.quantity,
            networkWords(item.networkCode),
            humanCode(item.formatCode),
          ),
        )
        .join("\n");
}

function usageWords(view: WithCampaign): string | null {
  const c = view.campaign;
  const scope = wordsOf(t.territoryScopes, c.usageRightsTerritoryScope);
  const countries =
    c.usageRightsTerritories.length === 0
      ? null
      : c.usageRightsTerritories.map(countryName).join(", ");
  const parts = [
    c.usageRights === null ? null : humanCode(c.usageRights),
    wordsOf(t.usageDurations, c.usageRightsDuration),
    scope === null
      ? countries
      : countries === null
        ? scope
        : `${scope} (${countries})`,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

function audienceLines(view: WithCampaign): string | null {
  const c = view.campaign;
  const label = t.audienceLabels;
  const groups: readonly (readonly [string, string | null])[] = [
    [label.countries, listOf(c.audienceCountries, countryName)],
    [label.languages, listOf(c.audienceLanguages, languageName)],
    [label.bands, listOf(c.audienceBands, humanCode)],
    [label.ageBands, listOf(c.audienceAgeBands, humanCode)],
    [
      label.gender,
      c.audienceGender === null ? null : humanCode(c.audienceGender),
    ],
    [label.topics, listOf(c.audienceTopics, humanCode)],
  ];
  const lines = groups.flatMap(([name, values]) =>
    values === null ? [] : [t.audienceLine(name, values)],
  );
  return lines.length === 0 ? null : lines.join("\n");
}

function periodWords(view: WithCampaign): string | null {
  const { startsOn, endsOn } = view.campaign;
  return startsOn === null && endsOn === null
    ? null
    : t.periodRange(
        startsOn === null ? null : formatDay(startsOn),
        endsOn === null ? null : formatDay(endsOn),
      );
}

function dayWords(day: string | null): string | null {
  return day === null ? null : formatDay(day);
}

/** Block ② — the campaign as submitted, in the order of the form (09 blocks 1 to 7); the texts keep their breaks. */
export function campaignFacts(view: WithCampaign): Fact[] {
  const c = view.campaign;
  return [
    fact(
      "category",
      c.campaignType === null ? null : humanCode(c.campaignType),
    ),
    fact(
      "sector",
      c.productSector === null
        ? null
        : `${humanCode(c.productSector)}${c.sectorIsSensitive ? ` (${t.sensitive})` : ""}`,
    ),
    fact("reference", c.internalReference),
    fact("remuneration", wordsOf(t.remunerationKinds, c.remunerationKind)),
    fact("budget", budgetWords(c.budgetBandLabelKey)),
    fact(
      "creatorsWanted",
      c.creatorsWanted === null ? null : String(c.creatorsWanted),
    ),
    fact("period", periodWords(view)),
    fact("applicationsClose", dayWords(c.applicationsCloseOn)),
    fact("contentDue", dayWords(c.contentDueOn)),
    fact("deliverables", deliverableLines(view), true),
    fact("usage", usageWords(view)),
    fact("exclusivity", wordsOf(t.exclusivities, c.exclusivity)),
    fact("reviewDelay", wordsOf(t.reviewDelays, c.contentReviewDelay)),
    fact("productSent", yesNo(c.productIsSent)),
    fact("keepsProduct", yesNo(c.creatorKeepsProduct)),
    fact("shipping", wordsOf(t.shippingPayers, c.shippingCostsBorneBy)),
    fact("audience", audienceLines(view), true),
    fact(
      "maxApplications",
      c.maxApplications === null ? null : String(c.maxApplications),
    ),
    fact("publicSummary", c.publicSummary, true),
    fact("productDescription", c.productDescription, true),
    fact("restrictions", c.restrictions, true),
    fact(
      "keyMessages",
      c.keyMessages.length === 0
        ? null
        : c.keyMessages
            .map((text, at) => t.keyMessage(at + 1, text))
            .join("\n"),
      true,
    ),
  ];
}

/** Block ③ — the brief, whole: no cut, no markup (17b §3.8); null when none was written. */
export function briefOf(view: WithCampaign): string | null {
  const { brief } = view.campaign;
  return brief === null || brief.trim() === "" ? null : brief;
}

// --- The alerts (09 RG21 to RG23, RG95): informative, never a refusal ----------------------------------

function alertFieldWords(alert: CampaignTextAlert): string {
  const field = t.alerts.fields[alert.field] ?? alert.field;
  return alert.position === null
    ? field
    : t.alerts.keyMessageOf(field, alert.position + 1);
}

/** One finding in a sentence: the nature, the field, the shapes of the signal; never the text itself. */
export function alertLine(alert: CampaignTextAlert): string {
  const field = alertFieldWords(alert);
  const signals = alert.signals
    .map((signal) => t.alerts.signals[signal] ?? signal)
    .join(", ");
  switch (alert.code) {
    case "contact":
      return t.alerts.contact(field, signals);
    case "link":
      return t.alerts.link(field, signals);
    case "amount":
      return t.alerts.amount(field);
  }
}

/** The campaign of the same brand an alert of duplicate points at (09 RG95): information, never a refusal. */
export function duplicateLine(
  view: Pick<OpenCampaignEntryResponse, "duplicateOf">,
): string | null {
  const duplicate = view.duplicateOf;
  return duplicate === null
    ? null
    : t.alerts.duplicate(
        duplicate.title,
        t.statuses[duplicate.status] ?? duplicate.status,
      );
}

// --- A closed entry (09 RG5, 15 C8) ---------------------------------------------------------------

/** What a closed entry says: how it ended, by whom, the reason and the message the brand received. */
export function closedLines(view: OpenCampaignEntryResponse): string[] {
  const { entry } = view;
  const c = t.closed;
  const lines: string[] = [
    entry.state === "published"
      ? c.published
      : entry.state === "rejected"
        ? c.rejected
        : entry.state === "withdrawn"
          ? c.withdrawn
          : c.open,
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
    if (decision.rejectionReasonCode !== null) {
      lines.push(
        c.reason(
          t.decision.reasonLabels[decision.rejectionReasonCode] ??
            decision.rejectionReasonCode,
        ),
      );
    }
  }
  return lines;
}

// --- The responsible (09 RG6, CA63) -----------------------------------------------------------------

export type OwnerOption = { value: string; label: string };

/** The commercials a campaign may be given to, as the API lists them. */
export function ownerOptions(
  view: Pick<OpenCampaignEntryResponse, "responsibles">,
): OwnerOption[] {
  return view.responsibles.map((owner) => ({
    value: owner.accountId,
    label:
      owner.displayName ?? messages.queueReview.banner.forcedReleaseUnknown,
  }));
}

/** « ⟨moi⟩ » when the caller may be the responsible (17b §3.8), else nobody: the agent picks. */
export function defaultOwnerOf(
  view: Pick<OpenCampaignEntryResponse, "responsibles" | "entry">,
): string | null {
  const { claim } = view.entry;
  const caller = claim.heldByCaller ? claim.holder?.accountId : undefined;
  return view.responsibles.some((owner) => owner.accountId === caller)
    ? (caller ?? null)
    : null;
}

// --- The decisions: publish, ask a second opinion, refuse with a typed reason (09 RG5, RG85, RG89 to RG92) ---

function problem(
  field: Problem["field"],
  text: string,
): { ok: false; problem: Problem } {
  return { ok: false, problem: { field, text } };
}

/** The comment is facultative: sent only when it holds something, and within the bound. */
function commentOf(draft: Draft): Checked<string | null> {
  const comment = draft.internalComment.trim();
  if (comment.length > INTERNAL_COMMENT_MAX_LENGTH) {
    return problem("internalComment", t.decision.commentTooLong);
  }
  return { ok: true, body: comment === "" ? null : comment };
}

/** The publication: a responsible of the list the opening returned, then the facultative comment. */
export function publishCheck(
  draft: Draft,
  ownerAgentId: string | null,
  responsibles: readonly { accountId: string }[],
  reviewToken: string,
): Checked<PublishCampaignEntryRequest> {
  if (ownerAgentId === null) {
    return problem(
      "owner",
      responsibles.length === 0
        ? t.decision.ownerNone
        : t.decision.ownerRequired,
    );
  }
  if (!responsibles.some((owner) => owner.accountId === ownerAgentId)) {
    return problem("owner", t.decision.ownerInvalid);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body:
      comment.body === null
        ? { reviewToken, ownerAgentId }
        : { reviewToken, ownerAgentId, internalComment: comment.body },
  };
}

/** The facultative request of a second opinion (D84): a reasoned note of 20 to 1 000 characters; the lengths are the contract's. */
export function firstReviewCheck(
  opinion: string,
  reviewToken: string,
): Checked<FirstReviewCampaignEntryRequest> {
  const text = opinion.trim();
  if (text.length < CAMPAIGN_OPINION_MIN_LENGTH) {
    return problem("opinion", t.decision.opinionTooShort);
  }
  if (text.length > CAMPAIGN_OPINION_MAX_LENGTH) {
    return problem("opinion", t.decision.opinionTooLong);
  }
  return { ok: true, body: { reviewToken, opinion: text } };
}

/**
 * The refusal as the API takes it. The reason must be of the closed list the opening returned; the message to
 * the brand is for the reasons that ask for it, and only theirs (the database refuses the others); the checks
 * of length are the contract's, the contact detector is the server's.
 */
export function rejectCheck(
  draft: Draft,
  reasonCode: CampaignRejectionReasonCode | null,
  reasons: readonly CampaignReviewReason[],
  reviewToken: string,
): Checked<RejectCampaignEntryRequest> {
  const reason = reasons.find((candidate) => candidate.code === reasonCode);
  if (reason === undefined) {
    return problem("reason", t.decision.reasonRequired);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  const body: RejectCampaignEntryRequest = {
    reviewToken,
    reasonCode: reason.code,
    ...(comment.body === null ? {} : { internalComment: comment.body }),
  };
  if (!reason.requiresMemberMessage) {
    return { ok: true, body };
  }
  const message = draft.memberMessage.trim();
  if (message.length < CAMPAIGN_MEMBER_MESSAGE_MIN_LENGTH) {
    return problem("memberMessage", t.decision.otherTooShort);
  }
  if (message.length > CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH) {
    return problem("memberMessage", t.decision.otherTooLong);
  }
  return { ok: true, body: { ...body, memberMessage: message } };
}

/**
 * What the brand will read for the reason picked (09 RG90, 15 RG7): the sentence of the reason, the agent's own
 * text for the reason that has one, then what the brand can do. The sentences come from apps/api, from the
 * files of the e-mail itself: what the agent reads is what is sent.
 */
export function reasonPreview(
  reason: CampaignReviewReason,
  draft: Pick<Draft, "memberMessage">,
): { paragraphs: string[]; nextStep: string } {
  const paragraphs = [reason.message];
  if (reason.requiresMemberMessage) {
    const own = draft.memberMessage.trim();
    if (own !== "") {
      paragraphs.push(own);
    }
  }
  return { paragraphs, nextStep: reason.nextStepMessage };
}

// --- The exit (17b §2.6) -----------------------------------------------------------------------------

/** The confirmation that stays above the next entry: what was decided, in a sentence. */
export function publishedLines(
  view: Pick<OpenCampaignEntryResponse, "campaign">,
  late: boolean,
): string[] {
  const lines = [t.decision.publishedNotice(view.campaign.title)];
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

export function askedLines(
  view: Pick<OpenCampaignEntryResponse, "campaign">,
): string[] {
  return [t.decision.askedNotice(view.campaign.title)];
}

export function rejectedLines(
  view: Pick<OpenCampaignEntryResponse, "campaign">,
  reasonCode: CampaignRejectionReasonCode,
  late: boolean,
): string[] {
  const lines = [
    t.decision.rejectedNotice(
      view.campaign.title,
      (t.decision.reasonLabels[reasonCode] ?? reasonCode).toLowerCase(),
    ),
  ];
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

// What the decision screen of queue 2 shows and sends (docs/mvp/07 RG4 to RG10, RG16, RG93 to RG99; 15 RG27
// C1 to C8; 17b §2.4 to §2.6; jalons/l2g/modele.md §1 points 6, 10, 12, §3 « 0244 »; L2G-15), computed from the
// answers of apps/api. Pure functions, outside the components: the facts of the profile as last validated, its
// network lines, the revisions side by side, the alerts in words, how a closed entry ended, the draft of a
// refusal and its checks, the notices of the chain. No rule is decided here: the database says who holds the
// entry, which version a decision binds, which reasons exist and whether a message is acceptable; this module
// words and gathers. The shared parts (the mode, the banners, the claim, the refused calls) are
// `claimed-entry-view.ts`.
import { INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/backoffice-queues";
import {
  CREATOR_MEMBER_MESSAGE_MAX_LENGTH,
  CREATOR_MEMBER_MESSAGE_MIN_LENGTH,
  type CreatorRejectionReasonCode,
} from "@influx/contracts/creator-profile";
import type {
  CreatorReviewAlert,
  CreatorReviewedLine,
  CreatorReviewedRevision,
  CreatorReviewedVisual,
  CreatorReviewReason,
  CreatorRevisionValue,
  OpenCreatorEntryResponse,
  PublishCreatorEntryRequest,
  RejectCreatorEntryRequest,
} from "@influx/contracts/creator-queues";
import { messages } from "@/messages/fr";
import { humanCode } from "./queue-review-facts";
import {
  type Checked,
  type Draft,
  type Problem,
} from "./verification-decision-view";
import { levelWords, networkWords } from "./verification-queue-view";
import { countryName, formatDate, formatDateTime } from "./view-model";

const t = messages.creatorReview;

/** The moderated field a line of the screen shows (07 RG9, modele point 6), by its code. */
export type CreatorField = keyof typeof messages.creatorQueue.fields;

export function fieldLabel(field: CreatorField): string {
  return messages.creatorQueue.fields[field];
}

// --- The title ----------------------------------------------------------------------------------

export function entryTitle(view: OpenCreatorEntryResponse): string {
  return t.title(view.profile.alias);
}

export function entrySubtitle(view: OpenCreatorEntryResponse): string {
  return t.subtitle(
    messages.queueList.kinds[view.entry.kind],
    formatDateTime(view.entry.createdAt),
  );
}

// --- The profile as last validated (07 RG9: the live rows are always the last validated version) -----

function languageName(code: string): string {
  const known = messages.languages as Readonly<Record<string, string>>;
  return known[code] ?? humanCode(code);
}

function listOf(
  values: readonly string[],
  render: (value: string) => string,
): string {
  return values.length === 0 ? t.none : values.map(render).join(", ");
}

/** One line of the block « Le profil validé »: a label, its value, and the moderated field it shows. */
export type Fact = {
  key: string;
  label: string;
  value: string;
  /** A free text keeps its line breaks. */
  multiline: boolean;
  field: CreatorField | null;
};

function fact(
  key: keyof typeof t.facts,
  value: string | null,
  options: { multiline?: boolean; field?: CreatorField } = {},
): Fact {
  return {
    key,
    label: t.facts[key],
    value: value === null || value.trim() === "" ? t.unset : value,
    multiline: options.multiline === true,
    field: options.field ?? null,
  };
}

function code(value: string | null): string | null {
  return value === null ? null : humanCode(value);
}

/** A band of the form in the creator's own words; a code the screen does not know is written readable. */
function band(
  group: keyof typeof t.bands,
  value: string | null,
): string | null {
  return value === null ? null : (t.bands[group]?.[value] ?? humanCode(value));
}

/** The profile in the order of the form (07 RG26), as validated; the revisions are another block. */
export function profileFacts(view: OpenCreatorEntryResponse): Fact[] {
  const { profile, account } = view;
  const { lists } = profile;
  return [
    fact("alias", profile.alias),
    fact("status", t.statuses[profile.status] ?? profile.status),
    fact(
      "firstPublished",
      profile.firstPublishedAt === null
        ? null
        : formatDate(profile.firstPublishedAt),
    ),
    fact(
      "completeness",
      profile.completenessPercent === null
        ? null
        : `${profile.completenessPercent} %`,
    ),
    fact("country", countryName(account.countryCode)),
    fact("language", languageName(account.preferredLanguage)),
    fact("owner", account.owner?.displayName ?? null),
    fact("headline", profile.headline, { field: "headline" }),
    fact("bio", profile.bio, { multiline: true, field: "bio" }),
    fact("primaryTopic", code(profile.primaryTopic)),
    fact("secondaryTopics", listOf(lists.secondaryTopics, humanCode)),
    fact("tones", listOf(lists.tones, humanCode)),
    fact(
      "publicationLanguages",
      listOf(lists.publicationLanguages, languageName),
    ),
    fact("formats", listOf(lists.formats, humanCode)),
    fact(
      "usageRights",
      lists.usageRights.length === 0
        ? t.none
        : lists.usageRights
            .map(
              (right) =>
                `${humanCode(right.code)} (${t.inclusions[right.inclusion] ?? right.inclusion})`,
            )
            .join(", "),
    ),
    fact("refusedSectors", listOf(lists.refusedSectors, humanCode)),
    fact("residenceRegion", code(profile.residenceRegion)),
    fact("travelScope", band("travelScope", profile.travelScope)),
    fact(
      "collaborationExperience",
      band("collaborationExperience", profile.collaborationExperience),
    ),
    fact("deliveryLead", band("deliveryLead", profile.deliveryLead)),
    fact("maxExclusivity", band("maxExclusivity", profile.maxExclusivity)),
    fact("acceptsNonMonetary", profile.acceptsNonMonetary ? t.yes : t.no),
    fact("availability", band("availability", profile.availability)),
  ];
}

// --- The network lines, layer I (07 RG22, RG49, RG61; modele point 9) -----------------------------------

const COUNT = new Intl.NumberFormat("fr-FR");

/**
 * Basis points as a percentage, written from the digits (350 → « 3,5 »): a figure the creator declared or an
 * agent observed is shown, never computed with, and no arithmetic touches it here.
 */
export function basisPointsWords(basisPoints: number): string {
  const digits = String(basisPoints).padStart(3, "0");
  const decimals = digits.slice(-2).replace(/0+$/, "");
  return `${digits.slice(0, -2)}${decimals === "" ? "" : `,${decimals}`}`;
}

export type LineFact = {
  key: keyof typeof t.lines.facts;
  label: string;
  value: string;
  /** A handle, an address: broken anywhere, never a proportional font that hides a character. */
  mono: boolean;
};

export type LineView = {
  id: string;
  /** The network and, written, whether it is the main one and whether the brands see it (never by colour). */
  title: string;
  facts: LineFact[];
};

function lineFact(
  key: keyof typeof t.lines.facts,
  value: string | null,
  mono = false,
): LineFact {
  return {
    key,
    label: t.lines.facts[key],
    value: value === null || value === "" ? t.unset : value,
    mono,
  };
}

function figure(value: number | null): string | null {
  return value === null ? null : COUNT.format(value);
}

/** One line: the exact figures with their source and their date, and the badge in force (07 RG49, RG50). */
export function lineView(line: CreatorReviewedLine): LineView {
  const words = [
    networkWords(line.networkCode),
    ...(line.isPrimary ? [t.lines.primary] : []),
  ].join(" · ");
  return {
    id: line.id,
    title: words,
    facts: [
      lineFact("status", line.listed ? t.lines.listed : t.lines.unlisted),
      lineFact("handle", line.handle, true),
      lineFact("pseudonym", line.pseudonym),
      lineFact("url", line.profileUrl, true),
      lineFact("followers", figure(line.followers)),
      lineFact("posts", figure(line.postsLast30Days)),
      lineFact("comments", figure(line.avgComments)),
      lineFact("reach", figure(line.avgReach)),
      lineFact(
        "engagement",
        line.engagementRateBp === null
          ? null
          : t.lines.engagement(basisPointsWords(line.engagementRateBp)),
      ),
      lineFact(
        "source",
        t.lines.sources[line.figuresSource] ?? line.figuresSource,
      ),
      lineFact(
        "measuredAt",
        line.figuresMeasuredAt === null
          ? null
          : formatDate(line.figuresMeasuredAt),
      ),
      lineFact(
        "badge",
        line.badge === null ? t.lines.noBadge : levelWords(line.badge),
      ),
    ],
  };
}

// --- The revisions, side by side (07 RG9, CA48) --------------------------------------------------------

/** A visual in words: its place in the order of the profile, or « en attente » while it has none. */
export function visualName(
  visuals: readonly Pick<CreatorReviewedVisual, "id" | "displayOrder">[],
  id: string | null,
): string {
  const visual = visuals.find((candidate) => candidate.id === id);
  return visual?.displayOrder == null
    ? t.visuals.unordered
    : t.visuals.order(visual.displayOrder);
}

function valueWords(value: CreatorRevisionValue | null): string {
  if (value === null) {
    return t.written.noneListed;
  }
  switch (value.kind) {
    case "text":
      return value.text === null || value.text.trim() === ""
        ? t.written.emptyValue
        : value.text;
    case "line":
      return t.written.newLine(networkWords(value.networkCode));
    case "caption":
      return `${
        value.caption === null || value.caption.trim() === ""
          ? t.written.emptyValue
          : value.caption
      } — ${value.brandDeclared ? t.written.declared : t.written.notDeclared}`;
  }
}

export type RevisionRow = {
  id: string;
  label: string;
  validated: string;
  proposed: string;
  multiline: boolean;
};

/** The pending revisions: the field, the validated value and the proposed one, in the order they were made. */
export function revisionRows(
  view: Pick<OpenCreatorEntryResponse, "revisions" | "profile">,
): RevisionRow[] {
  return view.revisions.map((revision: CreatorReviewedRevision) => ({
    id: revision.id,
    label:
      revision.field === "portfolio_caption"
        ? `${fieldLabel(revision.field)} (${visualName(view.profile.visuals, revision.rowKey).toLowerCase()})`
        : fieldLabel(revision.field),
    validated: valueWords(revision.validated),
    proposed: valueWords(revision.proposed),
    multiline:
      revision.field === "bio" ||
      revision.field === "headline" ||
      revision.field === "portfolio_caption",
  }));
}

/** The fields a revision changes, in words, for the line that opens the screen (07 RG93). */
export function modifiedFieldsWords(
  view: Pick<OpenCreatorEntryResponse, "revisions">,
): string | null {
  const fields = [
    ...new Set(view.revisions.map((revision) => fieldLabel(revision.field))),
  ];
  return fields.length === 0 ? null : t.written.summary(fields.join(", "));
}

// --- The visuals (07 RG77, RG78; modele point 10) -------------------------------------------------------

export function visualFacts(visual: CreatorReviewedVisual): string[] {
  return [
    visual.displayOrder === null
      ? t.visuals.unordered
      : t.visuals.order(visual.displayOrder),
    t.visuals.states[visual.state] ?? visual.state,
    t.visuals.dimensions(visual.width, visual.height),
    t.visuals.kilobytes(Math.max(1, Math.round(visual.byteSize / 1024))),
    t.visuals.deposited(formatDate(visual.createdAt)),
    ...(visual.replacesItemId === null ? [] : [t.visuals.replacement]),
    ...(visual.brandDeclared ? [t.visuals.declared] : []),
  ];
}

// --- The alerts (07 RG93; EC-L2G-12): informative, never a refusal -------------------------------------

export function alertLine(
  alert: CreatorReviewAlert,
  visuals: readonly Pick<CreatorReviewedVisual, "id" | "displayOrder">[],
): string {
  const field =
    alert.field === "portfolio_caption" && alert.rowKey !== null
      ? t.alerts.captionOf(visualName(visuals, alert.rowKey))
      : (t.alerts.fields[alert.field] ?? alert.field);
  const signals = alert.signals
    .map((signal) => t.alerts.signals[signal] ?? signal)
    .join(", ");
  return t.alerts.direct_contact(field, signals);
}

// --- A closed entry (07 RG10, 15 C8) -----------------------------------------------------------------

/** What a closed entry says: how it ended, by whom, the reason and the message the creator received. */
export function closedLines(view: OpenCreatorEntryResponse): string[] {
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

// --- The decision: a publication, or a refusal with a typed reason (07 RG5, RG10, RG96 to RG98) --------

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

export function publishCheck(
  draft: Draft,
  reviewToken: string,
): Checked<PublishCreatorEntryRequest> {
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  return {
    ok: true,
    body:
      comment.body === null
        ? { reviewToken }
        : { reviewToken, internalComment: comment.body },
  };
}

/**
 * The refusal as the API takes it. The reason must be of the closed list the opening returned; the message
 * to the creator is for the reasons that ask for it, and only theirs (the database refuses the others); the
 * checks of length are the contract's, the contact detector is the server's (07 RG98, RG158).
 */
export function rejectCheck(
  draft: Draft,
  reasonCode: CreatorRejectionReasonCode | null,
  reasons: readonly CreatorReviewReason[],
  reviewToken: string,
): Checked<RejectCreatorEntryRequest> {
  const reason = reasons.find((candidate) => candidate.code === reasonCode);
  if (reason === undefined) {
    return problem("reason", t.decision.reasonRequired);
  }
  const comment = commentOf(draft);
  if (!comment.ok) {
    return comment;
  }
  const body: RejectCreatorEntryRequest = {
    reviewToken,
    reasonCode: reason.code,
    ...(comment.body === null ? {} : { internalComment: comment.body }),
  };
  if (!reason.requiresMemberMessage) {
    return { ok: true, body };
  }
  const message = draft.memberMessage.trim();
  if (message.length < CREATOR_MEMBER_MESSAGE_MIN_LENGTH) {
    return problem("memberMessage", t.decision.otherTooShort);
  }
  if (message.length > CREATOR_MEMBER_MESSAGE_MAX_LENGTH) {
    return problem("memberMessage", t.decision.otherTooLong);
  }
  return { ok: true, body: { ...body, memberMessage: message } };
}

/**
 * What the creator will read for the reason picked (07 RG96, 15 RG7): the sentence of the reason, the agent's
 * own text for the reason that has one, then what the creator can do. The sentences come from apps/api, from
 * the files of the e-mail itself: what the agent reads is what is sent.
 */
export function reasonPreview(
  reason: CreatorReviewReason,
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
  view: Pick<OpenCreatorEntryResponse, "profile">,
  late: boolean,
): string[] {
  const lines = [t.decision.publishedNotice(view.profile.alias)];
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

export function rejectedLines(
  view: Pick<OpenCreatorEntryResponse, "profile">,
  reasonCode: CreatorRejectionReasonCode,
  late: boolean,
): string[] {
  const lines = [
    t.decision.rejectedNotice(
      view.profile.alias,
      (t.decision.reasonLabels[reasonCode] ?? reasonCode).toLowerCase(),
    ),
  ];
  if (late) {
    lines.push(t.decision.lateMark);
  }
  return lines;
}

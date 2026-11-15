// What the record of a campaign shows and sends (docs/mvp/09 RG1, RG8, RG9, RG83, RG93, RG94, CA60, CA61; 17b
// §3.5 block 4, §3.8; jalons/l3c/modele.md §5, §6; l3c-fiche invariants 6, 12, 13; L3C-09), computed from the
// answers of apps/api. Pure functions, outside the components: the facts of the cycle and of the internal
// block, the history of the decisions and of the interventions in sentences, the fields an agent may correct
// and how each is typed, the checks of the three forms (correction, passage, creation for a brand), what a
// refused call means. No rule is decided here: the database says which state allows which act, which value a
// field accepts and what is refused; these checks only spare the agent a round trip. No amount is read, kept
// or computed: the total budget is « non communiqué », the band is its label (D48, D78), and the fields that
// hold a figure, a band or the currency are not offered to the correction (invariant 12).
import { INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/backoffice-queues";
import { EXCLUSIVITY_BANDS } from "@influx/contracts/brand-profile";
import {
  CONTENT_REVIEW_DELAYS,
  REMUNERATION_KINDS,
  SHIPPING_PAYERS,
  USAGE_RIGHTS_DURATIONS,
  type CampaignStatus,
} from "@influx/contracts/campaign";
import {
  CAMPAIGN_UNSERVED_VALUE_FIELDS,
  type CampaignCorrectableField,
  type CampaignCorrectionValue,
  type CampaignFields,
  type CampaignPassageRequest,
  type CampaignRecordResponse,
  type CorrectCampaignFieldRequest,
  type CreateCampaignForBrandRequest,
  type InterventionReasonCode,
} from "@influx/contracts/campaign-review";
import { messages } from "@/messages/fr";
import { budgetWords, type Fact } from "./campaign-review-view";
import { CAMPAIGN_REVIEW_LIST } from "./campaign-queue-view";
import { humanCode } from "./queue-review-facts";
import { networkWords } from "./verification-queue-view";
import { countryName, formatDateTime, formatDay } from "./view-model";

const t = messages.campaignRecord;
const r = messages.campaignReview;

// --- Addresses -------------------------------------------------------------------------------------

/** The record of the account the campaign belongs to (17b §3.5). */
export function accountHref(accountId: string): string {
  return `/inscrits/${accountId}`;
}

/** The record of a campaign, under the accounts (the id is the campaign's; the account is told by the answer). */
export function recordHref(campaignId: string): string {
  return `/inscrits/campagnes/${campaignId}`;
}

/** An entry of queue 7: opening it takes it in charge. */
export function entryHref(entryId: string): string {
  return `${CAMPAIGN_REVIEW_LIST}/${entryId}`;
}

// --- The title and the blocks that only read ---------------------------------------------------------

export function recordTitle(record: Pick<CampaignRecordResponse, "fields">) {
  return t.title(record.fields.title);
}

/** The state and the cycle of the campaign, in the order a commercial reads them. */
export function cycleFacts(record: CampaignRecordResponse): Fact[] {
  const { cycle } = record;
  const c = t.cycle;
  const line = (key: string, label: string, value: string): Fact => ({
    key,
    label,
    value,
    multiline: false,
  });
  const facts: Fact[] = [
    line("status", c.status, r.statuses[cycle.status] ?? cycle.status),
    line("createdAt", c.createdAt, formatDateTime(cycle.createdAt)),
  ];
  if (cycle.submittedAt !== null) {
    facts.push(
      line("submittedAt", c.submittedAt, formatDateTime(cycle.submittedAt)),
    );
  }
  if (cycle.firstPublishedAt !== null) {
    facts.push(
      line(
        "firstPublishedAt",
        c.firstPublishedAt,
        formatDateTime(cycle.firstPublishedAt),
      ),
    );
  }
  if (cycle.status === "paused" && cycle.pausedAt !== null) {
    facts.push(line("pausedAt", c.pausedAt, formatDateTime(cycle.pausedAt)));
    if (cycle.pauseOrigin !== null) {
      facts.push(
        line(
          "pauseOrigin",
          c.pauseOrigin,
          c.origins[cycle.pauseOrigin] ?? cycle.pauseOrigin,
        ),
      );
    }
  }
  if (cycle.closedAt !== null) {
    facts.push(line("closedAt", c.closedAt, formatDateTime(cycle.closedAt)));
  }
  facts.push(
    line("owner", c.owner, cycle.owner?.displayName ?? c.ownerNone),
    line(
      "snapshot",
      c.snapshot,
      cycle.snapshotVersion === null
        ? c.snapshotNone
        : c.snapshotValue(cycle.snapshotVersion),
    ),
  );
  return facts;
}

/**
 * The internal block (09 RG83): what is never published nor read of a creator. The total budget is never served
 * (« non communiqué »), the band is its label alone (D78), the reference as the brand typed it.
 */
export function internalFacts(record: CampaignRecordResponse): Fact[] {
  const i = t.internal;
  const unset = r.unset;
  const reference = record.fields.internalReference;
  return [
    {
      key: "totalBudget",
      label: i.totalBudget,
      value: i.totalBudgetValue,
      multiline: false,
    },
    {
      key: "band",
      label: i.band,
      value: budgetWords(record.fields.budgetBandLabelKey) ?? unset,
      multiline: false,
    },
    {
      key: "reference",
      label: i.reference,
      value: reference === null || reference.trim() === "" ? unset : reference,
      multiline: false,
    },
    {
      key: "owner",
      label: i.owner,
      value: record.cycle.owner?.displayName ?? t.cycle.ownerNone,
      multiline: false,
    },
  ];
}

/**
 * The facts of the campaign without the two the internal block holds (the reference and the band), the type of
 * campaign in the words of the correction's list, so that the record reads one wording for one value.
 */
export function publicFacts(
  facts: readonly Fact[],
  fields: Pick<CampaignFields, "campaignType">,
): Fact[] {
  const typeWords =
    fields.campaignType === null
      ? undefined
      : t.campaignTypes[fields.campaignType];
  return facts
    .filter((fact) => fact.key !== "reference" && fact.key !== "budget")
    .map((fact) =>
      fact.key === "category" && typeWords !== undefined
        ? { ...fact, value: typeWords }
        : fact,
    );
}

// --- The history (09 RG93, RG94) -------------------------------------------------------------------------

export type HistoryLine = {
  key: string;
  /** The instant, to sort by. */
  at: string;
  text: string;
  /** The open entry of the line, which the agent may open to take it in charge. */
  entryId: string | null;
};

type Json = unknown;

function parseJson(text: string): Json {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return text;
  }
}

/** Words per field for the values kept by an intervention (a closed list reads in its own words). */
const OPTION_WORDS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  {
    campaign_type: t.campaignTypes,
    remuneration_kind: r.remunerationKinds,
    shipping_costs_borne_by: r.shippingPayers,
    usage_rights_duration: r.usageDurations,
    exclusivity: r.exclusivities,
    content_review_delay: r.reviewDelays,
  };

const CODE_LIST_FIELDS: ReadonlySet<string> = new Set([
  "product_sector",
  "usage_rights",
  "audience_languages",
  "audience_bands",
  "audience_age_bands",
  "audience_gender",
  "audience_topics",
  "requested_items",
]);

function wordsOfValue(code: string, value: Json): string {
  if (value === null || value === undefined) {
    return t.history.emptyValue;
  }
  if (typeof value === "boolean") {
    return value ? r.yes : r.no;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    const words = OPTION_WORDS[code];
    if (words !== undefined) {
      return words[value] ?? humanCode(value);
    }
    if (code === "audience_countries") {
      return countryName(value);
    }
    if (CODE_LIST_FIELDS.has(code)) {
      return humanCode(value);
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDay(value) : value;
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? t.history.emptyValue
      : value.map((item) => wordsOfValue(code, item)).join(", ");
  }
  const object = value as Record<string, unknown>;
  if (typeof object.quantity === "number") {
    return r.deliverable(
      object.quantity,
      networkWords(
        typeof object.networkCode === "string" ? object.networkCode : null,
      ),
      typeof object.formatCode === "string" ? humanCode(object.formatCode) : "",
    );
  }
  if (typeof object.scope === "string") {
    const scope = r.territoryScopes[object.scope] ?? humanCode(object.scope);
    const countries = Array.isArray(object.countries)
      ? object.countries
          .filter((c): c is string => typeof c === "string")
          .map(countryName)
      : [];
    return countries.length === 0
      ? scope
      : `${scope} (${countries.join(", ")})`;
  }
  return t.history.emptyValue;
}

function interventionText(
  intervention: CampaignRecordResponse["interventions"][number],
): string {
  const h = t.history;
  let text = h.intervention(
    h.kinds[intervention.kind] ?? intervention.kind,
    formatDateTime(intervention.createdAt),
    intervention.agent?.displayName ?? h.unknownAgent,
    t.actions.reasons[intervention.reasonCode] ?? intervention.reasonCode,
  );
  const code = intervention.fieldCode;
  if (code !== null) {
    text += h.field(t.fields[code] ?? humanCode(code));
    if (CAMPAIGN_UNSERVED_VALUE_FIELDS.includes(code)) {
      text += h.valuesNotServed;
    } else if (
      intervention.oldValueJson !== null ||
      intervention.newValueJson !== null
    ) {
      text += h.values(
        wordsOfValue(code, parseJson(intervention.oldValueJson ?? "null")),
        wordsOfValue(code, parseJson(intervention.newValueJson ?? "null")),
      );
    }
  }
  return text;
}

function entryLines(
  entry: CampaignRecordResponse["entries"][number],
): HistoryLine[] {
  const h = t.history;
  const lines: HistoryLine[] = [];
  const decision = entry.decision;
  const by = decision?.decidedBy?.displayName ?? h.unknownAgent;
  const late = decision?.late === true ? h.late : "";
  if (entry.state === "open") {
    lines.push({
      key: `entry-${entry.id}`,
      at: entry.createdAt,
      text: h.submitted(formatDateTime(entry.createdAt)),
      entryId: entry.id,
    });
  } else if (entry.state === "published" && decision !== null) {
    lines.push({
      key: `entry-${entry.id}`,
      at: decision.decidedAt,
      text: `${h.published(formatDateTime(decision.decidedAt), by)}${late}`,
      entryId: null,
    });
  } else if (entry.state === "rejected" && decision !== null) {
    const reason =
      decision.rejectionReasonCode === null
        ? r.unset
        : (r.decision.reasonLabels[decision.rejectionReasonCode] ??
          decision.rejectionReasonCode);
    lines.push({
      key: `entry-${entry.id}`,
      at: decision.decidedAt,
      text: `${h.rejected(formatDateTime(decision.decidedAt), by, reason)}${late}`,
      entryId: null,
    });
  } else if (entry.state === "withdrawn") {
    const at = entry.closedAt ?? entry.createdAt;
    lines.push({
      key: `entry-${entry.id}`,
      at,
      text: h.withdrawn(formatDateTime(at)),
      entryId: null,
    });
  }
  if (entry.firstReviewedAt !== null) {
    lines.push({
      key: `first-${entry.id}`,
      at: entry.firstReviewedAt,
      text: h.firstReview(
        formatDateTime(entry.firstReviewedAt),
        entry.firstReviewedBy?.displayName ?? h.unknownAgent,
      ),
      entryId: null,
    });
  }
  return lines;
}

/** The decisions of the entries and the interventions of the agents, the most recent first. */
export function historyLines(record: CampaignRecordResponse): HistoryLine[] {
  const lines = [
    ...record.entries.flatMap(entryLines),
    ...record.interventions.map((intervention): HistoryLine => ({
      key: `intervention-${intervention.id}`,
      at: intervention.createdAt,
      text: interventionText(intervention),
      entryId: null,
    })),
  ];
  return lines.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// --- What the state allows (09 RG3, RG8, RG9; modele §5, §6) --------------------------------------------

export type RecordAction = "correct" | "pause" | "resume" | "close";

/** The acts offered for a state; the database refuses the others (a conflict reads the record again). */
export function actionsOf(status: CampaignStatus): RecordAction[] {
  switch (status) {
    case "draft":
    case "rejected":
    case "pending_review":
      return ["correct"];
    case "published":
      return ["pause", "close"];
    case "paused":
      return ["resume", "close"];
    case "closed":
      return [];
  }
}

/** The sentence of a state that offers fewer acts than an agent may expect: frozen, or closed for good. */
export function actionsNote(status: CampaignStatus): string | null {
  if (status === "published" || status === "paused") {
    return t.actions.frozen;
  }
  return status === "closed" ? t.actions.closedNote : null;
}

/** The open entry of a pending campaign: where an agent takes it in charge to correct it. */
export function openEntryIdOf(record: CampaignRecordResponse): string | null {
  return record.entries.find((entry) => entry.state === "open")?.id ?? null;
}

/** The language the brand is told in (09 RG93). */
export function informedLine(
  record: Pick<CampaignRecordResponse, "brand">,
): string {
  return t.actions.informed(
    messages.languages[record.brand.preferredLanguage] ??
      record.brand.preferredLanguage,
  );
}

// --- The problems of a form ------------------------------------------------------------------------------

export type ProblemField =
  "field" | "value" | "reason" | "comment" | "title" | "type";

export type Problem = { field: ProblemField; text: string };
export type Checked<T> =
  { ok: true; body: T } | { ok: false; problem: Problem };

function problem(
  field: ProblemField,
  text: string,
): { ok: false; problem: Problem } {
  return { ok: false, problem: { field, text } };
}

/** The reason and the comment of every act: the reason of the closed list, the comment for « other » (modele §6). */
function reasonAndComment(
  reasonCode: InterventionReasonCode | null,
  comment: string,
): Checked<{ reasonCode: InterventionReasonCode; internalComment?: string }> {
  if (reasonCode === null) {
    return problem("reason", t.actions.reasonRequired);
  }
  const text = comment.trim();
  if (text.length > INTERNAL_COMMENT_MAX_LENGTH) {
    return problem("comment", t.actions.commentTooLong);
  }
  if (reasonCode === "other" && text === "") {
    return problem("comment", t.actions.commentRequired);
  }
  return {
    ok: true,
    body: text === "" ? { reasonCode } : { reasonCode, internalComment: text },
  };
}

// --- The correction of ONE field (09 RG94, CA60) --------------------------------------------------------

export type FieldKind =
  "text" | "multiline" | "choice" | "yesno" | "integer" | "date" | "lines";

/** What the field holds as the API serves it: a text, a boolean, a number, a list of texts, or nothing. */
type Stored = string | boolean | number | readonly string[] | null;

export type FieldSpec = {
  code: CampaignCorrectableField;
  kind: FieldKind;
  read: (fields: CampaignFields) => Stored;
  /** `choice`: the codes of the closed list, in the words of `words`. */
  options?: readonly string[];
  words?: Readonly<Record<string, string>>;
};

/** The seven types of campaign (09 RG18, `reference.campaign_types`, 0303): a closed list, no « other ». */
export const CAMPAIGN_TYPE_CODES = [
  "product_placement",
  "ugc_delivered",
  "product_review",
  "ambassador",
  "contest",
  "event_presence",
  "affiliate_program",
] as const;

/**
 * The fields offered to the correction: a text, a closed list this screen knows, a yes or no, a number, a date,
 * or a list of messages. Not offered (invariant 12, and no list of reference codes at hand): the amounts, the
 * bands, the currency, the sector, the countries, languages and topics, the deliverables and the territory.
 */
export const CORRECTABLE_FIELDS: readonly FieldSpec[] = [
  { code: "title", kind: "text", read: (f) => f.title },
  {
    code: "campaign_type",
    kind: "choice",
    read: (f) => f.campaignType,
    options: CAMPAIGN_TYPE_CODES,
    words: t.campaignTypes,
  },
  { code: "public_summary", kind: "multiline", read: (f) => f.publicSummary },
  { code: "brief", kind: "multiline", read: (f) => f.brief },
  {
    code: "internal_reference",
    kind: "text",
    read: (f) => f.internalReference,
  },
  {
    code: "product_description",
    kind: "multiline",
    read: (f) => f.productDescription,
  },
  { code: "restrictions", kind: "multiline", read: (f) => f.restrictions },
  { code: "key_messages", kind: "lines", read: (f) => f.keyMessages },
  {
    code: "remuneration_kind",
    kind: "choice",
    read: (f) => f.remunerationKind,
    options: REMUNERATION_KINDS,
    words: r.remunerationKinds,
  },
  { code: "product_is_sent", kind: "yesno", read: (f) => f.productIsSent },
  {
    code: "creator_keeps_product",
    kind: "yesno",
    read: (f) => f.creatorKeepsProduct,
  },
  {
    code: "shipping_costs_borne_by",
    kind: "choice",
    read: (f) => f.shippingCostsBorneBy,
    options: SHIPPING_PAYERS,
    words: r.shippingPayers,
  },
  {
    code: "usage_rights_duration",
    kind: "choice",
    read: (f) => f.usageRightsDuration,
    options: USAGE_RIGHTS_DURATIONS,
    words: r.usageDurations,
  },
  {
    code: "exclusivity",
    kind: "choice",
    read: (f) => f.exclusivity,
    options: EXCLUSIVITY_BANDS,
    words: r.exclusivities,
  },
  {
    code: "content_review_delay",
    kind: "choice",
    read: (f) => f.contentReviewDelay,
    options: CONTENT_REVIEW_DELAYS,
    words: r.reviewDelays,
  },
  { code: "creators_wanted", kind: "integer", read: (f) => f.creatorsWanted },
  { code: "max_applications", kind: "integer", read: (f) => f.maxApplications },
  {
    code: "applications_close_on",
    kind: "date",
    read: (f) => f.applicationsCloseOn,
  },
  { code: "content_due_on", kind: "date", read: (f) => f.contentDueOn },
  { code: "starts_on", kind: "date", read: (f) => f.startsOn },
  { code: "ends_on", kind: "date", read: (f) => f.endsOn },
];

export function specOf(
  code: CampaignCorrectableField | null,
): FieldSpec | null {
  return CORRECTABLE_FIELDS.find((spec) => spec.code === code) ?? null;
}

export function fieldLabel(spec: FieldSpec): string {
  return t.fields[spec.code] ?? humanCode(spec.code);
}

/** The value kept now, in words (« Valeur actuelle »): never a guess, « non renseignée » when empty. */
export function currentWords(spec: FieldSpec, fields: CampaignFields): string {
  const value = spec.read(fields);
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    return t.correct.currentEmpty;
  }
  if (typeof value === "string") {
    if (spec.kind === "choice") {
      return spec.words?.[value] ?? humanCode(value);
    }
    return spec.kind === "date" ? formatDay(value) : value;
  }
  if (typeof value === "boolean") {
    return value ? t.correct.yes : t.correct.no;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return (value as readonly string[])
    .map((line, at) => r.keyMessage(at + 1, line))
    .join("\n");
}

/** The editor starts on the value kept now: a correction is an edit, not a retyping. */
export function initialText(spec: FieldSpec, fields: CampaignFields): string {
  const value = spec.read(fields);
  if (value === null) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (typeof value === "number") {
    return String(value);
  }
  return typeof value === "string" ? value : value.join("\n");
}

export type CorrectionDraft = {
  fieldCode: CampaignCorrectableField | null;
  text: string;
  reasonCode: InterventionReasonCode | null;
  comment: string;
};

export const EMPTY_CORRECTION: CorrectionDraft = {
  fieldCode: null,
  text: "",
  reasonCode: null,
  comment: "",
};

/** The most a key messages list holds (0303: five ranks). */
const KEY_MESSAGES_MAX = 5;
const INTEGER_MAX = 32767;

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function isCalendarDay(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
}

function typedValue(
  spec: FieldSpec,
  text: string,
): Checked<CampaignCorrectionValue> {
  const c = t.correct;
  switch (spec.kind) {
    case "text":
    case "multiline": {
      const value = text.trim();
      return value === ""
        ? problem("value", c.valueRequired)
        : { ok: true, body: value };
    }
    case "choice":
      if (text === "") {
        return problem("value", c.valueRequired);
      }
      return spec.options?.includes(text) === true
        ? { ok: true, body: text }
        : problem("value", c.optionInvalid);
    case "yesno":
      return text === "yes" || text === "no"
        ? { ok: true, body: text === "yes" }
        : problem("value", c.valueRequired);
    case "integer": {
      if (text.trim() === "") {
        return problem("value", c.valueRequired);
      }
      const value = Number(text.trim());
      return /^\d{1,5}$/.test(text.trim()) && value <= INTEGER_MAX
        ? { ok: true, body: value }
        : problem("value", c.integerInvalid);
    }
    case "date":
      if (text.trim() === "") {
        return problem("value", c.valueRequired);
      }
      return isCalendarDay(text.trim())
        ? { ok: true, body: text.trim() }
        : problem("value", c.dateInvalid);
    case "lines": {
      const lines = linesOf(text);
      if (lines.length === 0) {
        return problem("value", c.valueRequired);
      }
      return lines.length > KEY_MESSAGES_MAX
        ? problem("value", c.linesTooMany)
        : { ok: true, body: lines };
    }
  }
}

function sameAsStored(stored: Stored, value: CampaignCorrectionValue): boolean {
  if (Array.isArray(stored) && Array.isArray(value)) {
    return (
      stored.length === value.length &&
      stored.every((line, at) => line === value[at])
    );
  }
  return stored === value;
}

/** The correction as the API takes it: a field, its new value as typed by its kind, a reason, the comment of « other ». */
export function correctionCheck(
  draft: CorrectionDraft,
  fields: CampaignFields,
): Checked<CorrectCampaignFieldRequest> {
  const spec = specOf(draft.fieldCode);
  if (spec === null) {
    return problem("field", t.correct.fieldRequired);
  }
  const value = typedValue(spec, draft.text);
  if (!value.ok) {
    return value;
  }
  if (sameAsStored(spec.read(fields), value.body)) {
    return problem("value", t.correct.valueUnchanged);
  }
  const why = reasonAndComment(draft.reasonCode, draft.comment);
  if (!why.ok) {
    return why;
  }
  return {
    ok: true,
    body: { fieldCode: spec.code, value: value.body, ...why.body },
  };
}

// --- The passages of an agent (09 RG8, RG9, RG93) ----------------------------------------------------------

export type PassageDraft = {
  reasonCode: InterventionReasonCode | null;
  comment: string;
};

export const EMPTY_PASSAGE: PassageDraft = { reasonCode: null, comment: "" };

export function passageCheck(
  draft: PassageDraft,
): Checked<CampaignPassageRequest> {
  return reasonAndComment(draft.reasonCode, draft.comment);
}

// --- The draft opened for a brand (09 RG1, RG94, CA61; Q2) ---------------------------------------------------

const TITLE_MAX = 140;

export function creationCheck(
  accountId: string,
  title: string,
  campaignType: string,
): Checked<CreateCampaignForBrandRequest> {
  const text = title.trim();
  if (text === "") {
    return problem("title", t.create.titleRequired);
  }
  if (text.length > TITLE_MAX) {
    return problem("title", t.create.titleTooLong);
  }
  if (!(CAMPAIGN_TYPE_CODES as readonly string[]).includes(campaignType)) {
    return problem("type", t.create.typeRequired);
  }
  return {
    ok: true,
    body: { advertiserAccountId: accountId, title: text, campaignType },
  };
}

// --- What the notices say, what a refusal means ------------------------------------------------------------

/** The sentence after a correction: under the caller's claim, the version of the campaign changed. */
export function correctedNotice(reviewToken: string | null): string {
  return reviewToken === null ? t.correct.done : t.correct.doneHeld;
}

const REFUSALS = messages.claimedReview.refusals;

/** A conflict of the acts of the record, by the issue the API names (409 on the path `campaign`). */
const CONFLICT_TEXT: Readonly<Record<string, string>> = {
  campaign_not_pausable: REFUSALS.campaignNotPausable,
  campaign_not_resumable: REFUSALS.campaignNotResumable,
  campaign_not_closable: REFUSALS.campaignNotClosable,
  campaign_not_correctable: REFUSALS.campaignNotCorrectable,
  campaign_closed: REFUSALS.campaignClosed,
  first_review_given: REFUSALS.firstReviewGiven,
  brand_not_active: REFUSALS.brandNotActive,
  // the pending campaign is corrected under the caller's own claim of its entry
  claim_not_held: t.failures.claimNeeded,
  claim_lifted: t.failures.claimNeeded,
  held_by_other: t.failures.claimNeeded,
  entry_closed: REFUSALS.campaignNotCorrectable,
  campaign_state: REFUSALS.campaignNotCorrectable,
};

/** The 400 of a value the database refused, by the issue `invalid_<field>` the API names. */
const VALIDATION_TEXT: Readonly<Record<string, string>> = {
  invalid_value: t.failures.valueRefused,
  unchanged: t.failures.unchanged,
  invalid_internal_comment: t.failures.commentRefused,
  invalid_reason: t.failures.reasonRefused,
  invalid_title: t.failures.titleRefused,
  invalid_campaign_type: t.failures.typeRefused,
};

/**
 * What a refused call of the record means, or null to leave the common sentence. A conflict also tells the
 * screen to read the record again (`readsAgain`): the state it drew is not the base's any more.
 */
export function actFailureOf(
  code: string | undefined,
  issues: readonly string[],
): { text: string; readsAgain: boolean } | null {
  const table =
    code === "conflict"
      ? CONFLICT_TEXT
      : code === "validation_failed"
        ? VALIDATION_TEXT
        : null;
  if (table !== null) {
    for (const issue of issues) {
      const text = table[issue];
      if (text !== undefined) {
        return { text, readsAgain: code === "conflict" };
      }
    }
  }
  if (code === "forbidden" && issues.includes("conflict_of_interest")) {
    return {
      text: messages.claimedReview.errors.conflictOfInterest,
      readsAgain: false,
    };
  }
  return null;
}

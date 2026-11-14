// The rules of the screens "mes campagnes" and the campaign form that are not apps/api's (docs/mvp/17
// §4.3; 09 RG14, RG21 to RG23, RG108; jalons/l3b, commits 09 and 10): the draft the form holds, the
// patch of what changed, the dependents a change empties (EC-L3B-07-1), the checks the browser makes
// with the very schema the API validates with (RG14), the order of the four dates (RG70, RG74), the
// warnings a text shows (RG21 to RG23, never a refusal), which message an answer calls for, which
// state allows editing, what the submission names as missing (RG4, CA3). Pure functions,
// unit-tested (tests/campaign-view.test.ts); the components and the hook only display and call.
// The bounds of the texts, the dates and the required fields are packages/domain's (the form reads
// the same as the API); the missing fields come in each answer of the API, nothing of them is
// computed here. No amount is entered, shown or computed on this screen but a band chosen from the
// grid (CLAUDE.md §2, D48, D78): the band is a code, its label is a translation. The total budget of
// RG55 is not typed here (EC-L3B-10-1): turning an amount typed into the minor unit is the one
// multiplication T16.6 exempts, and the function that holds it does not exist yet.
import {
  updateCampaignBodySchema,
  type CampaignDeliverable,
  type CampaignResponse,
  type CampaignStatus,
} from "@influx/contracts/campaign";
import {
  CAMPAIGN_DATE_FIELDS,
  CAMPAIGN_GIFT_ONLY,
  CAMPAIGN_NO_USAGE_RIGHTS,
  CAMPAIGN_REQUIRED_FIELD_STEP,
  CAMPAIGN_STEPS,
  CAMPAIGN_TERRITORY_SELECTED,
  CAMPAIGN_TERRITORY_WORLDWIDE,
  CAMPAIGN_TEXT_KINDS,
  CAMPAIGN_TEXT_WARNING_CODE,
  campaignDateConflicts,
  campaignTextKinds,
  isPublicationWindowTooLong,
  type CampaignDateConflict,
  type CampaignDateField,
  type CampaignRequiredField,
  type CampaignStep,
} from "./campaign-domain";
import type { RelayResult } from "@influx/web-platform/relay-client";
import type { StatusTone } from "@/components/member/ui/status-badge-classes";

// --- The steps ----------------------------------------------------------------------------------

/** The five steps of the form (17 §4.3). */
export const TOTAL_STEPS = CAMPAIGN_STEPS.length;

/** The steps that have a screen: an entry without a screen is left out (02 §21.5 point 9). */
export const AVAILABLE_STEPS: readonly CampaignStep[] = [1, 2, 3, 4, 5];

/** The step a `?step=` of the address names; the first one when it names none that exists. */
export function stepOfParameter(
  value: string | string[] | undefined,
): CampaignStep {
  const text = Array.isArray(value) ? value[0] : value;
  const found = AVAILABLE_STEPS.find((step) => String(step) === text);
  return found ?? 1;
}

// --- The draft ----------------------------------------------------------------------------------

/** One line of deliverables as the form holds it: a line half entered has an empty code. */
export type DeliverableDraft = {
  networkCode: string;
  formatCode: string;
  quantity: number;
};

/** What the form holds, field by field; texts as typed, lists as chosen, `null` for "not chosen". */
export type CampaignDraft = {
  // step 1: the offer (blocks 1 and 2)
  title: string;
  campaignType: string | null;
  publicSummary: string;
  brief: string;
  internalReference: string;
  productDescription: string;
  productSector: string | null;
  keyMessages: string[];
  restrictions: string;
  productIsSent: boolean | null;
  currency: string | null;
  productValueBand: string | null;
  creatorKeepsProduct: boolean | null;
  shippingCostsBorneBy: string | null;
  // step 2: the work expected (block 3)
  deliverables: DeliverableDraft[];
  usageRights: string | null;
  usageRightsDuration: string | null;
  usageRightsTerritoryScope: string | null;
  usageRightsTerritories: string[];
  exclusivity: string | null;
  contentReviewDelay: string | null;
  // step 3: for whom (block 4)
  audienceCountries: string[];
  audienceLanguages: string[];
  audienceTopics: string[];
  audienceBands: string[];
  audienceAgeBands: string[];
  audienceGender: string | null;
  // step 4: the budget (block 5), the currency being asked in step 1 too once a product is sent
  remunerationKind: string | null;
  budgetBand: string | null;
  creatorsWanted: number | null;
  // step 5: the calendar (block 6), the dates as the civil dates of the form ("" for none), then the
  // application (block 7)
  applicationsCloseOn: string;
  contentDueOn: string;
  startsOn: string;
  endsOn: string;
  requestedItems: string[];
  maxApplications: number | null;
};

export type DraftKey = keyof CampaignDraft;

/** The step each field belongs to, in the order of the form (17 §4.3). */
export const STEP_OF_KEY: Readonly<Record<DraftKey, CampaignStep>> = {
  title: 1,
  campaignType: 1,
  publicSummary: 1,
  brief: 1,
  internalReference: 1,
  productDescription: 1,
  productSector: 1,
  keyMessages: 1,
  restrictions: 1,
  productIsSent: 1,
  currency: 1,
  productValueBand: 1,
  creatorKeepsProduct: 1,
  shippingCostsBorneBy: 1,
  deliverables: 2,
  usageRights: 2,
  usageRightsDuration: 2,
  usageRightsTerritoryScope: 2,
  usageRightsTerritories: 2,
  exclusivity: 2,
  contentReviewDelay: 2,
  audienceCountries: 3,
  audienceLanguages: 3,
  audienceTopics: 3,
  audienceBands: 3,
  audienceAgeBands: 3,
  audienceGender: 3,
  remunerationKind: 4,
  budgetBand: 4,
  creatorsWanted: 4,
  applicationsCloseOn: 5,
  contentDueOn: 5,
  startsOn: 5,
  endsOn: 5,
  requestedItems: 5,
  maxApplications: 5,
};

/** The fields in the order of the form. */
export const DRAFT_KEYS = Object.keys(STEP_OF_KEY) as DraftKey[];

/** What the form holds for a campaign the API answered. */
export function draftOf(campaign: CampaignResponse): CampaignDraft {
  return {
    title: campaign.title ?? "",
    campaignType: campaign.campaignType,
    publicSummary: campaign.publicSummary ?? "",
    brief: campaign.brief ?? "",
    internalReference: campaign.internalReference ?? "",
    productDescription: campaign.productDescription ?? "",
    productSector: campaign.productSector,
    keyMessages: [...campaign.keyMessages],
    restrictions: campaign.restrictions ?? "",
    productIsSent: campaign.productIsSent,
    currency: campaign.currency,
    productValueBand: campaign.productValueBand,
    creatorKeepsProduct: campaign.creatorKeepsProduct,
    shippingCostsBorneBy: campaign.shippingCostsBorneBy,
    deliverables: campaign.deliverables.map((line) => ({ ...line })),
    usageRights: campaign.usageRights,
    usageRightsDuration: campaign.usageRightsDuration,
    usageRightsTerritoryScope: campaign.usageRightsTerritoryScope,
    usageRightsTerritories: [...campaign.usageRightsTerritories],
    exclusivity: campaign.exclusivity,
    contentReviewDelay: campaign.contentReviewDelay,
    audienceCountries: [...campaign.audienceCountries],
    audienceLanguages: [...campaign.audienceLanguages],
    audienceTopics: [...campaign.audienceTopics],
    audienceBands: [...campaign.audienceBands],
    audienceAgeBands: [...campaign.audienceAgeBands],
    audienceGender: campaign.audienceGender,
    remunerationKind: campaign.remunerationKind,
    budgetBand: campaign.budgetBand,
    creatorsWanted: campaign.creatorsWanted,
    applicationsCloseOn: campaign.applicationsCloseOn ?? "",
    contentDueOn: campaign.contentDueOn ?? "",
    startsOn: campaign.startsOn ?? "",
    endsOn: campaign.endsOn ?? "",
    requestedItems: [...campaign.requestedItems],
    maxApplications: campaign.maxApplications,
  };
}

/** The deliverable lines the API can take: a line with its network and its format both chosen. */
export function completeDeliverables(
  lines: readonly DeliverableDraft[],
): CampaignDeliverable[] {
  return lines
    .filter((line) => line.networkCode !== "" && line.formatCode !== "")
    .map((line) => ({
      networkCode: line.networkCode,
      formatCode: line.formatCode,
      quantity: line.quantity,
    }));
}

/**
 * What the API would hold for a field: the deliverables only count once their line is complete (a
 * line half entered is kept on the screen, never sent, RG108), the rest as it is.
 */
function comparableOf(key: DraftKey, draft: CampaignDraft): unknown {
  return key === "deliverables"
    ? completeDeliverables(draft.deliverables)
    : draft[key];
}

/** Two values of a field are the same: a list is compared in order, element by element. */
export function sameValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

// --- What a change empties (EC-L3B-07-1) ---------------------------------------------------------

/**
 * The fields an answer makes inapplicable, which the API refuses to leave filled and never empties
 * itself (`not_applicable`): the form sends them emptied in the same save as the answer that
 * changes them. The two bands follow the currency: a band belongs to the grid of one currency. The
 * budget band follows the nature too: "gift only" asks none (RG63, CA76).
 */
export const DEPENDENT_KEYS: Readonly<
  Partial<Record<DraftKey, readonly DraftKey[]>>
> = {
  productIsSent: [
    "productValueBand",
    "creatorKeepsProduct",
    "shippingCostsBorneBy",
  ],
  currency: ["productValueBand", "budgetBand"],
  remunerationKind: ["budgetBand"],
  usageRights: [
    "usageRightsDuration",
    "usageRightsTerritoryScope",
    "usageRightsTerritories",
  ],
  usageRightsTerritoryScope: ["usageRightsTerritories"],
};

/**
 * The draft after one answer: the value, and the dependents it makes inapplicable emptied (a product
 * no longer sent, no usage right, a territory that is the world, a currency that changes).
 */
export function applyChange<Key extends DraftKey>(
  draft: CampaignDraft,
  key: Key,
  value: CampaignDraft[Key],
): CampaignDraft {
  const next: CampaignDraft = { ...draft, [key]: value };
  switch (key) {
    case "productIsSent":
      if (value === false) {
        next.productValueBand = null;
        next.creatorKeepsProduct = null;
        next.shippingCostsBorneBy = null;
      }
      break;
    case "currency":
      next.productValueBand = null;
      next.budgetBand = null;
      break;
    case "remunerationKind":
      if (value === CAMPAIGN_GIFT_ONLY) {
        next.budgetBand = null;
      }
      break;
    case "usageRights":
      if (value === CAMPAIGN_NO_USAGE_RIGHTS) {
        next.usageRightsDuration = null;
        next.usageRightsTerritoryScope = null;
        next.usageRightsTerritories = [];
      }
      break;
    case "usageRightsTerritoryScope":
      if (value === CAMPAIGN_TERRITORY_WORLDWIDE) {
        next.usageRightsTerritories = [];
      }
      break;
    default:
      break;
  }
  return next;
}

/**
 * The fields whose refusal an answer may settle: a type "content delivered to the brand" is refused
 * while the usage rights are none, and the rights refused while the type is UGC (RG43); a gift refused
 * while no product is sent (RG29); a date refused for the order or the length of the calendar (RG70,
 * RG74). An answer on one clears the error of the other, so that it is sent again with the next save.
 */
export const RELATED_ERROR_KEYS: Readonly<
  Partial<Record<DraftKey, readonly DraftKey[]>>
> = {
  campaignType: ["usageRights"],
  usageRights: ["campaignType"],
  // a gift needs a product sent (RG29): the answer of step 1 settles the nature of step 4
  productIsSent: ["remunerationKind"],
  // the four dates hold together (RG70, RG74): a change of one may settle the refusal of another
  applicationsCloseOn: ["contentDueOn", "startsOn", "endsOn"],
  contentDueOn: ["applicationsCloseOn", "startsOn", "endsOn"],
  startsOn: ["applicationsCloseOn", "contentDueOn", "endsOn"],
  endsOn: ["applicationsCloseOn", "contentDueOn", "startsOn"],
};

// --- The patch of the autosave (RG108) ------------------------------------------------------------

/** Why a field is not accepted, as a key of `campaign.fieldErrors`. */
export type FieldError =
  | "invalid"
  | "unknown"
  | "tooLong"
  | "duplicate"
  | "formatNetworkMismatch"
  | "ugcRequiresRights"
  | "giftRequiresProduct"
  | "notApplicable"
  | "dateOrder"
  | "windowTooLong"
  | "required";

export type FieldErrors = Partial<Record<DraftKey, FieldError>>;

/** The part of the body that one field makes (an object the schema reads). */
function fragmentOf(
  key: DraftKey,
  draft: CampaignDraft,
): Record<string, unknown> {
  switch (key) {
    case "title":
    case "publicSummary":
    case "brief":
    case "internalReference":
    case "productDescription":
    case "restrictions":
      // Kept as typed (margins and line breaks); the API trims, and a blank text empties the field.
      return { [key]: draft[key] === "" ? null : draft[key] };
    case "applicationsCloseOn":
    case "contentDueOn":
    case "startsOn":
    case "endsOn":
      // A date cleared empties the field.
      return { [key]: draft[key] === "" ? null : draft[key] };
    case "deliverables":
      return { deliverables: completeDeliverables(draft.deliverables) };
    default:
      return { [key]: draft[key] };
  }
}

export type PatchPlan = {
  /** What to send: the valid changes, `null` when there is nothing to send. */
  body: Record<string, unknown> | null;
  /** The fields that changed and are sent (to mark as saved once the API accepted them). */
  keys: DraftKey[];
  /** The changed fields the browser refuses, each with its reason; not sent, kept in the form. */
  refused: FieldErrors;
};

/**
 * The autosave of what changed since the last answer of the API (RG108): each changed field is
 * checked alone with the schema of the API (RG14), so that one wrong field never holds back the
 * others, and the ones accepted make the body. `skip`: the fields already in error, left alone until
 * the member changes them (no loop).
 */
export function planPatch(
  draft: CampaignDraft,
  saved: CampaignDraft,
  skip: FieldErrors = {},
): PatchPlan {
  const schema = updateCampaignBodySchema;
  const patch: Record<string, unknown> = {};
  const keys: DraftKey[] = [];
  const refused: FieldErrors = {};
  const calendar = dateIssuesOf(draft);
  for (const key of DRAFT_KEYS) {
    if (
      sameValue(comparableOf(key, draft), comparableOf(key, saved)) ||
      skip[key] !== undefined
    ) {
      continue;
    }
    // A date that breaks the order or the length of the calendar is kept on the screen, never sent
    // (the API refuses it all the same): the screen names the two dates that conflict.
    if (isDateKey(key)) {
      if (calendar.inConflict.has(key)) {
        refused[key] = "dateOrder";
        continue;
      }
      if (calendar.windowTooLong && (key === "startsOn" || key === "endsOn")) {
        refused[key] = "windowTooLong";
        continue;
      }
    }
    const fragment = fragmentOf(key, draft);
    if (!schema.safeParse(fragment).success) {
      refused[key] = "invalid";
      continue;
    }
    Object.assign(patch, fragment);
    keys.push(key);
  }
  return {
    body: keys.length > 0 && schema.safeParse(patch).success ? patch : null,
    keys,
    refused,
  };
}

/**
 * The body of one field alone, with the dependents it empties that changed too: what a refused patch
 * is split into to find the wrong field (the API checks a field against the others, so a field is
 * never sent apart from the fields its answer empties).
 */
export function singleFieldPatch(
  key: DraftKey,
  draft: CampaignDraft,
  saved: CampaignDraft,
): { body: Record<string, unknown>; keys: DraftKey[] } | null {
  const keys = [
    key,
    ...(DEPENDENT_KEYS[key] ?? []).filter(
      (dependent) =>
        !sameValue(
          comparableOf(dependent, draft),
          comparableOf(dependent, saved),
        ),
    ),
  ];
  const body: Record<string, unknown> = {};
  for (const member of keys) {
    Object.assign(body, fragmentOf(member, draft));
  }
  return updateCampaignBodySchema.safeParse(body).success
    ? { body, keys }
    : null;
}

/** The reason of a field refused by the API (a 400 on its own), from the issues of the answer. */
export function fieldErrorOf(result: RelayResult<unknown>): FieldError {
  const issues = result.kind === "failed" ? (result.issues ?? []) : [];
  const has = (issue: string) => issues.includes(issue);
  if (has("ugc_requires_rights")) return "ugcRequiresRights";
  if (has("gift_requires_product")) return "giftRequiresProduct";
  if (has("format_network_mismatch")) return "formatNetworkMismatch";
  if (has("duplicate")) return "duplicate";
  if (has("too_long")) return "tooLong";
  if (has("unknown")) return "unknown";
  if (has("not_applicable")) return "notApplicable";
  if (has("date_order")) return "dateOrder";
  if (has("window_too_long")) return "windowTooLong";
  return "invalid";
}

/**
 * After the API accepted the fields sent: they are the new reference of the next patch. The texts
 * stay as typed (the margins of a text being typed must not vanish under the cursor).
 */
export function afterSave(
  saved: CampaignDraft,
  sent: CampaignDraft,
  keys: readonly DraftKey[],
): CampaignDraft {
  const next: CampaignDraft = { ...saved };
  for (const key of keys) {
    Object.assign(next, { [key]: sent[key] });
  }
  return next;
}

// --- The calendar (RG70, RG74) ---------------------------------------------------------------------

/** The four dates of the form are the fields of the domain's own list. */
export function isDateKey(key: DraftKey): key is CampaignDateField {
  return (CAMPAIGN_DATE_FIELDS as readonly string[]).includes(key);
}

/** The dates the form holds, a date not entered being none (the domain reads `null`). */
function datesOf(
  draft: CampaignDraft,
): Record<CampaignDateField, string | null> {
  return {
    applicationsCloseOn: draft.applicationsCloseOn || null,
    contentDueOn: draft.contentDueOn || null,
    startsOn: draft.startsOn || null,
    endsOn: draft.endsOn || null,
  };
}

/** The pairs of dates out of order, in the order of the calendar (RG70): the screen names both. */
export function dateConflictsOf(draft: CampaignDraft): CampaignDateConflict[] {
  return campaignDateConflicts(datesOf(draft));
}

/** What is wrong with the calendar the form holds: the dates in conflict, the period too long. */
function dateIssuesOf(draft: CampaignDraft): {
  inConflict: ReadonlySet<DraftKey>;
  windowTooLong: boolean;
} {
  const dates = datesOf(draft);
  const inConflict = new Set<DraftKey>();
  for (const conflict of campaignDateConflicts(dates)) {
    inConflict.add(conflict.earlier);
    inConflict.add(conflict.later);
  }
  return {
    inConflict,
    windowTooLong: isPublicationWindowTooLong(dates.startsOn, dates.endsOn),
  };
}

// --- Where each field stands ---------------------------------------------------------------------

/** The element a field is focused by: the id of its control (of the first one for a group). */
export function controlIdOf(key: DraftKey): string {
  return `campaign-${key}`;
}

/** The fields marked "required" on the form: the ones whose absence the submission names (RG4). */
export const REQUIRED_KEYS: ReadonlySet<DraftKey> = new Set<DraftKey>([
  "title",
  "campaignType",
  "publicSummary",
  "brief",
  "productDescription",
  "productSector",
  "productIsSent",
  "deliverables",
  "usageRights",
  "exclusivity",
  "contentReviewDelay",
  "audienceCountries",
  "audienceLanguages",
  "audienceTopics",
  "currency",
  "remunerationKind",
  "creatorsWanted",
  "applicationsCloseOn",
  "startsOn",
  "endsOn",
]);

/** Required once their condition holds (RG24, RG34, RG63): a product sent, rights granted, a budget asked. */
export function isConditionallyRequired(
  key: DraftKey,
  draft: CampaignDraft,
): boolean {
  switch (key) {
    case "productValueBand":
    case "creatorKeepsProduct":
    case "shippingCostsBorneBy":
      return draft.productIsSent === true;
    case "usageRightsDuration":
    case "usageRightsTerritoryScope":
      return (
        draft.usageRights !== null &&
        draft.usageRights !== CAMPAIGN_NO_USAGE_RIGHTS
      );
    case "budgetBand":
      return draft.remunerationKind !== null && !isGiftOnly(draft);
    default:
      return false;
  }
}

/** "Gift only": a product kept and no money, so no band of budget is asked (RG63, CA76). */
export function isGiftOnly(draft: CampaignDraft): boolean {
  return draft.remunerationKind === CAMPAIGN_GIFT_ONLY;
}

/** Whether a field is asked as required now. */
export function isRequired(key: DraftKey, draft: CampaignDraft): boolean {
  return REQUIRED_KEYS.has(key) || isConditionallyRequired(key, draft);
}

/** The required fields still missing in one step, as the API counted them (CA3, RG4). */
export function missingOfStep(
  missing: readonly CampaignRequiredField[],
  step: CampaignStep,
): CampaignRequiredField[] {
  return missing.filter((code) => CAMPAIGN_REQUIRED_FIELD_STEP[code] === step);
}

/**
 * The field of the form a missing code points to: the territory is the scope until it is chosen, then
 * its countries. Every other code is the name of its field.
 */
export function missingKeyOf(
  code: CampaignRequiredField,
  draft: CampaignDraft,
): DraftKey {
  if (code === "usageRightsTerritory") {
    return draft.usageRightsTerritoryScope === CAMPAIGN_TERRITORY_SELECTED
      ? "usageRightsTerritories"
      : "usageRightsTerritoryScope";
  }
  return code;
}

/** The fields still missing as errors of the form, once a submission asked for them (RG4, CA3). */
export function missingErrors(
  missing: readonly CampaignRequiredField[],
  draft: CampaignDraft,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const code of missing) {
    errors[missingKeyOf(code, draft)] = "required";
  }
  return errors;
}

/** What is missing, step by step, in the order of the form: the list the submission names (CA3). */
export function missingGroups(
  missing: readonly CampaignRequiredField[],
  draft: CampaignDraft,
): { step: CampaignStep; keys: DraftKey[] }[] {
  return AVAILABLE_STEPS.map((step) => ({
    step,
    keys: missingOfStep(missing, step).map((code) => missingKeyOf(code, draft)),
  })).filter((group) => group.keys.length > 0);
}

/** The first missing field with its step: the one the focus goes to. */
export function firstMissing(
  missing: readonly CampaignRequiredField[],
  draft: CampaignDraft,
): { step: CampaignStep; key: DraftKey } | null {
  const first = missingGroups(missing, draft)[0];
  const key = first?.keys[0];
  return first === undefined || key === undefined
    ? null
    : { step: first.step, key };
}

/**
 * The fields a refusal holds on the screen and whose entry the API does not hold: what a submission
 * must not leave behind (the campaign submitted would not be the one on the screen).
 */
export function unsavedInError(
  draft: CampaignDraft,
  saved: CampaignDraft,
  errors: FieldErrors,
): DraftKey[] {
  return (Object.keys(errors) as DraftKey[]).filter(
    (key) => !sameValue(comparableOf(key, draft), comparableOf(key, saved)),
  );
}

/**
 * The refused fields a submission must not leave behind, in the order of the screen (the steps, then
 * the fields of each): each with the step that draws it, the currency being drawn in step 1 only once a
 * product is sent, else in step 4 (RG110: the focus goes to the first one, L3BU-4).
 */
export function invalidFields(
  draft: CampaignDraft,
  saved: CampaignDraft,
  errors: FieldErrors,
): { step: CampaignStep; key: DraftKey }[] {
  return unsavedInError(draft, saved, errors)
    .map((key) => ({
      key,
      step:
        key === "currency" && draft.productIsSent !== true
          ? (4 as CampaignStep)
          : STEP_OF_KEY[key],
    }))
    .sort(
      (a, b) =>
        a.step - b.step ||
        DRAFT_KEYS.indexOf(a.key) - DRAFT_KEYS.indexOf(b.key),
    );
}

/** The first refused field of the screen with its step: the one the focus goes to, or null. */
export function firstInvalid(
  draft: CampaignDraft,
  saved: CampaignDraft,
  errors: FieldErrors,
): { step: CampaignStep; key: DraftKey } | null {
  return invalidFields(draft, saved, errors)[0] ?? null;
}

/** Whether a field is drawn in a step: the currency is also asked in step 1 once a product is sent. */
export function isKeyOfStep(
  key: DraftKey,
  step: CampaignStep,
  draft: CampaignDraft,
): boolean {
  if (key === "currency") {
    return step === 4 || (step === 1 && draft.productIsSent === true);
  }
  return STEP_OF_KEY[key] === step;
}

// --- What a text says about itself (RG21 to RG23) -------------------------------------------------

/** The warning keys (`campaign.errors.*`) a free text calls for: signalled, never refused or changed. */
export function warningKeysOf(
  texts: readonly string[],
): ("contactInText" | "linkInText" | "amountInText")[] {
  const found = new Set(texts.flatMap((text) => campaignTextKinds(text)));
  return CAMPAIGN_TEXT_KINDS.filter((kind) => found.has(kind)).map(
    (kind) =>
      CAMPAIGN_TEXT_WARNING_CODE[kind] as
        "contactInText" | "linkInText" | "amountInText",
  );
}

// --- States and dates ---------------------------------------------------------------------------

/** Whether the brand writes the campaign in this state: draft and rejected only (RG5, modele §4). */
export function isEditable(status: CampaignStatus): boolean {
  return status === "draft" || status === "rejected";
}

/** The written state of a campaign: its tone, its short label and its sentence (CA74). */
export const STATUS_TONES: Readonly<Record<CampaignStatus, StatusTone>> = {
  draft: "neutral",
  pending_review: "info",
  published: "success",
  paused: "warning",
  closed: "neutral",
  rejected: "warning",
};

/** The key of the sentence of a state in `campaign.status.*`. */
export const STATUS_TEXT_KEYS = {
  draft: "draft",
  pending_review: "pending",
  published: "published",
  paused: "paused",
  closed: "closed",
  rejected: "rejected",
} as const satisfies Record<CampaignStatus, string>;

/** A date of the base as the language writes it ("13 nov. 2026"). */
export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

// --- The formats of a network (RG36) -------------------------------------------------------------

/** What the API says of a format: its code and the network it belongs to, none for a UGC format. */
export type FormatReference = { code: string; networkCode: string | null };

/** The formats a line of the network may take: its own, and the UGC ones that go with any (RG36). */
export function formatsOfNetwork(
  formats: readonly FormatReference[],
  networkCode: string,
): string[] {
  return formats
    .filter(
      (format) =>
        format.networkCode === null || format.networkCode === networkCode,
    )
    .map((format) => format.code);
}

/** A new line of deliverables: nothing chosen, one piece. */
export function newDeliverable(): DeliverableDraft {
  return { networkCode: "", formatCode: "", quantity: 1 };
}

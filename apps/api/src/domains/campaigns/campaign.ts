// The campaigns of the member's own account: list, create, read, autosave, submit (docs/mvp/09 RG4,
// RG14, RG16 to RG85, CA2, CA3, CA72, CA76; jalons/l3b, commit 07). The rules live elsewhere and are
// only called here:
// - the bounds of the texts, the dates (RG70, RG74) and the required fields of a submission:
//   packages/domain (the form reads the same), the database holding the same as checks (0303, 0305);
// - closed lists, caps, the conditionals, the freeze (modele §4): the database arbitrates; this file
//   checks first only to say WHICH field is wrong (RG14, CA3);
// - the transition to `pending_review`, the declaration of RG85 and the register line: the door of
//   the database (0305), the only transition a member makes (RG5).
// A free text is trimmed and a blank one empties the field (EC-L2B-06-4); a coordinate, a link or an
// amount in a text is SIGNALLED by the form, never refused nor changed here (RG21 to RG23, fiche
// invariant 8). No amount is computed, no commission, no net (CLAUDE.md §2, D48, D78): the total
// budget is stored as entered.
// EC-L3B-07-1 (the choice that is safest, no invariant): a save that makes a dependent field
// inapplicable (a product no longer sent, no usage right, a gift only) is REFUSED with the field
// named, never silently emptied; the form sends the emptied fields with the answer that changes
// them. The one exception is the currency: changing it empties the two bands of the old grid in the
// same write (modele §1, else the foreign key refuses).
import {
  campaignListResponseSchema,
  campaignResponseSchema,
  type CampaignListResponse,
  type CampaignResponse,
  type CreateCampaignBody,
  type DeclarationLocale,
  type SubmitCampaignResponse,
  type UpdateCampaignBody,
} from "@influx/contracts/campaign";
import type { ValidationIssue } from "@influx/contracts/errors";
import { trimmedLength } from "@influx/domain/brand-profile";
import {
  CAMPAIGN_BRIEF_MAX_LENGTH,
  CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH,
  CAMPAIGN_KEY_MESSAGE_MAX_LENGTH,
  CAMPAIGN_PRODUCT_MAX_LENGTH,
  CAMPAIGN_RESTRICTIONS_MAX_LENGTH,
  CAMPAIGN_SUMMARY_MAX_LENGTH,
  CAMPAIGN_TITLE_MAX_LENGTH,
  campaignDateIssues,
  CAMPAIGN_NO_USAGE_RIGHTS,
  CAMPAIGN_GIFT_ONLY,
  isCivilDate,
  missingCampaignFields,
} from "@influx/domain/campaign";
import type { Transaction } from "../../db/index.ts";
import { sqlDetailOf, sqlMessageOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  CAMPAIGN_LISTS,
  insertDraftCampaign,
  listOwnCampaigns,
  readActiveCampaignReferences,
  readOwnCampaign,
  replaceCampaignDeliverables,
  replaceCampaignList,
  submitOwnCampaign,
  updateCampaignColumns,
  type ActiveCampaignReferences,
  type CampaignColumns,
  type CampaignListName,
  type StoredCampaign,
} from "./repository.ts";

/** The states a brand may write a campaign in (modele §4: the freeze is the base's too). */
const EDITABLE_STATUSES: readonly string[] = ["draft", "rejected"];

/** A text that is only margins is no text: trimmed, and blank means empty (EC-L2B-06-4). */
function normalizedText(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** The answer of the routes: the stored campaign, what is missing, the active codes. */
function viewOf(
  stored: StoredCampaign,
  references: ActiveCampaignReferences,
): CampaignResponse {
  // every active currency is the API's own check, not the form's: only those with a grid are served
  const published = Object.fromEntries(
    Object.entries(references).filter(([key]) => key !== "activeCurrencies"),
  );
  return campaignResponseSchema.parse({
    ...stored,
    missingRequired: missingCampaignFields(stored),
    references: published,
  });
}

/** GET /v1/me/campaigns: the session's own campaigns. */
export async function readCampaignList(
  tx: Transaction,
): Promise<CampaignListResponse> {
  return campaignListResponseSchema.parse({
    campaigns: await listOwnCampaigns(tx),
  });
}

/** GET /v1/me/campaigns/:id: null when the id is nobody's or another brand's (T14). */
export async function readCampaign(
  tx: Transaction,
  campaignId: string,
): Promise<CampaignResponse | null> {
  const stored = await readOwnCampaign(tx, campaignId);
  if (stored === null) {
    return null;
  }
  return viewOf(stored, await readActiveCampaignReferences(tx));
}

/** The upper bounds of the free texts, in characters outside the margins (RG16, RG24). */
const TEXT_MAXIMUMS = {
  title: CAMPAIGN_TITLE_MAX_LENGTH,
  publicSummary: CAMPAIGN_SUMMARY_MAX_LENGTH,
  brief: CAMPAIGN_BRIEF_MAX_LENGTH,
  productDescription: CAMPAIGN_PRODUCT_MAX_LENGTH,
  restrictions: CAMPAIGN_RESTRICTIONS_MAX_LENGTH,
  internalReference: CAMPAIGN_INTERNAL_REFERENCE_MAX_LENGTH,
} as const;

const SCALAR_REFERENCES = [
  ["campaignType", "campaignTypes"],
  ["productSector", "sectors"],
  ["usageRights", "usageRights"],
  ["audienceGender", "audienceGenders"],
] as const;

const LIST_REFERENCES: readonly [
  CampaignListName,
  (references: ActiveCampaignReferences) => readonly string[],
][] = [
  ["usageRightsTerritories", (references) => references.countries],
  ["audienceCountries", (references) => references.countries],
  ["audienceLanguages", (references) => references.languages],
  ["audienceBands", (references) => references.audienceBands],
  ["audienceAgeBands", (references) => references.audienceAgeBands],
  ["audienceTopics", (references) => references.topics],
  ["requestedItems", (references) => references.requestedItems],
];

/** What a save would leave in the campaign: the stored values, the body over them. */
type Merged = {
  campaignType: string | null;
  usageRights: string | null;
  usageRightsDuration: string | null;
  usageRightsTerritoryScope: string | null;
  productIsSent: boolean | null;
  productValueBand: string | null;
  creatorKeepsProduct: boolean | null;
  shippingCostsBorneBy: string | null;
  currency: string | null;
  remunerationKind: string | null;
  budgetBand: string | null;
  totalBudgetMinor: number | null;
  applicationsCloseOn: string | null;
  contentDueOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
};

function mergedOf(stored: StoredCampaign, body: UpdateCampaignBody): Merged {
  const pick = <K extends keyof Merged>(key: K): Merged[K] => {
    const value = (body as Record<string, unknown>)[key];
    return (value === undefined ? stored[key] : value) as Merged[K];
  };
  // changing the currency empties the two bands unless this very save names them (modele §1)
  const currencyChanged =
    body.currency !== undefined && body.currency !== stored.currency;
  return {
    campaignType: pick("campaignType"),
    usageRights: pick("usageRights"),
    usageRightsDuration: pick("usageRightsDuration"),
    usageRightsTerritoryScope: pick("usageRightsTerritoryScope"),
    productIsSent: pick("productIsSent"),
    productValueBand:
      body.productValueBand === undefined && currencyChanged
        ? null
        : pick("productValueBand"),
    creatorKeepsProduct: pick("creatorKeepsProduct"),
    shippingCostsBorneBy: pick("shippingCostsBorneBy"),
    currency: pick("currency"),
    remunerationKind: pick("remunerationKind"),
    budgetBand:
      body.budgetBand === undefined && currencyChanged
        ? null
        : pick("budgetBand"),
    totalBudgetMinor: pick("totalBudgetMinor"),
    applicationsCloseOn: pick("applicationsCloseOn"),
    contentDueOn: pick("contentDueOn"),
    startsOn: pick("startsOn"),
    endsOn: pick("endsOn"),
  };
}

/** The fields a save would get wrong, one issue per field and rule, never the value (RG14, CA3). */
function campaignIssues(
  body: UpdateCampaignBody,
  merged: Merged,
  keyMessages: readonly string[] | undefined,
  references: ActiveCampaignReferences,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (path: string, issue: string) => {
    if (!issues.some((found) => found.path === path && found.issue === issue)) {
      issues.push({ path, issue });
    }
  };

  // the upper bounds of the texts (the lower ones are the submission's: a draft is never refused)
  for (const [field, maximum] of Object.entries(TEXT_MAXIMUMS)) {
    const value = normalizedText(
      (body as Record<string, string | null | undefined>)[field],
    );
    if (
      value !== undefined &&
      value !== null &&
      trimmedLength(value) > maximum
    ) {
      add(field, "too_long");
    }
  }
  if (
    keyMessages?.some(
      (text) => trimmedLength(text) > CAMPAIGN_KEY_MESSAGE_MAX_LENGTH,
    )
  ) {
    add("keyMessages", "too_long");
  }

  // codes outside the active lists (a retired code is never offered)
  for (const [field, list] of SCALAR_REFERENCES) {
    const code = body[field];
    if (
      code !== undefined &&
      code !== null &&
      !references[list].includes(code)
    ) {
      add(field, "unknown");
    }
  }
  if (
    body.currency !== undefined &&
    body.currency !== null &&
    !references.activeCurrencies.includes(body.currency)
  ) {
    add("currency", "unknown");
  }
  for (const [field, listOf] of LIST_REFERENCES) {
    const codes = body[field];
    if (codes !== undefined) {
      const known = new Set(listOf(references));
      if (codes.some((code) => !known.has(code))) {
        add(field, "unknown");
      }
    }
  }

  // the bands of the grid of the currency of the campaign (Q16, RG58): none without a currency
  const bands =
    merged.currency === null
      ? null
      : (references.currencies.find((entry) => entry.code === merged.currency)
          ?.bands ?? []);
  for (const [field, band] of [
    ["budgetBand", body.budgetBand],
    ["productValueBand", body.productValueBand],
  ] as const) {
    if (band === undefined || band === null) {
      continue;
    }
    if (bands === null) {
      add("currency", "required");
    } else if (!bands.includes(band)) {
      add(field, "unknown");
    }
  }
  if (
    merged.currency === null &&
    (merged.budgetBand !== null ||
      merged.productValueBand !== null ||
      merged.totalBudgetMinor !== null)
  ) {
    add("currency", "required");
  }

  // the deliverable lines (RG36): a format of a network goes with that network, once per line
  if (body.deliverables !== undefined) {
    const networks = new Set(references.networks);
    const formats = new Map(
      references.formats.map((format) => [format.code, format.networkCode]),
    );
    const seen = new Set<string>();
    for (const line of body.deliverables) {
      const formatNetwork = formats.get(line.formatCode);
      if (!networks.has(line.networkCode) || formatNetwork === undefined) {
        add("deliverables", "unknown");
      } else if (formatNetwork !== null && formatNetwork !== line.networkCode) {
        add("deliverables", "format_network_mismatch");
      }
      const key = `${line.networkCode}/${line.formatCode}`;
      if (seen.has(key)) {
        add("deliverables", "duplicate");
      }
      seen.add(key);
    }
  }

  // dates that exist (RG69), in order (RG70), over at most 12 months (RG74)
  for (const field of [
    "applicationsCloseOn",
    "contentDueOn",
    "startsOn",
    "endsOn",
  ] as const) {
    const value = body[field];
    if (value !== undefined && value !== null && !isCivilDate(value)) {
      add(field, "invalid_date");
    }
  }
  const calendar = campaignDateIssues(merged);
  for (const conflict of calendar.conflicts) {
    add(conflict.later, "date_order");
  }
  if (calendar.windowTooLong) {
    add("endsOn", "window_too_long");
  }

  // the conditionals the database holds in every state (0303; RG24, RG39, RG43, RG63, CA76)
  if (merged.usageRights === CAMPAIGN_NO_USAGE_RIGHTS) {
    if (merged.usageRightsDuration !== null) {
      add("usageRightsDuration", "not_applicable");
    }
    if (merged.usageRightsTerritoryScope !== null) {
      add("usageRightsTerritoryScope", "not_applicable");
    }
    if (merged.campaignType === "ugc_delivered") {
      add("usageRights", "ugc_requires_rights");
    }
  }
  if (merged.productIsSent === false) {
    if (merged.productValueBand !== null) {
      add("productValueBand", "not_applicable");
    }
    if (merged.creatorKeepsProduct !== null) {
      add("creatorKeepsProduct", "not_applicable");
    }
    if (merged.shippingCostsBorneBy !== null) {
      add("shippingCostsBorneBy", "not_applicable");
    }
    if (
      merged.remunerationKind === "cash_and_gift" ||
      merged.remunerationKind === CAMPAIGN_GIFT_ONLY
    ) {
      add("remunerationKind", "gift_requires_product");
    }
  }
  if (
    merged.remunerationKind === CAMPAIGN_GIFT_ONLY &&
    merged.budgetBand !== null
  ) {
    add("budgetBand", "not_applicable");
  }
  return issues;
}

/** The columns a body sets, texts trimmed; the bands emptied with a currency that changes. */
function columnsOf(
  body: UpdateCampaignBody,
  merged: Merged,
  stored: StoredCampaign,
): CampaignColumns {
  const currencyChanged =
    body.currency !== undefined && body.currency !== stored.currency;
  const columns: CampaignColumns = {
    title: normalizedText(body.title),
    campaignType: body.campaignType,
    publicSummary: normalizedText(body.publicSummary),
    brief: normalizedText(body.brief),
    internalReference: normalizedText(body.internalReference),
    productDescription: normalizedText(body.productDescription),
    productSector: body.productSector,
    restrictions: normalizedText(body.restrictions),
    productIsSent: body.productIsSent,
    productValueBand: body.productValueBand,
    creatorKeepsProduct: body.creatorKeepsProduct,
    shippingCostsBorneBy: body.shippingCostsBorneBy,
    usageRights: body.usageRights,
    usageRightsDuration: body.usageRightsDuration,
    usageRightsTerritoryScope: body.usageRightsTerritoryScope,
    exclusivity: body.exclusivity,
    contentReviewDelay: body.contentReviewDelay,
    contentDueOn: body.contentDueOn,
    audienceGender: body.audienceGender,
    currency: body.currency,
    remunerationKind: body.remunerationKind,
    budgetBand: body.budgetBand,
    creatorsWanted: body.creatorsWanted,
    totalBudgetMinor: body.totalBudgetMinor,
    applicationsCloseOn: body.applicationsCloseOn,
    startsOn: body.startsOn,
    endsOn: body.endsOn,
    maxApplications: body.maxApplications,
  };
  if (currencyChanged) {
    columns.productValueBand ??= merged.productValueBand;
    columns.budgetBand ??= merged.budgetBand;
  }
  // an absent key is left alone: drop what the body did not name
  return Object.fromEntries(
    Object.entries(columns).filter(([, value]) => value !== undefined),
  ) as CampaignColumns;
}

/** The key messages as saved: trimmed, a blank bullet dropped (it is no bullet). */
function keyMessagesOf(body: UpdateCampaignBody): string[] | undefined {
  return body.keyMessages
    ?.map((text) => text.trim())
    .filter((text) => text !== "");
}

/**
 * The write itself, the campaign row already locked and read: the checks that name the field, then
 * the columns and the lists in the same transaction. What only the database knows (a constraint it
 * holds, the freeze) comes back as a generic refusal or a conflict.
 */
async function writeCampaign(
  tx: Transaction,
  stored: StoredCampaign,
  body: UpdateCampaignBody,
  references: ActiveCampaignReferences,
): Promise<void> {
  if (!EDITABLE_STATUSES.includes(stored.status)) {
    // modele §4: INFLUX examines the submitted version, the brand writes in draft and rejected only
    throw new ApiError("conflict", [
      { path: "status", issue: "campaign_not_editable" },
    ]);
  }
  const merged = mergedOf(stored, body);
  const keyMessages = keyMessagesOf(body);
  const issues = campaignIssues(body, merged, keyMessages, references);
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }
  try {
    await updateCampaignColumns(tx, stored.id, columnsOf(body, merged, stored));
    if (keyMessages !== undefined) {
      await replaceCampaignList(tx, stored.id, "keyMessages", keyMessages);
    }
    if (body.deliverables !== undefined) {
      await replaceCampaignDeliverables(tx, stored.id, body.deliverables);
    }
    for (const name of Object.keys(CAMPAIGN_LISTS) as CampaignListName[]) {
      const values = (body as Record<string, unknown>)[name];
      if (name !== "keyMessages" && values !== undefined) {
        await replaceCampaignList(
          tx,
          stored.id,
          name,
          values as readonly string[],
        );
      }
    }
  } catch (error) {
    // What the checks above cannot know: a constraint the database holds (0303), or its freeze.
    const state = sqlStateOf(error);
    if (
      state === "23514" ||
      state === "23503" ||
      state === "23505" ||
      state === "22023" ||
      state === "22021" ||
      state === "22P05"
    ) {
      throw new RequestValidationError([{ path: "", issue: "invalid" }]);
    }
    if (state === "55000") {
      throw new ApiError("conflict", [
        { path: "status", issue: "campaign_not_editable" },
      ]);
    }
    throw error;
  }
}

async function answerOf(
  tx: Transaction,
  campaignId: string,
  references: ActiveCampaignReferences,
): Promise<CampaignResponse> {
  const stored = await readOwnCampaign(tx, campaignId);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  return viewOf(stored, references);
}

/**
 * POST /v1/me/campaigns: a draft of the session's account (CA2: the profile blocks the submission
 * only), with the fields already entered when the body names some. Not journalled: no register line
 * exists for a creation (modele §3, -10).
 */
export async function createCampaign(
  tx: Transaction,
  body: CreateCampaignBody | undefined,
): Promise<CampaignResponse> {
  const references = await readActiveCampaignReferences(tx);
  let campaignId: string;
  try {
    campaignId = await insertDraftCampaign(tx);
  } catch (error) {
    // no brand profile row (a foreign key): nothing a brand may create here
    if (sqlStateOf(error) === "23503" || sqlStateOf(error) === "42501") {
      throw new ApiError("not_found");
    }
    throw error;
  }
  if (body !== undefined && Object.keys(body).length > 0) {
    const stored = await readOwnCampaign(tx, campaignId, { lock: true });
    if (stored === null) {
      throw new ApiError("not_found");
    }
    await writeCampaign(tx, stored, body as UpdateCampaignBody, references);
  }
  return answerOf(tx, campaignId, references);
}

/**
 * PATCH /v1/me/campaigns/:id: autosave of what changed, in ONE transaction (the row locked first).
 * Texts are trimmed, lists replaced as a whole, the rules of packages/domain applied before the
 * base, which arbitrates (RG14). A campaign outside draft and rejected is a conflict (modele §4);
 * an id that is nobody's or another brand's is no such route (T14).
 */
export async function saveCampaign(
  tx: Transaction,
  campaignId: string,
  body: UpdateCampaignBody,
): Promise<CampaignResponse> {
  const stored = await readOwnCampaign(tx, campaignId, { lock: true });
  if (stored === null) {
    throw new ApiError("not_found");
  }
  const references = await readActiveCampaignReferences(tx);
  await writeCampaign(tx, stored, body, references);
  return answerOf(tx, campaignId, references);
}

/** `campaign_type` of the database, `campaignType` of the contract and of packages/domain. */
function camelOf(code: string): string {
  return code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * POST /v1/me/campaigns/:id/submit (RG4, RG5, RG84, RG85, CA2, CA3): draft or rejected to
 * `pending_review`. The database decides and journals (`campaign.submitted`); the refusals are read
 * from its MESSAGE (the code of the refusal) and its DETAIL: every missing field, in the order of the
 * form. The language of the declaration is passed only when the box is ticked.
 */
export async function submitCampaign(
  tx: Transaction,
  campaignId: string,
  declarationLocale: DeclarationLocale | null,
): Promise<SubmitCampaignResponse> {
  let outcome;
  try {
    outcome = await submitOwnCampaign(tx, campaignId, declarationLocale);
  } catch (error) {
    const message = sqlMessageOf(error);
    switch (sqlStateOf(error)) {
      case "42501":
        throw new ApiError("not_found");
      case "55000":
        if (message === "profile_not_published") {
          throw new ApiError("conflict", [
            { path: "profile", issue: "profile_not_published" },
          ]);
        }
        throw new ApiError("conflict", [
          { path: "status", issue: "campaign_not_submittable" },
        ]);
      case "23514": {
        if (message === "authorizations_declaration") {
          throw new RequestValidationError([
            { path: "authorizationsDeclaration", issue: "required" },
          ]);
        }
        const fields = (sqlDetailOf(error) ?? "")
          .split(",")
          .filter((code) => code !== "")
          .map(camelOf);
        if (message === "required_fields_missing" && fields.length > 0) {
          throw new RequestValidationError(
            fields.map((field) => ({ path: field, issue: "required" })),
          );
        }
        throw error;
      }
      default:
        throw error;
    }
  }
  const view = await answerOf(
    tx,
    campaignId,
    await readActiveCampaignReferences(tx),
  );
  return { ...view, changed: outcome.changed };
}

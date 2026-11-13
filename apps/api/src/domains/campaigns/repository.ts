// SQL of the campaigns of the member's own account (docs/mvp/09; 0303, 0305; jalons/l3b/modele.md
// §2 to §5; commit 07). Every statement runs in the member's transaction, as influx_advertiser: the
// account is the one of the transaction context (`influx.current_account_id()`), never a parameter,
// and the policies of 0303 bind every read and write to it. A campaign of another brand is a row
// that does not exist for this role.
// - The columns of the blocks 1 to 7 (the freeze of modele §4 is the database's: 55000 outside
//   draft and rejected), the nine lists replaced as a whole (delete, then insert, one transaction).
// - The submission is campaigns.submit_own_campaign() (0305), the only member transition: 42501
//   forbidden (nobody's campaign), 55000 (state, profile), 23514 (missing fields, declaration).
// No amount is computed here and no column the brand holds no right on is named (D78).
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
const CIVIL_DATE = "YYYY-MM-DD";

/** A Postgres text-array literal, every element quoted (drizzle expands a JS array into a list). */
function textArray(values: readonly string[]): string {
  return `{${values
    .map((value) => `"${value.replace(/["\\]/g, "\\$&")}"`)
    .join(",")}}`;
}

/** The simple lists of a campaign, by the name the contract gives them; the columns are fixed here. */
export const CAMPAIGN_LISTS = {
  keyMessages: {
    table: "campaign_key_messages",
    column: "body",
    order: "position",
  },
  usageRightsTerritories: {
    table: "campaign_usage_territories",
    column: "country_code",
    order: "slot",
  },
  audienceCountries: {
    table: "campaign_audience_countries",
    column: "country_code",
    order: "slot",
  },
  audienceLanguages: {
    table: "campaign_audience_languages",
    column: "language_code",
    order: null,
  },
  audienceBands: {
    table: "campaign_audience_bands",
    column: "audience_band_code",
    order: null,
  },
  audienceAgeBands: {
    table: "campaign_audience_age_bands",
    column: "age_band_code",
    order: null,
  },
  audienceTopics: {
    table: "campaign_topics",
    column: "topic_code",
    order: "slot",
  },
  requestedItems: {
    table: "campaign_requested_items",
    column: "item_code",
    order: "slot",
  },
} as const;

export type CampaignListName = keyof typeof CAMPAIGN_LISTS;

export type StoredDeliverable = {
  networkCode: string;
  formatCode: string;
  quantity: number;
};

/** The campaign as stored: what `campaigns.campaigns` and its child tables hold, nothing computed. */
export type StoredCampaign = {
  id: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  title: string | null;
  campaignType: string | null;
  publicSummary: string | null;
  brief: string | null;
  internalReference: string | null;
  productDescription: string | null;
  productSector: string | null;
  restrictions: string | null;
  productIsSent: boolean | null;
  productValueBand: string | null;
  creatorKeepsProduct: boolean | null;
  shippingCostsBorneBy: string | null;
  deliverables: StoredDeliverable[];
  usageRights: string | null;
  usageRightsDuration: string | null;
  usageRightsTerritoryScope: string | null;
  exclusivity: string | null;
  contentReviewDelay: string | null;
  contentDueOn: string | null;
  audienceGender: string | null;
  currency: string | null;
  remunerationKind: string | null;
  budgetBand: string | null;
  creatorsWanted: number | null;
  totalBudgetMinor: number | null;
  applicationsCloseOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  maxApplications: number | null;
  authorizationsDeclaredAt: string | null;
  /** The sector of the product is sensitive (09 RG84), read by join, never copied (modele §2). */
  sectorIsSensitive: boolean;
} & Record<CampaignListName, string[]>;

type StoredRow = {
  id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  title: string | null;
  campaign_type_code: string | null;
  public_summary: string | null;
  brief: string | null;
  internal_reference: string | null;
  product_description: string | null;
  sector_code: string | null;
  restrictions: string | null;
  product_is_sent: boolean | null;
  product_value_band_code: string | null;
  creator_keeps_product: boolean | null;
  shipping_costs_borne_by: string | null;
  usage_rights_code: string | null;
  usage_rights_duration_band: string | null;
  usage_rights_territory_scope: string | null;
  exclusivity_band: string | null;
  content_review_delay: string | null;
  content_due_on: string | null;
  audience_gender_code: string | null;
  currency: string | null;
  remuneration_kind: string | null;
  per_creator_budget_band_code: string | null;
  creators_wanted: number | null;
  total_budget_minor: string | null;
  applications_close_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  max_applications: number | null;
  authorizations_declared_at: string | null;
  sector_is_sensitive: boolean;
  deliverables: StoredDeliverable[];
} & Record<CampaignListName, string[]>;

/** An aggregated list of one child table, in its order. As JSON: the pool fetches no array type. */
function listColumn(name: CampaignListName): SQL {
  const list = CAMPAIGN_LISTS[name];
  const table = sql`${sql.identifier("campaigns")}.${sql.identifier(list.table)}`;
  const column = sql.identifier(list.column);
  const order = sql.identifier(list.order ?? list.column);
  return sql`coalesce((select jsonb_agg(${column}::text order by ${order})
                         from ${table} l
                        where l.campaign_id = c.id), '[]'::jsonb)`;
}

function toStored(row: StoredRow): StoredCampaign {
  return {
    id: row.id,
    status: row.status,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    campaignType: row.campaign_type_code,
    publicSummary: row.public_summary,
    brief: row.brief,
    internalReference: row.internal_reference,
    productDescription: row.product_description,
    productSector: row.sector_code,
    restrictions: row.restrictions,
    productIsSent: row.product_is_sent,
    productValueBand: row.product_value_band_code,
    creatorKeepsProduct: row.creator_keeps_product,
    shippingCostsBorneBy: row.shipping_costs_borne_by,
    deliverables: row.deliverables,
    usageRights: row.usage_rights_code,
    usageRightsDuration: row.usage_rights_duration_band,
    usageRightsTerritoryScope: row.usage_rights_territory_scope,
    exclusivity: row.exclusivity_band,
    contentReviewDelay: row.content_review_delay,
    contentDueOn: row.content_due_on,
    audienceGender: row.audience_gender_code,
    currency: row.currency,
    remunerationKind: row.remuneration_kind,
    budgetBand: row.per_creator_budget_band_code,
    creatorsWanted: row.creators_wanted,
    // a bigint comes back as text (no type fetch): a safe integer by the check of its column's cap
    totalBudgetMinor:
      row.total_budget_minor === null ? null : Number(row.total_budget_minor),
    applicationsCloseOn: row.applications_close_on,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    maxApplications: row.max_applications,
    authorizationsDeclaredAt: row.authorizations_declared_at,
    sectorIsSensitive: row.sector_is_sensitive === true,
    keyMessages: row.keyMessages,
    usageRightsTerritories: row.usageRightsTerritories,
    audienceCountries: row.audienceCountries,
    audienceLanguages: row.audienceLanguages,
    audienceBands: row.audienceBands,
    audienceAgeBands: row.audienceAgeBands,
    audienceTopics: row.audienceTopics,
    requestedItems: row.requestedItems,
  };
}

/**
 * One of the session's own campaigns, or null when the id is nobody's or another brand's (the same
 * answer, T14). `lock`: the row is locked for the rest of the transaction, so that two saves at the
 * same moment (autosave from two tabs) are serialised and the second reads what the first committed.
 */
export async function readOwnCampaign(
  tx: Transaction,
  campaignId: string,
  options: { lock?: boolean } = {},
): Promise<StoredCampaign | null> {
  const rows = await tx.execute<StoredRow>(sql`
    select c.id::text as id, c.status::text as status,
           to_char(c.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(c.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(c.updated_at at time zone 'UTC', ${ISO_UTC}) as updated_at,
           c.title, c.campaign_type_code, c.public_summary, c.brief, c.internal_reference,
           c.product_description, c.sector_code, c.restrictions, c.product_is_sent,
           c.product_value_band_code, c.creator_keeps_product, c.shipping_costs_borne_by,
           c.usage_rights_code, c.usage_rights_duration_band, c.usage_rights_territory_scope,
           c.exclusivity_band, c.content_review_delay,
           to_char(c.content_due_on, ${CIVIL_DATE}) as content_due_on,
           c.audience_gender_code, c.currency::text as currency,
           c.remuneration_kind::text as remuneration_kind,
           c.per_creator_budget_band_code, c.creators_wanted,
           c.total_budget_minor::text as total_budget_minor,
           to_char(c.applications_close_on, ${CIVIL_DATE}) as applications_close_on,
           to_char(c.starts_on, ${CIVIL_DATE}) as starts_on,
           to_char(c.ends_on, ${CIVIL_DATE}) as ends_on,
           c.max_applications,
           to_char(c.authorizations_declared_at at time zone 'UTC', ${ISO_UTC})
             as authorizations_declared_at,
           coalesce((select s.is_sensitive from reference.sectors s
                      where s.code = c.sector_code), false) as sector_is_sensitive,
           coalesce((select jsonb_agg(jsonb_build_object(
                              'networkCode', d.network_code, 'formatCode', d.format_code,
                              'quantity', d.quantity) order by d.slot)
                       from campaigns.campaign_deliverables d
                      where d.campaign_id = c.id), '[]'::jsonb) as deliverables,
           ${listColumn("keyMessages")} as "keyMessages",
           ${listColumn("usageRightsTerritories")} as "usageRightsTerritories",
           ${listColumn("audienceCountries")} as "audienceCountries",
           ${listColumn("audienceLanguages")} as "audienceLanguages",
           ${listColumn("audienceBands")} as "audienceBands",
           ${listColumn("audienceAgeBands")} as "audienceAgeBands",
           ${listColumn("audienceTopics")} as "audienceTopics",
           ${listColumn("requestedItems")} as "requestedItems"
      from campaigns.campaigns c
     where c.id = ${campaignId}::uuid
       and c.advertiser_account_id = (select influx.current_account_id())
       ${options.lock === true ? sql`for update of c` : sql``}`);
  const row = rows[0];
  return row === undefined ? null : toStored(row);
}

export type CampaignSummaryRow = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  applicationsCloseOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
};

/** The session's own campaigns, the most recently changed first (the identifier is opaque). */
export async function listOwnCampaigns(
  tx: Transaction,
): Promise<CampaignSummaryRow[]> {
  const rows = await tx.execute<{
    id: string;
    title: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    submitted_at: string | null;
    applications_close_on: string | null;
    starts_on: string | null;
    ends_on: string | null;
  }>(sql`
    select c.id::text as id, c.title, c.status::text as status,
           to_char(c.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(c.updated_at at time zone 'UTC', ${ISO_UTC}) as updated_at,
           to_char(c.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(c.applications_close_on, ${CIVIL_DATE}) as applications_close_on,
           to_char(c.starts_on, ${CIVIL_DATE}) as starts_on,
           to_char(c.ends_on, ${CIVIL_DATE}) as ends_on
      from campaigns.campaigns c
     where c.advertiser_account_id = (select influx.current_account_id())
     order by c.updated_at desc, c.id`);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    applicationsCloseOn: row.applications_close_on,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}

/** The codes of the closed lists the form draws from, the active ones (retired ones never offered). */
export type ActiveCampaignReferences = {
  campaignTypes: string[];
  sectors: string[];
  sensitiveSectors: string[];
  usageRights: string[];
  networks: string[];
  formats: { code: string; networkCode: string | null }[];
  countries: string[];
  languages: string[];
  topics: string[];
  audienceGenders: string[];
  audienceBands: string[];
  audienceAgeBands: string[];
  /** Only the currencies that hold a grid of bands (modele §1), the bands in increasing order. */
  currencies: { code: string; bands: string[] }[];
  /** Every active currency, with or without a grid: a draft may hold one (a band is the form's). */
  activeCurrencies: string[];
  requestedItems: string[];
  authorizationDeclarations: { locale: string; body: string }[];
};

export async function readActiveCampaignReferences(
  tx: Transaction,
): Promise<ActiveCampaignReferences> {
  const rows = await tx.execute<ActiveCampaignReferences>(sql`
    select (select coalesce(jsonb_agg(code::text order by sort_order), '[]'::jsonb)
              from reference.campaign_types where retired_at is null) as "campaignTypes",
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.sectors where retired_at is null) as sectors,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.sectors where retired_at is null and is_sensitive) as "sensitiveSectors",
           (select coalesce(jsonb_agg(code::text order by sort_order), '[]'::jsonb)
              from reference.usage_rights where retired_at is null) as "usageRights",
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.networks where retired_at is null) as networks,
           (select coalesce(jsonb_agg(jsonb_build_object(
                              'code', code::text, 'networkCode', network_code::text) order by code),
                            '[]'::jsonb)
              from reference.formats where retired_at is null) as formats,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.countries where is_active) as countries,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.languages where is_active) as languages,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.topics where retired_at is null) as topics,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.audience_genders where retired_at is null) as "audienceGenders",
           (select coalesce(jsonb_agg(code::text order by min_followers, code), '[]'::jsonb)
              from reference.audience_bands where retired_at is null) as "audienceBands",
           (select coalesce(jsonb_agg(code::text order by min_age, code), '[]'::jsonb)
              from reference.age_bands where retired_at is null) as "audienceAgeBands",
           (select coalesce(jsonb_agg(jsonb_build_object('code', g.code, 'bands', g.bands)
                                      order by g.code), '[]'::jsonb)
              from (select cur.code::text as code,
                           (select jsonb_agg(b.code::text order by b.min_amount_minor)
                              from reference.price_bands b
                             where b.currency = cur.code and b.retired_at is null) as bands
                      from reference.currencies cur where cur.is_active) g
             where g.bands is not null) as currencies,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb)
              from reference.currencies where is_active) as "activeCurrencies",
           (select coalesce(jsonb_agg(code::text order by "position"), '[]'::jsonb)
              from campaigns.requested_items where is_active) as "requestedItems",
           (select coalesce(jsonb_agg(jsonb_build_object('locale', locale, 'body', body)
                                      order by locale), '[]'::jsonb)
              from campaigns.authorization_declaration_texts) as "authorizationDeclarations"`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the reference lists of the campaign form are unreadable");
  }
  return row;
}

/** A draft owned by the session's account (CA2: any active brand creates one); its identifier. */
export async function insertDraftCampaign(tx: Transaction): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`insert into campaigns.campaigns (advertiser_account_id)
        values ((select influx.current_account_id()))
        returning id::text as id`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("campaigns.campaigns insert returned no row");
  }
  return row.id;
}

/** The columns of the campaign row a save may set; an absent key is left as it is, `null` empties. */
export type CampaignColumns = {
  title?: string | null;
  campaignType?: string | null;
  publicSummary?: string | null;
  brief?: string | null;
  internalReference?: string | null;
  productDescription?: string | null;
  productSector?: string | null;
  restrictions?: string | null;
  productIsSent?: boolean | null;
  productValueBand?: string | null;
  creatorKeepsProduct?: boolean | null;
  shippingCostsBorneBy?: string | null;
  usageRights?: string | null;
  usageRightsDuration?: string | null;
  usageRightsTerritoryScope?: string | null;
  exclusivity?: string | null;
  contentReviewDelay?: string | null;
  contentDueOn?: string | null;
  audienceGender?: string | null;
  currency?: string | null;
  remunerationKind?: string | null;
  budgetBand?: string | null;
  creatorsWanted?: number | null;
  totalBudgetMinor?: number | null;
  applicationsCloseOn?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  maxApplications?: number | null;
};

/**
 * Sets the given columns of the campaign (0303: the column rights of influx_advertiser), and always
 * touches the row, so that a save of a list alone dates the campaign. The freeze is the base's.
 */
export async function updateCampaignColumns(
  tx: Transaction,
  campaignId: string,
  columns: CampaignColumns,
): Promise<void> {
  const text = (name: string, value: string | null | undefined) =>
    value === undefined ? [] : [sql`${sql.identifier(name)} = ${value}::text`];
  const flag = (name: string, value: boolean | null | undefined) =>
    value === undefined
      ? []
      : [sql`${sql.identifier(name)} = ${value}::boolean`];
  const small = (name: string, value: number | null | undefined) =>
    value === undefined
      ? []
      : [sql`${sql.identifier(name)} = ${value}::smallint`];
  const date = (name: string, value: string | null | undefined) =>
    value === undefined ? [] : [sql`${sql.identifier(name)} = ${value}::date`];
  const assignments: SQL[] = [
    ...text("title", columns.title),
    ...text("campaign_type_code", columns.campaignType),
    ...text("public_summary", columns.publicSummary),
    ...text("brief", columns.brief),
    ...text("internal_reference", columns.internalReference),
    ...text("product_description", columns.productDescription),
    ...text("sector_code", columns.productSector),
    ...text("restrictions", columns.restrictions),
    ...flag("product_is_sent", columns.productIsSent),
    ...text("product_value_band_code", columns.productValueBand),
    ...flag("creator_keeps_product", columns.creatorKeepsProduct),
    ...text("shipping_costs_borne_by", columns.shippingCostsBorneBy),
    ...text("usage_rights_code", columns.usageRights),
    ...text("usage_rights_duration_band", columns.usageRightsDuration),
    ...text("usage_rights_territory_scope", columns.usageRightsTerritoryScope),
    ...text("exclusivity_band", columns.exclusivity),
    ...text("content_review_delay", columns.contentReviewDelay),
    ...date("content_due_on", columns.contentDueOn),
    ...text("audience_gender_code", columns.audienceGender),
    ...text("currency", columns.currency),
    ...(columns.remunerationKind === undefined
      ? []
      : [
          sql`remuneration_kind = ${columns.remunerationKind}::text::campaigns.remuneration_kind`,
        ]),
    ...text("per_creator_budget_band_code", columns.budgetBand),
    ...small("creators_wanted", columns.creatorsWanted),
    ...(columns.totalBudgetMinor === undefined
      ? []
      : [
          sql`total_budget_minor = ${columns.totalBudgetMinor === null ? null : String(columns.totalBudgetMinor)}::bigint`,
        ]),
    ...date("applications_close_on", columns.applicationsCloseOn),
    ...date("starts_on", columns.startsOn),
    ...date("ends_on", columns.endsOn),
    ...small("max_applications", columns.maxApplications),
  ];
  // a save of a list alone still dates the row: the touch trigger fires on any update
  const set = assignments.length === 0 ? [sql`title = title`] : assignments;
  await tx.execute(
    sql`update campaigns.campaigns
           set ${sql.join(set, sql`, `)}
         where id = ${campaignId}::uuid
           and advertiser_account_id = (select influx.current_account_id())`,
  );
}

/**
 * Replaces a list as a whole: deletion, then insertion in the order given (slot or position 1 to n
 * where the list is ordered). The caps, the closed lists and the uniqueness are the database's.
 */
export async function replaceCampaignList(
  tx: Transaction,
  campaignId: string,
  name: CampaignListName,
  values: readonly string[],
): Promise<void> {
  const list = CAMPAIGN_LISTS[name];
  const table = sql`${sql.identifier("campaigns")}.${sql.identifier(list.table)}`;
  const column = sql.identifier(list.column);
  await tx.execute(
    sql`delete from ${table} where campaign_id = ${campaignId}::uuid`,
  );
  if (values.length === 0) {
    return;
  }
  const literal = textArray(values);
  if (list.order === null) {
    await tx.execute(
      sql`insert into ${table} (campaign_id, ${column})
          select ${campaignId}::uuid, v.value
            from unnest(${literal}::text[]) as v (value)`,
    );
  } else {
    await tx.execute(
      sql`insert into ${table} (campaign_id, ${sql.identifier(list.order)}, ${column})
          select ${campaignId}::uuid, v.ord::smallint, v.value
            from unnest(${literal}::text[]) with ordinality as v (value, ord)`,
    );
  }
}

/** Replaces the deliverable lines as a whole, slot 1 to n in the order given (09 RG36, RG37). */
export async function replaceCampaignDeliverables(
  tx: Transaction,
  campaignId: string,
  deliverables: readonly StoredDeliverable[],
): Promise<void> {
  await tx.execute(
    sql`delete from campaigns.campaign_deliverables where campaign_id = ${campaignId}::uuid`,
  );
  if (deliverables.length === 0) {
    return;
  }
  await tx.execute(
    sql`insert into campaigns.campaign_deliverables
          (campaign_id, slot, network_code, format_code, quantity)
        select ${campaignId}::uuid, v.ord::smallint, v.item ->> 'networkCode',
               v.item ->> 'formatCode', (v.item ->> 'quantity')::smallint
          from jsonb_array_elements(${JSON.stringify(deliverables)}::text::jsonb)
               with ordinality as v (item, ord)`,
  );
}

export type SubmissionOutcome = {
  status: string;
  submittedAt: string | null;
  changed: boolean;
};

/**
 * campaigns.submit_own_campaign() (0305): the language of the declaration of RG85 only when the box
 * is ticked. The refusals are its SQLSTATE codes and messages; the caller reads them.
 */
export async function submitOwnCampaign(
  tx: Transaction,
  campaignId: string,
  declarationLocale: string | null,
): Promise<SubmissionOutcome> {
  const rows = await tx.execute<{
    status: string;
    submitted_at: string | null;
    changed: boolean;
  }>(
    sql`select status, to_char(submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at, changed
          from campaigns.submit_own_campaign(${campaignId}::uuid, ${declarationLocale}::text)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("campaigns.submit_own_campaign() returned no row");
  }
  return {
    status: row.status,
    submittedAt: row.submitted_at,
    changed: row.changed,
  };
}

/**
 * campaigns.campaign_creator_view() (0305, modele §6): what a creator sees of the campaign, as the
 * base builds it (the constructor L3C freezes into its snapshot). Called on the row the policies of
 * 0303 let the session see: a campaign of another brand or nobody's yields no row, and the function
 * is never reached for it (its 42501 would abort the transaction). The view is returned as the base
 * wrote it; the caller parses it against the contract.
 */
export async function readCreatorViewOfOwnCampaign(
  tx: Transaction,
  campaignId: string,
): Promise<unknown> {
  const rows = await tx.execute<{ view: unknown }>(
    sql`select campaigns.campaign_creator_view(c.id) as view
          from campaigns.campaigns c
         where c.id = ${campaignId}::uuid`,
  );
  return rows[0]?.view ?? null;
}

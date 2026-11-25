// L3B commit 05 — the PARITY of the required fields of a campaign between the base (0305:
// campaigns.campaign_missing_required_fields) and packages/domain (CAMPAIGN_REQUIRED_FIELDS,
// missingCampaignFields): both copies answer the same input, the JSON of CampaignInput (modele §5,
// the pattern of 0203), the domain codes in camelCase, the base's in snake_case (L3B-T6, fiche
// invariant 5). The same thresholds, the same order, the conditionals asked only when their
// condition is answered (EC-L3B-04-1), the key messages optional (EC-L3B-04-4), the territory as its
// scope and its countries, the dates as civil dates written YYYY-MM-DD.
import {
  CAMPAIGN_REQUIRED_FIELDS,
  campaignDateIssues,
  isCampaignBriefLengthAllowed,
  isCampaignSummaryLengthAllowed,
  isCampaignTitleLengthAllowed,
  missingCampaignFields,
  type CampaignDates,
  type CampaignInput,
} from "@influx/domain/campaign";
import { CAMPAIGN_IDS, inRolledBackTransaction } from "@influx/test-kit/db";
import { beforeAll, describe, expect, it } from "vitest";
import { campaignCalendar, civilDateIn } from "./campaign-dates-kit.ts";
import { localSuperuser, testDataSet } from "./support.ts";

/** The four dates of a valid campaign, from today (L3BT-9). */
const CALENDAR = campaignCalendar();

/** The base's code of a domain code: camelCase to snake_case (campaignType → campaign_type). */
const snake = (code: string) =>
  code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

async function missingInBase(input: CampaignInput): Promise<string[]> {
  const [row] = await localSuperuser()<{ missing: string[] }[]>`
    select campaigns.campaign_missing_required_fields(${JSON.stringify(input)}::text::jsonb)
             as missing`;
  if (row === undefined) throw new Error("no answer");
  return row.missing;
}

/** The margins String.prototype.trim() removes (EC-L2B-06-4). */
const SPACES = "\t\n\u000b\f\r          　﻿";

const COMPLETE: CampaignInput = {
  title: "Summer outdoor kit",
  campaignType: "product_placement",
  publicSummary: "s".repeat(120),
  brief: "b".repeat(300),
  productDescription: "A light tent for two",
  productSector: "sports_leisure",
  keyMessages: ["Packs into a bottle", "Pitched in three minutes"],
  productIsSent: true,
  productValueBand: "100_250",
  creatorKeepsProduct: true,
  shippingCostsBorneBy: "brand",
  deliverables: [
    { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
  ],
  usageRights: "organic_repost",
  usageRightsDuration: "3m",
  usageRightsTerritoryScope: "selected_countries",
  usageRightsTerritories: ["FR", "BE"],
  exclusivity: "none",
  contentReviewDelay: "5bd",
  audienceCountries: ["FR"],
  audienceLanguages: ["fr"],
  audienceTopics: ["sport_fitness"],
  currency: "EUR",
  remunerationKind: "cash_and_gift",
  budgetBand: "500_1000",
  creatorsWanted: 3,
  applicationsCloseOn: CALENDAR.applicationsCloseOn,
  startsOn: CALENDAR.startsOn,
  endsOn: CALENDAR.endsOn,
};

/** Every field null, the lists empty: the input of a fresh draft. */
const EMPTY: CampaignInput = Object.fromEntries(
  Object.entries(COMPLETE).map(([key, value]) => [
    key,
    Array.isArray(value) ? [] : null,
  ]),
);

const PARITY_CASES: readonly [string, CampaignInput][] = [
  ["nothing entered", {}],
  ["a fresh draft (every field null, every list empty)", EMPTY],
  ["a complete campaign", COMPLETE],
  // each field absent, in turn: the conditionals follow their condition
  ...Object.keys(COMPLETE).map((field): [string, CampaignInput] => [
    `${field} absent`,
    Object.fromEntries(
      Object.entries(COMPLETE).filter(([key]) => key !== field),
    ),
  ]),
  // texts at their thresholds, margins excluded, code points counted
  ["a title of 9 characters", { ...COMPLETE, title: "a".repeat(9) }],
  ["a title of 10 characters", { ...COMPLETE, title: "a".repeat(10) }],
  [
    "a title of 9 characters between margins",
    { ...COMPLETE, title: `${SPACES}${"a".repeat(9)}${SPACES}` },
  ],
  [
    "a title of 10 characters outside the BMP",
    { ...COMPLETE, title: "\u{1f332}".repeat(10) },
  ],
  [
    "a summary of 119 characters",
    { ...COMPLETE, publicSummary: "s".repeat(119) },
  ],
  ["a brief of 299 characters", { ...COMPLETE, brief: "b".repeat(299) }],
  ["a brief of 300 characters", { ...COMPLETE, brief: "b".repeat(300) }],
  [
    "a product of 19 characters",
    { ...COMPLETE, productDescription: "p".repeat(19) },
  ],
  ["a sector of a space", { ...COMPLETE, productSector: " " }],
  ["a type of a no-break space", { ...COMPLETE, campaignType: " " }],
  // key messages: optional, a bullet that is there holds 10 to 200
  ["no key message", { ...COMPLETE, keyMessages: [] }],
  ["key messages null", { ...COMPLETE, keyMessages: null }],
  [
    "a key message of 9 characters",
    { ...COMPLETE, keyMessages: ["Fine message", "a".repeat(9)] },
  ],
  [
    "a key message of 200 characters",
    { ...COMPLETE, keyMessages: ["a".repeat(200)] },
  ],
  [
    "a key message of 201 characters",
    { ...COMPLETE, keyMessages: ["a".repeat(201)] },
  ],
  [
    "a key message of 10 characters between margins",
    { ...COMPLETE, keyMessages: [`${SPACES}${"a".repeat(10)}${SPACES}`] },
  ],
  // the product (RG24): its three fields asked only when it is sent
  [
    "a product not sent, its fields empty",
    {
      ...COMPLETE,
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    },
  ],
  [
    "a product sent, its fields empty",
    {
      ...COMPLETE,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: "",
    },
  ],
  [
    "the product question unanswered, its fields empty",
    {
      ...COMPLETE,
      productIsSent: null,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    },
  ],
  [
    "the creator does not keep the product (false is an answer)",
    { ...COMPLETE, creatorKeepsProduct: false },
  ],
  // the rights (RG34, RG39): duration and territory asked unless `none`
  [
    "no usage rights, no duration nor territory",
    {
      ...COMPLETE,
      usageRights: "none",
      usageRightsDuration: null,
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    },
  ],
  [
    "rights unanswered, no duration nor territory",
    {
      ...COMPLETE,
      usageRights: null,
      usageRightsDuration: null,
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    },
  ],
  [
    "rights granted, duration and scope empty",
    {
      ...COMPLETE,
      usageRightsDuration: " ",
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    },
  ],
  [
    "worldwide without country",
    {
      ...COMPLETE,
      usageRightsTerritoryScope: "worldwide",
      usageRightsTerritories: [],
    },
  ],
  [
    "worldwide with a country",
    {
      ...COMPLETE,
      usageRightsTerritoryScope: "worldwide",
      usageRightsTerritories: ["FR"],
    },
  ],
  [
    "selected countries without a country",
    { ...COMPLETE, usageRightsTerritories: [] },
  ],
  [
    "countries without their scope",
    { ...COMPLETE, usageRightsTerritoryScope: null },
  ],
  ["an unknown scope", { ...COMPLETE, usageRightsTerritoryScope: "continent" }],
  // the budget (Q16, CA76): a band unless gift only, affiliation included
  [
    "gift only without band",
    { ...COMPLETE, remunerationKind: "gift_only", budgetBand: null },
  ],
  [
    "cash without band (CA76)",
    { ...COMPLETE, remunerationKind: "cash", budgetBand: null },
  ],
  [
    "affiliation without band (CA45)",
    { ...COMPLETE, remunerationKind: "affiliate", budgetBand: "" },
  ],
  [
    "the nature unanswered, no band",
    { ...COMPLETE, remunerationKind: null, budgetBand: null },
  ],
  // creators wanted: an integer from 1 to 50
  ["no creator wanted", { ...COMPLETE, creatorsWanted: 0 }],
  ["one creator wanted", { ...COMPLETE, creatorsWanted: 1 }],
  ["fifty creators wanted", { ...COMPLETE, creatorsWanted: 50 }],
  ["fifty-one creators wanted", { ...COMPLETE, creatorsWanted: 51 }],
  ["two and a half creators", { ...COMPLETE, creatorsWanted: 2.5 }],
  ["a negative number of creators", { ...COMPLETE, creatorsWanted: -3 }],
  // the dates: civil dates that exist, written YYYY-MM-DD
  ["29 February of a leap year", { ...COMPLETE, startsOn: "2028-02-29" }],
  ["29 February of a common year", { ...COMPLETE, startsOn: "2027-02-29" }],
  ["31 April", { ...COMPLETE, endsOn: "2027-04-31" }],
  ["a thirteenth month", { ...COMPLETE, applicationsCloseOn: "2027-13-01" }],
  ["a day zero", { ...COMPLETE, applicationsCloseOn: "2027-01-00" }],
  ["the year zero", { ...COMPLETE, applicationsCloseOn: "0000-01-10" }],
  ["the year one", { ...COMPLETE, applicationsCloseOn: "0001-01-10" }],
  ["29 February of the year 4", { ...COMPLETE, startsOn: "0004-02-29" }],
  ["a date written D/M/Y", { ...COMPLETE, startsOn: "01/02/2027" }],
  ["a date with an instant", { ...COMPLETE, endsOn: "2027-03-01T00:00:00Z" }],
  ["a date of spaces", { ...COMPLETE, endsOn: "  " }],
];

describe("L3B-T6: 09 RG4, CA3: the required fields of the base equal those of packages/domain (0305, modele §5)", () => {
  it("names, for an empty input, the codes of CAMPAIGN_REQUIRED_FIELDS that hang on no condition, in their order", async () => {
    const conditional = new Set([
      "productValueBand",
      "creatorKeepsProduct",
      "shippingCostsBorneBy",
      "usageRightsDuration",
      "usageRightsTerritory",
      "budgetBand",
      "keyMessages",
    ]);
    expect(await missingInBase({})).toEqual(
      CAMPAIGN_REQUIRED_FIELDS.filter((field) => !conditional.has(field)).map(
        snake,
      ),
    );
  });

  it("names the 24 other codes, in the order of CAMPAIGN_REQUIRED_FIELDS, when only the three conditions are answered", async () => {
    const input: CampaignInput = {
      keyMessages: ["short"],
      productIsSent: true,
      usageRights: "organic_repost",
      remunerationKind: "cash",
    };
    const expected = CAMPAIGN_REQUIRED_FIELDS.filter(
      (field) =>
        field !== "productIsSent" &&
        field !== "usageRights" &&
        field !== "remunerationKind",
    ).map(snake);
    expect(await missingInBase(input)).toEqual(expected);
    expect(missingCampaignFields(input).map(snake)).toEqual(expected);
    expect(CAMPAIGN_REQUIRED_FIELDS).toHaveLength(27);
  });

  it.each(PARITY_CASES)(
    "answers as missingCampaignFields() for %s",
    async (_label, input) => {
      expect(await missingInBase(input)).toEqual(
        missingCampaignFields(input).map(snake),
      );
    },
  );

  it("is pure and closed: IMMUTABLE, SECURITY INVOKER, owned by influx_campaign_definer, executed by its owner only", async () => {
    const rows = await localSuperuser()<
      {
        name: string;
        volatility: string;
        definer: boolean;
        owner: string;
        config: string[] | null;
        grantees: string[];
      }[]
    >`
      select p.proname as name, p.provolatile::text as volatility, p.prosecdef as definer,
             pg_catalog.pg_get_userbyid(p.proowner) as owner, p.proconfig as config,
             coalesce((select pg_catalog.array_agg(distinct pg_catalog.pg_get_userbyid(a.grantee)::text)
                         from pg_catalog.aclexplode(p.proacl) a
                        where a.grantee <> p.proowner), '{}') as grantees
        from pg_catalog.pg_proc p
       where p.oid in ('campaigns.campaign_missing_required_fields(jsonb)'::regprocedure,
                       'campaigns.campaign_input(uuid)'::regprocedure)
       order by p.proname`;
    expect(rows).toEqual([
      {
        name: "campaign_input",
        volatility: "s",
        definer: false,
        owner: "influx_campaign_definer",
        config: ['search_path=""'],
        grantees: [],
      },
      {
        name: "campaign_missing_required_fields",
        volatility: "i",
        definer: false,
        owner: "influx_campaign_definer",
        config: ['search_path=""'],
        grantees: [],
      },
    ]);
  });
});

// L3B-T6, fiche invariant 5 (L3BT-1): the calendar (RG70, RG74) and the upper bounds of the long texts
// (RG16) are judged by packages/domain and by the table checks of 0303 with the same verdict. Each
// case names its expected verdict, then both sides must give it: accepted, or refused by the named
// check. One rule at stake per case; the other dates stay null (a partial calendar) and no text has
// margins (the margins are another matter).
type Verdict =
  | "accepted"
  | "campaigns_dates_ordered"
  | "campaigns_publication_window_max_12m"
  | "campaigns_title_length"
  | "campaigns_public_summary_length"
  | "campaigns_brief_length";

/** The verdict of an UPDATE of draft A (rolled back): accepted, or the name of the check that refuses. */
async function baseVerdict(assignment: string): Promise<Verdict> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    try {
      await tx.savepoint((savepoint) =>
        savepoint.unsafe(
          `update campaigns.campaigns set ${assignment} where id = '${CAMPAIGN_IDS.a}'`,
        ),
      );
      return "accepted";
    } catch (error) {
      const found = error as { code?: string; constraint_name?: string };
      if (found.code !== "23514" || found.constraint_name === undefined) {
        throw error;
      }
      return found.constraint_name as Verdict;
    }
  });
}

const DATE_COLUMNS = {
  applicationsCloseOn: "applications_close_on",
  contentDueOn: "content_due_on",
  startsOn: "starts_on",
  endsOn: "ends_on",
} as const;

/** The four date columns of an UPDATE, a date left out being written null. */
function datesAssignment(dates: CampaignDates): string {
  return Object.entries(DATE_COLUMNS)
    .map(([field, column]) => {
      const value = dates[field as keyof CampaignDates];
      return `${column} = ${value === undefined || value === null ? "null" : `date '${value}'`}`;
    })
    .join(", ");
}

/** The verdict of packages/domain on a calendar. */
function domainDateVerdict(dates: CampaignDates): Verdict {
  const issues = campaignDateIssues(dates);
  if (issues.conflicts.length > 0) return "campaigns_dates_ordered";
  return issues.windowTooLong
    ? "campaigns_publication_window_max_12m"
    : "accepted";
}

const PAIRS = [
  ["applicationsCloseOn", "contentDueOn"],
  ["applicationsCloseOn", "startsOn"],
  ["applicationsCloseOn", "endsOn"],
  ["contentDueOn", "startsOn"],
  ["contentDueOn", "endsOn"],
  ["startsOn", "endsOn"],
] as const;

const DATE_CASES: readonly [string, CampaignDates, Verdict][] = [
  // RG70: the six pairs, each alone, inverted by one day, then equal
  ...PAIRS.flatMap(([earlier, later]): [string, CampaignDates, Verdict][] => [
    [
      `${earlier} one day after ${later}`,
      { [earlier]: civilDateIn(41), [later]: civilDateIn(40) },
      "campaigns_dates_ordered",
    ],
    [
      `${earlier} the same day as ${later}`,
      { [earlier]: civilDateIn(41), [later]: civilDateIn(41) },
      "accepted",
    ],
  ]),
  // RG74: the end against the start plus 12 months, as the base counts it
  [
    "a period ending one day before 12 months",
    { startsOn: "2027-02-01", endsOn: "2028-01-31" },
    "accepted",
  ],
  [
    "a period of exactly 12 months",
    { startsOn: "2027-02-01", endsOn: "2028-02-01" },
    "accepted",
  ],
  [
    "a period one day beyond 12 months",
    { startsOn: "2027-02-01", endsOn: "2028-02-02" },
    "campaigns_publication_window_max_12m",
  ],
  [
    "a 29 February start ending on 28 February",
    { startsOn: "2028-02-29", endsOn: "2029-02-28" },
    "accepted",
  ],
  [
    "a 29 February start ending on 1 March",
    { startsOn: "2028-02-29", endsOn: "2029-03-01" },
    "campaigns_publication_window_max_12m",
  ],
  [
    "a 31 December start ending on 31 December",
    { startsOn: "2027-12-31", endsOn: "2028-12-31" },
    "accepted",
  ],
  [
    "a 31 December start ending on 1 January",
    { startsOn: "2027-12-31", endsOn: "2029-01-01" },
    "campaigns_publication_window_max_12m",
  ],
  [
    "a 31 January start ending on 31 January",
    { startsOn: "2027-01-31", endsOn: "2028-01-31" },
    "accepted",
  ],
  [
    "a 31 January start ending on 1 February",
    { startsOn: "2027-01-31", endsOn: "2028-02-01" },
    "campaigns_publication_window_max_12m",
  ],
  [
    "a 30 April start ending on 30 April",
    { startsOn: "2027-04-30", endsOn: "2028-04-30" },
    "accepted",
  ],
  [
    "a 30 April start ending on 1 May",
    { startsOn: "2027-04-30", endsOn: "2028-05-01" },
    "campaigns_publication_window_max_12m",
  ],
  [
    "a 28 February start ending on 28 February",
    { startsOn: "2027-02-28", endsOn: "2028-02-28" },
    "accepted",
  ],
  [
    "a 28 February start ending on 29 February of a leap year",
    { startsOn: "2027-02-28", endsOn: "2028-02-29" },
    "campaigns_publication_window_max_12m",
  ],
  [
    "a 28 February start of a leap year ending on 28 February",
    { startsOn: "2028-02-28", endsOn: "2029-02-28" },
    "accepted",
  ],
  [
    "a 28 February start of a leap year ending on 1 March",
    { startsOn: "2028-02-28", endsOn: "2029-03-01" },
    "campaigns_publication_window_max_12m",
  ],
];

// The code points of the astral plane count for one on both sides (char_length, Array.from).
const textOf = (length: number) => "😀".repeat(length);

type LengthRule = {
  readonly name: string;
  readonly column: string;
  readonly allowed: (value: string) => boolean;
  readonly max: number;
  readonly check: Verdict;
};

const LENGTH_RULES: readonly LengthRule[] = [
  {
    name: "title",
    column: "title",
    allowed: isCampaignTitleLengthAllowed,
    max: 140,
    check: "campaigns_title_length",
  },
  {
    name: "summary",
    column: "public_summary",
    allowed: isCampaignSummaryLengthAllowed,
    max: 400,
    check: "campaigns_public_summary_length",
  },
  {
    name: "brief",
    column: "brief",
    allowed: isCampaignBriefLengthAllowed,
    max: 4000,
    check: "campaigns_brief_length",
  },
];

const LENGTH_CASES = LENGTH_RULES.flatMap(
  (rule): [string, LengthRule, number, Verdict][] => [
    [`a ${rule.name} of ${rule.max} code points`, rule, rule.max, "accepted"],
    [
      `a ${rule.name} of ${rule.max + 1} code points`,
      rule,
      rule.max + 1,
      rule.check,
    ],
  ],
);

describe("L3B-T6 the calendar and the upper bounds of the texts: the table checks of 0303 answer as packages/domain (RG70, RG74, RG16)", () => {
  beforeAll(async () => {
    await testDataSet();
  });

  it.each(DATE_CASES)(
    "L3B-T6 judges %s alike",
    async (_label, dates, expected) => {
      expect(domainDateVerdict(dates)).toBe(expected);
      expect(await baseVerdict(datesAssignment(dates))).toBe(expected);
    },
  );

  it.each(LENGTH_CASES)(
    "L3B-T6 judges %s alike",
    async (_label, rule, length, expected) => {
      const text = textOf(length);
      expect(rule.allowed(text) ? "accepted" : rule.check).toBe(expected);
      expect(await baseVerdict(`${rule.column} = '${text}'`)).toBe(expected);
    },
  );
});

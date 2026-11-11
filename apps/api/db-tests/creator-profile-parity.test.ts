// L2G commit 03 — the PARITY of the rules of a creator profile between the base (0243:
// profiles.creator_missing_required_fields, profiles.creator_completeness_percent) and packages/domain
// (missingCreatorRequiredFields, creatorProfileCompleteness): both copies answer the same input, the
// JSON of CreatorProfileInput (l2g/modele -5, the pattern of 0203). The base adds what the domain
// learns at commit 06: the codes `portfolio` and `account_verified` after those of required.ts, and
// the points of the portfolio (RG87 block 6). Until then the parity is stated on the domain's codes
// and on profiles without a visual; commit 06 extends it (portfolioDeposited, accountVerified).
import {
  CREATOR_PROFILE_REQUIRED_FIELDS,
  creatorProfileCompleteness,
  missingCreatorRequiredFields,
  type CreatorProfileInput,
} from "@influx/domain/creator-profile";
import { describe, expect, it } from "vitest";
import { localSuperuser } from "./support.ts";

/** The base's code of a domain code: camelCase to snake_case (primaryTopic → primary_topic). */
const snake = (code: string) =>
  code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

/** The codes the base adds to the domain's at L2G (RG4, RG77; 08 RG16). */
const BASE_ONLY = ["portfolio", "account_verified"];

type BaseInput = CreatorProfileInput & {
  portfolioDeposited?: number;
  accountVerified?: boolean;
};

async function inBase(
  input: BaseInput,
): Promise<{ missing: string[]; score: number }> {
  const [row] = await localSuperuser()<{ missing: string[]; score: number }[]>`
    select profiles.creator_missing_required_fields(${JSON.stringify(input)}::text::jsonb)
             as missing,
           profiles.creator_completeness_percent(${JSON.stringify(input)}::text::jsonb)::int
             as score`;
  if (row === undefined) throw new Error("no answer");
  return row;
}

const LINE = {
  networkCode: "instagram",
  isPrimary: true,
  handle: "camille_cuisine",
  profileUrl: "https://www.instagram.com/camille_cuisine",
  followersCount: 48000,
  postsLast30Days: 12,
  avgCommentsPerPost: 30,
  avgReachPerPost: null,
  figuresConfirmedAt: "2026-11-10T09:00:00.000Z",
  audienceCountries: [
    { slot: 0, code: "FR", share: 70 },
    { slot: 1, code: "BE", share: 15 },
  ],
  audienceAges: [{ code: "18_24", share: 40 }],
  audienceGenders: [{ code: "female", share: 60 }],
} as const;

const COMPLETE: CreatorProfileInput = {
  headline: "Créatrice lifestyle à Rennes, voyages et cuisine",
  bio:
    "Je partage chaque semaine des recettes de saison, des adresses de voyage et des routines " +
    "simples. Mes abonnés aiment le ton direct et les formats courts, tournés avec soin.",
  primaryTopicCode: "food",
  secondaryTopicCodes: ["travel"],
  toneCodes: ["educational"],
  publicationLanguages: ["fr", "en"],
  residenceCountryCode: "FR",
  travelScope: "domestic",
  networkLines: [
    LINE,
    {
      ...LINE,
      networkCode: "tiktok",
      isPrimary: false,
      handle: "camille.tk",
      profileUrl: "https://www.tiktok.com/@camille.tk",
      avgReachPerPost: 9000,
    },
  ],
  offerLines: [
    { networkCode: "instagram", formatCode: "instagram_reel" },
    { networkCode: null, formatCode: "ugc_photo" },
  ],
  usageRights: [{ code: "organic_repost", inclusion: "included" }],
  maxExclusivityBand: "le_1m",
  availabilityBand: "lt_1m",
  badgeRequested: true,
};

const PARITY_CASES: [string, CreatorProfileInput][] = [
  ["an empty profile", {}],
  ["a complete profile", COMPLETE],
  [
    "a headline under 20 signs once trimmed (RG25)",
    { ...COMPLETE, headline: "  Dix-neuf signes ok  " },
  ],
  [
    "a headline of 20 signs in code points",
    { ...COMPLETE, headline: "Créatrice 🌿 ici au 1" },
  ],
  ["a bio of a no-break space and a tab", { ...COMPLETE, bio: " \t" }],
  [
    "two primary lines (no main account, RG41)",
    {
      ...COMPLETE,
      networkLines: [LINE, { ...LINE, networkCode: "tiktok" }],
    },
  ],
  [
    "a line without URL nor date",
    {
      ...COMPLETE,
      networkLines: [{ ...LINE, profileUrl: " ", figuresConfirmedAt: null }],
    },
  ],
  [
    "a main country without its share",
    {
      ...COMPLETE,
      networkLines: [
        { ...LINE, audienceCountries: [{ slot: 0, code: "FR", share: null }] },
      ],
    },
  ],
  [
    "no line, no offer, no right but `none`",
    {
      ...COMPLETE,
      networkLines: [],
      offerLines: [],
      usageRights: [{ code: "none", inclusion: "included" }],
    },
  ],
  [
    "a profile of the second line only, unmarked",
    {
      ...COMPLETE,
      networkLines: [{ ...LINE, isPrimary: false }],
      badgeRequested: false,
      travelScope: null,
      maxExclusivityBand: null,
    },
  ],
  [
    "ages and genders without a share, other countries without a code",
    {
      ...COMPLETE,
      networkLines: [
        {
          ...LINE,
          audienceCountries: [
            { slot: 0, code: "FR", share: 70 },
            { slot: 1, code: " ", share: 15 },
          ],
          audienceAges: [],
          audienceGenders: [],
        },
      ],
    },
  ],
];

describe("07 RG16, RG86 to RG90: the rules of the base equal those of packages/domain (0243, l2g/modele -5)", () => {
  it("names the codes of CREATOR_PROFILE_REQUIRED_FIELDS in their order, then portfolio and account_verified, for an empty profile", async () => {
    expect((await inBase({})).missing).toEqual([
      ...CREATOR_PROFILE_REQUIRED_FIELDS.map(snake),
      ...BASE_ONLY,
    ]);
  });

  it.each(PARITY_CASES)(
    "answers as the domain for %s (codes and score, no visual)",
    async (_label, input) => {
      const base = await inBase(input);
      expect(base.missing.filter((code) => !BASE_ONLY.includes(code))).toEqual(
        missingCreatorRequiredFields(input).map(snake),
      );
      expect(base.score).toBe(creatorProfileCompleteness(input).score);
    },
  );

  it("counts the visuals deposited (RG87 block 6: 6 from 3, 2 more from 5) and lists portfolio and account_verified until they are there", async () => {
    const at = async (portfolioDeposited: number, accountVerified: boolean) =>
      inBase({ ...COMPLETE, portfolioDeposited, accountVerified });
    const [two, three, five, verified] = await Promise.all([
      at(2, false),
      at(3, false),
      at(5, false),
      at(3, true),
    ]);
    const domain = creatorProfileCompleteness(COMPLETE).score;
    expect([two.score, three.score, five.score]).toEqual([
      domain,
      domain + 6,
      domain + 8,
    ]);
    // a complete profile reaches 100 with five visuals (RG87, the badge request filed)
    expect(five.score).toBe(100);
    expect(two.missing).toEqual(BASE_ONLY);
    expect(three.missing).toEqual(["account_verified"]);
    expect(verified.missing).toEqual([]);
  });

  it("are pure and closed: IMMUTABLE, SECURITY INVOKER, executed by the creator doors and the decisions only", async () => {
    const found = await localSuperuser()<
      {
        name: string;
        volatility: string;
        definer: boolean;
        config: string[] | null;
        grantees: string[];
      }[]
    >`
      select p.proname as name, p.provolatile::text as volatility, p.prosecdef as definer,
             p.proconfig as config,
             coalesce((select pg_catalog.array_agg(distinct pg_catalog.pg_get_userbyid(a.grantee)::text)
                         from pg_catalog.aclexplode(p.proacl) a
                        where a.grantee <> p.proowner), '{}') as grantees
        from pg_catalog.pg_proc p
       where p.oid in ('profiles.creator_missing_required_fields(jsonb)'::regprocedure,
                       'profiles.creator_completeness_percent(jsonb)'::regprocedure,
                       'profiles.trimmed_char_length(text)'::regprocedure)
       order by p.proname`;
    expect(found).toEqual(
      [
        "creator_completeness_percent",
        "creator_missing_required_fields",
        "trimmed_char_length",
      ].map((name) => ({
        name,
        volatility: "i",
        definer: false,
        config: ['search_path=""'],
        // 0244: the decisions recontrol the required fields and store the score (modele §3)
        grantees: [
          "influx_creator_profile_definer",
          "influx_moderation_definer",
        ],
      })),
    );
  });
});

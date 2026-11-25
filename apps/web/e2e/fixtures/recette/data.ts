// The synthetic acceptance data of the Lot 3bis, one block per space (docs/mvp/22-refonte-ux-ui/05 §4;
// RUA-04, jalons/rua/04.md). Pure data, no import of Playwright or of the database: the unit test
// (tests/recette-data.test.ts) reads it, and `support/recette.ts` loads it through the existing helpers
// only. The texts come from the mockups (Maison Azur, "Routine éclat d'hiver", profile 93JMS4,
// 7K3MQA), which are themselves synthetic. Every address is under `example.test`; no amount, no price,
// no commission figure appears on the creator side (D48, D78), and no e-mail or telephone of the other
// party (D46). The alias of a creator is drawn by the base (`profiles.new_creator_alias()`): the
// mockup's `93JMS4` is a label to compare against, not a value the loaders can write.

/** The campaign states a brand's list tells (09 RG3). */
export type CampaignState =
  "draft" | "pending_review" | "published" | "paused" | "closed" | "rejected";

/** The brand space: the brand and its campaigns (E01, E10, E12, E18). */
export const BRAND_DATA = {
  /** The trading name the helper writes is `Maison <name>` (the seed slices the name to 24 characters). */
  name: "Azur",
  mockupLabel: "Maison Azur",
  /** One campaign per state, titled after the mockups' "Routine éclat d'hiver". */
  campaigns: [
    { state: "draft", title: "Routine éclat d'hiver : brouillon" },
    { state: "pending_review", title: "Routine éclat d'hiver : en validation" },
    { state: "published", title: "Routine éclat d'hiver : publiée" },
    { state: "paused", title: "Routine éclat d'hiver : en pause" },
    { state: "closed", title: "Routine éclat d'hiver : close" },
    { state: "rejected", title: "Routine éclat d'hiver : à corriger" },
  ],
  /** The reason a refused campaign shows (typed code of queue 7). */
  refusalReason: "contact_in_text",
  /** The creators a brand finds in its anonymous search (topic codes of the facet F1). */
  searchableCreators: [
    { topic: "beauty" },
    { topic: "food" },
    { topic: "beauty" },
  ],
  /** The caption of the first portfolio visual of a creator a brand opens. */
  visualCaption: "Routine du matin, sérum à la vitamine C",
} as const satisfies {
  name: string;
  mockupLabel: string;
  campaigns: readonly { state: CampaignState; title: string }[];
  refusalReason: string;
  searchableCreators: readonly { topic: string }[];
  visualCaption: string;
};

/** One line of a creator's verification, as the cycle of a badge leaves it (08 RG70 to RG77). */
export type CreatorVerificationLine =
  | {
      kind: "badge";
      networkCode: string;
      level: "account_verified" | "audience_verified";
      state: "active" | "to_refresh" | "to_reconfirm";
    }
  | { kind: "refusal"; networkCode: string; reason: string }
  | {
      kind: "revoked";
      networkCode: string;
      reason: string;
      memberMessage: string | null;
    };

/** The creator space: a profile and its networks (E03, E14, E15). */
export const CREATOR_DATA = {
  /** Browser summaries of the sessions of an account (the first is the browser's, E20). */
  sessions: ["chrome.windows", "safari.macos"],
  /** The creator's main topic and audience country of a published profile. */
  profile: { topic: "beauty" },
  /** The handles of the networks other than the main line (the main one is written by the seed). */
  handles: {
    tiktok: "azur_recette_tt",
    youtube: "azur_recette_yt",
    twitch: "azur_recette_tw",
  },
  /**
   * What the verification hub reads: the main line (Instagram, written by the seed) with its two
   * levels, a TikTok line to reconfirm, a YouTube line whose badge INFLUX withdrew by its own error,
   * a Twitch line whose request was refused.
   */
  verification: [
    {
      kind: "badge",
      networkCode: "instagram",
      level: "account_verified",
      state: "active",
    },
    {
      kind: "badge",
      networkCode: "instagram",
      level: "audience_verified",
      state: "active",
    },
    {
      kind: "badge",
      networkCode: "tiktok",
      level: "account_verified",
      state: "to_reconfirm",
    },
    {
      kind: "revoked",
      networkCode: "youtube",
      reason: "influx_error",
      memberMessage: null,
    },
    { kind: "refusal", networkCode: "twitch", reason: "ownership_not_proven" },
  ],
} as const satisfies {
  sessions: readonly string[];
  profile: { topic: string };
  handles: Record<string, string>;
  verification: readonly CreatorVerificationLine[];
};

/** The backoffice space: the colleagues and what waits in their queues (E04 to E06, E16, E17, E21). */
export const BACKOFFICE_DATA = {
  /** The first names of the internal accounts (the backoffice shows first names only). */
  ownerFirstName: "Alice",
  agentFirstName: "Noa",
  adminFirstName: "Sacha",
  /** The trading name of a brand waiting in queue 1 (the seed writes it as is). */
  brandProfileName: "Maison Azur",
  /** Minutes from now to the deadline of an entry: past, the entry is overdue (06 RG7). */
  dueInMinutes: { onTime: 480, overdue: -90 },
  /** The campaign waiting in queue 7. */
  queuedCampaignTitle: "Routine éclat d'hiver : à valider",
  /** The tag of the signups of the list of members (E16). */
  signupTag: "recette",
  signupCountry: "FR",
} as const;

/** The only domain of an address of the data set. */
export const RECETTE_EMAIL_DOMAIN = "example.test";

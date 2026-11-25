// The loaders of `support/recette.ts`, as data: which space each serves and which existing helpers it
// calls (the unit test reads the imports of `support/recette.ts` and checks that these names, and no
// other helper, are the ones it uses). A state of a mockup names the loaders it starts from.
export type RecetteSpace = "brand" | "creator" | "backoffice";

export const LOADERS = {
  "brand-bare": {
    space: "brand",
    helpers: ["seedColleague", "brandAccount", "ownBrand"],
  },
  "brand-draft": {
    space: "brand",
    helpers: ["seedMember", "ownBrand"],
  },
  "brand-campaigns": {
    space: "brand",
    helpers: [
      "seedColleague",
      "brandAccount",
      "ownBrand",
      "seedCampaignInState",
    ],
  },
  "brand-search": {
    space: "brand",
    helpers: [
      "seedColleague",
      "brandAccount",
      "ownBrand",
      "seedSearchableCreators",
    ],
  },
  "creator-bare": { space: "creator", helpers: ["seedMember"] },
  "creator-without-portfolio": {
    space: "creator",
    helpers: ["seedMember", "seedColleague", "seedCreatorWithoutPortfolio"],
  },
  "creator-published": {
    space: "creator",
    helpers: ["seedColleague", "seedCreatorWithVisuals"],
  },
  "creator-verification": {
    space: "creator",
    helpers: [
      "seedMember",
      "seedColleague",
      "seedLines",
      "withSql",
      "seedNetworkLine",
      "seedBadge",
      "seedRefusal",
      "seedRevokedBadge",
    ],
  },
  "agent-bare": {
    space: "backoffice",
    helpers: ["seedColleague", "seedInternal"],
  },
  "admin-bare": {
    space: "backoffice",
    helpers: ["seedColleague", "seedInternal"],
  },
  "queue-campaigns": {
    space: "backoffice",
    helpers: ["seedColleague", "submittedCampaign", "holdEntry", "ownBrand"],
  },
  "queue-brand-profiles": {
    space: "backoffice",
    helpers: ["seedColleague", "seedReviewEntry"],
  },
  signups: { space: "backoffice", helpers: ["seedSignup", "runTag"] },
} as const satisfies Record<
  string,
  { space: RecetteSpace; helpers: readonly string[] }
>;

export type LoaderId = keyof typeof LOADERS;

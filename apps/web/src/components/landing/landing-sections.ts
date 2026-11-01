// The landing sections reachable from the header and footer menus: menu key -> section anchor.
export const LANDING_SECTION_ANCHORS = {
  method: "method",
  creators: "creators",
  useCases: "use-cases",
  pricing: "pricing",
  faq: "faq",
} as const;

export type LandingNavId = keyof typeof LANDING_SECTION_ANCHORS;

export const LANDING_NAV_IDS = Object.keys(
  LANDING_SECTION_ANCHORS,
) as LandingNavId[];

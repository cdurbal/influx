import type { StaticImageData } from "next/image";

// Content types of the landing page (01 §6.1). No value lives here: these types survive the
// removal of the fictitious module at Lot 1.

export type LandingImage = {
  src: StaticImageData;
  /** Empty string when the image is decorative (05 §3). */
  alt: string;
  /** Focal point from 05 §4 (CSS object-position), mapped to a token by ResponsiveImage. */
  focus: ImageFocus;
};

/** Every focal point used by 05-images.md §4. */
export type ImageFocus =
  | "center"
  | "center 35%"
  | "center 40%"
  | "center 60%"
  | "center 70%"
  | "35% center"
  | "45% center"
  | "55% center"
  | "60% center"
  | "65% center"
  | "70% center";

/**
 * Creator card (sections 3, 9, 15). D16 and CA17: this type has no pseudonym, name, handle,
 * link or social network field, by construction.
 */
export type CreatorCard = {
  id: string;
  theme: string;
  audienceMin: number;
  audienceMax: number;
  country: string;
  verified: boolean;
  image: LandingImage;
};

export type HeroContent = {
  mainImage: LandingImage;
  secondaryImage: LandingImage;
};

export type KeyFigure = {
  /** A count, never an amount of money nor a country (02 §3.4). */
  value: number;
  sourceNote: string;
};

export type FeaturedResult = {
  /** Performance indicator as a ratio (for example 0.05 = 5 %), never an amount of money. */
  value: number;
  metricLabel: string;
  trend: { value: number; months: number };
  context: string;
  sourceNote: string;
  image: LandingImage;
};

export type BrandLogos = {
  brands: readonly string[];
  sourceNote: string;
};

export type CaseStudy = {
  id: string;
  sector: string;
  brandName: string;
  /** Performance increase as a ratio (for example 0.5 = +50 %), never an amount of money. */
  metricValue: number;
  metricLabel: string;
  summary: string;
  image: LandingImage;
};

export type CaseStudies = {
  items: readonly CaseStudy[];
  sourceNote: string;
};

export type ConversationAuthor = "advertiser" | "creator";

/** CA18: plain text only, no email, phone, URL, handle or pseudonym. */
export type ConversationMessage = {
  id: string;
  author: ConversationAuthor;
  text: string;
};

export type ProblemContent = {
  messages: readonly ConversationMessage[];
  sourceNote: string;
  image: LandingImage;
};

export type CreatorNetwork = {
  count: number | null;
  sourceNote: string;
  cards: readonly CreatorCard[];
};

export type UseCaseId = "ugc" | "acquisition" | "productLaunch" | "awareness";

export type HowItWorksStepId =
  "createAccount" | "completeProfile" | "receiveProposals";

export type WhyInfluxItemId =
  "qualifiedMatching" | "secureContract" | "allInInflux";

export type MockupNotice = {
  title: string;
  body: string;
  restart: string;
};

/** Everything the page receives from the fictitious module, in one locale. */
export type PlaceholderContent = {
  mockupBanner: { regionLabel: string; label: string; detail: string };
  contact: { email: string };
  hero: HeroContent;
  keyFigure: KeyFigure | null;
  creatorCards: { sourceNote: string };
  creatorShowcase: { cards: readonly CreatorCard[] };
  featuredResult: FeaturedResult | null;
  brandLogos: BrandLogos | null;
  caseStudies: CaseStudies | null;
  problem: ProblemContent;
  method: { image: LandingImage };
  creatorNetwork: CreatorNetwork;
  useCases: { images: Record<UseCaseId, LandingImage> };
  howItWorks: { images: Record<HowItWorksStepId, LandingImage> };
  whyInflux: { images: Record<WhyInfluxItemId, LandingImage> };
  finalCta: { cards: readonly CreatorCard[] };
  startForm: { mockupNotice: MockupNotice; image: LandingImage };
};

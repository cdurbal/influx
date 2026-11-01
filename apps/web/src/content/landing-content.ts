import type { StaticImageData } from "next/image";

// Content types of the landing page (01 §6.1). No value lives here. The fictitious module was
// removed at J9 commit 5 (02 §13.3 point 2); the photos are final brand assets
// (src/content/landing-images.ts).

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
 * link or social network field, by construction. No card is shown until real, anonymized
 * profiles exist (Lot 3): the former cards were fictitious.
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

export type UseCaseId = "ugc" | "acquisition" | "productLaunch" | "awareness";

export type HowItWorksStepId =
  "createAccount" | "completeProfile" | "receiveProposals";

export type WhyInfluxItemId =
  "qualifiedMatching" | "dedicatedAgent" | "allInInflux";

// Photos of the landing page: final brand assets, credited in ./images/CREDITS.md (the manifest
// of guard G4's replacement, 18 §5). Their alternative texts live in the translation files
// (`landing.images`); a photo without one is decorative (05 §3).
import type { StaticImageData } from "next/image";
import type { ImageFocus, LandingImage } from "@/content/landing-content";
import imgForm01 from "./images/img-form-01.jpg";
import imgHero01 from "./images/img-hero-01.jpg";
import imgHero02 from "./images/img-hero-02.jpg";
import imgMethod01 from "./images/img-method-01.jpg";
import imgProblem01 from "./images/img-problem-01.jpg";
import imgStep01 from "./images/img-step-01.jpg";
import imgStep02 from "./images/img-step-02.jpg";
import imgStep03 from "./images/img-step-03.jpg";
import imgUse01 from "./images/img-use-01.jpg";
import imgUse02 from "./images/img-use-02.jpg";
import imgUse03 from "./images/img-use-03.jpg";
import imgUse04 from "./images/img-use-04.jpg";
import imgWhy01 from "./images/img-why-01.jpg";
import imgWhy02 from "./images/img-why-02.jpg";
import imgWhy03 from "./images/img-why-03.jpg";

type Photo = { src: StaticImageData; focus: ImageFocus };

/** Focal points from 05-images.md §4. */
const PHOTOS = {
  hero01: { src: imgHero01, focus: "center 35%" },
  hero02: { src: imgHero02, focus: "center" },
  problem01: { src: imgProblem01, focus: "center" },
  method01: { src: imgMethod01, focus: "center" },
  use01: { src: imgUse01, focus: "center" },
  use02: { src: imgUse02, focus: "center" },
  use03: { src: imgUse03, focus: "center" },
  use04: { src: imgUse04, focus: "center 40%" },
  step01: { src: imgStep01, focus: "center" },
  step02: { src: imgStep02, focus: "center 40%" },
  step03: { src: imgStep03, focus: "center" },
  why01: { src: imgWhy01, focus: "center" },
  why02: { src: imgWhy02, focus: "center" },
  why03: { src: imgWhy03, focus: "65% center" },
  form01: { src: imgForm01, focus: "70% center" },
} as const satisfies Record<string, Photo>;

export type PhotoId = keyof typeof PHOTOS;

/** A photo with its alternative text; empty (the default) when it is decorative. */
export function landingPhoto(id: PhotoId, alt = ""): LandingImage {
  return { ...PHOTOS[id], alt };
}

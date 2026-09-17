/*
 * Values of the `sizes` attribute of images (01 §11 rule 6).
 * Documented exception to guard test G3: an HTML attribute cannot read a CSS variable.
 * Breakpoints mirror tokens.css: sm 480px, md 768px, lg 1024px; content max width 1200px.
 */
export const IMAGE_SIZES = {
  heroMain: "(min-width: 1024px) 400px, 100vw",
  heroSecondary: "(min-width: 1024px) 200px, 1px",
  creatorCard: "(min-width: 1024px) 300px, (min-width: 480px) 50vw, 33vw",
  halfDesktop: "(min-width: 1024px) 600px, 100vw",
  thirdDesktop: "(min-width: 1024px) 400px, 100vw",
  caseStudy: "(min-width: 1024px) 500px, 90vw",
  sideDecoration: "(min-width: 1024px) 500px, 1px",
} as const;

export type ImageSizesKey = keyof typeof IMAGE_SIZES;

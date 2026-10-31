// KEO typefaces, self-hosted (02 §21.4, D73): Manrope (headings, figures) and Source Sans 3 (body).
// Imported (as @influx/ui/fonts) by the member layout (web) and the root layout (backoffice) only, so no route of the
// vitrine ever preloads a font (G8). One copy for both fronts, in packages/ui (G4f, PL-07).
// Each family is two faces: `latin` (preloaded) and `latin-ext` (names such as ł, ș, ğ, č), listed
// after it in the font stack so that it is fetched only when a glyph is missing from `latin`.
import localFont from "next/font/local";

const MANROPE_LATIN = localFont({
  src: "./fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--typeface-manrope",
});

const MANROPE_LATIN_EXT = localFont({
  src: "./fonts/manrope-latin-ext-wght-normal.woff2",
  weight: "200 800",
  variable: "--typeface-manrope-ext",
  preload: false,
});

const SOURCE_SANS_LATIN = localFont({
  src: "./fonts/source-sans-3-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--typeface-source-sans",
});

const SOURCE_SANS_LATIN_EXT = localFont({
  src: "./fonts/source-sans-3-latin-ext-wght-normal.woff2",
  weight: "200 900",
  variable: "--typeface-source-sans-ext",
  preload: false,
});

/** Class names that define the four `--typeface-*` variables; put them on the KEO container. */
export const FONT_VARIABLE_CLASSES = [
  MANROPE_LATIN.variable,
  MANROPE_LATIN_EXT.variable,
  SOURCE_SANS_LATIN.variable,
  SOURCE_SANS_LATIN_EXT.variable,
].join(" ");

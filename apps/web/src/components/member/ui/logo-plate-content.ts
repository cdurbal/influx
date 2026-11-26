// What a logo plate holds (docs/mvp/22-refonte-ux-ui/02a C33, 02c): the picture while it is given and loads,
// otherwise the initials of the name, or the dashes of a missing logo. A picture that fails is the same as
// no picture: the initials (never a broken-image icon).

export type LogoPlateContent = "image" | "initials" | "dashed";

/** The first letters of the first two words of a name, in capitals; nothing for a name without letters. */
export function initialsOf(name: string, locale?: string): string {
  const words = name.split(/[\s'’-]+/).filter((word) => word !== "");
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase(locale);
}

/**
 * `src` is the picture, `failedSrc` the one that has just failed to load, `missing` what to draw when
 * there is none. A picture that failed stays failed until `src` changes.
 */
export function logoPlateContent(
  src: string | undefined,
  failedSrc: string | undefined,
  missing: "initials" | "dashed",
): LogoPlateContent {
  if (src !== undefined && src !== "") {
    return failedSrc === src ? "initials" : "image";
  }
  return missing;
}

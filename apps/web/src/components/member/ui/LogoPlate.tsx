"use client";

import { useState } from "react";
import { cn } from "@/components/ui/class-names";
import {
  logoPlateClasses,
  logoPlateImageClasses,
  type LogoPlateShape,
  type LogoPlateSize,
} from "./logo-plate-classes";
import { initialsOf, logoPlateContent } from "./logo-plate-content";

type LogoPlateMissing = "initials" | "dashed";

export type LogoPlateProps = {
  /** The picture, a URL or a `data:` source built by the API; absent, the initials or the dashes. */
  src?: string;
  /** The name of what it stands for: the alternative text of the picture, the name of the initials. */
  name: string;
  size: LogoPlateSize;
  /** `plate`: a light square for a logo; `round`: a disc for a face, on a plain ground (RU-07). */
  shape: LogoPlateShape;
  /** What stands for a missing picture: the initials (by default) or a dashed square (a logo absent from a queue). */
  missing?: LogoPlateMissing;
  className?: string;
};

/**
 * The logo of a brand on its plate, or the face of a member in a disc (C33). A picture that is absent or
 * that fails to load shows the initials of the name: the name stays the accessible name in every case,
 * and the initials are decorative. No gradient (RU-07): a plain ground.
 */
export function LogoPlate({
  src,
  name,
  size,
  shape,
  missing = "initials",
  className,
}: LogoPlateProps) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const content = logoPlateContent(src, failedSrc, missing);
  const classes = cn(
    logoPlateClasses(size, shape, content === "dashed"),
    className,
  );
  if (content === "image") {
    return (
      <span className={classes}>
        {/* A data: source built by the API, or a signed URL: next/image has nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          className={logoPlateImageClasses(shape)}
          onError={() => setFailedSrc(src)}
          // A picture that failed before the page was alive has fired its event to nobody.
          ref={(image) => {
            if (image !== null && image.complete && image.naturalWidth === 0) {
              setFailedSrc(src);
            }
          }}
        />
      </span>
    );
  }
  return (
    <span role="img" aria-label={name} className={classes}>
      {content === "initials" ? (
        <span aria-hidden="true">{initialsOf(name)}</span>
      ) : null}
    </span>
  );
}

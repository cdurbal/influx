"use client";

// The image of a logo on the decision screen of queue 1 (docs/mvp/06 RG15; jalons/archives/l2b/
// stockage.md §4; founder's decision of 2026-11-05; 0213; L2C-18b). Loaded on demand, once per logo
// shown: each read is a nominative line of the register, so an entry that is read again (the
// decision screen reopens the entry after a refusal of the lock, L2BS-1) does not ask again for a
// logo it already holds. The bytes come as JSON (base64) from apps/api and are drawn from a `blob:`
// URL (the CSP of the backoffice allows `img-src 'self' blob:`, nothing else); the URL is revoked
// when the screen leaves. A failure is told and never blocks the decision (the characteristics stay).
import { useEffect, useState } from "react";
import { readBrandReviewLogo } from "./backoffice-api";

export type ReviewLogoImage =
  { kind: "loading" } | { kind: "ready"; url: string } | { kind: "failed" };

/** The bytes of a base64 string, as the API sends them (a string it checked, bounded to 1.4 MB). */
function bytesOf(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) {
    bytes[at] = binary.charCodeAt(at);
  }
  return bytes;
}

export function useReviewLogo(
  entryId: string,
  logoId: string,
): ReviewLogoImage {
  const [image, setImage] = useState<{
    logoId: string;
    value: ReviewLogoImage;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    void (async () => {
      let value: ReviewLogoImage = { kind: "failed" };
      try {
        const result = await readBrandReviewLogo(entryId, logoId);
        if (result.kind === "ok") {
          url = URL.createObjectURL(
            new Blob([bytesOf(result.data.logo.data)], {
              type: result.data.logo.contentType,
            }),
          );
          value = { kind: "ready", url };
        }
      } catch {
        // an identifier outside the UUID shape, a base64 that does not decode: unreadable
      }
      if (alive) {
        setImage({ logoId, value });
      } else if (url !== null) {
        URL.revokeObjectURL(url);
      }
    })();
    return () => {
      alive = false;
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [entryId, logoId]);

  // an answer that belongs to another logo is no answer for this one
  return image !== null && image.logoId === logoId
    ? image.value
    : { kind: "loading" };
}

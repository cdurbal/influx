"use client";

// The image of one logo on the decision screen of queue 1 (06 RG15; 0213; L2C-18b): loaded when it is
// shown, drawn from a `blob:` URL, with its written alternative. A failure is a sentence under the
// logo's characteristics: the decision never waits for the image.
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { useReviewLogo } from "./use-review-logo";

const t = messages.queueReview;

const IMAGE_CLASSES =
  "size-32 shrink-0 rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised object-contain";

export function ReviewLogo({
  entryId,
  logoId,
  label,
  brandName,
}: {
  entryId: string;
  logoId: string;
  /** « Logo actif » or « Logo en examen »: the state is written, never only drawn. */
  label: string;
  brandName: string;
}) {
  const image = useReviewLogo(entryId, logoId);
  if (image.kind === "ready") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a blob: URL built from the API's bytes
      <img
        src={image.url}
        alt={t.logo.alt(label, brandName)}
        className={IMAGE_CLASSES}
      />
    );
  }
  return (
    <p
      role={image.kind === "failed" ? "status" : undefined}
      className={HELP_CLASSES}
    >
      {image.kind === "failed" ? t.logo.failed : t.logo.loading}
    </p>
  );
}

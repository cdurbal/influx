"use client";

// Blocks ② and "Ce qu'il faut constater" of the decision screen of a creator's verification request
// (docs/mvp/08 RG46, RG83, RG84, RG87; 17b §3.7; jalons/l2e/modele.md §4, §6; L2E-22): the procedure the
// agent applies, written on the screen so that it is the same on a Monday and on a Friday, and the pieces,
// opened one by one on request. Each opening is one nominative line of the register, and says so. The image
// is drawn from a `blob:` URL: no link to it, no download, nothing outside the backoffice. A Storage that
// does not answer is told with its cause, and the decision of an audience waits.
import type { VerificationOpenResponse } from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import type { PieceImage } from "./use-verification-evidence";
import { isAudience, modeOf } from "./verification-decision-view";

const t = messages.verificationReview;

const IMAGE_CLASSES =
  "max-h-screen max-w-full rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised object-contain select-none";

/** The steps of the level asked, then what is never done (RG25, RG37, RG87): numbered, in one list. */
export function ProcedureBlock({ view }: { view: VerificationOpenResponse }) {
  const audience = isAudience(view);
  const steps = audience ? t.procedure.audience : t.procedure.ownership;
  return (
    <section
      aria-labelledby="verification-procedure"
      className={SECTION_CLASSES}
    >
      <h2 id="verification-procedure" className={SECTION_TITLE}>
        {t.sections.procedure}
      </h2>
      <p className="text-sm text-text-primary">{t.procedure.admissibility}</p>
      <ol className="list-decimal pl-5 text-sm text-text-primary">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className={HELP_CLASSES}>
        {audience
          ? t.procedure.audiencePrerequisite
          : t.procedure.ownershipNever}
      </p>
    </section>
  );
}

function Piece({
  at,
  total,
  image,
  disabled,
  onOpen,
  onClose,
}: {
  at: number;
  total: number;
  image: PieceImage | undefined;
  disabled: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className={BLOCK_TITLE}>{t.evidence.pieceTitle(at, total)}</h3>
        {image?.kind === "ready" ? (
          <button
            type="button"
            onClick={onClose}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.evidence.close}
          </button>
        ) : (
          <button
            type="button"
            aria-disabled={image?.kind === "loading" || disabled || undefined}
            onClick={() => {
              if (image?.kind !== "loading" && !disabled) {
                onOpen();
              }
            }}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.evidence.open(at, total)}
          </button>
        )}
      </div>
      {image?.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {t.evidence.loading}
        </p>
      ) : null}
      {image?.kind === "ready" ? (
        <>
          <p role="status" className={HELP_CLASSES}>
            {t.evidence.openedLine(at, total)}{" "}
            <span className="tabular-nums">
              {t.evidence.dimensions(image.width, image.height)}
            </span>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL built from the API's bytes */}
          <img
            src={image.url}
            alt={t.evidence.alt(at, total)}
            width={image.width}
            height={image.height}
            draggable={false}
            onContextMenu={(event) => event.preventDefault()}
            className={IMAGE_CLASSES}
          />
          <p className={HELP_CLASSES}>{t.evidence.readOnly}</p>
        </>
      ) : null}
    </li>
  );
}

export function EvidenceBlock({
  view,
  pieces,
  blocked,
  onOpen,
  onClose,
}: {
  view: VerificationOpenResponse;
  pieces: Readonly<Record<string, PieceImage>>;
  blocked: boolean;
  onOpen: (evidenceId: string) => void;
  onClose: (evidenceId: string) => void;
}) {
  const evidence = view.dossier?.evidence ?? [];
  const mode = modeOf(view);
  return (
    <section
      aria-labelledby="verification-evidence"
      className={SECTION_CLASSES}
    >
      <h2 id="verification-evidence" className={SECTION_TITLE}>
        {t.sections.evidence}
      </h2>
      <p className={HELP_CLASSES}>{t.evidence.lead}</p>
      {evidence.length === 0 ? (
        <>
          <p className="text-sm text-text-primary">{t.evidence.none}</p>
          {mode === "deciding" ? (
            <p className={HELP_CLASSES}>{t.evidence.noneSuggestion}</p>
          ) : null}
        </>
      ) : (
        <ul className="flex flex-col gap-4">
          {evidence.map((piece, index) => (
            <Piece
              key={piece.id}
              at={index + 1}
              total={evidence.length}
              image={pieces[piece.id]}
              disabled={mode !== "deciding"}
              onOpen={() => onOpen(piece.id)}
              onClose={() => onClose(piece.id)}
            />
          ))}
        </ul>
      )}
      {Object.values(pieces).some((piece) => piece.kind === "failed") &&
      !blocked ? (
        <ErrorNotice>{t.evidence.failed}</ErrorNotice>
      ) : null}
      {blocked ? <ErrorNotice>{t.evidence.blocked}</ErrorNotice> : null}
    </section>
  );
}

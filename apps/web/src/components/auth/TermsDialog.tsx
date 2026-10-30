"use client";

// The terms panel of screen 3 (docs/mvp/17 §3.4, "Lire les CGU"; 05 RG25, RG27, RG111): a modal
// dialog inside the journey, so that nothing typed is lost. It shows EXACTLY the version whose
// `id` the acceptance sends (RG24), in the language actually served (RG25).
import type { CurrentTermsResponse } from "@influx/contracts/terms";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef } from "react";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { parseLegalMarkdown } from "@/lib/legal-markdown";
import {
  DIALOG_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";

export function TermsDialog({
  terms,
  open,
  onClose,
}: {
  terms: CurrentTermsResponse;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("auth.signup.terms");
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blocks = useMemo(() => parseLegalMarkdown(terms.content), [terms]);

  // The native modal dialog holds the focus inside and gives it back to the opener on close.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className={DIALOG_CLASSES}
    >
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className={TITLE_CLASSES}>
          {t("title")}
        </h2>
        <p className={HELP_CLASSES}>
          {t("version", { label: terms.versionLabel })}
        </p>
        {terms.isFallback ? (
          <p role="note" className={INFO_CLASSES}>
            {t("fallback")}
          </p>
        ) : null}
        <article lang={terms.locale}>
          <LegalMarkdown blocks={blocks} variant="keo" />
        </article>
        <button
          type="button"
          onClick={onClose}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {t("close")}
        </button>
      </div>
    </dialog>
  );
}

"use client";

// A public document, readable without an account (docs/mvp/21 EC-62; 05 RG25, RG27). The text,
// its version and its language come from GET /v1/terms/current; this component only displays:
// - the version label and the date it entered into force, formatted in the page's language;
// - a notice when the English version is shown for another language (RG25), and the text then
//   carries lang="en";
// - noindex while the version is a draft (`draft-*`, local and staging only);
// - one error state, whether the document is not published or the service is unreachable.
import {
  isDraftLabel,
  type CurrentTermsResponse,
  type PublicDocument,
} from "@influx/contracts/terms";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  ERROR_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/auth/auth-classes";
import { parseLegalMarkdown } from "@/lib/legal-markdown";
import { readCurrentTerms } from "./legal-documents-api";
import { LegalMarkdown } from "./LegalMarkdown";

type State =
  | { kind: "loading" }
  | { kind: "ready"; terms: CurrentTermsResponse }
  | { kind: "unavailable" };

export function LegalDocumentView({ document }: { document: PublicDocument }) {
  const t = useTranslations("legal");
  const format = useFormatter();
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: "loading" });
  // Bumped by "Try again": a new read of the version in force.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void readCurrentTerms(document, locale).then((result) => {
      if (!active) {
        return;
      }
      setState(
        result.kind === "ok"
          ? { kind: "ready", terms: result.data }
          : { kind: "unavailable" },
      );
    });
    return () => {
      active = false;
    };
  }, [document, locale, attempt]);

  function retry() {
    setState({ kind: "loading" });
    setAttempt((count) => count + 1);
  }

  const blocks = useMemo(
    () =>
      state.kind === "ready" ? parseLegalMarkdown(state.terms.content) : [],
    [state],
  );

  if (state.kind === "loading") {
    return (
      <p role="status" className={HELP_CLASSES}>
        {t("loading")}
      </p>
    );
  }

  if (state.kind === "unavailable") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className={ERROR_CLASSES}>
          {t("unavailable")}
        </p>
        <button
          type="button"
          onClick={retry}
          className={SECONDARY_BUTTON_CLASSES}
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  const { terms } = state;
  const effectiveFrom = format.dateTime(new Date(terms.effectiveFrom), {
    dateStyle: "long",
    // The reader's own time zone: the date is the one of their calendar.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return (
    <div className="flex flex-col gap-6">
      {isDraftLabel(terms.versionLabel) ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : null}
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        <p>{t("version", { label: terms.versionLabel })}</p>
        <p>{t("effectiveFrom", { date: effectiveFrom })}</p>
      </div>
      {terms.isFallback ? (
        <p role="note" className={INFO_CLASSES}>
          {t("fallback")}
        </p>
      ) : null}
      <article lang={terms.locale}>
        <LegalMarkdown blocks={blocks} />
      </article>
    </div>
  );
}

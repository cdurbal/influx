"use client";

// The parts the ownership journey and the audience journey of a creator share (docs/mvp/08 RG60,
// RG95; jalons/l2e, commits 18 and 19): what a refused call means, written, and the way back to the
// profile. They draw; what a refusal is lies in verification-view.ts.
import { useLocale, useTranslations } from "next-intl";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { formatDelay, type Failure } from "./verification-view";

/** What a refused call means, written; the delay left is the API's `Retry-After`, said in words (RG60). */
export function FailureNotice({
  failure,
  since,
}: {
  failure: Failure;
  /** The date the open request was sent, for « une demande est déjà en cours depuis le {date} » (RG14). */
  since: string | null;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  let message: string;
  // After the cap the creator is told where to go: no date is promised, the team can be reached (L2EU-5).
  let next: string | null = null;
  switch (failure.key) {
    case "retryLater":
      if (failure.retryAfterSeconds === null) {
        message = t("failure.cap");
        next = t("refusal.next.contact");
      } else {
        message = t("failure.retryLater", {
          delay: formatDelay(failure.retryAfterSeconds, locale),
        });
      }
      break;
    case "expired":
      message = t("verif.request.expired");
      break;
    case "duplicate":
      message =
        since === null
          ? t("failure.notDraft")
          : t("verif.request.duplicate", { date: since });
      break;
    default:
      message = t(`failure.${failure.key}`);
  }
  return (
    <ErrorNotice>
      <span data-failure={failure.key}>{message}</span>
      {next === null ? null : <p data-failure-next="">{next}</p>}
    </ErrorNotice>
  );
}

export function BackToProfile({ label }: { label: string }) {
  const locale = useLocale();
  return (
    <div>
      <Link
        href={memberPageHref("accountProfile", locale)}
        className={memberButtonClasses("secondary")}
      >
        {label}
      </Link>
    </div>
  );
}

/** The name of a network in the language of the page (the reference list's), its code when the list has none. */
export function useNetworkName(networkCode: string): string {
  const tBrand = useTranslations("brandProfile");
  const key = `reference.network.${networkCode}`;
  return tBrand.has(key as Parameters<typeof tBrand>[0])
    ? tBrand(key as Parameters<typeof tBrand>[0])
    : networkCode;
}

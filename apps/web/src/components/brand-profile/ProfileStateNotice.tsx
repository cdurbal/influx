"use client";

// The state of the brand profile, written (docs/mvp/06 RG3, RG9, RG10, RG84, RG85, CA20, CA47; 17
// §4.2): a word, then what it allows, never a colour alone. One component for the page of the
// profile and the home, so that the same state reads the same words in both (jalons/l2b, commit 13;
// jalons/l2c, commit 15). A refusal carries the message of its typed reason, as the API gives it in
// the account's language. No amount, rate or price.
import { useTranslations } from "next-intl";
import { formatDate } from "@/components/account/account-view";
import { Notice } from "@/components/member/ui/Notice";
import { noticeOf, type ProfileNoticeSource } from "./brand-profile-view";

export function ProfileStateNotice({
  source,
  locale,
}: {
  source: ProfileNoticeSource;
  locale: string;
}) {
  const t = useTranslations("brandProfile");
  const notice = noticeOf(source);
  let text: string;
  switch (notice.kind) {
    case "pendingSince":
      text = `${t("status.pending")} ${t("statusText.pendingSince", {
        date:
          source.submittedAt === null
            ? ""
            : formatDate(source.submittedAt, locale === "en" ? "en" : "fr"),
      })}`;
      break;
    case "pendingWithPublished":
      text = t("status.pendingWithPublished");
      break;
    case "revisionRefused":
      text = t("status.revisionRefused", { reason: notice.reason });
      break;
    case "rejected":
      text = `${t("status.rejected", { reason: notice.reason })} ${t("statusText.rejectedNext")}`;
      break;
    case "rejectedUnexplained":
      text = t("status.rejected", { reason: t("statusText.rejectedReason") });
      break;
    default:
      text = t(`statusText.${notice.kind}`);
  }
  const tone =
    notice.kind === "published"
      ? "success"
      : notice.kind === "rejected" ||
          notice.kind === "rejectedUnexplained" ||
          notice.kind === "revisionRefused" ||
          notice.kind === "suspended"
        ? "warning"
        : "info";
  return (
    <Notice tone={tone} announce={false}>
      <p className="font-semibold text-text-primary">
        {t("state.label", { state: t(`state.${source.status}`) })}
      </p>
      <p>{text}</p>
    </Notice>
  );
}

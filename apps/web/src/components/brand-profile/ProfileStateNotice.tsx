"use client";

// The state of the brand profile, written (docs/mvp/06 RG3, RG85, CA47; 17 §4.2): a word, then what
// it allows, never a colour alone. One component for the page of the profile and the home, so that
// the same state reads the same words in both (jalons/l2b, commit 13). No amount, rate or price.
import type { BrandProfileStatus } from "@influx/contracts/brand-profile";
import { useTranslations } from "next-intl";
import { formatDate } from "@/components/account/account-view";
import { Notice } from "@/components/member/ui/Notice";
import { statusTextKeyOf } from "./brand-profile-view";

export function ProfileStateNotice({
  status,
  submittedAt,
  locale,
}: {
  status: BrandProfileStatus;
  submittedAt: string | null;
  locale: string;
}) {
  const t = useTranslations("brandProfile");
  const key = statusTextKeyOf(status);
  const text =
    key === "pendingSince"
      ? `${t("status.pending")} ${t("statusText.pendingSince", {
          date:
            submittedAt === null
              ? ""
              : formatDate(submittedAt, locale === "en" ? "en" : "fr"),
        })}`
      : key === "rejectedReason"
        ? t("status.rejected", { reason: t("statusText.rejectedReason") })
        : t(`statusText.${key}`);
  const tone =
    status === "published"
      ? "success"
      : status === "rejected" || status === "suspended"
        ? "warning"
        : "info";
  return (
    <Notice tone={tone} announce={false}>
      <p className="font-semibold text-text-primary">
        {t("state.label", { state: t(`state.${status}`) })}
      </p>
      <p>{text}</p>
    </Notice>
  );
}

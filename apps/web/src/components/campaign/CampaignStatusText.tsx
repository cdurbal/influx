"use client";

// The sentence of a campaign's state (docs/mvp/09 RG3, RG10, RG90, RG109, CA59, CA74; 17 §4.3; jalons/l3c,
// commit 10): the state in its own words, and, for a campaign INFLUX refused, WHY — the typed reason, the message of
// the agent for the two reasons that carry one, and the step that follows (L3BU-5: "À corriger" without its reason
// cannot be corrected). The reason is the API's code, its words are this front's translations
// (`campaign.rejection.<code>`); never the agent, the opinion nor the internal comment. Shared by the list and
// the form, so that both say the same thing.
import type {
  CampaignRefusal,
  CampaignStatus,
} from "@influx/contracts/campaign";
import { useTranslations } from "next-intl";
import { Notice } from "@/components/member/ui/Notice";
import { STATUS_TEXT_KEYS } from "./campaign-view";

export function CampaignStatusText({
  status,
  refusal,
}: {
  status: CampaignStatus;
  /** The refusal of the answer: told while the campaign is `rejected` only. */
  refusal: CampaignRefusal | null;
}) {
  const t = useTranslations("campaign");
  if (status === "rejected" && refusal !== null) {
    return (
      <Notice tone="warning" announce={false} className="w-full">
        <div className="flex flex-col gap-2 text-sm">
          <p>
            {t("status.rejected", {
              reason: t(`rejection.${refusal.reasonCode}`),
            })}
          </p>
          {refusal.memberMessage === null ? null : (
            <p>{refusal.memberMessage}</p>
          )}
          <p>{t(`refusal.${refusal.followUp}`)}</p>
        </div>
      </Notice>
    );
  }
  return (
    <p className="text-sm text-text-secondary">
      {t(`status.${STATUS_TEXT_KEYS[status]}`)}
    </p>
  );
}

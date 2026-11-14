"use client";

// "Mes campagnes" (docs/mvp/17 §2.6, §4.3; 09 RG108; CA74; jalons/l3b, commit 09): the brand's
// campaigns, each with its state written (CA74), "Créer une campagne" when the brand profile is
// published and, until then, the sentence that says so with the way to the profile
// (`campaign.publish.profileRequired`, CA2: the profile blocks the submission, never the draft, but
// the invitation to write starts from a published profile). Four states: loading, empty (what a
// campaign is, in two lines), the list, unreadable. A creator finds a page that does not exist
// (T14.3). The list is the API's: nothing here ranks, counts or computes. No amount (CLAUDE.md §2).
import type { CampaignSummary } from "@influx/contracts/campaign";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  SPACE_SCREEN_CLASSES,
  TEXT_LINK_CLASSES,
} from "@/components/auth/auth-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { PlusIcon } from "@/components/ui/icons";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { memberPageHref } from "@/lib/member-paths";
import { createCampaignDraft, readCampaignList } from "./campaign-api";
import {
  CAMPAIGN_LIST_CLASSES,
  CAMPAIGN_ROW_CLASSES,
} from "./campaign-classes";
import {
  formatDate,
  isEditable,
  STATUS_TEXT_KEYS,
  STATUS_TONES,
} from "./campaign-view";

type ListState =
  | { kind: "loading" }
  | { kind: "ready"; campaigns: readonly CampaignSummary[] }
  | { kind: "unavailable" };

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function CampaignListScreen() {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <CampaignListView />;
}

function CampaignListView() {
  const t = useTranslations("campaign");
  const locale = useLocale();
  const router = useRouter();
  const { signedOut, brandProfile } = useMember();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [creating, setCreating] = useState<"idle" | "busy" | "failed">("idle");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const result = await readCampaignList();
    if (result.kind === "ok") {
      setState({ kind: "ready", campaigns: result.data.campaigns });
    } else if (result.kind === "unauthenticated") {
      signedOut(null);
    } else {
      setState({ kind: "unavailable" });
    }
  }, [signedOut]);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create() {
    if (creating === "busy") {
      return;
    }
    setCreating("busy");
    const result = await createCampaignDraft();
    if (result.kind === "ok") {
      router.push(memberPageHref("advertiserCampaign", locale, result.data.id));
    } else if (result.kind === "unauthenticated") {
      signedOut(null);
    } else {
      setCreating("failed");
    }
  }

  // The invitation to write waits for a published profile (CA2); while the profile is read, nothing is said.
  const profile = brandProfile.state;
  const published =
    profile.kind === "ready" && profile.summary.status === "published";
  const blocked = profile.kind === "ready" && !published;
  const createButton = published ? (
    <MemberButton
      aria-disabled={creating === "busy" || undefined}
      onClick={() => void create()}
    >
      <PlusIcon aria-hidden="true" className="size-(--size-icon-md)" />
      {creating === "busy" ? t("list.creating") : t("list.create")}
    </MemberButton>
  ) : undefined;

  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <PageHeader title={t("list.title")} actions={createButton} />
      {blocked ? (
        <Notice tone="info">
          <p>{t("publish.profileRequired")}</p>
          <Link
            href={memberPageHref("accountProfile", locale)}
            className={TEXT_LINK_CLASSES}
          >
            {t("list.profileLink")}
          </Link>
        </Notice>
      ) : null}
      {creating === "failed" ? (
        <ErrorNotice>{t("list.createFailed")}</ErrorNotice>
      ) : null}
      {state.kind === "loading" ? (
        <p role="status" className="text-sm text-text-secondary">
          {t("list.loading")}
        </p>
      ) : state.kind === "unavailable" ? (
        <div className="flex flex-col gap-4">
          <ErrorNotice>{t("list.unavailable")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={() => void load()}>
            {t("list.retry")}
          </MemberButton>
        </div>
      ) : state.campaigns.length === 0 ? (
        <Card>
          <h2 className={CARD_TITLE}>{t("list.empty.title")}</h2>
          <p className="text-md text-text-secondary">{t("list.empty.text")}</p>
        </Card>
      ) : (
        <ul aria-label={t("list.title")} className={CAMPAIGN_LIST_CLASSES}>
          {state.campaigns.map((campaign) => (
            <li key={campaign.id}>
              <CampaignRow campaign={campaign} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One campaign: its title, its state written with what it allows, its last change, the way in. */
function CampaignRow({
  campaign,
  locale,
}: {
  campaign: CampaignSummary;
  locale: AppLocale;
}) {
  const t = useTranslations("campaign");
  const editable = isEditable(campaign.status);
  return (
    <Card>
      <div className={CAMPAIGN_ROW_CLASSES}>
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className={CARD_TITLE}>
            <Link
              href={memberPageHref("advertiserCampaign", locale, campaign.id)}
              className="underline"
            >
              {campaign.title ?? t("list.untitled")}
            </Link>
          </h2>
          <StatusBadge tone={STATUS_TONES[campaign.status]}>
            {t(`status.label.${campaign.status}`)}
          </StatusBadge>
          <p className="text-sm text-text-secondary">
            {t(`status.${STATUS_TEXT_KEYS[campaign.status]}`)}
          </p>
          <p className="text-sm text-text-secondary">
            {t("list.updatedOn", {
              date: formatDate(campaign.updatedAt, locale),
            })}
          </p>
          <Link
            href={memberPageHref(
              "advertiserCampaignPreview",
              locale,
              campaign.id,
            )}
            className={TEXT_LINK_CLASSES}
          >
            {t("preview.link")}
            <span className="sr-only">
              {" "}
              {campaign.title ?? t("list.untitled")}
            </span>
          </Link>
        </div>
        <Link
          href={memberPageHref("advertiserCampaign", locale, campaign.id)}
          className={memberButtonClasses(
            editable ? "primary" : "secondary",
            "md",
          )}
        >
          {editable ? t("list.resume") : t("list.view")}
          <span className="sr-only">
            {" "}
            {campaign.title ?? t("list.untitled")}
          </span>
        </Link>
      </div>
    </Card>
  );
}

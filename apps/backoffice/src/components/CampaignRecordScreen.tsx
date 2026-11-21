"use client";

// The record of a campaign for an agent (docs/mvp/09 RG1, RG3, RG8, RG9, RG83, RG93, RG94, CA60; 15 RG36; 17b
// §3.5 block 4, §3.8; jalons/l3c/modele.md §2, §5, §6; l3c-fiche invariants 6, 11 to 13; L3C-09). Its opening is
// journaled by apps/api (`campaign.record_read`) and the screen says so. The blocks that read are those of the
// decision screen plus the cycle, the internal block and the history; the acts (the correction of ONE field,
// pause, resumption, closing) are `CampaignRecordActions`. After an act the record is read again, without
// leaving the screen: what is drawn is always what the base holds. It only draws: the rules are the database's
// and apps/api's.
import type { CampaignRecordResponse } from "@influx/contracts/campaign-review";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, TITLE_CLASSES } from "./auth-classes";
import { readCampaignRecord } from "./backoffice-api";
import {
  BLOCK_TITLE,
  LINK_CLASSES,
  SECTION_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { accountHref, recordTitle } from "./campaign-record-view";
import { CampaignRecordActions } from "./CampaignRecordActions";
import {
  CycleBlock,
  HistoryBlock,
  InternalBlock,
  RecordCampaignBlock,
} from "./CampaignRecordBlocks";
import { AlertsBlock, BrandBlock, BriefBlock } from "./CampaignReviewBlocks";
import { ErrorNotice } from "./ErrorNotice";
import { compatibleHref, isCompatibleOffered } from "./identified-search-view";
import { formatDateTime } from "./view-model";

const t = messages.campaignRecord;

type Load =
  | { kind: "loading" }
  | { kind: "ok"; record: CampaignRecordResponse }
  | { kind: "error"; message: string };

/**
 * « Créateurs compatibles » (10 RG73; 17b §3.3; L3G-12): opens the identified search with the facets drawn from the brief
 * of this campaign. Only a campaign the base admits to the search is offered (out of draft, not rejected); the
 * opening journals the proposal. No amount, no box to tick: the proposal itself is Lot 4.
 */
function CompatibleCreatorsBlock({ campaignId }: { campaignId: string }) {
  const c = messages.identifiedSearch.compatible;
  return (
    <section aria-label={c.title} className={SECTION_CLASSES}>
      <h2 className={BLOCK_TITLE}>{c.title}</h2>
      <p className={HELP_CLASSES}>{c.lead}</p>
      <Link
        href={compatibleHref(campaignId)}
        className={`${SMALL_SECONDARY_CLASSES} self-start`}
      >
        {c.open}
      </Link>
    </section>
  );
}

export function CampaignRecordScreen({ id }: { id: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    void readCampaignRecord(id).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setLoad({ kind: "ok", record: result.data });
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setLoad({
          kind: "error",
          message: result.code === "not_found" ? t.notFound : t.unavailable,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [id, reload, router]);

  if (load.kind !== "ok") {
    return (
      <>
        <Link href="/inscrits" className={LINK_CLASSES}>
          {messages.account.back}
        </Link>
        <h1 className={TITLE_CLASSES}>{t.title(null)}</h1>
        {load.kind === "loading" ? (
          <p role="status" className={HELP_CLASSES}>
            {messages.common.loading}
          </p>
        ) : (
          <ErrorNotice>{load.message}</ErrorNotice>
        )}
      </>
    );
  }

  const { record } = load;
  return (
    <>
      <Link href={accountHref(record.brand.accountId)} className={LINK_CLASSES}>
        {t.back}
      </Link>
      <h1 className={TITLE_CLASSES}>{recordTitle(record)}</h1>
      <p role="status" className={HELP_CLASSES}>
        {t.journaled(formatDateTime(record.asOf))}
      </p>
      <BrandBlock
        view={{ brand: record.brand, duplicateOf: record.duplicateOf }}
      />
      <CycleBlock record={record} />
      <InternalBlock record={record} />
      <RecordCampaignBlock record={record} />
      {isCompatibleOffered(record.cycle.status) ? (
        <CompatibleCreatorsBlock campaignId={id} />
      ) : null}
      <BriefBlock view={{ campaign: record.fields }} />
      <AlertsBlock view={{ alerts: record.alerts }} />
      <HistoryBlock record={record} />
      <CampaignRecordActions
        record={record}
        onChanged={() => setReload((count) => count + 1)}
      />
    </>
  );
}

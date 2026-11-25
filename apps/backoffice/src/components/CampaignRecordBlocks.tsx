"use client";

// The blocks of the record of a campaign that only read (docs/mvp/09 RG3, RG83, RG93, RG94; 17b §3.5 block 4,
// §3.8; jalons/l3c/modele.md §2, §5, §6; L3C-09): the state and the cycle, the internal block (never read of a
// creator), the campaign without what the internal block holds, and the history of the decisions and of the
// interventions. The brand, the brief and the alerts are those of the decision screen (`CampaignReviewBlocks`):
// one reading of a campaign, one wording. No figure: the total budget is « non communiqué », the band is its label.
import type { CampaignRecordResponse } from "@influx/contracts/campaign-review";
import Link from "next/link";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { SECTION_CLASSES, SECTION_TITLE } from "./bo-classes";
import { campaignFacts } from "./campaign-review-view";
import {
  cycleFacts,
  entryHref,
  historyLines,
  internalFacts,
  publicFacts,
} from "./campaign-record-view";
import { FactList } from "./CampaignReviewBlocks";

const t = messages.campaignRecord;
const r = messages.campaignReview;

/** ② The state and the cycle of the campaign (09 RG3, RG8, RG9). */
export function CycleBlock({ record }: { record: CampaignRecordResponse }) {
  return (
    <section aria-labelledby="record-cycle" className={SECTION_CLASSES}>
      <h2 id="record-cycle" className={SECTION_TITLE}>
        {t.sections.cycle}
      </h2>
      <FactList facts={cycleFacts(record)} />
    </section>
  );
}

/** ③ The internal block (09 RG83): the total budget is never served, the band is its label alone (D48, D78). */
export function InternalBlock({ record }: { record: CampaignRecordResponse }) {
  return (
    <section aria-labelledby="record-internal" className={SECTION_CLASSES}>
      <h2 id="record-internal" className={SECTION_TITLE}>
        {t.sections.internal}
      </h2>
      <p className={HELP_CLASSES}>{t.internal.lead}</p>
      <FactList facts={internalFacts(record)} />
      <p className={HELP_CLASSES}>{t.internal.totalBudgetNote}</p>
    </section>
  );
}

/** ④ The campaign as stored, in the order of the form, without the reference and the band of the internal block. */
export function RecordCampaignBlock({
  record,
}: {
  record: CampaignRecordResponse;
}) {
  return (
    <section aria-labelledby="campaign-fields" className={SECTION_CLASSES}>
      <h2 id="campaign-fields" className={SECTION_TITLE}>
        {r.sections.campaign}
      </h2>
      <FactList
        facts={publicFacts(
          campaignFacts({ campaign: record.fields }),
          record.fields,
        )}
      />
    </section>
  );
}

/** ⑦ What was decided and what an agent did, the most recent first; an entry still open may be opened from here. */
export function HistoryBlock({ record }: { record: CampaignRecordResponse }) {
  const lines = historyLines(record);
  return (
    <section aria-labelledby="record-history" className={SECTION_CLASSES}>
      <h2 id="record-history" className={SECTION_TITLE}>
        {t.sections.history}
      </h2>
      <p className={HELP_CLASSES}>{t.history.lead}</p>
      {lines.length === 0 ? (
        <p className="text-sm text-text-primary">{t.history.empty}</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm text-text-primary">
          {lines.map((line) => (
            <li key={line.key} className="break-words">
              {line.text}
              {line.entryId === null ? null : (
                <>
                  {" "}
                  <Link
                    href={entryHref(line.entryId)}
                    className="text-text-primary underline"
                  >
                    {t.history.openEntry}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

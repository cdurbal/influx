"use client";

// The state of the verification of ONE network line, inside its card of block 3 of "mon profil"
// (docs/mvp/08 RG13; 17 §5.2, §5.3; jalons/l2e, commit 18): a row for the ownership of the account and
// a row for the audience, each with its own badge or its own request, never a global one. The
// audience is told to wait for the ownership BEFORE any button (RG12); its own journey is commit
// 19's. A button leads to the journey of the line, never decides anything: the API says who is
// verified. No identifier of the account is shown here, the creator's own line holds it above.
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import { useLocale, useTranslations } from "next-intl";
import { Notice } from "@/components/member/ui/Notice";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { GROUP_TITLE_CLASSES } from "@/components/creator-profile/creator-profile-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { ownershipJourneyHref } from "@/lib/member-paths";
import { routing, type AppLocale } from "@/i18n/routing";
import { BadgeLine } from "./BadgeLine";
import { RequestState } from "./RequestState";
import type { CreatorVerificationState } from "./use-creator-verification";
import {
  isOwnershipEstablished,
  levelRowOf,
  lineOfNetwork,
  ownershipActionOf,
  type LevelRow,
} from "./verification-view";

const BLOCK_CLASSES =
  "flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-strong p-4";
const ROW_CLASSES = "flex flex-col gap-2";
const ROW_LABEL_CLASSES = "text-sm font-semibold text-text-primary";

function localeOf(value: string): AppLocale {
  return (
    routing.locales.find((candidate) => candidate === value) ??
    routing.defaultLocale
  );
}

export function VerificationLineState({
  line,
  network,
  verification,
}: {
  line: CreatorNetworkLine;
  /** The name of the network, in the language of the page. */
  network: string;
  verification: CreatorVerificationState;
}) {
  const t = useTranslations("verification");
  const locale = localeOf(useLocale());
  const titleId = `${line.id}-verification-title`;

  let body;
  if (verification.phase === "loading") {
    body = (
      <p role="status" className="text-sm text-text-secondary">
        {t("line.loading")}
      </p>
    );
  } else if (verification.phase === "unavailable") {
    body = (
      <div className="flex flex-col gap-3">
        <ErrorNotice>{t("line.unavailable")}</ErrorNotice>
        <div>
          <MemberButton
            variant="secondary"
            onClick={() => void verification.retry()}
          >
            {t("line.retry")}
          </MemberButton>
        </div>
      </div>
    );
  } else {
    // A network added since the last read has no line in the answer yet: nothing is verified on it.
    const held = lineOfNetwork(verification.lines, line.networkCode) ?? {
      networkCode: line.networkCode,
      badges: [],
      requests: [],
    };
    const ownership = levelRowOf(held, "account_verified");
    const audience = levelRowOf(held, "audience_verified");
    const action = ownershipActionOf(ownership);
    const noIdentifier =
      (line.handle ?? "").trim() === "" ||
      (line.profileUrl ?? "").trim() === "";
    body = (
      <dl className="flex flex-col gap-4">
        <div className={ROW_CLASSES} data-verification-row="account_verified">
          <dt className={ROW_LABEL_CLASSES}>{t("line.account")}</dt>
          <dd className="flex flex-col gap-3">
            <RowBody
              row={ownership}
              network={network}
              absent={t("line.absent.account")}
            />
            {action !== null && noIdentifier && ownership.badge === null ? (
              <Notice tone="info" announce={false}>
                {t("line.needIdentifier")}
              </Notice>
            ) : null}
            {action === null ? null : (
              <div>
                <Link
                  href={ownershipJourneyHref(line.networkCode, locale)}
                  className={memberButtonClasses(
                    action === "start" ? "primary" : "secondary",
                  )}
                  data-verification-action={action}
                >
                  {t(`line.cta.${action}`)}
                  <span className="sr-only">
                    {" "}
                    {t("line.cta.on", { network })}
                  </span>
                </Link>
              </div>
            )}
          </dd>
        </div>
        <div className={ROW_CLASSES} data-verification-row="audience_verified">
          <dt className={ROW_LABEL_CLASSES}>{t("line.audience")}</dt>
          <dd>
            <RowBody
              row={audience}
              network={network}
              absent={
                isOwnershipEstablished(held)
                  ? t("line.absent.audience")
                  : t("line.absent.audienceNeedsAccount")
              }
            />
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={BLOCK_CLASSES}
      data-verification-line={line.networkCode}
    >
      <h4 id={titleId} className={GROUP_TITLE_CLASSES}>
        {t("line.title")}
      </h4>
      {body}
    </section>
  );
}

/** What a level holds: its badge, its request, and when it holds none the sentence that says so. */
function RowBody({
  row,
  network,
  absent,
}: {
  row: LevelRow;
  network: string;
  absent: string;
}) {
  const shown = row.badge !== null || row.request !== null;
  return (
    <div className="flex flex-col gap-3">
      {row.badge === null ? null : (
        <BadgeLine badge={row.badge} network={network} />
      )}
      {row.request === null ? null : <RequestState state={row.request} />}
      {shown ? null : <p className="text-sm text-text-secondary">{absent}</p>}
    </div>
  );
}

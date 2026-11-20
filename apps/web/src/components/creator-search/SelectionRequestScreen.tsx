"use client";

// « Demander une sélection à l'équipe INFLUX » (docs/mvp/10 RG1, RG61, RG63; 17 §4.4, §4.9; D45, D46, D48, D78;
// jalons/l3f, commits 10 and 11): the child of M4 that the permanent button leads to. It takes the criteria and the
// campaign of the search back from the address (reprise), asks for a free message of a few words (optional, bounded:
// no e-mail nor telephone, everything goes through INFLUX) and sends the request to the INFLUX team alone. The
// confirmation names a DELAY (the day the team answers by, as the base fixed it), never a promise of a result or of a
// contact; no creator is told, nothing leaves INFLUX (D45, CA64). The request stays possible with the search closed
// (RG61, permanent). The page of a brand: any other role finds no such page.
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import {
  MEMBER_FIELD_HELP_CLASSES,
  MEMBER_FIELD_LABEL_CLASSES,
  memberControlClasses,
} from "@/components/member/ui/field-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { SEARCH_PAGE_CLASSES, FORM_CLASSES } from "./creator-search-classes";
import { criteriaOf } from "./creator-search-view";
import { requestTeamSelection } from "./shortlists-api";
import {
  deadlineTextOf,
  messageProblemOf,
  requestBodyOf,
  searchHref,
  selectionFailureOf,
  SELECTION_MESSAGE_MAX,
  type SearchPlace,
  type SelectionFailure,
} from "./shortlists-view";
import { useSearchLabels } from "./use-search-labels";
import { useOriginCampaigns } from "./use-search-sources";

/** What the form is: waiting for the brand, sending, sent (the day the team answers by), or refused. */
type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; answerBy: string }
  | { kind: "not_published" }
  | { kind: "refused"; failure: SelectionFailure };

export function SelectionRequestScreen({ place }: { place: SearchPlace }) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <SelectionRequestView place={place} />;
}

function SelectionRequestView({ place }: { place: SearchPlace }) {
  const t = useTranslations("creatorSearch");
  const tAccount = useTranslations("account");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale() as AppLocale;
  const labels = useSearchLabels();
  const { signedOut } = useMember();
  const campaigns = useOriginCampaigns();
  const criteria = criteriaOf(place.query.filters, labels);
  const [message, setMessage] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(
    place.query.campaignId,
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const campaignFieldId = useId();
  // the confirmation replaces the form and the button pressed: the focus goes to its title (WCAG 2.4.3, 4.1.3)
  const sentTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (status.kind === "sent") {
      sentTitle.current?.focus();
    }
  }, [status.kind]);
  // one request per press: the base counts every request against the day's bound
  const sending = useRef(false);
  const problem = messageProblemOf(message);
  const options =
    campaigns.state.phase === "ready" ? campaigns.state.value : [];
  const known =
    campaignId === null || options.some((item) => item.id === campaignId);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending.current || problem !== null) {
      return;
    }
    sending.current = true;
    setStatus({ kind: "sending" });
    const result = await requestTeamSelection(
      requestBodyOf(place.query.filters, campaignId, message),
    );
    sending.current = false;
    if (result.kind === "unauthenticated") {
      signedOut(null);
      return;
    }
    if (result.kind === "failed") {
      setStatus({ kind: "refused", failure: selectionFailureOf(result) });
    } else if (result.data.state === "requested") {
      setStatus({ kind: "sent", answerBy: result.data.answerBy });
    } else {
      setStatus({ kind: "not_published" });
    }
  }

  const back = (
    <Link href={searchHref(locale, place)} className={BACK_LINK_CLASSES}>
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("selectionRequest.back")}
    </Link>
  );
  return (
    <PageBackContext value={back}>
      <div className={SEARCH_PAGE_CLASSES}>
        <PageHeader title={t("selectionRequest.title")} />
        {status.kind === "sent" ? (
          <Card>
            <h2
              ref={sentTitle}
              tabIndex={-1}
              data-request-sent=""
              className={CARD_TITLE}
            >
              {t("selectionRequest.sent.title")}
            </h2>
            <p className="text-md text-text-primary">
              {t("selectionRequest.sent.text", {
                date: deadlineTextOf(status.answerBy, locale),
              })}
            </p>
            <p className="text-sm text-text-secondary">
              {t("selectionRequest.sent.note")}
            </p>
            <Link
              href={searchHref(locale, place)}
              className={memberButtonClasses("secondary")}
            >
              {t("selectionRequest.sent.back")}
            </Link>
          </Card>
        ) : (
          <>
            <p className="text-md text-text-secondary">
              {t("selectionRequest.explain")}
            </p>
            <Card>
              <h2 className={CARD_TITLE}>{t("selectionRequest.recap")}</h2>
              {criteria.length === 0 ? (
                <p className="text-md text-text-secondary">
                  {t("selectionRequest.recapNone")}
                </p>
              ) : (
                <ul
                  data-request-criteria=""
                  className="m-0 flex list-none flex-col gap-1 p-0 text-md text-text-primary"
                >
                  {criteria.map((criterion) => (
                    <li key={criterion.id}>{criterion.label}</li>
                  ))}
                </ul>
              )}
            </Card>
            <form
              onSubmit={(event) => void send(event)}
              className={FORM_CLASSES}
              aria-label={t("selectionRequest.title")}
            >
              <Card>
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    htmlFor={campaignFieldId}
                    className={MEMBER_FIELD_LABEL_CLASSES}
                  >
                    {t("selectionRequest.campaign")}
                  </label>
                  <select
                    id={campaignFieldId}
                    name="campaign"
                    value={campaignId ?? ""}
                    onChange={(event) =>
                      setCampaignId(
                        event.target.value === "" ? null : event.target.value,
                      )
                    }
                    className={memberControlClasses(false)}
                  >
                    <option value="">{t("campaign.none")}</option>
                    {known || campaignId === null ? null : (
                      <option value={campaignId}>
                        {t("campaign.current")}
                      </option>
                    )}
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title ?? t("campaign.untitled")}
                      </option>
                    ))}
                  </select>
                  {campaigns.state.phase === "failed" ? (
                    <p className={MEMBER_FIELD_HELP_CLASSES}>
                      {t("campaign.failed")}
                    </p>
                  ) : null}
                </div>
                <TextAreaField
                  name="message"
                  label={t("selectionRequest.message")}
                  help={t("selectionRequest.messageHelp")}
                  value={message}
                  onChange={setMessage}
                  maxLength={SELECTION_MESSAGE_MAX}
                  counterText={(count, max) =>
                    t("selectionRequest.counter", { count, max })
                  }
                  rows={5}
                  error={
                    status.kind === "refused" &&
                    status.failure === "invalid_message"
                      ? t("shortlist.refusal.invalid_message")
                      : null
                  }
                />
              </Card>
              {status.kind === "refused" &&
              status.failure !== "invalid_message" ? (
                <ErrorNotice>
                  <span data-request-failure={status.failure}>
                    {t(`selectionRequest.refusal.${status.failure}`)}
                  </span>
                </ErrorNotice>
              ) : null}
              {status.kind === "not_published" ? (
                <Notice tone="warning">
                  <p data-state="brand_not_published">
                    {tBrand("search.blockedUntilPublished")}
                  </p>
                  <Link
                    href={memberPageHref("accountProfile", locale)}
                    className={TEXT_LINK_CLASSES}
                  >
                    {t("notPublished.action")}
                  </Link>
                </Notice>
              ) : null}
              <div>
                <MemberButton
                  type="submit"
                  aria-disabled={status.kind === "sending" || problem !== null}
                  data-send-request=""
                >
                  {status.kind === "sending"
                    ? t("selectionRequest.sending")
                    : t("selectionRequest.submit")}
                </MemberButton>
              </div>
            </form>
          </>
        )}
      </div>
    </PageBackContext>
  );
}

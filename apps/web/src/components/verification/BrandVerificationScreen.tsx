"use client";

// "Faire vérifier ma marque" (docs/mvp/17 §4.2, M2 block 4; 06 RG46 to RG54, RG83, CA26 to CA29; jalons/l2e,
// commit 20): the one request of a brand for the badge « Marque vérifiée », in three screens. 1. what the
// badge states (the domain is the brand's, the registration exists in a public register) and does not
// state (solvency, seriousness, past work, quality), and what will be shown with it, BEFORE anything is
// asked; 2. the domain code, the two ways to publish it (a DNS TXT record or a page of the domain),
// how long it is valid, and ONLY THERE the internal block of RG46 (legal name, country, number),
// asked at the request and never before (RG47), in the internal layer; 3. the follow-up. The screen is
// the API's own state read back (a request left half-way is taken back at its own screen); it grants
// nothing: an INFLUX agent looks at the domain and at a public register by hand and decides (RG49,
// RG52). The follow-up shows the code again while it lives (a request an agent opened is sent at once,
// D83; the TXT record or the page stays possible, L2FU-1). The page of a brand: any other role finds no such page. This file draws; the steps and the
// refusals are brand-verification-view.ts, the gestures use-brand-journey.ts. No amount, rate, net or
// price (D48, D78); the internal block is never written in a log nor kept in the browser (D37, RG48).
import {
  VERIFICATION_LEGAL_NAME_MAX_LENGTH,
  VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH,
  type BrandInternalDetails,
  type BrandVerificationResponse,
  type OwnCode,
  type OwnRequest,
} from "@influx/contracts/verification";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { SPACE_SCREEN_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { SingleChoiceField } from "@/components/member/ui/SingleChoiceField";
import { TextField } from "@/components/member/ui/TextField";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import {
  CARD_TITLE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { BrandBadgeLine } from "./BrandBadgeLine";
import { BrandRequestState } from "./BrandRequestState";
import { CodeBox } from "./CodeBox";
import {
  BRAND_STEP_COUNT,
  DETAILS_CONTROL_IDS,
  DETAILS_LABEL_KEYS,
  brandJourneyOf,
  brandStateOf,
  brandStepNumberOf,
  countryOf,
  detailsBodyOf,
  detailsDraftOf,
  emptyDetailsOf,
  isSavedDetails,
  type BrandJourney,
  type DetailsDraft,
  type DetailsField,
} from "./brand-verification-view";
import { BackToProfile, FailureNotice } from "./JourneyParts";
import {
  useBrandJourney,
  type BrandJourneyGestures,
} from "./use-brand-journey";
import { useBrandVerification } from "./use-brand-verification";
import {
  doneUntilKeyOf,
  formatVerificationDate,
  isCancellable,
  isRenewable,
  requestedCodeOf,
  rowRequestOf,
  type Failure,
} from "./verification-view";

const STEP_TITLE_CLASSES = cn(SECTION_TITLE, "text-text-primary");
const SUBTITLE_CLASSES = cn(CARD_TITLE, "text-text-primary");
const LIST_CLASSES =
  "flex list-disc flex-col gap-2 pl-5 text-md text-text-primary";
const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";

type TitleRef = RefObject<HTMLHeadingElement | null>;

/** The date the open request was sent, for « une demande est déjà en cours depuis le {date} » (06 RG14). */
function requestedSinceOf(data: BrandVerificationResponse): string | null {
  const { request } = brandStateOf(data);
  return request?.kind === "requested" ? request.since : null;
}

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function BrandVerificationScreen() {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <BrandVerificationView />;
}

function BrandVerificationView() {
  const t = useTranslations("verification");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const verification = useBrandVerification({
    onSignedOut: () => signedOut(null),
  });
  const gestures = useBrandJourney({
    reload: verification.reload,
    onSignedOut: () => signedOut(null),
  });

  const back = (
    <Link
      href={memberPageHref("accountProfile", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{t("brand.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("brand.back")}
    </Link>
  );

  let body: ReactNode;
  if (verification.data !== null) {
    body = (
      <Journey
        journey={brandJourneyOf(verification.data)}
        saved={verification.data.internalDetails}
        gestures={gestures}
        requestedSince={requestedSinceOf(verification.data)}
      />
    );
  } else if (verification.phase === "unavailable") {
    body = (
      <div className="flex flex-col gap-4">
        <ErrorNotice>{t("brand.unavailable")}</ErrorNotice>
        <div>
          <MemberButton
            variant="secondary"
            onClick={() => void verification.retry()}
          >
            {t("brand.retry")}
          </MemberButton>
        </div>
      </div>
    );
  } else {
    body = (
      <p role="status" className="text-sm text-text-secondary">
        {t("brand.loading")}
      </p>
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={SPACE_SCREEN_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("brand.title")} />
        {body}
      </div>
    </PageBackContext>
  );
}

/** What a refused call means; the texts that name « ce réseau » are the creator's, the brand's own are written here. */
function BrandFailureNotice({
  failure,
  requestedSince,
}: {
  failure: Failure;
  requestedSince: string | null;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  if (failure.key === "alreadyVerified") {
    return (
      <ErrorNotice>
        <span data-failure={failure.key}>
          {t("brand.failure.alreadyVerified")}
        </span>
      </ErrorNotice>
    );
  }
  if (failure.key === "duplicate" && requestedSince !== null) {
    return (
      <ErrorNotice>
        <span data-failure={failure.key}>
          {t("brand.failure.duplicate", {
            date: formatVerificationDate(requestedSince, locale),
          })}
        </span>
      </ErrorNotice>
    );
  }
  return <FailureNotice failure={failure} since={null} />;
}

function Journey({
  journey,
  saved,
  gestures,
  requestedSince,
}: {
  journey: BrandJourney;
  saved: BrandInternalDetails | null;
  gestures: BrandJourneyGestures;
  requestedSince: string | null;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();

  // After a step, the focus goes to its title, so that the next gesture is the next screen's (17 §2.2);
  // not at the first draw, where the page title keeps it.
  const title = useRef<HTMLHeadingElement>(null);
  const shown = useRef(journey.stage);
  useEffect(() => {
    if (shown.current !== journey.stage) {
      shown.current = journey.stage;
      title.current?.focus();
    }
  }, [journey.stage]);

  const stageName =
    journey.stage === "affirm"
      ? t("brand.steps.affirm")
      : journey.stage === "publish"
        ? t("brand.steps.publish")
        : t("brand.steps.follow");

  return (
    <>
      <p className="text-sm text-text-secondary" data-step={journey.stage}>
        {t("ownership.steps.progress", {
          current: brandStepNumberOf(journey.stage),
          total: BRAND_STEP_COUNT,
          name: stageName,
        })}
      </p>
      <Card>
        {gestures.failure === null ? null : (
          <BrandFailureNotice
            failure={gestures.failure}
            requestedSince={requestedSince}
          />
        )}
        {journey.stage === "affirm" ? (
          <AffirmStep journey={journey} gestures={gestures} title={title} />
        ) : null}
        {journey.stage === "publish" && journey.request !== null ? (
          <PublishStep
            journey={journey}
            request={journey.request}
            saved={saved}
            gestures={gestures}
            title={title}
          />
        ) : null}
        {journey.stage === "sent" && journey.request !== null ? (
          <SentStep
            request={journey.request}
            requestedSince={requestedSince}
            gestures={gestures}
            title={title}
          />
        ) : null}
        {journey.stage === "done" && journey.badge !== null ? (
          <>
            <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
              {t("brand.done.title")}
            </h2>
            <BrandBadgeLine badge={journey.badge} />
            <p>{t("brand.done.removeCode")}</p>
            {journey.badge.expiresAt === null ? null : (
              <p className={MEMBER_FIELD_HELP_CLASSES}>
                {t(`brand.done.${doneUntilKeyOf(journey.badge)}`, {
                  date: formatVerificationDate(journey.badge.expiresAt, locale),
                })}
              </p>
            )}
            {isRenewable(journey.badge) ? (
              // the reminder window is open (06 RG54, L2FU-2): a new request keeps the badge until it is decided
              <div className={ACTIONS_CLASSES}>
                <MemberButton
                  onClick={gestures.start}
                  aria-disabled={gestures.busy !== null}
                >
                  {t("brandBlock.cta.refresh")}
                </MemberButton>
              </div>
            ) : null}
            <BackToProfile label={t("brand.done.back")} />
          </>
        ) : null}
      </Card>
    </>
  );
}

/** Screen 1: what the badge states and does not state, what is shown with it, and only then the button (RG49, RG50, RG53). */
function AffirmStep({
  journey,
  gestures,
  title,
}: {
  journey: BrandJourney;
  gestures: BrandJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale();
  // The example date: today's, said to be an example; the real one is the day of the check.
  const [now] = useState(() => new Date());
  const expired = journey.previous?.kind === "expired";
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("brand.affirm.title")}
      </h2>
      {journey.badge === null ? null : <BrandBadgeLine badge={journey.badge} />}
      {journey.refresh ? <p>{t("brand.affirm.refresh")}</p> : null}
      {journey.previous === null ? null : (
        <BrandRequestState state={journey.previous} />
      )}
      <p>{t("brand.affirm.todo")}</p>
      <p>{t("brand.affirm.intro")}</p>
      <ul className={LIST_CLASSES}>
        <li>{t("brand.affirm.items.domain")}</li>
        <li>{t("brand.affirm.items.registration")}</li>
      </ul>
      <p>{t("brand.affirm.byHand")}</p>
      <h3 className={SUBTITLE_CLASSES}>{t("brand.affirm.not.title")}</h3>
      <ul className={LIST_CLASSES}>
        <li>{t("brand.affirm.not.solvency")}</li>
        <li>{t("brand.affirm.not.serious")}</li>
        <li>{t("brand.affirm.not.experience")}</li>
        <li>{t("brand.affirm.not.quality")}</li>
      </ul>
      <h3 className={SUBTITLE_CLASSES}>{t("brand.affirm.preview.title")}</h3>
      <div className="flex flex-col gap-2" data-preview="">
        <VerifiedBadge
          text={tBrand("badge.label", {
            date: formatVerificationDate(now.toISOString(), locale),
          })}
        />
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("verif.badge.brandVerified.help")}
        </p>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("brand.affirm.preview.example")}
        </p>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("brand.affirm.preview.never")}
        </p>
      </div>
      <p className={MEMBER_FIELD_HELP_CLASSES}>{t("brandBlock.optional")}</p>
      <div className={ACTIONS_CLASSES}>
        <MemberButton
          onClick={gestures.start}
          aria-disabled={gestures.busy !== null}
        >
          {expired
            ? t("ownership.code.renewExpired")
            : t("brand.affirm.continue")}
        </MemberButton>
        <BackToProfile label={t("brand.affirm.back")} />
      </div>
    </>
  );
}

/** Screen 2: the code, the two ways to publish it, how long, and the internal block of RG46, asked here and nowhere before (RG47, RG51). */
function PublishStep({
  journey,
  request,
  saved,
  gestures,
  title,
}: {
  journey: BrandJourney;
  request: OwnRequest;
  saved: BrandInternalDetails | null;
  gestures: BrandJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const [draft, setDraft] = useState<DetailsDraft>(() => detailsDraftOf(saved));
  const [showMissing, setShowMissing] = useState(false);
  const code = request.code;
  const busy = gestures.busy !== null;
  const missing = emptyDetailsOf(draft);

  function send() {
    const body = detailsBodyOf(draft);
    if (body === null) {
      // The first field that is missing takes the focus; nothing is sent (RG46: all three are needed).
      setShowMissing(true);
      const first = missing[0];
      if (first !== undefined) {
        document.getElementById(DETAILS_CONTROL_IDS[first])?.focus();
      }
      return;
    }
    gestures.submit(isSavedDetails(draft, saved) ? null : body);
  }

  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("brand.publish.title")}
      </h2>
      {code === null || journey.codeExpired ? (
        <>
          <Notice tone="warning">{t("verif.request.expired")}</Notice>
          <div className={ACTIONS_CLASSES}>
            <MemberButton onClick={gestures.renew} aria-disabled={busy}>
              {t("ownership.code.renewExpired")}
            </MemberButton>
            <CancelButton request={request} gestures={gestures} />
          </div>
        </>
      ) : (
        <>
          <BrandCode code={code} />
          <p>{t("brand.publish.public")}</p>
          <Notice tone="info" announce={false}>
            {t("brand.publish.neverAsk")}
          </Notice>
          <p>{t("brand.publish.screenshot")}</p>
          <DetailsForm
            draft={draft}
            onChange={(field, value) =>
              setDraft((current) =>
                field === "registrationCountryCode"
                  ? { ...current, registrationCountryCode: countryOf(value) }
                  : { ...current, [field]: value },
              )
            }
            missing={showMissing ? missing : []}
          />
          <div className={ACTIONS_CLASSES}>
            <MemberButton onClick={send} aria-disabled={busy}>
              {gestures.busy === "submit"
                ? t("brand.publish.sending")
                : t("brand.publish.submit")}
            </MemberButton>
            <MemberButton
              variant="text"
              onClick={gestures.renew}
              aria-disabled={busy}
            >
              {t("ownership.code.renew")}
            </MemberButton>
            <CancelButton request={request} gestures={gestures} />
          </div>
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("ownership.code.renewHelp")}
          </p>
        </>
      )}
    </>
  );
}

/**
 * The domain code and the two ways to publish it, a DNS TXT record or a page of the domain (06 RG51): the
 * same block on screen 2 and, while it lives, on screen 3.
 */
function BrandCode({ code }: { code: OwnCode }) {
  const t = useTranslations("verification");
  return (
    <>
      <p>{t("brand.publish.intro")}</p>
      <CodeBox key={code.code} code={code} />
      <h3 className={SUBTITLE_CLASSES}>{t("brand.publish.ways.title")}</h3>
      <ul className="flex flex-col gap-3" data-ways="">
        <li className="flex flex-col gap-1">
          <span className="font-semibold text-text-primary">
            {t("brand.publish.ways.dns.title")}
          </span>
          <span>{t("brand.publish.ways.dns.text")}</span>
        </li>
        <li className="flex flex-col gap-1">
          <span className="font-semibold text-text-primary">
            {t("brand.publish.ways.page.title")}
          </span>
          <span>{t("brand.publish.ways.page.text")}</span>
        </li>
      </ul>
    </>
  );
}

/** The three internal fields of RG46, each in the internal layer, written and never the colour alone (RG47, RG48). */
function DetailsForm({
  draft,
  onChange,
  missing,
}: {
  draft: DetailsDraft;
  onChange: (field: DetailsField, value: string) => void;
  /** The fields to show in error: those still empty after a click on « Envoyer ». */
  missing: readonly DetailsField[];
}) {
  const t = useTranslations("verification");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale();
  const countries = useMemo(
    () =>
      getLocalizedCountryOptions(locale).map((country) => ({
        code: country.code,
        label: country.name,
      })),
    [locale],
  );
  const common = (field: DetailsField) => ({
    id: DETAILS_CONTROL_IDS[field],
    label: t(`brand.details.${DETAILS_LABEL_KEYS[field]}.label`),
    help: t(`brand.details.${DETAILS_LABEL_KEYS[field]}.help`),
    requiredLabel: tBrand("field.required"),
    layer: { layer: "internal", label: tBrand("layer.internal") } as const,
    error: missing.includes(field) ? t("brand.details.required") : null,
  });
  return (
    <div className="flex flex-col gap-4" data-internal-block="">
      <h3 className={SUBTITLE_CLASSES}>{t("brand.details.title")}</h3>
      <p>{t("brand.details.intro")}</p>
      <TextField
        {...common("legalName")}
        name="legalName"
        value={draft.legalName}
        onChange={(value) => onChange("legalName", value)}
        maxLength={VERIFICATION_LEGAL_NAME_MAX_LENGTH}
        autoComplete="organization"
      />
      <SingleChoiceField
        {...common("registrationCountryCode")}
        name="registrationCountryCode"
        options={countries}
        value={
          draft.registrationCountryCode === ""
            ? null
            : draft.registrationCountryCode
        }
        onChange={(code) => onChange("registrationCountryCode", code)}
        placeholder={tBrand("field.choose")}
      />
      <TextField
        {...common("registrationNumber")}
        name="registrationNumber"
        value={draft.registrationNumber}
        onChange={(value) => onChange("registrationNumber", value)}
        maxLength={VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH}
      />
    </div>
  );
}

function CancelButton({
  request,
  gestures,
}: {
  request: OwnRequest;
  gestures: BrandJourneyGestures;
}) {
  const t = useTranslations("verification");
  if (!isCancellable(request)) {
    return null;
  }
  return (
    <MemberButton
      variant="text"
      onClick={gestures.cancel}
      aria-disabled={gestures.busy !== null}
    >
      {t("ownership.cancel")}
    </MemberButton>
  );
}

/**
 * Screen 3: the request is sent, an agent will check; the state stays visible in block 4 of the profile.
 * While its domain code lives, the code is shown again with the two ways (L2FU-1, the TXT fallback of a
 * request an agent opened).
 */
function SentStep({
  request,
  requestedSince,
  gestures,
  title,
}: {
  request: OwnRequest;
  requestedSince: string | null;
  gestures: BrandJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const code = requestedCodeOf(rowRequestOf(request));
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("brand.sent.title")}
      </h2>
      <p>{t("brand.sent.body")}</p>
      {requestedSince === null ? null : (
        <BrandRequestState
          state={{ kind: "requested", request, since: requestedSince }}
        />
      )}
      {code === null ? null : <BrandCode code={code} />}
      <Notice tone="info" announce={false}>
        {t("brand.sent.keepCode")}
      </Notice>
      <p className={MEMBER_FIELD_HELP_CLASSES}>{t("brand.sent.state")}</p>
      <div className={ACTIONS_CLASSES}>
        <BackToProfile label={t("brand.sent.back")} />
        <CancelButton request={request} gestures={gestures} />
      </div>
    </>
  );
}

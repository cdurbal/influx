"use client";

// "Faire vérifier mon compte" (docs/mvp/17 §5.3, C3; 08 §C, RG1 to RG7, RG21 to RG24, RG28, RG29, RG96;
// jalons/l2e, commit 18): the proof of ownership of ONE network line, in three screens. 1. what the
// badge states and does not state, and what the brands will read of it, BEFORE anything is asked;
// 2. the code, « Copier », where to paste it, how long it is valid, what INFLUX never asks and what
// it does not accept; 3. the confirmation. The screen is the API's own state read back (a request
// left half-way is taken back at its own screen); it grants nothing: an INFLUX agent reads the code
// online and decides by hand (RG9, RG25). The page of a creator: any other role finds no such page.
// This file draws; the steps and the refusals are verification-view.ts, the gestures
// use-ownership-journey.ts. No amount, rate, net or price (D78); no identifier of the account.
import type { OwnRequest } from "@influx/contracts/verification";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
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
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import {
  CARD_TITLE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon, CopyIcon } from "@/components/ui/icons";
import { copyText } from "@/browser/copy-text";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { BadgeLine } from "./BadgeLine";
import { BackToProfile, FailureNotice, useNetworkName } from "./JourneyParts";
import { RequestState } from "./RequestState";
import { useCreatorVerification } from "./use-creator-verification";
import {
  useOwnershipJourney,
  type OwnershipJourneyGestures,
} from "./use-ownership-journey";
import {
  OWNERSHIP_STEP_COUNT,
  formatVerificationDate,
  isCancellable,
  levelRowOf,
  lineOfNetwork,
  ownershipJourneyOf,
  stepNumberOf,
  type OwnershipJourney,
  type RowRequest,
} from "./verification-view";

const STEP_TITLE_CLASSES = cn(SECTION_TITLE, "text-text-primary");
const SUBTITLE_CLASSES = cn(CARD_TITLE, "text-text-primary");
const LIST_CLASSES =
  "flex list-disc flex-col gap-2 pl-5 text-md text-text-primary";
const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";
const CODE_BOX_CLASSES =
  "flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-raised p-4";
const CODE_CLASSES =
  "select-all break-all font-mono text-title-section font-bold tracking-overline text-text-primary";

type TitleRef = RefObject<HTMLHeadingElement | null>;

/** The page of a creator; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function OwnershipScreen({ networkCode }: { networkCode: string }) {
  const { me } = useMember();
  if (me.role !== "creator") {
    notFound();
  }
  return <OwnershipView networkCode={networkCode} />;
}

function OwnershipView({ networkCode }: { networkCode: string }) {
  const t = useTranslations("verification");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const verification = useCreatorVerification({
    onSignedOut: () => signedOut(null),
  });
  const gestures = useOwnershipJourney({
    networkCode,
    reload: verification.reload,
    onSignedOut: () => signedOut(null),
  });

  const network = useNetworkName(networkCode);

  const back = (
    <Link
      href={memberPageHref("accountProfile", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{t("ownership.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("ownership.back")}
    </Link>
  );

  const line =
    verification.phase === "ready"
      ? lineOfNetwork(verification.lines, networkCode)
      : null;
  if (verification.phase === "ready" && line === null) {
    // A network the creator holds no line on: the API says it too (T14).
    notFound();
  }

  let body: ReactNode;
  if (line !== null) {
    body = (
      <Journey
        network={network}
        networkCode={networkCode}
        line={line}
        gestures={gestures}
      />
    );
  } else if (verification.phase === "unavailable") {
    body = (
      <div className="flex flex-col gap-4">
        <ErrorNotice>{t("ownership.unavailable")}</ErrorNotice>
        <div>
          <MemberButton
            variant="secondary"
            onClick={() => void verification.retry()}
          >
            {t("ownership.retry")}
          </MemberButton>
        </div>
      </div>
    );
  } else {
    body = (
      <p role="status" className="text-sm text-text-secondary">
        {t("ownership.loading")}
      </p>
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={SPACE_SCREEN_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("ownership.title", { network })} />
        {body}
      </div>
    </PageBackContext>
  );
}

function Journey({
  network,
  networkCode,
  line,
  gestures,
}: {
  network: string;
  networkCode: string;
  line: NonNullable<ReturnType<typeof lineOfNetwork>>;
  gestures: OwnershipJourneyGestures;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const journey = ownershipJourneyOf(line);
  const row = levelRowOf(line, "account_verified");

  // After a step, the focus goes to its title, so that the next gesture is the next screen's (17 §2.2);
  // not at the first draw, where the page title keeps it.
  const title = useRef<HTMLHeadingElement>(null);
  const shown = useRef(journey.step);
  useEffect(() => {
    if (shown.current !== journey.step) {
      shown.current = journey.step;
      title.current?.focus();
    }
  }, [journey.step]);

  const stepName =
    journey.step === "affirm"
      ? t("ownership.steps.affirm")
      : journey.step === "code"
        ? t("ownership.steps.code")
        : t("ownership.steps.confirm");
  const duplicateSince =
    row.request?.kind === "requested"
      ? formatVerificationDate(row.request.since, locale)
      : null;

  return (
    <>
      <p className="text-sm text-text-secondary" data-step={journey.step}>
        {t("ownership.steps.progress", {
          current: stepNumberOf(journey.step),
          total: OWNERSHIP_STEP_COUNT,
          name: stepName,
        })}
      </p>
      <Card>
        {gestures.failure === null ? null : (
          <FailureNotice failure={gestures.failure} since={duplicateSince} />
        )}
        {journey.step === "affirm" ? (
          <AffirmStep
            network={network}
            journey={journey}
            gestures={gestures}
            title={title}
          />
        ) : null}
        {journey.step === "code" && journey.request !== null ? (
          <CodeStep
            network={network}
            networkCode={networkCode}
            journey={journey}
            request={journey.request}
            gestures={gestures}
            title={title}
          />
        ) : null}
        {journey.step === "confirm" && journey.request !== null ? (
          <ConfirmStep
            request={journey.request}
            gestures={gestures}
            title={title}
            requested={row.request}
          />
        ) : null}
        {journey.step === "done" && journey.badge !== null ? (
          <>
            <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
              {t("ownership.done.title")}
            </h2>
            <BadgeLine badge={journey.badge} network={network} />
            <p>{t("ownership.done.removeCode")}</p>
            <BackToProfile label={t("ownership.done.back")} />
          </>
        ) : null}
      </Card>
    </>
  );
}

/** Screen 1: what the badge states and does not state, what the brands read, and only then the button (RG1, RG2, RG96). */
function AffirmStep({
  network,
  journey,
  gestures,
  title,
}: {
  network: string;
  journey: OwnershipJourney;
  gestures: OwnershipJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  // The example date: today's, said to be an example; the real one is the day of the check.
  const [now] = useState(() => new Date());
  const expired = journey.previous?.kind === "expired";
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("ownership.affirm.title")}
      </h2>
      {journey.badge === null ? null : (
        <BadgeLine badge={journey.badge} network={network} />
      )}
      {journey.previous === null ? null : (
        <RequestState
          state={journey.previous}
          context={{ level: "account_verified" }}
        />
      )}
      <p>{t("ownership.affirm.todo", { network })}</p>
      <p>{t("ownership.affirm.intro")}</p>
      <ul className={LIST_CLASSES}>
        <li>{t("ownership.affirm.items.fact")}</li>
        <li>{t("ownership.affirm.items.evidence")}</li>
        <li>{t("ownership.affirm.items.agent")}</li>
        <li>{t("ownership.affirm.items.date")}</li>
      </ul>
      <h3 className={SUBTITLE_CLASSES}>{t("ownership.affirm.not.title")}</h3>
      <ul className={LIST_CLASSES}>
        <li>{t("ownership.affirm.not.authenticity")}</li>
        <li>{t("ownership.affirm.not.stability")}</li>
        <li>{t("ownership.affirm.not.performance")}</li>
        <li>{t("ownership.affirm.not.quality")}</li>
        <li>{t("ownership.affirm.not.commitments")}</li>
      </ul>
      <h3 className={SUBTITLE_CLASSES}>
        {t("ownership.affirm.preview.title")}
      </h3>
      <div className="flex flex-col gap-2" data-preview="">
        <VerifiedBadge
          text={t("verif.badge.accountVerified.label", {
            network,
            date: formatVerificationDate(now.toISOString(), locale),
          })}
        />
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("verif.badge.accountVerified.help")}
        </p>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("ownership.affirm.preview.example")}
        </p>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("ownership.affirm.preview.never")}
        </p>
      </div>
      <div className={ACTIONS_CLASSES}>
        <MemberButton
          onClick={gestures.start}
          aria-disabled={gestures.busy !== null}
        >
          {expired
            ? t("ownership.code.renewExpired")
            : t("ownership.affirm.continue")}
        </MemberButton>
      </div>
    </>
  );
}

/** Screen 2: the code, « Copier », where, how long, what INFLUX never asks and never accepts (RG21 to RG24, RG28, RG29). */
function CodeStep({
  network,
  networkCode,
  journey,
  request,
  gestures,
  title,
}: {
  network: string;
  networkCode: string;
  journey: OwnershipJourney;
  request: OwnRequest;
  gestures: OwnershipJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const code = request.code;
  const whereKey = `ownership.code.where.${networkCode}`;
  const where = t.has(whereKey as Parameters<typeof t>[0])
    ? t(whereKey as Parameters<typeof t>[0])
    : t("ownership.code.where.other");
  const busy = gestures.busy !== null;

  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("ownership.code.title")}
      </h2>
      {code === null || journey.codeExpired ? (
        <>
          <Notice tone="warning">{t("verif.request.expired")}</Notice>
          <div className={ACTIONS_CLASSES}>
            <MemberButton
              onClick={() => gestures.renew(request.id)}
              aria-disabled={busy}
            >
              {t("ownership.code.renewExpired")}
            </MemberButton>
            <CancelButton request={request} gestures={gestures} />
          </div>
        </>
      ) : (
        <>
          <p>{t("verif.ownership.instructions", { network })}</p>
          <p>{where}</p>
          <div className={CODE_BOX_CLASSES}>
            <span className="text-sm font-semibold text-text-secondary">
              {t("ownership.code.label")}
            </span>
            <code className={CODE_CLASSES} data-ownership-code="">
              {code.code}
            </code>
            <div className={ACTIONS_CLASSES}>
              <MemberButton
                variant="secondary"
                onClick={() => {
                  void copyText(code.code).then((done) =>
                    setCopy(done ? "copied" : "failed"),
                  );
                }}
              >
                <CopyIcon
                  aria-hidden="true"
                  className="size-(--size-icon-sm) shrink-0"
                />
                {t("ownership.code.copy")}
              </MemberButton>
              <span role="status" className="text-sm text-text-secondary">
                {copy === "copied"
                  ? t("ownership.code.copied")
                  : copy === "failed"
                    ? t("ownership.code.copyFailed")
                    : null}
              </span>
            </div>
          </div>
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("verif.ownership.codeExpiry", {
              date: formatVerificationDate(code.expiresAt, locale),
            })}
          </p>
          <p>{t("ownership.code.public")}</p>
          <Notice tone="info" announce={false}>
            {t("verif.ownership.neverAsk")}
          </Notice>
          <h3 className={SUBTITLE_CLASSES}>
            {t("ownership.code.notAccepted.title")}
          </h3>
          <p>{t("ownership.code.notAccepted.intro")}</p>
          <ul className={LIST_CLASSES}>
            <li>{t("ownership.code.notAccepted.dm")}</li>
            <li>{t("ownership.code.notAccepted.connected")}</li>
            <li>{t("ownership.code.notAccepted.bio")}</li>
            <li>{t("ownership.code.notAccepted.oath")}</li>
            <li>{t("ownership.code.notAccepted.link")}</li>
            <li>{t("ownership.code.notAccepted.video")}</li>
            <li>{t("ownership.code.notAccepted.credentials")}</li>
          </ul>
          <div className={ACTIONS_CLASSES}>
            <MemberButton
              onClick={() => gestures.submit(request.id)}
              aria-disabled={busy}
            >
              {t("ownership.code.pasted")}
            </MemberButton>
            <MemberButton
              variant="text"
              onClick={() => {
                setCopy("idle");
                gestures.renew(request.id);
              }}
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

function CancelButton({
  request,
  gestures,
}: {
  request: OwnRequest;
  gestures: OwnershipJourneyGestures;
}) {
  const t = useTranslations("verification");
  if (!isCancellable(request)) {
    return null;
  }
  return (
    <MemberButton
      variant="text"
      onClick={() => gestures.cancel(request.id)}
      aria-disabled={gestures.busy !== null}
    >
      {t("ownership.cancel")}
    </MemberButton>
  );
}

/** Screen 3: the request is sent, an agent will check; the state stays visible in the line of the network. */
function ConfirmStep({
  request,
  gestures,
  title,
  requested,
}: {
  request: OwnRequest;
  gestures: OwnershipJourneyGestures;
  title: TitleRef;
  requested: RowRequest | null;
}) {
  const t = useTranslations("verification");
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("ownership.confirm.title")}
      </h2>
      <p>{t("ownership.confirm.body")}</p>
      {requested === null ? null : (
        <RequestState
          state={requested}
          context={{ level: "account_verified" }}
        />
      )}
      <Notice tone="info" announce={false}>
        {t("ownership.confirm.keepCode")}
      </Notice>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("ownership.confirm.state")}
      </p>
      <div className={ACTIONS_CLASSES}>
        <BackToProfile label={t("ownership.confirm.back")} />
        <CancelButton request={request} gestures={gestures} />
      </div>
    </>
  );
}

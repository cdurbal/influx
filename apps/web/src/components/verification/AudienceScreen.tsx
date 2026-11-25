"use client";

// "Faire vérifier mon audience" (docs/mvp/17 §5.3, C3; 08 §D, RG12, RG31 to RG36, RG85, RG87, RG95,
// RG96; jalons/l2e, commit 19): the deposit of the evidence of the audience of ONE network line. The
// condition (« Compte vérifié » on the same network, RG12) is written BEFORE any button; then what the
// badge states and what a brand will read, before anything is deposited (RG96); then the deposit,
// where the instructions are the screen (RG87): the piece expected on the network (RG32), what must
// be seen, hidden, never asked, one file per call, a file that fails never costs the others (RG95,
// CA67); then the follow-up: in review, refused with its reason, or granted with its date, its period,
// its source and the sentence on authenticity beside it (RG10). The screen is the API's own state read
// back and grants nothing: an INFLUX agent reads the figures himself and decides by hand (RG9). The
// page of a creator: any other role finds no such page. This file draws; the stages, the failures and
// the sizes are verification-view.ts, the gestures use-audience-journey.ts. No amount, rate, net or
// price (D78); no identifier of the account; the name of a file is never read, shown or sent.
import {
  VERIFICATION_EVIDENCE_MIN_SIDE,
  type OwnEvidence,
} from "@influx/contracts/verification";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
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
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import {
  CARD_TITLE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref, ownershipJourneyHref } from "@/lib/member-paths";
import { routing, type AppLocale } from "@/i18n/routing";
import { BadgeLine } from "./BadgeLine";
import { BackToProfile, FailureNotice, useNetworkName } from "./JourneyParts";
import { RequestState } from "./RequestState";
import {
  useAudienceJourney,
  type AudienceJourneyGestures,
  type DepositAttempt,
} from "./use-audience-journey";
import { useCreatorVerification } from "./use-creator-verification";
import {
  AUDIENCE_STEP_COUNT,
  EVIDENCE_MAX_MEBIBYTES,
  audienceJourneyOf,
  audienceStepNumberOf,
  doneUntilKeyOf,
  expectedPieceKeyOf,
  formatByteSize,
  formatDelay,
  formatVerificationDate,
  isCancellable,
  isRenewable,
  levelRowOf,
  lineOfNetwork,
  type AudienceJourney,
  type EvidenceFailure,
} from "./verification-view";

const STEP_TITLE_CLASSES = cn(SECTION_TITLE, "text-text-primary");
const SUBTITLE_CLASSES = cn(CARD_TITLE, "text-text-primary");
const LIST_CLASSES =
  "flex list-disc flex-col gap-2 pl-5 text-md text-text-primary";
const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";
const GROUP_CLASSES =
  "flex flex-col gap-2 rounded-md border-(length:--border-width-thin) border-border-strong p-4";
const PIECE_CLASSES =
  "flex flex-wrap items-center justify-between gap-3 rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised px-4 py-2";
/** What the picker offers; the API reads the real type in the bytes and decides (08 RG34). */
const ACCEPTED_FORMATS = "image/png,image/jpeg,image/webp";

type TitleRef = RefObject<HTMLHeadingElement | null>;

function localeOf(value: string): AppLocale {
  return (
    routing.locales.find((candidate) => candidate === value) ??
    routing.defaultLocale
  );
}

/** The page of a creator; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function AudienceScreen({ networkCode }: { networkCode: string }) {
  const { me } = useMember();
  if (me.role !== "creator") {
    notFound();
  }
  return <AudienceView networkCode={networkCode} />;
}

function AudienceView({ networkCode }: { networkCode: string }) {
  const t = useTranslations("verification");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const verification = useCreatorVerification({
    onSignedOut: () => signedOut(null),
  });
  const gestures = useAudienceJourney({
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
        journey={audienceJourneyOf(line)}
        sentSince={sentSinceOf(line)}
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
        <PageHeader title={t("audience.title", { network })} />
        {body}
      </div>
    </PageBackContext>
  );
}

/** The date the open request of the audience was sent, for « une demande est déjà en cours depuis le … » (RG14). */
function sentSinceOf(
  line: NonNullable<ReturnType<typeof lineOfNetwork>>,
): string | null {
  const row = levelRowOf(line, "audience_verified");
  return row.request?.kind === "requested" ? row.request.since : null;
}

function Journey({
  network,
  networkCode,
  journey,
  sentSince,
  gestures,
}: {
  network: string;
  networkCode: string;
  journey: AudienceJourney;
  sentSince: string | null;
  gestures: AudienceJourneyGestures;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const step = audienceStepNumberOf(journey.stage);

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

  const stepName =
    journey.stage === "affirm"
      ? t("audience.steps.affirm")
      : journey.stage === "deposit"
        ? t("audience.steps.deposit")
        : t("audience.steps.follow");

  return (
    <>
      {step === null ? null : (
        <p className="text-sm text-text-secondary" data-step={journey.stage}>
          {t("ownership.steps.progress", {
            current: step,
            total: AUDIENCE_STEP_COUNT,
            name: stepName,
          })}
        </p>
      )}
      <Card>
        {gestures.failure === null ? null : (
          <FailureNotice
            failure={gestures.failure}
            since={
              sentSince === null
                ? null
                : formatVerificationDate(sentSince, locale)
            }
          />
        )}
        {journey.stage === "locked" ? (
          <LockedStep
            network={network}
            networkCode={networkCode}
            title={title}
          />
        ) : null}
        {journey.stage === "affirm" ? (
          <AffirmStep
            network={network}
            journey={journey}
            gestures={gestures}
            title={title}
          />
        ) : null}
        {journey.stage === "deposit" && journey.request !== null ? (
          <DepositStep
            network={network}
            networkCode={networkCode}
            journey={journey}
            requestId={journey.request.id}
            gestures={gestures}
            title={title}
          />
        ) : null}
        {journey.stage === "sent" && journey.request !== null ? (
          <SentStep journey={journey} gestures={gestures} title={title} />
        ) : null}
        {journey.stage === "done" && journey.badge !== null ? (
          <>
            <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
              {t("audience.done.title")}
            </h2>
            <BadgeLine badge={journey.badge} network={network} />
            {journey.badge.expiresAt === null ? null : (
              <p>
                {t(`audience.done.${doneUntilKeyOf(journey.badge)}`, {
                  date: formatVerificationDate(journey.badge.expiresAt, locale),
                })}
              </p>
            )}
            {isRenewable(journey.badge) ? (
              // the reminder window is open (08 RG70 « J-15 », L2FU-2): the new deposit keeps the badge
              <div className={ACTIONS_CLASSES}>
                <MemberButton
                  onClick={gestures.start}
                  aria-disabled={gestures.busy !== null}
                >
                  {t("audience.affirm.continueRefresh")}
                </MemberButton>
              </div>
            ) : null}
            <BackToProfile label={t("ownership.done.back")} />
          </>
        ) : null}
      </Card>
    </>
  );
}

/** The condition, written before any button (RG12): the audience is verified on an account whose owner is known. */
function LockedStep({
  network,
  networkCode,
  title,
}: {
  network: string;
  networkCode: string;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const locale = localeOf(useLocale());
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("audience.locked.title")}
      </h2>
      <p data-audience-locked="">{t("audience.locked.body", { network })}</p>
      <div>
        <Link
          href={ownershipJourneyHref(networkCode, locale)}
          className={memberButtonClasses("primary")}
        >
          {t("audience.locked.cta", { network })}
        </Link>
      </div>
    </>
  );
}

/** Screen 1: what the badge states and does not state, what the brands read and what stays internal, and only then the button (RG1, RG2, RG96). */
function AffirmStep({
  network,
  journey,
  gestures,
  title,
}: {
  network: string;
  journey: AudienceJourney;
  gestures: AudienceJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  // The example date: today's, said to be an example; the real one is the day of the check.
  const [now] = useState(() => new Date());
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("audience.affirm.title")}
      </h2>
      {journey.badge === null ? null : (
        <BadgeLine badge={journey.badge} network={network} />
      )}
      {journey.previous === null ? null : (
        // the first screen only follows an established ownership: a locked line shows no first screen (RG12)
        <RequestState
          state={journey.previous}
          context={{ level: "audience_verified", ownershipEstablished: true }}
        />
      )}
      {journey.refresh ? <p>{t("audience.affirm.refresh")}</p> : null}
      <p>{t("audience.affirm.todo", { network })}</p>
      <p>{t("audience.affirm.intro", { network })}</p>
      <ul className={LIST_CLASSES}>
        <li>{t("audience.affirm.items.fact")}</li>
        <li>{t("audience.affirm.items.evidence", { network })}</li>
        <li>{t("audience.affirm.items.agent")}</li>
        <li>{t("audience.affirm.items.date")}</li>
      </ul>
      <h3 className={SUBTITLE_CLASSES}>{t("ownership.affirm.not.title")}</h3>
      <ul className={LIST_CLASSES}>
        <li>{t("ownership.affirm.not.authenticity")}</li>
        <li>{t("ownership.affirm.not.stability")}</li>
        <li>{t("ownership.affirm.not.performance")}</li>
        <li>{t("ownership.affirm.not.quality")}</li>
        <li>{t("ownership.affirm.not.commitments")}</li>
      </ul>
      <h3 className={SUBTITLE_CLASSES}>{t("audience.preview.title")}</h3>
      <div className="flex flex-col gap-3" data-preview="">
        <div className="flex flex-col gap-2">
          <VerifiedBadge
            text={t("verif.badge.audienceVerified.label", {
              network,
              date: formatVerificationDate(now.toISOString(), locale),
            })}
          />
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("audience.preview.help", { network })}
          </p>
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("audience.preview.example")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section aria-labelledby="audience-public" className={GROUP_CLASSES}>
            <h4 id="audience-public" className={SUBTITLE_CLASSES}>
              {t("audience.preview.public.title")}
            </h4>
            <ul className={LIST_CLASSES}>
              <li>{t("audience.preview.public.level")}</li>
              <li>{t("audience.preview.public.date")}</li>
              <li>{t("audience.preview.public.period")}</li>
              <li>{t("audience.preview.public.source", { network })}</li>
              <li>{t("audience.preview.public.bands")}</li>
            </ul>
          </section>
          <section
            aria-labelledby="audience-internal"
            className={GROUP_CLASSES}
          >
            <h4 id="audience-internal" className={SUBTITLE_CLASSES}>
              {t("audience.preview.internal.title")}
            </h4>
            <ul className={LIST_CLASSES}>
              <li>{t("audience.preview.internal.pieces")}</li>
              <li>{t("audience.preview.internal.exact")}</li>
              <li>{t("audience.preview.internal.gap")}</li>
              <li>{t("audience.preview.internal.handle")}</li>
              <li>{t("audience.preview.internal.agent")}</li>
            </ul>
          </section>
        </div>
      </div>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("verif.evidence.freshness")}
      </p>
      <div className={ACTIONS_CLASSES}>
        <MemberButton
          onClick={gestures.start}
          aria-disabled={gestures.busy !== null}
        >
          {journey.refresh
            ? t("audience.affirm.continueRefresh")
            : t("audience.affirm.continue")}
        </MemberButton>
      </div>
    </>
  );
}

/** Screen 2: the instructions are the screen (RG87), the piece expected on the network (RG32), the files, one per call (RG95). */
function DepositStep({
  network,
  networkCode,
  journey,
  requestId,
  gestures,
  title,
}: {
  network: string;
  networkCode: string;
  journey: AudienceJourney;
  requestId: string;
  gestures: AudienceJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const picker = useRef<HTMLInputElement>(null);
  const busy = gestures.busy !== null;
  const { pieces } = journey;
  const request = journey.request;

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // The same file can be chosen again after a refusal.
    event.target.value = "";
    if (picked.length > 0) {
      gestures.choose(requestId, picked);
    }
  }

  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("audience.deposit.title")}
      </h2>
      <h3 className={SUBTITLE_CLASSES}>
        {t("audience.deposit.expected.title", { network })}
      </h3>
      <p data-expected={expectedPieceKeyOf(networkCode)}>
        {t(`audience.deposit.expected.${expectedPieceKeyOf(networkCode)}`, {
          network,
        })}
      </p>
      <p>{t("audience.deposit.expected.thirdParty")}</p>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("verif.evidence.freshness")}
      </p>
      <h3 className={SUBTITLE_CLASSES}>
        {t("audience.deposit.instructions.title")}
      </h3>
      <dl className="flex flex-col gap-3" data-instructions="">
        {(["see", "hide", "never"] as const).map((part) => (
          <div key={part} className={GROUP_CLASSES}>
            <dt className="font-semibold text-text-primary">
              {t(`audience.deposit.instructions.${part}.title`)}
            </dt>
            <dd>{t(`audience.deposit.instructions.${part}.text`)}</dd>
          </div>
        ))}
      </dl>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("audience.deposit.instructions.why")}
      </p>
      <p>{t("audience.deposit.formats", { size: EVIDENCE_MAX_MEBIBYTES })}</p>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("audience.deposit.private")}
      </p>

      <section
        aria-labelledby="audience-pieces"
        className="flex flex-col gap-3"
      >
        <h3 id="audience-pieces" className={SUBTITLE_CLASSES}>
          {t("audience.deposit.pieces.title")}
        </h3>
        <p role="status" className="text-sm text-text-secondary">
          {pieces.length === 0
            ? t("audience.deposit.pieces.none")
            : t("audience.deposit.pieces.count", { count: pieces.length })}
        </p>
        {pieces.length === 0 ? null : (
          <ul className="flex flex-col gap-2" data-pieces="">
            {pieces.map((piece, index) => (
              <li key={piece.id} className={PIECE_CLASSES} data-piece="">
                <span>{pieceLabel(t, locale, piece, index + 1)}</span>
                <MemberButton
                  variant="text"
                  aria-label={t("audience.deposit.pieces.removeLabel", {
                    number: index + 1,
                  })}
                  aria-disabled={busy}
                  onClick={() => gestures.removePiece(requestId, piece.id)}
                >
                  {t("audience.deposit.pieces.remove")}
                </MemberButton>
              </li>
            ))}
          </ul>
        )}
        {gestures.attempts.length === 0 ? null : (
          <ul className="flex flex-col gap-2" data-attempts="">
            {gestures.attempts.map((attempt) => (
              <AttemptRow
                key={attempt.key}
                attempt={attempt}
                requestId={requestId}
                gestures={gestures}
              />
            ))}
          </ul>
        )}
        <div className={ACTIONS_CLASSES}>
          <input
            ref={picker}
            type="file"
            accept={ACCEPTED_FORMATS}
            multiple
            hidden
            onChange={onPick}
          />
          <MemberButton
            variant="secondary"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) {
                picker.current?.click();
              }
            }}
          >
            {pieces.length === 0
              ? t("audience.deposit.choose")
              : t("audience.deposit.chooseMore")}
          </MemberButton>
        </div>
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("audience.deposit.chooseHelp")}
        </p>
      </section>

      <div className={ACTIONS_CLASSES}>
        <MemberButton
          onClick={() => {
            if (pieces.length > 0) {
              gestures.submit(requestId);
            }
          }}
          aria-disabled={busy || pieces.length === 0}
        >
          {t("audience.deposit.submit")}
        </MemberButton>
        {request === null || !isCancellable(request) ? null : (
          <MemberButton
            variant="text"
            onClick={() => gestures.cancel(request.id)}
            aria-disabled={busy}
          >
            {t("ownership.cancel")}
          </MemberButton>
        )}
      </div>
      {pieces.length === 0 ? (
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("audience.deposit.submitHelp")}
        </p>
      ) : null}
    </>
  );
}

type Translate = ReturnType<typeof useTranslations<"verification">>;

/** « Capture 2 : 600 × 300 px, 34 ko »: the numbers of the stored piece, never its name (it has none). */
function pieceLabel(
  t: Translate,
  locale: string,
  piece: OwnEvidence,
  number: number,
): string {
  if (
    piece.width === null ||
    piece.height === null ||
    piece.byteSize === null
  ) {
    return t("audience.deposit.pieces.itemUnsized", { number });
  }
  return t("audience.deposit.pieces.item", {
    number,
    width: piece.width,
    height: piece.height,
    size: formatByteSize(piece.byteSize, locale),
  });
}

/** One file of the queue that the API does not hold yet: waiting, sending, or told why it was not taken (RG95, CA67). */
function AttemptRow({
  attempt,
  requestId,
  gestures,
}: {
  attempt: DepositAttempt;
  requestId: string;
  gestures: AudienceJourneyGestures;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const size = formatByteSize(attempt.size, locale);
  const failure = attempt.failure;
  return (
    <li
      className="flex flex-col gap-2"
      data-attempt={attempt.state}
      data-failure-key={failure?.key}
    >
      <p
        className="text-sm text-text-secondary"
        role={attempt.state === "failed" ? undefined : "status"}
      >
        {t(`audience.deposit.attempt.${attempt.state}`, { size })}
      </p>
      {failure === null ? null : (
        <ErrorNotice>
          <span data-evidence-failure={failure.key}>
            {evidenceMessage(t, locale, failure)}
          </span>
        </ErrorNotice>
      )}
      {attempt.state !== "failed" ? null : (
        <div className={ACTIONS_CLASSES}>
          {failure?.retryable === true ? (
            <MemberButton
              variant="secondary"
              aria-disabled={gestures.busy !== null}
              onClick={() => gestures.retry(requestId, attempt.key)}
            >
              {t("audience.deposit.attempt.retry")}
            </MemberButton>
          ) : null}
          <MemberButton
            variant="text"
            onClick={() => gestures.dismiss(attempt.key)}
          >
            {t("audience.deposit.attempt.dismiss")}
          </MemberButton>
        </div>
      )}
    </li>
  );
}

/** The message of a refused deposit, from its key; the delay of the quota is the API's `Retry-After`, said in words. */
function evidenceMessage(
  t: Translate,
  locale: string,
  failure: EvidenceFailure,
): string {
  switch (failure.key) {
    case "quota":
      return failure.retryAfterSeconds === null
        ? t("audience.errors.quota")
        : t("audience.errors.quotaDelay", {
            delay: formatDelay(failure.retryAfterSeconds, locale),
          });
    case "too_small":
      return t("audience.errors.too_small", {
        min: VERIFICATION_EVIDENCE_MIN_SIDE,
      });
    case "tooLarge":
      return t("audience.errors.tooLarge", { size: EVIDENCE_MAX_MEBIBYTES });
    default:
      return t(`audience.errors.${failure.key}`);
  }
}

/** Screen 3: the request is sent, an agent will check; the state stays visible in the line of the network. */
function SentStep({
  journey,
  gestures,
  title,
}: {
  journey: AudienceJourney;
  gestures: AudienceJourneyGestures;
  title: TitleRef;
}) {
  const t = useTranslations("verification");
  const request = journey.request;
  const since = request?.submittedAt ?? request?.createdAt ?? null;
  return (
    <>
      <h2 ref={title} tabIndex={-1} className={STEP_TITLE_CLASSES}>
        {t("audience.sent.title")}
      </h2>
      <p>{t("audience.sent.body")}</p>
      {request === null || since === null ? null : (
        <RequestState
          state={{ kind: "requested", request, since }}
          context={{ level: "audience_verified", ownershipEstablished: true }}
        />
      )}
      <p className={MEMBER_FIELD_HELP_CLASSES}>{t("audience.sent.private")}</p>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("ownership.confirm.state")}
      </p>
      <div className={ACTIONS_CLASSES}>
        <BackToProfile label={t("ownership.confirm.back")} />
        {request === null || !isCancellable(request) ? null : (
          <MemberButton
            variant="text"
            onClick={() => gestures.cancel(request.id)}
            aria-disabled={gestures.busy !== null}
          >
            {t("ownership.cancel")}
          </MemberButton>
        )}
      </div>
    </>
  );
}

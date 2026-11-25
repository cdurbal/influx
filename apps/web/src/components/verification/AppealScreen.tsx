"use client";

// "Contester une décision" (docs/mvp/17 §5.3, C3; 08 RG19, RG77, CA52, CA53; jalons/l2f/modele.md §1 points
// 7 to 9, §5; commit 17): the contest of ONE decision of a creator, a refusal or the withdrawal of a badge,
// named by the query. The decision and its reason are written first (INFLUX's apologies when the badge was
// its own error, never an accusation), then the window in days, then the form: a reason of the closed list,
// the creator's own words (required for « autre »), no attachment, no contact; sending shows the
// confirmation, which is the follow-up of the contest read back from the API, then its outcome with a motive.
// The screen is the API's own state read back and decides nothing: the window, the unicity and what is
// contestable are the database's. The page of a creator: any other role finds no such page. This file draws;
// the rules are dispute-view.ts, the gesture use-appeal.ts. No amount, rate, net or price (D78); no
// identifier of the account, no decider, no agent; what the creator wrote is never kept in the browser.
import {
  VERIFICATION_DISPUTE_TEXT_MAX_LENGTH,
  type ContestableDecision,
  type CreatorVerificationLine,
  type OwnDispute,
  type OwnDisputesResponse,
} from "@influx/contracts/verification";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
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
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import { SECTION_TITLE } from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref, type AppealTarget } from "@/lib/member-paths";
import { routing, type AppLocale } from "@/i18n/routing";
import { OutcomeSentence, RevocationText } from "./DisputeNotice";
import { BackToProfile, useNetworkName } from "./JourneyParts";
import {
  APPEAL_REASONS,
  EMPTY_APPEAL_DRAFT,
  appealProblemOf,
  appealReasonRequiresText,
  contestableOfTarget,
  disputeOfTarget,
  type AppealDraft,
  type AppealProblem,
} from "./dispute-view";
import { useAppeal, type AppealGesture } from "./use-appeal";
import { useCreatorVerification } from "./use-creator-verification";
import { formatVerificationDate } from "./verification-view";

const TITLE_CLASSES = cn(SECTION_TITLE, "text-text-primary");
const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";
const CONTROL_IDS = { reason: "appeal-reason", text: "appeal-text" } as const;

function localeOf(value: string): AppLocale {
  return (
    routing.locales.find((candidate) => candidate === value) ??
    routing.defaultLocale
  );
}

/** The page of a creator; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function AppealScreen({ target }: { target: AppealTarget }) {
  const { me } = useMember();
  if (me.role !== "creator") {
    notFound();
  }
  return <AppealView target={target} />;
}

function AppealView({ target }: { target: AppealTarget }) {
  const t = useTranslations("verification");
  const tAccount = useTranslations("account");
  const locale = localeOf(useLocale());
  const online = useOnline();
  const { signedOut } = useMember();
  const verification = useCreatorVerification({
    onSignedOut: () => signedOut(null),
  });
  const gesture = useAppeal({
    target,
    reload: verification.reload,
    onSignedOut: () => signedOut(null),
  });

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

  let body: ReactNode;
  if (verification.phase === "ready" && verification.disputes !== null) {
    body = (
      <Decision
        target={target}
        disputes={verification.disputes}
        lines={verification.lines}
        gesture={gesture}
      />
    );
  } else if (
    verification.phase === "unavailable" ||
    verification.phase === "ready"
  ) {
    // the lines answered but the contests did not: nothing can be said of a decision, and nothing is lost
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
        <PageHeader title={t("appeal.title")} />
        {body}
      </div>
    </PageBackContext>
  );
}

/** What the target is now: already contested (its follow-up), still contestable (the form), or neither. */
function Decision({
  target,
  disputes,
  lines,
  gesture,
}: {
  target: AppealTarget;
  disputes: OwnDisputesResponse;
  lines: readonly CreatorVerificationLine[];
  gesture: AppealGesture;
}) {
  const t = useTranslations("verification");
  const dispute = disputeOfTarget(disputes, target);
  const decision = contestableOfTarget(disputes, target);
  // After the send, the focus goes to the title of what the screen became (17 §2.2)
  const title = useRef<HTMLHeadingElement>(null);
  const shown = useRef(dispute === null);
  useEffect(() => {
    if (shown.current !== (dispute === null)) {
      shown.current = dispute === null;
      title.current?.focus();
    }
  }, [dispute]);

  if (dispute !== null) {
    return <Tracking dispute={dispute} lines={lines} title={title} />;
  }
  if (decision !== null) {
    return (
      <Form
        decision={decision}
        windowDays={disputes.windowDays}
        gesture={gesture}
      />
    );
  }
  return (
    <Card>
      {gesture.failure === null ? null : (
        <ErrorNotice>
          <span data-failure={gesture.failure.key}>
            {t(`appeal.failure.${gesture.failure.key}`)}
          </span>
        </ErrorNotice>
      )}
      <p data-appeal-gone="">{t("appeal.gone")}</p>
      <BackToProfile label={t("ownership.done.back")} />
    </Card>
  );
}

/** The decision written first: what happened, on which network, its reason, and the agent's own message where there is one. */
function About({ decision }: { decision: ContestableDecision }) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const network = useNetworkName(decision.networkCode);
  const badge = t(`appeal.badgeName.${decision.level}`);
  const date = formatVerificationDate(decision.decidedAt, locale);
  if (decision.kind === "revocation") {
    return (
      <div className="flex flex-col gap-2" data-about="revocation">
        <p>{t("appeal.about.revocation", { badge, network, date })}</p>
        <RevocationText decision={decision} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-about="refusal">
      <p>{t("appeal.about.refusal", { badge, network, date })}</p>
      {decision.reasonCode === "other" ? null : (
        <p>{t(`refusal.reason.${decision.reasonCode}`)}</p>
      )}
    </div>
  );
}

function Form({
  decision,
  windowDays,
  gesture,
}: {
  decision: ContestableDecision;
  windowDays: number;
  gesture: AppealGesture;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const [draft, setDraft] = useState<AppealDraft>(EMPTY_APPEAL_DRAFT);
  const [problem, setProblem] = useState<AppealProblem | null>(null);
  const textRequired =
    draft.reasonCode !== null && appealReasonRequiresText(draft.reasonCode);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (gesture.busy) {
      return;
    }
    const missing = appealProblemOf(draft);
    setProblem(missing);
    if (missing !== null) {
      document.getElementById(CONTROL_IDS[missing])?.focus();
      return;
    }
    void gesture.send(draft);
  }

  const failureKey = gesture.failure?.key ?? null;
  const textError =
    problem === "text"
      ? t("appeal.problem.text")
      : failureKey === "directContact" ||
          failureKey === "textRequired" ||
          failureKey === "invalidText"
        ? t(`appeal.failure.${failureKey}`)
        : null;

  return (
    <Card>
      <About decision={decision} />
      <p data-appeal-window="">{t("appeal.window", { days: windowDays })}</p>
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("appeal.until", {
          date: formatVerificationDate(decision.closesAt, locale),
        })}
      </p>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-5"
        data-appeal-form=""
      >
        {gesture.failure === null || textError !== null ? null : (
          <ErrorNotice>
            <span data-failure={gesture.failure.key}>
              {t(`appeal.failure.${gesture.failure.key}`)}
            </span>
          </ErrorNotice>
        )}
        <SingleChoiceField
          id={CONTROL_IDS.reason}
          name="appeal-reason"
          display="radios"
          label={t("appeal.form.reasonLegend")}
          options={APPEAL_REASONS.map((code) => ({
            code,
            label: t(`appeal.reason.${code}`),
          }))}
          value={draft.reasonCode}
          onChange={(code) => {
            const reason = APPEAL_REASONS.find((known) => known === code);
            if (reason !== undefined) {
              setDraft({ ...draft, reasonCode: reason });
              setProblem(null);
            }
          }}
          error={problem === "reason" ? t("appeal.problem.reason") : null}
        />
        <TextAreaField
          id={CONTROL_IDS.text}
          name="appeal-text"
          label={t("appeal.form.textLabel")}
          requiredLabel={
            textRequired ? t("appeal.form.textRequired") : undefined
          }
          help={`${draft.reasonCode !== null && !textRequired ? `${t("appeal.form.textOptional")} ` : ""}${t("appeal.form.textHelp")}`}
          value={draft.text}
          onChange={(text) => setDraft({ ...draft, text })}
          maxLength={VERIFICATION_DISPUTE_TEXT_MAX_LENGTH}
          counterText={(count, max) =>
            t("appeal.form.characters", { count, max })
          }
          error={textError}
        />
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("appeal.form.noAttachment")}
        </p>
        <div className={ACTIONS_CLASSES}>
          <MemberButton type="submit" aria-disabled={gesture.busy}>
            {gesture.busy ? t("appeal.form.sending") : t("appeal.form.submit")}
          </MemberButton>
        </div>
      </form>
    </Card>
  );
}

/** The confirmation and the follow-up of a contest: what was sent, where it stands, its outcome with a motive. */
function Tracking({
  dispute,
  lines,
  title,
}: {
  dispute: OwnDispute;
  lines: readonly CreatorVerificationLine[];
  title: RefObject<HTMLHeadingElement | null>;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const decided = dispute.state === "upheld" || dispute.state === "overturned";
  return (
    <Card>
      <h2 ref={title} tabIndex={-1} className={TITLE_CLASSES}>
        {decided ? t("appeal.outcome.title") : t("appeal.sent.title")}
      </h2>
      <div className="flex flex-col gap-3" data-dispute={dispute.state}>
        <p>
          {t("appeal.sent.received", {
            badge: t(`appeal.badgeName.${dispute.level}`),
          })}
        </p>
        {dispute.state === "open" ? (
          <p>
            {t("appeal.state.open", {
              date: formatVerificationDate(dispute.submittedAt, locale),
            })}
          </p>
        ) : dispute.state === "withdrawn" ? (
          <p>{t("appeal.state.withdrawn")}</p>
        ) : (
          <>
            <p>
              {t("appeal.state.decided", {
                date: formatVerificationDate(
                  dispute.outcome?.decidedAt ?? dispute.submittedAt,
                  locale,
                ),
              })}
            </p>
            <OutcomeSentence dispute={dispute} lines={lines} />
          </>
        )}
        <p className={MEMBER_FIELD_HELP_CLASSES}>
          {t("appeal.yours.reason", {
            reason: t(`appeal.reason.${dispute.reasonCode}`),
          })}
        </p>
        {dispute.text === null ? null : (
          <p className={MEMBER_FIELD_HELP_CLASSES}>
            {t("appeal.yours.text")}{" "}
            <span data-own-text="">{dispute.text}</span>
          </p>
        )}
      </div>
      <BackToProfile label={t("ownership.done.back")} />
    </Card>
  );
}

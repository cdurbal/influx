"use client";

// The state and the calls of the decision screen of a verification request, queue 4, in either view (docs/
// mvp/08 RG43 to RG59; 06 RG49 to RG52; 17b §3.7; jalons/l2e/modele.md §4, §6; L2E-22, L2E-23), kept out of
// the components so that they only draw. Opening is claiming: the first reading calls POST …/open. Every decision is bound to the
// review token of the version read: a stale token, a lost or lifted claim, a closed request read the
// dossier again and say why, and what the agent typed stays (RG116). The wording and the checks are
// `verification-decision-view.ts`; the rules are the database's and apps/api's.
import type { ClaimReleaseReasonCode } from "@influx/contracts/backoffice-queues";
import type {
  CompareFiguresResponse,
  GrantAccountRequest,
  GrantAudienceRequest,
  GrantBrandRequest,
  ObservedFigures,
  VerificationOpenResponse,
  VerificationQueueView,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { messages } from "@/messages/fr";
import {
  compareVerificationFigures,
  extendVerificationEntryClaim,
  forceReleaseVerificationEntryClaim,
  grantVerificationAccount,
  grantVerificationAudience,
  grantVerificationBrand,
  openVerificationEntry,
  reexamineVerificationEntry,
  rejectVerificationEntry,
  releaseVerificationEntry,
} from "./backoffice-api";
import {
  chainNoticeFor,
  clockOffset,
  reviewShortcutOf,
  stashChainNotice,
  type ChainNotice,
} from "./queue-review-view";
import {
  accountGrantCheck,
  audienceGrantCheck,
  brandGrantCheck,
  compareCheck,
  EMPTY_DRAFT,
  figuresKeyOf,
  grantedNotice,
  isAudience,
  isBrand,
  modeOf,
  openFailure,
  reexamineCheck,
  reexaminedNotice,
  releaseStepOf,
  refusalOf,
  rejectCheck,
  rejectedNotice,
  reopenNotice,
  whoOf,
  withClaimExpiry,
  type Draft,
  type Problem,
} from "./verification-decision-view";
import { useVerificationEvidence } from "./use-verification-evidence";
import { formatTime } from "./view-model";

const t = messages.verificationReview;

export type ReadyScreen = {
  kind: "ready";
  view: VerificationOpenResponse;
  /** Database instant minus the browser's, taken when the request was read. */
  offsetMs: number;
  /** The sentence that says why the request was read again, or what an extension did. */
  notice: string | null;
};

export type VerificationScreen =
  | { kind: "loading" }
  | { kind: "failed"; text: string; retry: boolean }
  | ReadyScreen;

export type VerificationBusy =
  | "grant"
  | "reject"
  | "reexamine"
  | "compare"
  | "release"
  | "extend"
  | "force"
  | "resume";
/** What the grant sends, by level, once what the agent typed and saw has been checked. */
type GrantPlan =
  | { ok: true; level: "account"; body: GrantAccountRequest }
  | { ok: true; level: "audience"; body: GrantAudienceRequest }
  | { ok: true; level: "brand"; body: GrantBrandRequest }
  | { ok: false; problem: Problem };

export type VerificationPanel =
  "grant" | "reject" | "reexamine" | "release" | "force" | "help" | null;

/** The figures the agent typed, the answer of the database, and the typing the answer speaks of. */
export type Comparison = {
  key: string;
  typed: ObservedFigures;
  result: CompareFiguresResponse;
};

/** `list` is the address of the view the request belongs to: the chain of 17b §2.6 and the way back go there. */
export function useVerificationEntry(
  id: string,
  queue: VerificationQueueView,
  list: string,
) {
  const router = useRouter();
  const alive = useRef(false);
  const evidence = useVerificationEvidence(id);
  const [screen, setScreen] = useState<VerificationScreen>({ kind: "loading" });
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [panel, setPanel] = useState<VerificationPanel>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<VerificationBusy | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [forceReason, setForceReason] = useState<ClaimReleaseReasonCode | null>(
    null,
  );
  const [chain, setChain] = useState<ChainNotice | null>(() =>
    chainNoticeFor(id),
  );
  const [done, setDone] = useState<ChainNotice | null>(null);

  /** Opening is claiming: reads the request (and takes it when it is free) and shows what that gave. */
  const read = useCallback(
    async (
      previous: VerificationOpenResponse | null,
      notice: string | null,
    ) => {
      let result: RelayResult<VerificationOpenResponse>;
      try {
        result = await openVerificationEntry(queue, id);
      } catch {
        // an address that is no identifier: the same answer as an unknown request
        if (alive.current) {
          setScreen({ kind: "failed", text: t.errors.notFound, retry: false });
        }
        return;
      }
      if (!alive.current) {
        return;
      }
      if (result.kind === "ok") {
        const nowMs = Date.now();
        setNow(nowMs);
        setScreen({
          kind: "ready",
          view: result.data,
          offsetMs: clockOffset(result.data.asOf, nowMs),
          notice,
        });
        return;
      }
      const failure = openFailure(result);
      if (failure === "signedOut") {
        router.replace("/");
        return;
      }
      if (previous === null) {
        setScreen({ kind: "failed", ...failure });
      } else {
        setProblem({ field: null, text: failure.text });
      }
    },
    [id, queue, router],
  );

  useEffect(() => {
    alive.current = true;
    // the first reading of the request: the state it sets arrives with the answer, after the effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void read(null, null);
    return () => {
      alive.current = false;
    };
  }, [read]);

  // The clock of the reminder (A9): a tick every ten seconds while the request is decided here.
  const deciding =
    screen.kind === "ready" && modeOf(screen.view) === "deciding";
  useEffect(() => {
    if (!deciding) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [deciding]);

  /** One call of the screen: busy, its answer, and what a refusal means (read again, or a sentence). */
  const perform = useCallback(
    async <Data>(
      kind: VerificationBusy,
      view: VerificationOpenResponse,
      call: () => Promise<RelayResult<Data>>,
      onOk: (data: Data) => void | Promise<void>,
    ) => {
      setBusy(kind);
      setProblem(null);
      try {
        const result = await call();
        if (!alive.current) {
          return;
        }
        if (result.kind === "ok") {
          await onOk(result.data);
          return;
        }
        const refusal = refusalOf(result, whoOf(view));
        if (refusal.kind === "signedOut") {
          router.replace("/");
        } else if (refusal.kind === "reopen") {
          setPanel(null);
          setComparison(null);
          await read(view, reopenNotice(refusal.why));
        } else {
          setProblem({ field: refusal.field, text: refusal.text });
        }
      } finally {
        if (alive.current) {
          setBusy(null);
        }
      }
    },
    [read, router],
  );

  /** 17b §2.6: the next request opens by itself; with none left, the screen ends on the empty queue. */
  const finish = useCallback(
    (
      view: VerificationOpenResponse,
      next: { entryId: string } | null,
      lines: readonly string[],
    ) => {
      setPanel(null);
      if (next !== null) {
        stashChainNotice({
          forEntry: next.entryId,
          decidedEntry: view.entry.id,
          lines,
        });
        router.push(`${list}/${next.entryId}`);
        return;
      }
      stashChainNotice(null);
      setDone({ forEntry: view.entry.id, decidedEntry: view.entry.id, lines });
    },
    [list, router],
  );

  /** What the grant of this level asks of the agent, before any panel opens or any call leaves. */
  const grantPlan = useCallback(
    (view: VerificationOpenResponse, token: string): GrantPlan => {
      if (isBrand(view)) {
        const checked = brandGrantCheck(
          draft,
          token,
          view.dossier?.brand?.registrySources ?? [],
        );
        return checked.ok
          ? { ok: true, level: "brand", body: checked.body }
          : checked;
      }
      if (!isAudience(view)) {
        const checked = accountGrantCheck(draft, token);
        return checked.ok
          ? { ok: true, level: "account", body: checked.body }
          : checked;
      }
      const refusal = (text: string): GrantPlan => ({
        ok: false,
        problem: { field: null, text },
      });
      if ((view.dossier?.evidence.length ?? 0) === 0) {
        return refusal(t.problems.missingEvidence);
      }
      if (evidence.blocked) {
        return refusal(t.evidence.blockedGrant);
      }
      if (evidence.seen === 0) {
        return refusal(t.evidence.mustOpen);
      }
      const checked = audienceGrantCheck(draft, token);
      return checked.ok
        ? { ok: true, level: "audience", body: checked.body }
        : checked;
    },
    [draft, evidence.blocked, evidence.seen],
  );

  /** ‹v› and the button open the recap, never grant (RG115): what is typed is checked before it opens. */
  const openGrant = useCallback(
    (view: VerificationOpenResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = grantPlan(view, view.reviewToken);
      if (!checked.ok) {
        setPanel(null);
        setProblem(checked.problem);
        return;
      }
      setProblem(null);
      setPanel("grant");
    },
    [grantPlan],
  );

  const grant = useCallback(
    (view: VerificationOpenResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = grantPlan(view, view.reviewToken);
      if (!checked.ok) {
        setPanel(null);
        setProblem(checked.problem);
        return;
      }
      void perform(
        "grant",
        view,
        () =>
          checked.level === "brand"
            ? grantVerificationBrand(view.entry.id, checked.body)
            : checked.level === "audience"
              ? grantVerificationAudience(view.entry.id, checked.body)
              : grantVerificationAccount(view.entry.id, checked.body),
        (data) =>
          finish(view, data.next, grantedNotice(view, data.outcome, data.late)),
      );
    },
    [finish, grantPlan, perform],
  );

  const reject = useCallback(
    (view: VerificationOpenResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = rejectCheck(
        draft,
        view.reasons,
        view.reviewToken,
        whoOf(view),
      );
      if (!checked.ok) {
        setProblem(checked.problem);
        return;
      }
      void perform(
        "reject",
        view,
        () => rejectVerificationEntry(queue, view.entry.id, checked.body),
        (data) =>
          finish(
            view,
            data.next,
            rejectedNotice(
              view,
              checked.body.reasonCode,
              data.status,
              data.escalated,
              data.late,
            ),
          ),
      );
    },
    [draft, finish, perform, queue],
  );

  const reexamine = useCallback(
    (view: VerificationOpenResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = reexamineCheck(draft, view.reviewToken);
      if (!checked.ok) {
        setProblem(checked.problem);
        return;
      }
      void perform(
        "reexamine",
        view,
        () => reexamineVerificationEntry(queue, view.entry.id, checked.body),
        (data) => finish(view, data.next, reexaminedNotice(view)),
      );
    },
    [draft, finish, perform, queue],
  );

  /** Modele -19: the typed figures leave, the declared ones and the verdict of the gap come back. */
  const compare = useCallback(
    (view: VerificationOpenResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = compareCheck(draft, view.reviewToken);
      if (!checked.ok) {
        setProblem(checked.problem);
        return;
      }
      const typed: ObservedFigures = {
        followers: checked.body.followers,
        postsLast30Days: checked.body.postsLast30Days,
        avgComments: checked.body.avgComments,
        engagementBp: checked.body.engagementBp,
      };
      const key = figuresKeyOf(draft);
      void perform(
        "compare",
        view,
        () => compareVerificationFigures(view.entry.id, checked.body),
        (result) => setComparison({ key, typed, result }),
      );
    },
    [draft, perform],
  );

  const release = useCallback(
    (view: VerificationOpenResponse) =>
      void perform(
        "release",
        view,
        () => releaseVerificationEntry(queue, view.entry.id),
        () => router.push(list),
      ),
    [list, perform, queue, router],
  );

  /** « Je rends la main » and ‹l›: typed work is never dropped without a confirmation (L2EU-7). */
  const askRelease = useCallback(
    (view: VerificationOpenResponse) => {
      if (releaseStepOf(draft) === "confirm") {
        setProblem(null);
        setPanel("release");
        return;
      }
      release(view);
    },
    [draft, release],
  );

  const extend = useCallback(
    (view: VerificationOpenResponse) =>
      void perform(
        "extend",
        view,
        () => extendVerificationEntryClaim(queue, view.entry.id),
        (data) => {
          setNow(Date.now());
          setScreen((current) =>
            current.kind === "ready"
              ? {
                  ...current,
                  view: withClaimExpiry(current.view, data.claimExpiresAt),
                  notice: messages.queueReview.banner.extended(
                    formatTime(data.claimExpiresAt),
                  ),
                }
              : current,
          );
        },
      ),
    [perform, queue],
  );

  /** The expired claim: the request is opened again, which takes it again when it is free. */
  const resume = useCallback(
    (view: VerificationOpenResponse) => {
      setBusy("resume");
      void read(view, null).finally(() => {
        if (alive.current) {
          setBusy(null);
        }
      });
    },
    [read],
  );

  const retryOpening = useCallback(() => {
    setScreen({ kind: "loading" });
    void read(null, null);
  }, [read]);

  const forceRelease = useCallback(
    (view: VerificationOpenResponse) => {
      if (forceReason === null) {
        setProblem({ field: null, text: messages.queueReview.force.required });
        return;
      }
      void perform(
        "force",
        view,
        () =>
          forceReleaseVerificationEntryClaim(queue, view.entry.id, {
            reasonCode: forceReason,
          }),
        async (data) => {
          setPanel(null);
          setForceReason(null);
          const holder = data.holder?.displayName ?? null;
          await read(
            view,
            holder === null
              ? t.notices.liftedNoName
              : t.notices.lifted_by_you(holder),
          );
        },
      );
    },
    [forceReason, perform, queue, read],
  );

  /** 17b §2.6: the chain is cancelled, the request just taken is given back and the list is shown. */
  const cancelChain = useCallback(
    (view: VerificationOpenResponse) => {
      stashChainNotice(null);
      setChain(null);
      if (modeOf(view) !== "deciding") {
        router.push(list);
        return;
      }
      void perform(
        "release",
        view,
        () => releaseVerificationEntry(queue, view.entry.id),
        () => router.push(list),
      );
    },
    [list, perform, queue, router],
  );

  const closeChain = useCallback(() => {
    stashChainNotice(null);
    setChain(null);
  }, []);

  // The keyboard (08 RG98): ‹v› and ‹r› open a panel, never decide; ‹Échap› closes without loss.
  const ready = screen.kind === "ready" ? screen : null;
  useEffect(() => {
    if (ready === null) {
      return;
    }
    const readyView = ready.view;
    const mode = modeOf(readyView);
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const shortcut = reviewShortcutOf({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target:
          target === null
            ? null
            : {
                tagName: target.tagName,
                isContentEditable: target.isContentEditable,
              },
      });
      if (shortcut === null) {
        return;
      }
      if (shortcut === "escape") {
        if (panel !== null) {
          event.preventDefault();
          setPanel(null);
        }
        return;
      }
      event.preventDefault();
      if (shortcut === "help") {
        setPanel(panel === "help" ? null : "help");
      } else if (busy === null && mode === "deciding") {
        if (shortcut === "release") {
          askRelease(readyView);
        } else if (shortcut === "publish") {
          openGrant(readyView);
        } else {
          setProblem(null);
          setPanel("reject");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, panel, busy, askRelease, openGrant]);

  return {
    screen,
    now,
    draft,
    setDraft,
    panel,
    setPanel,
    problem,
    setProblem,
    busy,
    comparison,
    evidence,
    forceReason,
    setForceReason,
    chain,
    done,
    openGrant,
    grant,
    reject,
    reexamine,
    compare,
    release,
    askRelease,
    extend,
    resume,
    retryOpening,
    forceRelease,
    cancelChain,
    closeChain,
  };
}

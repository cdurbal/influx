"use client";

// The state and the calls of the decision screen of queue 1 (docs/mvp/06 RG6; 15 RG27 C1 to C4, RG114
// to RG116; 17b §2.4 to §2.6; jalons/l2c/file.md A3, A8, A9; L2C-17), kept out of the component so that
// it only draws. Opening is claiming: the first reading calls POST …/open. A decision is bound to the
// version read (L2BS-1): a stale token, a lost or lifted claim, a closed entry read the entry again
// and say why, and the draft stays (RG116). The wording and the checks are `queue-review-view.ts`; the
// rules are the database's and apps/api's.
import type {
  ClaimReleaseReasonCode,
  OpenEntryResponse,
} from "@influx/contracts/backoffice-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { messages } from "@/messages/fr";
import {
  extendBrandReviewClaim,
  forceReleaseBrandReviewClaim,
  openBrandReviewEntry,
  publishBrandReviewEntry,
  rejectBrandReviewEntry,
  releaseBrandReviewEntry,
} from "./backoffice-api";
import type { PickerProblem } from "./BoReasonPicker";
import { changesBetween, type ChangeSet } from "./queue-review-facts";
import {
  chainNoticeFor,
  clockOffset,
  decisionNotice,
  EMPTY_DRAFT,
  modeOf,
  openFailure,
  publishCheck,
  refusalOf,
  rejectCheck,
  reopenNotice,
  reviewShortcutOf,
  stashChainNotice,
  withClaimExpiry,
  type ChainNotice,
  type Draft,
} from "./queue-review-view";
import type { DecisionPanel } from "./ReviewDecision";
import { formatTime } from "./view-model";

const t = messages.queueReview;
export const REVIEW_LIST = "/files/profils-marque";

export type ReadyScreen = {
  kind: "ready";
  view: OpenEntryResponse;
  /** Database instant minus the browser's, taken when the entry was read (A9). */
  offsetMs: number;
  /** The sentence that says why the entry was read again, or what an extension did. */
  notice: string | null;
  /** What moved since the first reading (L2BS-1); null when nothing did. */
  changes: ChangeSet | null;
};

export type ReviewScreen =
  | { kind: "loading" }
  | { kind: "failed"; text: string; retry: boolean }
  | ReadyScreen;

export type ReviewBusy =
  "publish" | "reject" | "release" | "extend" | "force" | "resume";
export type ReviewPanel = DecisionPanel | "force" | "help";

export function useReviewEntry(id: string) {
  const router = useRouter();
  const alive = useRef(false);
  const [screen, setScreen] = useState<ReviewScreen>({ kind: "loading" });
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [panel, setPanel] = useState<ReviewPanel>(null);
  const [problem, setProblem] = useState<PickerProblem | null>(null);
  const [busy, setBusy] = useState<ReviewBusy | null>(null);
  const [forceReason, setForceReason] = useState<ClaimReleaseReasonCode | null>(
    null,
  );
  const [chain, setChain] = useState<ChainNotice | null>(() =>
    chainNoticeFor(id),
  );
  const [done, setDone] = useState<ChainNotice | null>(null);

  /** Opening is claiming: reads the entry (and takes it when it is free) and shows what that gave. */
  const read = useCallback(
    async (previous: OpenEntryResponse | null, notice: string | null) => {
      let result: RelayResult<OpenEntryResponse>;
      try {
        result = await openBrandReviewEntry(id);
      } catch {
        // an address that is no identifier: the same answer as an unknown entry
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
        const changes =
          previous === null ? null : changesBetween(previous, result.data);
        setNow(nowMs);
        setScreen({
          kind: "ready",
          view: result.data,
          offsetMs: clockOffset(result.data.asOf, nowMs),
          notice,
          changes:
            changes !== null && changes.labels.length > 0 ? changes : null,
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
    [id, router],
  );

  useEffect(() => {
    alive.current = true;
    // the first reading of the entry: the state it sets arrives with the answer, after the effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void read(null, null);
    return () => {
      alive.current = false;
    };
  }, [read]);

  // The clock of the reminder (A9): a tick every ten seconds while the entry is decided here.
  const deciding =
    screen.kind === "ready" && modeOf(screen.view) === "deciding";
  useEffect(() => {
    if (!deciding) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [deciding]);

  /** One call of the screen: busy, its answer, and what a refusal means (reread, or a sentence). */
  const perform = useCallback(
    async <Data>(
      kind: ReviewBusy,
      view: OpenEntryResponse,
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
        const refusal = refusalOf(result);
        if (refusal.kind === "signedOut") {
          router.replace("/");
        } else if (refusal.kind === "reopen") {
          setPanel(null);
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

  /** 17b §2.6: the next entry opens by itself; with none left, the screen ends on the empty queue. */
  const finish = useCallback(
    (
      view: OpenEntryResponse,
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
        router.push(`${REVIEW_LIST}/${next.entryId}`);
        return;
      }
      stashChainNotice(null);
      setDone({ forEntry: view.entry.id, decidedEntry: view.entry.id, lines });
    },
    [router],
  );

  const publish = useCallback(
    (view: OpenEntryResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = publishCheck(draft, view.reviewToken);
      if (!checked.ok) {
        setProblem({ field: checked.field, text: checked.error });
        return;
      }
      void perform(
        "publish",
        view,
        () => publishBrandReviewEntry(view.entry.id, checked.body),
        (data) =>
          finish(
            view,
            data.next,
            decisionNotice(
              "published",
              view.profile.brandName,
              null,
              data.late,
            ),
          ),
      );
    },
    [draft, finish, perform],
  );

  const reject = useCallback(
    (view: OpenEntryResponse) => {
      if (view.reviewToken === null) {
        return;
      }
      const checked = rejectCheck(draft, view.reasons, view.reviewToken);
      if (!checked.ok) {
        setProblem({ field: checked.field, text: checked.error });
        return;
      }
      void perform(
        "reject",
        view,
        () => rejectBrandReviewEntry(view.entry.id, checked.body),
        (data) =>
          finish(
            view,
            data.next,
            decisionNotice(
              "rejected",
              view.profile.brandName,
              checked.body.reasonCode,
              data.late,
            ),
          ),
      );
    },
    [draft, finish, perform],
  );

  const release = useCallback(
    (view: OpenEntryResponse) =>
      void perform(
        "release",
        view,
        () => releaseBrandReviewEntry(view.entry.id),
        () => router.push(REVIEW_LIST),
      ),
    [perform, router],
  );

  const extend = useCallback(
    (view: OpenEntryResponse) =>
      void perform(
        "extend",
        view,
        () => extendBrandReviewClaim(view.entry.id),
        (data) => {
          setNow(Date.now());
          setScreen((current) =>
            current.kind === "ready"
              ? {
                  ...current,
                  view: withClaimExpiry(current.view, data.claimExpiresAt),
                  notice: t.banner.extended(formatTime(data.claimExpiresAt)),
                }
              : current,
          );
        },
      ),
    [perform],
  );

  /** The expired claim: the entry is opened again, which takes it again when it is free. */
  const resume = useCallback(
    (view: OpenEntryResponse) => {
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
    (view: OpenEntryResponse) => {
      if (forceReason === null) {
        setProblem({ field: null, text: t.force.required });
        return;
      }
      void perform(
        "force",
        view,
        () =>
          forceReleaseBrandReviewClaim(view.entry.id, {
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
    [forceReason, perform, read],
  );

  /** 17b §2.6: the chain is cancelled, the entry just taken is given back and the list is shown. */
  const cancelChain = useCallback(
    (view: OpenEntryResponse) => {
      stashChainNotice(null);
      setChain(null);
      if (modeOf(view) !== "deciding") {
        router.push(REVIEW_LIST);
        return;
      }
      void perform(
        "release",
        view,
        () => releaseBrandReviewEntry(view.entry.id),
        () => router.push(REVIEW_LIST),
      );
    },
    [perform, router],
  );

  const closeChain = useCallback(() => {
    stashChainNotice(null);
    setChain(null);
  }, []);

  // The keyboard (15 RG114, RG115): ‹v› and ‹r› open a panel, never decide; ‹Échap› closes without loss.
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
          release(readyView);
        } else {
          setPanel(shortcut);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, panel, busy, release]);

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
    forceReason,
    setForceReason,
    chain,
    done,
    publish,
    reject,
    release,
    extend,
    resume,
    retryOpening,
    forceRelease,
    cancelChain,
    closeChain,
  };
}

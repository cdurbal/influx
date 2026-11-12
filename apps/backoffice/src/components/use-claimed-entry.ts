"use client";

// The state and the calls that queues 5 and 6 share on their decision screens (docs/mvp/08 RG77, RG78,
// RG98, RG116; 15 RG27 C1 to C8; 17b §2.4 to §2.6; jalons/l2f/modele.md §5; L2F-19), kept out of the
// components so that they only draw. Opening is claiming: the first reading calls POST …/open. A decision
// is bound to the review token of the version read: a stale token, a lost or lifted claim, a closed entry
// read the dossier again and say why, and what the agent typed stays (RG116). Each screen brings its own
// calls and its own decisions; the rules are the database's and apps/api's.
import type {
  ClaimReleaseReasonCode,
  ExtendEntryResponse,
  ForceReleaseRequest,
  ForceReleaseResponse,
  ReleaseEntryResponse,
} from "@influx/contracts/backoffice-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { messages } from "@/messages/fr";
import {
  claimedModeOf,
  claimedOpenFailure,
  claimedRefusalOf,
  claimedReopenNotice,
  type ClaimedQueue,
  withClaimedExpiry,
  type ClaimedView,
} from "./claimed-entry-view";
import {
  chainNoticeFor,
  clockOffset,
  isShowShortcut,
  reviewShortcutOf,
  stashChainNotice,
  type ChainNotice,
} from "./queue-review-view";
import {
  EMPTY_DRAFT,
  releaseStepOf,
  type Draft,
  type Problem,
} from "./verification-decision-view";
import { formatTime } from "./view-model";

const t = messages.claimedReview;

/** The calls of one queue, which the screen names; the hook never builds an address. */
export type ClaimedApi<View extends ClaimedView> = {
  open: (id: string) => Promise<RelayResult<View>>;
  release: (id: string) => Promise<RelayResult<ReleaseEntryResponse>>;
  extend: (id: string) => Promise<RelayResult<ExtendEntryResponse>>;
  forceRelease: (
    id: string,
    body: ForceReleaseRequest,
  ) => Promise<RelayResult<ForceReleaseResponse>>;
};

export type ReadyClaimedScreen<View extends ClaimedView> = {
  kind: "ready";
  view: View;
  /** Database instant minus the browser's, taken when the entry was read. */
  offsetMs: number;
  /** The sentence that says why the entry was read again, or what an extension did. */
  notice: string | null;
};

export type ClaimedScreen<View extends ClaimedView> =
  | { kind: "loading" }
  | { kind: "failed"; text: string; retry: boolean }
  | ReadyClaimedScreen<View>;

/** The panels every screen has; its own panels (its two decisions) come as the type parameter. */
export type ClaimedPanel<Decision extends string> =
  Decision | "release" | "force" | "help" | null;

/** `positive` and `negative` are the panels ‹v› and ‹r› open: they never decide (RG114, RG115). */
export type ClaimedKeys<Decision extends string> = {
  positive: Decision;
  negative: Decision;
};

export function useClaimedEntry<
  View extends ClaimedView,
  Decision extends string,
>(
  id: string,
  list: string,
  api: ClaimedApi<View>,
  keys: ClaimedKeys<Decision>,
  queue: ClaimedQueue,
  /** ‹i›: the screen shows a visual (queues 2 and 3, L2GU-21); absent on the screens that have none. */
  onShow?: () => void,
) {
  const router = useRouter();
  const showRef = useRef(onShow);
  useEffect(() => {
    showRef.current = onShow;
  });
  const alive = useRef(false);
  const [screen, setScreen] = useState<ClaimedScreen<View>>({
    kind: "loading",
  });
  const [now, setNow] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [panel, setPanel] = useState<ClaimedPanel<Decision>>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [forceReason, setForceReason] = useState<ClaimReleaseReasonCode | null>(
    null,
  );
  const [chain, setChain] = useState<ChainNotice | null>(() =>
    chainNoticeFor(id),
  );
  const [done, setDone] = useState<ChainNotice | null>(null);

  /** Opening is claiming: reads the entry (and takes it when it is free) and shows what that gave. */
  const read = useCallback(
    async (previous: View | null, notice: string | null) => {
      let result: RelayResult<View>;
      try {
        result = await api.open(id);
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
        setNow(nowMs);
        setScreen({
          kind: "ready",
          view: result.data,
          offsetMs: clockOffset(result.data.asOf, nowMs),
          notice,
        });
        return;
      }
      const failure = claimedOpenFailure(result);
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
    [api, id, router],
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

  // The clock of the reminder (15 A9): a tick every ten seconds while the entry is decided here.
  const deciding =
    screen.kind === "ready" && claimedModeOf(screen.view) === "deciding";
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
      kind: string,
      view: View,
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
        const refusal = claimedRefusalOf(result, queue);
        if (refusal.kind === "signedOut") {
          router.replace("/");
        } else if (refusal.kind === "reopen") {
          setPanel(null);
          await read(view, claimedReopenNotice(refusal.why));
        } else {
          setProblem({ field: refusal.field, text: refusal.text });
        }
      } finally {
        if (alive.current) {
          setBusy(null);
        }
      }
    },
    [queue, read, router],
  );

  /** 17b §2.6: the next entry opens by itself; with none left, the screen ends on the empty queue. */
  const finish = useCallback(
    (
      view: View,
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

  const release = useCallback(
    (view: View) =>
      void perform(
        "release",
        view,
        () => api.release(view.entry.id),
        () => router.push(list),
      ),
    [api, list, perform, router],
  );

  /** « Je rends la main » and ‹l›: typed work is never dropped without a confirmation (L2EU-7). */
  const askRelease = useCallback(
    (view: View) => {
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
    (view: View) =>
      void perform(
        "extend",
        view,
        () => api.extend(view.entry.id),
        (data) => {
          setNow(Date.now());
          setScreen((current) =>
            current.kind === "ready"
              ? {
                  ...current,
                  view: withClaimedExpiry(current.view, data.claimExpiresAt),
                  notice: messages.queueReview.banner.extended(
                    formatTime(data.claimExpiresAt),
                  ),
                }
              : current,
          );
        },
      ),
    [api, perform],
  );

  /** The expired claim: the entry is opened again, which takes it again when it is free. */
  const resume = useCallback(
    (view: View) => {
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
    (view: View) => {
      if (forceReason === null) {
        setProblem({ field: null, text: messages.queueReview.force.required });
        return;
      }
      void perform(
        "force",
        view,
        () => api.forceRelease(view.entry.id, { reasonCode: forceReason }),
        async (data) => {
          setPanel(null);
          setForceReason(null);
          const holder = data.holder?.displayName ?? null;
          await read(
            view,
            holder === null
              ? messages.queueReview.notices.liftedNoName
              : messages.queueReview.notices.lifted_by_you(holder),
          );
        },
      );
    },
    [api, forceReason, perform, read],
  );

  /** 17b §2.6: the chain is cancelled, the entry just taken is given back and the list is shown. */
  const cancelChain = useCallback(
    (view: View) => {
      stashChainNotice(null);
      setChain(null);
      if (claimedModeOf(view) !== "deciding") {
        router.push(list);
        return;
      }
      release(view);
    },
    [list, release, router],
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
    const mode = claimedModeOf(readyView);
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const facts = {
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
      };
      if (isShowShortcut(facts)) {
        if (showRef.current !== undefined && mode === "deciding") {
          event.preventDefault();
          showRef.current();
        }
        return;
      }
      const shortcut = reviewShortcutOf(facts);
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
        } else {
          setProblem(null);
          setPanel(shortcut === "publish" ? keys.positive : keys.negative);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready, panel, busy, askRelease, keys.positive, keys.negative]);

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
    perform,
    finish,
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

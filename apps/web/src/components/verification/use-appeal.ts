"use client";

// The one gesture of the contest screen (docs/mvp/08 RG77, CA52; jalons/l2f, commit 17), outside the
// components (CLAUDE.md §5): send the contest of a decision, then read the contests again so that the screen
// shows what the API holds, and tell a refusal by `appealFailureOf` (dispute-view.ts). A second send while
// one runs is ignored. Nothing is decided here (the window, the unicity and what is contestable are the
// database's), the text the creator wrote is never kept, logged or stored (D37, D60).
import { useCallback, useRef, useState } from "react";
import {
  appealBodyOf,
  appealFailureOf,
  type AppealDraft,
  type AppealFailure,
} from "./dispute-view";
import { submitOwnDispute } from "./verification-api";
import type { AppealTarget } from "@/lib/member-paths";

export type AppealGesture = {
  /** A contest is being sent: the button says it and refuses a second one. */
  busy: boolean;
  /** What the last refused send means, null once another starts. */
  failure: AppealFailure | null;
  /** Sends the draft; false when it is not complete (the screen says what is missing) or a send runs. */
  send: (draft: AppealDraft) => Promise<boolean>;
};

export function useAppeal(options: {
  target: AppealTarget;
  /** Reads the lines and the contests again, the screen untouched meanwhile. */
  reload: () => Promise<boolean>;
  onSignedOut: () => void;
}): AppealGesture {
  const { target, reload, onSignedOut } = options;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AppealFailure | null>(null);
  const running = useRef(false);

  const send = useCallback(
    async (draft: AppealDraft): Promise<boolean> => {
      const body = appealBodyOf(target, draft);
      if (body === null || running.current) {
        return false;
      }
      running.current = true;
      setBusy(true);
      setFailure(null);
      try {
        const result = await submitOwnDispute(body);
        if (result.kind === "ok") {
          await reload();
          return true;
        }
        if (result.kind === "unauthenticated") {
          onSignedOut();
          return false;
        }
        const refused = appealFailureOf(result);
        setFailure(refused);
        if (refused.reload) {
          await reload();
        }
        return false;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [target, reload, onSignedOut],
  );

  return { busy, failure, send };
}

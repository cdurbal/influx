"use client";

// One gesture of a screen and its answer (docs/mvp/17b §2.8, §3.14.d; 03 B-5): busy, the refusal in
// words, and R when apps/api asks for it — the confirmation of identity is shown, then the SAME call
// is sent again. No rule here: apps/api decides whether R is needed (403 reauthentication_required).
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { failureOf } from "./view-model";

export type Action = {
  busy: boolean;
  error: string | null;
  /** True while the confirmation of identity is shown. */
  reauth: boolean;
  run: <T>(
    call: () => Promise<RelayResult<T>>,
    onOk: (data: T) => void,
    onFailure?: (
      code: string | undefined,
      issues: readonly string[],
    ) => string | null,
  ) => Promise<void>;
  reauthConfirmed: () => void;
  reauthCancelled: () => void;
  clear: () => void;
};

export function useAction(): Action {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  async function run<T>(
    call: () => Promise<RelayResult<T>>,
    onOk: (data: T) => void,
    onFailure?: (
      code: string | undefined,
      issues: readonly string[],
    ) => string | null,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await call();
      if (result.kind === "ok") {
        onOk(result.data);
        return;
      }
      const failure = failureOf(result);
      if (failure === "signedOut") {
        router.replace("/");
        return;
      }
      if (failure === "reauth") {
        // a function in state is stored through an updater
        setRetry(() => () => void run(call, onOk, onFailure));
        return;
      }
      const own =
        result.kind === "failed" && onFailure !== undefined
          ? onFailure(result.code, result.issues ?? [])
          : null;
      setError(own ?? failure);
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    reauth: retry !== null,
    run,
    reauthConfirmed: () => {
      const again = retry;
      setRetry(null);
      again?.();
    },
    reauthCancelled: () => setRetry(null),
    clear: () => setError(null),
  };
}

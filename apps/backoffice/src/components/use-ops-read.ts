"use client";

// One read of the "Santé technique" screen and its state (docs/mvp/02 §20.5; 21 §J9 commit 9). The
// read is re-run when `refresh` moves (the screen's tick, every minute or on request), the previous
// answer staying on screen meanwhile; a read that CHANGES (another filter) starts from "loading",
// never from the answer to the previous question. No rule here: apps/api decides, an admin reads.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { RelayResult } from "@/browser/relay-client";

export type OpsLoad<T> =
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "forbidden" }
  | { kind: "error" };

type Settled<T> = Exclude<OpsLoad<T>, { kind: "loading" }>;

export function useOpsRead<T>(
  read: () => Promise<RelayResult<T>>,
  refresh: number,
): { load: OpsLoad<T>; retry: () => void } {
  const router = useRouter();
  const [settled, setSettled] = useState<{
    answerTo: () => Promise<RelayResult<T>>;
    result: Settled<T>;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void read().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "unauthenticated") {
        router.replace("/");
        return;
      }
      setSettled({
        answerTo: read,
        result:
          result.kind === "ok"
            ? { kind: "ok", data: result.data }
            : result.code === "forbidden"
              ? { kind: "forbidden" }
              : { kind: "error" },
      });
    });
    return () => {
      active = false;
    };
  }, [read, refresh, attempt, router]);

  return {
    load:
      settled === null || settled.answerTo !== read
        ? { kind: "loading" }
        : settled.result,
    retry: () => {
      setSettled(null);
      setAttempt((count) => count + 1);
    },
  };
}

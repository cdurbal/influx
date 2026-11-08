"use client";

// The pieces of one creator request on the decision screen of queue 4 (docs/mvp/08 RG46, RG83, RG84;
// jalons/l2e/modele.md §4; D82 (5); L2E-22). One piece is read when the agent asks, one at a time: each
// read is a nominative line of the register (the screen never reads ahead), the bytes come as JSON
// (base64) from apps/api and are drawn from a `blob:` URL that is revoked when the piece is closed or
// the screen leaves. Never a download, never an address outside the backoffice. A Storage that does not
// answer is not a failed piece: the decision of an audience waits (`decision_blocked`, `17b` l. 1235).
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { readVerificationEvidence } from "./backoffice-api";
import { bytesOf } from "./use-review-logo";
import { isDecisionBlocked } from "./verification-decision-view";

export type PieceImage =
  | { kind: "loading" }
  | { kind: "ready"; url: string; width: number; height: number }
  | { kind: "failed" };

export function useVerificationEvidence(entryId: string) {
  const router = useRouter();
  const alive = useRef(false);
  const urls = useRef(new Map<string, string>());
  const [pieces, setPieces] = useState<Readonly<Record<string, PieceImage>>>(
    {},
  );
  // the pieces the agent has seen with his own eyes at least once: the decision of an audience asks for one
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    alive.current = true;
    const held = urls.current;
    return () => {
      alive.current = false;
      for (const url of held.values()) {
        URL.revokeObjectURL(url);
      }
      held.clear();
    };
  }, []);

  const forget = useCallback((evidenceId: string) => {
    const url = urls.current.get(evidenceId);
    if (url !== undefined) {
      URL.revokeObjectURL(url);
      urls.current.delete(evidenceId);
    }
  }, []);

  const open = useCallback(
    async (evidenceId: string) => {
      forget(evidenceId);
      setPieces((current) => ({
        ...current,
        [evidenceId]: { kind: "loading" },
      }));
      let image: PieceImage = { kind: "failed" };
      let storageDown = false;
      try {
        const result = await readVerificationEvidence(entryId, evidenceId);
        if (result.kind === "ok") {
          if (!alive.current) {
            return;
          }
          const url = URL.createObjectURL(
            new Blob([bytesOf(result.data.data)], {
              type: result.data.contentType,
            }),
          );
          urls.current.set(evidenceId, url);
          image = {
            kind: "ready",
            url,
            width: result.data.width,
            height: result.data.height,
          };
        } else if (result.kind === "unauthenticated") {
          router.replace("/");
          return;
        } else {
          storageDown = isDecisionBlocked(result);
        }
      } catch {
        // an identifier outside the UUID shape, a base64 that does not decode: unreadable
      }
      if (!alive.current) {
        return;
      }
      setPieces((current) => ({ ...current, [evidenceId]: image }));
      setBlocked(storageDown);
      if (image.kind === "ready") {
        setSeen((current) => new Set(current).add(evidenceId));
      }
    },
    [entryId, forget, router],
  );

  const close = useCallback(
    (evidenceId: string) => {
      forget(evidenceId);
      setPieces((current) => {
        const next = { ...current };
        delete next[evidenceId];
        return next;
      });
    },
    [forget],
  );

  return { pieces, seen: seen.size, blocked, open, close };
}

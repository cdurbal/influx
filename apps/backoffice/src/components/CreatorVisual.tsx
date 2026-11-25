"use client";

// One visual of the portfolio on the decision screens of queue 2 (L2G-15) and queue 3 (L2G-16) (docs/mvp/07
// RG77, RG78; D82 (7); jalons/l2g/modele.md §1 point 10): read ON DEMAND, when the agent asks, never by the
// opening of the screen. The screen names the call (`read`): queue 2 reads one visual of the profile of its
// entry, queue 3 the visual that IS its entry.
// Each read is a nominative line of the register and the route serves the holder of a live claim only, so the
// screen asks once, for the visual the agent chose. The bytes come as JSON (base64) from apps/api and are
// drawn from a `blob:` URL (the CSP of the backoffice allows `img-src 'self' blob:`, nothing else); the URL is
// revoked when the screen leaves. A failure is a sentence and the button stays: the decision never waits for
// an image. On display the image takes the focus (the button that held it is gone, L2GU-10) and the status
// region says « Visuel affiché »; ‹i› (the screen's `showTicket`) shows the `next` visual without a click
// (L2GU-21).
import type { ReviewImageResponse } from "@influx/contracts/creator-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { useEffect, useRef, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { SMALL_SECONDARY_CLASSES } from "./bo-classes";
import { bytesOf } from "./use-review-logo";

const t = messages.creatorReview.visuals;

const IMAGE_CLASSES =
  "max-h-96 max-w-full rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised object-contain";

type VisualState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "failed" };

export function CreatorVisual({
  read,
  position,
  alt,
  showTicket = 0,
  next = false,
  onShown,
}: {
  /** The journaled read of this visual, by the route of the queue (it throws on an id outside the UUID shape). */
  read: () => Promise<RelayResult<ReviewImageResponse>>;
  /** « Visuel 2 »: the place of the visual, written, for the button. */
  position: string;
  /** The alternative text of the image once drawn. */
  alt: string;
  /** Changes at each ‹i› of the screen. */
  showTicket?: number;
  /** This is the visual ‹i› shows: it carries the hint of the key. */
  next?: boolean;
  /** Called once the image is drawn: the screen remembers which visuals were shown. */
  onShown?: () => void;
}) {
  const [state, setState] = useState<VisualState>({ kind: "idle" });
  const alive = useRef(true);
  const url = useRef<string | null>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const latest = useRef({ state, next, show: () => {}, onShown });
  const seenTicket = useRef(showTicket);

  useEffect(() => {
    latest.current = { state, next, show, onShown };
  });

  useEffect(() => {
    if (showTicket === seenTicket.current) {
      return;
    }
    seenTicket.current = showTicket;
    const { state: now, next: wanted, show: open } = latest.current;
    if (wanted && (now.kind === "idle" || now.kind === "failed")) {
      void open();
    }
  }, [showTicket]);

  useEffect(() => {
    if (state.kind === "ready") {
      image.current?.focus();
    }
  }, [state.kind]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (url.current !== null) {
        URL.revokeObjectURL(url.current);
        url.current = null;
      }
    };
  }, []);

  async function show() {
    setState({ kind: "loading" });
    let next: VisualState = { kind: "failed" };
    try {
      const result = await read();
      if (result.kind === "ok") {
        url.current = URL.createObjectURL(
          new Blob([bytesOf(result.data.image.data)], {
            type: result.data.image.contentType,
          }),
        );
        next = { kind: "ready", url: url.current };
      }
    } catch {
      // an identifier outside the UUID shape, a base64 that does not decode: unreadable
    }
    if (alive.current) {
      setState(next);
      if (next.kind === "ready") {
        latest.current.onShown?.();
      }
    } else if (url.current !== null) {
      URL.revokeObjectURL(url.current);
      url.current = null;
    }
  }

  const ready = state.kind === "ready";
  return (
    <div className="flex flex-col items-start gap-1">
      {state.kind === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element -- a blob: URL built from the API's bytes
        <img
          ref={image}
          src={state.url}
          alt={alt}
          tabIndex={-1}
          className={IMAGE_CLASSES}
        />
      ) : (
        <button
          type="button"
          aria-disabled={state.kind === "loading" || undefined}
          aria-keyshortcuts={next ? "i" : undefined}
          onClick={() => {
            if (state.kind !== "loading") {
              void show();
            }
          }}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.show}
          <span className="sr-only"> {position}</span>
          {next ? (
            <span aria-hidden="true" className="ml-2">
              {t.keyHint}
            </span>
          ) : null}
        </button>
      )}
      {/* one live region for the whole life of the visual, so that each change is announced */}
      <p
        role="status"
        className={
          state.kind === "loading" || state.kind === "failed"
            ? HELP_CLASSES
            : "sr-only"
        }
      >
        {state.kind === "loading"
          ? t.loading
          : state.kind === "failed"
            ? t.failed
            : ready
              ? t.shown
              : ""}
      </p>
    </div>
  );
}

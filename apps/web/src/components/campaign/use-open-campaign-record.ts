"use client";

// The state of the creator's record of an open campaign (docs/mvp/11 RG22 to RG24; 17 §5.6; jalons/l3d, commit 05),
// outside the component (CLAUDE.md §5): the answer of `GET /v1/open-campaigns/:id` as it comes, read once at the
// mount (the API journals every reading, RG22: nothing here rereads on its own), and the logo of the brand, read
// once through its own route when the answer says there is one. A campaign that is unknown, not visible, paused,
// closed, greyed or of a suspended brand is the same refusal (T14): the phase "gone", « n'est plus ouverte »
// (RG24), never a technical error. Nothing is decided here.
import type { BrandLogo } from "@influx/contracts/brand-profile";
import type { OpenCampaignRecordResponse } from "@influx/contracts/open-campaigns";
import { useCallback, useEffect, useRef, useState } from "react";
import { feedFailureOf, type FeedFailure } from "./open-campaigns-view";
import {
  readOpenCampaignBrandLogo,
  readOpenCampaignRecord,
} from "./open-campaigns-api";

export type RecordPhase = "loading" | "ready" | "gone" | "failed";

export type OpenCampaignRecordState = {
  phase: RecordPhase;
  record: OpenCampaignRecordResponse | null;
  /** Why a record is not shown when the phase is "failed" (a suspended profile, a read too soon, anything else). */
  failure: FeedFailure | null;
  retryAfterSeconds: number | null;
  /** The logo in force, once read; null while it loads, when there is none, and when it could not be read. */
  logo: BrandLogo | null;
  reload: () => void;
};

export function useOpenCampaignRecord(
  id: string,
  options: {
    /** The session ended: the shell shows "signed out". */
    onSignedOut: () => void;
  },
): OpenCampaignRecordState {
  const [phase, setPhase] = useState<RecordPhase>("loading");
  const [record, setRecord] = useState<OpenCampaignRecordResponse | null>(null);
  const [failure, setFailure] = useState<FeedFailure | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(
    null,
  );
  const [logo, setLogo] = useState<BrandLogo | null>(null);
  const logoAsked = useRef(false);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const load = useCallback(async (): Promise<void> => {
    setPhase("loading");
    const result = await readOpenCampaignRecord(id);
    if (result.kind === "ok") {
      setRecord(result.data);
      setFailure(null);
      setPhase("ready");
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else if (
      result.code === "not_found" ||
      result.code === "validation_failed"
    ) {
      // Unknown, not visible, paused, closed, greyed, a brand suspended, an identifier that is nobody's: RG24, T14.
      setRecord(null);
      setPhase("gone");
    } else {
      setRecord(null);
      setFailure(feedFailureOf(result));
      setRetryAfterSeconds(result.retryAfterSeconds ?? null);
      setPhase("failed");
    }
  }, [id]);

  useEffect(() => {
    // The read starts once, at the mount; its answer is the state of the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const hasLogo = record?.brand.hasLogo === true;
  useEffect(() => {
    if (!hasLogo || logoAsked.current) {
      return;
    }
    logoAsked.current = true;
    void readOpenCampaignBrandLogo(id).then((result) => {
      if (result.kind === "ok") {
        setLogo(result.data.logo);
      } else if (result.kind === "unauthenticated") {
        callbacks.current.onSignedOut();
      } else {
        // The brand's name stands without its image; asked again at the next reading, never in a loop.
        logoAsked.current = false;
      }
    });
  }, [hasLogo, id]);

  return {
    phase,
    record,
    failure,
    retryAfterSeconds,
    logo,
    reload: () => void load(),
  };
}

"use client";

// The flow of "Publier mon profil" and of the switch « visible dans la recherche » (docs/mvp/17 §5.2;
// 07 RG4, RG5, RG8, RG10, RG90; jalons/l2g, commit 13), outside the components (CLAUDE.md §5). The
// button is never disabled: a click asks the API, which answers what is still missing, by name and in
// the order of the form, or submits the profile; the screen shows the list and leads to the first
// field. Nothing is decided here: the list, the status and the switch are the API's answer.
import type { SubmitCreatorProfileResponse } from "@influx/contracts/creator-profile";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveCreatorVisibility,
  submitCreatorProfile,
} from "./creator-profile-api";

/** What the last click on the button left: nothing, the list of what is missing, a submission, a failure. */
export type SubmitActivity =
  | { kind: "idle" }
  | { kind: "submitting" }
  /** The API named what is missing: the live list of the profile is shown, with its links. */
  | { kind: "missing" }
  | { kind: "submitted" }
  | { kind: "failed" };

export type VisibilityActivity =
  | { kind: "idle" }
  /** The value being saved: the switch shows it at once, the API's answer confirms it. */
  | { kind: "saving"; value: boolean }
  | { kind: "failed" };

export type CreatorPublicationState = {
  submit: SubmitActivity;
  visibility: VisibilityActivity;
  publish: () => void;
  setSearchable: (value: boolean) => void;
};

export function useCreatorPublication(options: {
  /** The session ended: the shell shows "signed out". */
  onSignedOut: () => void;
  /** The profile changed under a gesture (its state, the list of what is missing): read it again. */
  onChanged: () => Promise<void>;
  /** The switch is the API's answer: the profile the screen holds takes it. */
  onSearchable: (value: boolean) => void;
  /** The button found something missing: go to the first field (the screen knows the anchors). */
  onMissing: (missing: SubmitCreatorProfileResponse["missing"]) => void;
}): CreatorPublicationState {
  const [submit, setSubmit] = useState<SubmitActivity>({ kind: "idle" });
  const [visibility, setVisibility] = useState<VisibilityActivity>({
    kind: "idle",
  });
  const busy = useRef(false);
  const callbacks = useRef(options);
  useEffect(() => {
    callbacks.current = options;
  }, [options]);

  const publish = useCallback(async (): Promise<void> => {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setSubmit({ kind: "submitting" });
    const result = await submitCreatorProfile();
    if (result.kind === "ok") {
      await callbacks.current.onChanged();
      if (result.data.missing.length > 0) {
        setSubmit({ kind: "missing" });
        callbacks.current.onMissing(result.data.missing);
      } else {
        setSubmit({ kind: "submitted" });
      }
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      // A 409 says the profile is no longer open to a submission (a decision came meanwhile).
      if (result.code === "conflict") {
        await callbacks.current.onChanged();
      }
      setSubmit({ kind: "failed" });
    }
    busy.current = false;
  }, []);

  const setSearchable = useCallback(async (value: boolean): Promise<void> => {
    setVisibility({ kind: "saving", value });
    const result = await saveCreatorVisibility(value);
    if (result.kind === "ok") {
      callbacks.current.onSearchable(result.data.isSearchable);
      setVisibility({ kind: "idle" });
    } else if (result.kind === "unauthenticated") {
      callbacks.current.onSignedOut();
    } else {
      setVisibility({ kind: "failed" });
    }
  }, []);

  return {
    submit,
    visibility,
    publish: () => void publish(),
    setSearchable: (value) => void setSearchable(value),
  };
}

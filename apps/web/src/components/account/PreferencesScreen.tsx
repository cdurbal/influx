"use client";

// "Mes préférences de communication" (docs/mvp/17 §6.2; 05 RG34, RG35, RG92 to RG96): the value in
// force, its date and its origin written in full; ONE action to withdraw, no reason asked,
// effective at once. An unsubscription that came back from Brevo is shown as such, never as an
// error (RG96). What withdrawing does not change is said beside it (RG35, RG94). Reachable while
// a version of the terms waits (J7 A3): consent is withdrawn at any time.
import type { ConsentResponse } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  CARD_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  LABEL_CLASSES,
  SECONDARY_BUTTON_CLASSES,
} from "@/components/auth/auth-classes";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { LIST_CLASSES, SECTION_TITLE_CLASSES } from "./account-classes";
import { readConsent, updateConsent } from "./account-api";
import { consentOriginOf, formatDate } from "./account-view";
import type { AccountContext } from "./AccountShell";
import { ErrorNotice } from "@/components/ui/ErrorNotice";

type State =
  | { kind: "loading" }
  | { kind: "ready"; consent: ConsentResponse }
  | { kind: "unavailable" };

export function PreferencesScreen({ online }: AccountContext) {
  const t = useTranslations("account.preferences");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const ids = { card: useId(), unchanged: useId() };
  const [state, setState] = useState<State>({ kind: "loading" });
  const [done, setDone] = useState<"withdrawn" | "granted" | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void readConsent().then((result) => {
      if (active) {
        setState(
          result.kind === "ok"
            ? { kind: "ready", consent: result.data }
            : { kind: "unavailable" },
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function change(granted: boolean) {
    if (busy || !online) {
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const result = await updateConsent(granted);
      if (result.kind !== "ok") {
        setFailed(true);
        return;
      }
      const { granted: now, occurredAt, source } = result.data;
      setState({
        kind: "ready",
        consent: { granted: now, occurredAt, source },
      });
      setDone(granted ? "granted" : "withdrawn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("title")} />
      {state.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {tAccount("loading")}
        </p>
      ) : null}
      {state.kind === "unavailable" ? (
        <ErrorNotice>{tAccount("unavailable")}</ErrorNotice>
      ) : null}
      {state.kind === "ready" ? (
        <section aria-labelledby={ids.card} className={CARD_CLASSES}>
          <h2 id={ids.card} className={SECTION_TITLE_CLASSES}>
            {t("cardTitle")}
          </h2>
          <p className={LABEL_CLASSES}>
            {t("stateLabel")}{" "}
            {state.consent.granted ? t("granted") : t("withdrawn")}
          </p>
          {state.consent.occurredAt !== null &&
          state.consent.source !== null ? (
            <p className={HELP_CLASSES}>
              {t("since", {
                date: formatDate(state.consent.occurredAt, locale),
                origin: t(`origin.${consentOriginOf(state.consent.source)}`),
              })}
            </p>
          ) : null}
          {done !== null ? (
            <Notice tone="success">{t(`done.${done}`)}</Notice>
          ) : null}
          {failed ? <ErrorNotice>{t("unavailable")}</ErrorNotice> : null}
          <button
            type="button"
            onClick={() => void change(!state.consent.granted)}
            aria-disabled={busy || !online || undefined}
            className={SECONDARY_BUTTON_CLASSES}
          >
            {state.consent.granted
              ? busy
                ? t("withdrawing")
                : t("withdraw")
              : busy
                ? t("granting")
                : t("grant")}
          </button>
          <p className={HELP_CLASSES}>
            {state.consent.granted ? t("withdrawHelp") : t("grantHelp")}
          </p>
        </section>
      ) : null}
      <section aria-labelledby={ids.unchanged} className={INFO_CLASSES}>
        <h2 id={ids.unchanged} className={LABEL_CLASSES}>
          {t("unchanged.title")}
        </h2>
        <ul className={LIST_CLASSES}>
          <li>{t("unchanged.code")}</li>
          <li>{t("unchanged.introductions")}</li>
          <li>{t("unchanged.account")}</li>
        </ul>
      </section>
    </>
  );
}

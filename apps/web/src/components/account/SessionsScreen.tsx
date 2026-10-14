"use client";

// "Mes sessions" (docs/mvp/17 §6.4; 05 RG56, RG143, RG144; CA33): the open sessions with their
// dates and their browser, never a country (EC-43); the current one marked "cet appareil".
// "Fermer toutes les sessions" closes this one too, and says so BEFORE (17 §6.4): a confirmation
// step, then the page ends signed out.
import type { MemberSession } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  CARD_CLASSES,
  ERROR_CLASSES,
  HELP_CLASSES,
  LABEL_CLASSES,
  LEAD_CLASSES,
  TEXT_BUTTON_CLASSES,
  TITLE_CLASSES,
  WARNING_CLASSES,
} from "@/components/auth/auth-classes";
import {
  ACTIONS_CLASSES,
  DESTRUCTIVE_BUTTON_CLASSES,
  META_CLASSES,
  SUCCESS_CLASSES,
  TAG_CLASSES,
} from "./account-classes";
import { readSessions, revokeAllSessions, revokeSession } from "./account-api";
import { browserOf, formatDateTime } from "./account-view";
import type { AccountContext } from "./AccountShell";

type State =
  | { kind: "loading" }
  | { kind: "ready"; sessions: MemberSession[] }
  | { kind: "unavailable" };

export function SessionsScreen({ online, signedOut }: AccountContext) {
  const t = useTranslations("account.sessions");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const warningId = useId();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirmAll, setConfirmAll] = useState(false);
  const [notice, setNotice] = useState<"closed" | "unavailable" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readSessions().then((result) => {
      if (active) {
        setState(
          result.kind === "ok"
            ? { kind: "ready", sessions: result.data.sessions }
            : { kind: "unavailable" },
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  function browserText(session: MemberSession): string {
    const browser = browserOf(session.browser);
    return browser === null
      ? t("unidentified")
      : t("browser", {
          family: t(`family.${browser.family}`),
          system: t(`system.${browser.system}`),
        });
  }

  async function close(session: MemberSession) {
    if (busy !== null || !online || state.kind !== "ready") {
      return;
    }
    setBusy(session.id);
    try {
      const result = await revokeSession(session.id);
      if (result.kind === "unauthenticated") {
        signedOut(t("signedOut"));
        return;
      }
      // Closed now, or already (404: unknown, closed or not ours) — either way it is gone.
      if (result.kind === "ok" || result.code === "not_found") {
        if (result.kind === "ok" && result.data.signedOut) {
          signedOut(t("signedOut"));
          return;
        }
        setState({
          kind: "ready",
          sessions: state.sessions.filter((item) => item.id !== session.id),
        });
        setNotice("closed");
        return;
      }
      setNotice("unavailable");
    } finally {
      setBusy(null);
    }
  }

  async function closeAll() {
    if (busy !== null || !online) {
      return;
    }
    setBusy("all");
    try {
      const result = await revokeAllSessions();
      if (result.kind === "failed") {
        setNotice("unavailable");
        return;
      }
      signedOut(t("allClosed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t("title")}</h1>
      <p className={LEAD_CLASSES}>{t("lead")}</p>
      <p className={HELP_CLASSES}>{t("help")}</p>
      {state.kind === "loading" ? (
        <p role="status" className={HELP_CLASSES}>
          {tAccount("loading")}
        </p>
      ) : null}
      {state.kind === "unavailable" ? (
        <p role="alert" className={ERROR_CLASSES}>
          {tAccount("unavailable")}
        </p>
      ) : null}
      {notice === "closed" ? (
        <p role="status" className={SUCCESS_CLASSES}>
          {t("closed")}
        </p>
      ) : null}
      {notice === "unavailable" ? (
        <p role="alert" className={ERROR_CLASSES}>
          {t("unavailable")}
        </p>
      ) : null}
      {state.kind === "ready" ? (
        <ul aria-label={t("title")} className="flex flex-col gap-4">
          {state.sessions.map((session) => (
            <li key={session.id} className={CARD_CLASSES}>
              <p className={LABEL_CLASSES}>{browserText(session)}</p>
              {session.current ? (
                <span className={TAG_CLASSES}>{t("current")}</span>
              ) : null}
              <p className={META_CLASSES}>
                {t("createdAt", {
                  date: formatDateTime(session.createdAt, locale),
                })}
                <br />
                {t("lastActivityAt", {
                  date: formatDateTime(session.lastActivityAt, locale),
                })}
              </p>
              <button
                type="button"
                onClick={() => void close(session)}
                aria-disabled={busy !== null || !online || undefined}
                className={TEXT_BUTTON_CLASSES}
              >
                {busy === session.id
                  ? t("closing")
                  : session.current
                    ? t("closeCurrent")
                    : t("close")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={CARD_CLASSES}>
        {confirmAll ? (
          <>
            <p id={warningId} role="alert" className={WARNING_CLASSES}>
              {t("closeAllWarning")}
            </p>
            <div className={ACTIONS_CLASSES}>
              <button
                type="button"
                onClick={() => void closeAll()}
                aria-describedby={warningId}
                aria-disabled={busy !== null || !online || undefined}
                className={DESTRUCTIVE_BUTTON_CLASSES}
              >
                {busy === "all" ? t("closing") : t("closeAllConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAll(false)}
                className={TEXT_BUTTON_CLASSES}
              >
                {tAccount("cancel")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={HELP_CLASSES}>{t("closeAllWarning")}</p>
            <button
              type="button"
              onClick={() => setConfirmAll(true)}
              className={DESTRUCTIVE_BUTTON_CLASSES}
            >
              {t("closeAll")}
            </button>
          </>
        )}
      </div>
    </>
  );
}

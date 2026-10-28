"use client";

// "Mes données" (docs/mvp/17 §6.3; 05 RG57; EC-14; J7 decision 6): export and deletion are
// REQUESTS, approved by an INFLUX admin; the screen never says that anything was exported or deleted
// before it was. Once an export is published (J8 commit 8, runbook demandes-rgpd §4), it is
// downloaded here, after a fresh code for each download, 3 times and 7 days at most. The deletion is confirmed in two steps, never one click: the two lists,
// "what disappears" and "what is kept, and why", side by side and of the same weight, then a word
// to type, then a fresh code. Reachable while a version of the terms waits (J7 A3).
import type {
  DataExportStateResponse,
  DataRequest,
  DataRequestType,
} from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";
import {
  CARD_CLASSES,
  ERROR_CLASSES,
  FIELD_CLASSES,
  HELP_CLASSES,
  INFO_CLASSES,
  inputClasses,
  LABEL_CLASSES,
  LEAD_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import { saveTextFile } from "@/browser/save-file";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCUMENT_SLUGS } from "@/lib/legal-documents";
import {
  ACTIONS_CLASSES,
  DESTRUCTIVE_BUTTON_CLASSES,
  INLINE_LINK_CLASSES,
  LIST_CLASSES,
  META_CLASSES,
  SECTION_TITLE_CLASSES,
  SUCCESS_CLASSES,
  TWO_LISTS_CLASSES,
} from "./account-classes";
import {
  downloadDataExport,
  readDataExport,
  readDataRequests,
  submitDataRequest,
} from "./account-api";
import {
  formatDate,
  isConfirmationWordTyped,
  openRequestOf,
} from "./account-view";
import type { AccountContext } from "./AccountShell";
import { FreshCode } from "./FreshCode";

type Phase =
  | { kind: "overview" }
  | { kind: "confirmDeletion" }
  | { kind: "freshCode"; type: DataRequestType }
  | { kind: "downloadCode"; exportId: string };

type Notice =
  | { kind: "received"; request: DataRequest }
  | { kind: "alreadyOpen" }
  | { kind: "unavailable" }
  | { kind: "saved"; name: string }
  | { kind: "exportGone" }
  | { kind: "downloadFailed" }
  | null;

type DataExport = DataExportStateResponse["export"];

const PURPOSES = {
  access: "data_export",
  erasure: "account_deletion",
} as const;

export function DataScreen({ me, online, signedOut }: AccountContext) {
  const t = useTranslations("account.data");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const ids = { export: useId(), delete: useId(), download: useId() };
  const [requests, setRequests] = useState<DataRequest[] | null>(null);
  const [dataExport, setDataExport] = useState<DataExport>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "overview" });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void readDataRequests().then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setRequests(result.data.requests);
      } else {
        setUnreadable(true);
      }
    });
    void readDataExport().then((result) => {
      if (active && result.kind === "ok") {
        setDataExport(result.data.export);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  /** One download, its fresh code just verified (or still fresh): the file saved as received. */
  async function download(exportId: string) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await downloadDataExport(exportId);
      if (
        result.kind === "failed" &&
        result.code === "reauthentication_required"
      ) {
        setPhase({ kind: "downloadCode", exportId });
        return;
      }
      setPhase({ kind: "overview" });
      if (result.kind === "ok") {
        const file = result.data.export;
        saveTextFile(file.fileName, file.content);
        setNotice({ kind: "saved", name: file.fileName });
        setDataExport((current) =>
          current === null
            ? null
            : {
                ...current,
                downloadsLeft: file.downloadsLeft,
                available: file.downloadsLeft > 0,
              },
        );
        return;
      }
      if (
        result.kind === "failed" &&
        (result.code === "export_unavailable" || result.code === "not_found")
      ) {
        setNotice({ kind: "exportGone" });
        setDataExport((current) =>
          current === null ? null : { ...current, available: false },
        );
        return;
      }
      setNotice({ kind: "downloadFailed" });
    } finally {
      setBusy(false);
    }
  }

  async function submit(type: DataRequestType) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const result = await submitDataRequest(type);
      if (
        result.kind === "failed" &&
        result.code === "reauthentication_required"
      ) {
        setPhase({ kind: "freshCode", type }); // the proof expired: a new code
        return;
      }
      setPhase({ kind: "overview" });
      if (result.kind !== "ok") {
        setNotice({ kind: "unavailable" });
        return;
      }
      if (result.data.outcome === "erasure_authorised") {
        // D72: every session is closed and the cookie cleared; the account is erased by the worker
        signedOut(t("done.erasureAuthorised"));
        return;
      }
      const { request, outcome } = result.data;
      setRequests([
        request,
        ...(requests ?? []).filter((item) => item.id !== request.id),
      ]);
      setNotice(
        outcome === "received"
          ? { kind: "received", request }
          : { kind: "alreadyOpen" },
      );
    } finally {
      setBusy(false);
    }
  }

  if (phase.kind === "freshCode") {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{t("title")}</h1>
        <FreshCode
          purpose={PURPOSES[phase.type]}
          email={me.email}
          online={online}
          onVerified={() => void submit(phase.type)}
          onCancel={() => setPhase({ kind: "overview" })}
        />
      </>
    );
  }

  if (phase.kind === "downloadCode") {
    return (
      <>
        <h1 className={TITLE_CLASSES}>{t("title")}</h1>
        <FreshCode
          purpose="data_export"
          email={me.email}
          online={online}
          onVerified={() => void download(phase.exportId)}
          onCancel={() => setPhase({ kind: "overview" })}
        />
      </>
    );
  }

  if (phase.kind === "confirmDeletion") {
    return (
      <ConfirmDeletion
        online={online}
        onConfirmed={() => setPhase({ kind: "freshCode", type: "erasure" })}
        onCancel={() => setPhase({ kind: "overview" })}
      />
    );
  }

  const openAccess = openRequestOf(requests ?? [], "access");
  const openErasure = openRequestOf(requests ?? [], "erasure");

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t("title")}</h1>
      <p className={LEAD_CLASSES}>{t("lead")}</p>
      {notice?.kind === "received" ? (
        <p role="status" className={SUCCESS_CLASSES}>
          {t(`done.${notice.request.type}`, {
            date: formatDate(notice.request.dueAt, locale),
          })}
        </p>
      ) : null}
      {notice?.kind === "alreadyOpen" ? (
        <p role="status" className={INFO_CLASSES}>
          {t("done.alreadyOpen")}
        </p>
      ) : null}
      {notice?.kind === "unavailable" ? (
        <p role="alert" className={ERROR_CLASSES}>
          {t("unavailable")}
        </p>
      ) : null}
      {notice?.kind === "saved" ? (
        <p role="status" className={SUCCESS_CLASSES}>
          {t("download.saved", { name: notice.name })}
        </p>
      ) : null}
      {notice?.kind === "exportGone" ? (
        <p role="alert" className={INFO_CLASSES}>
          {t("download.gone")}
        </p>
      ) : null}
      {notice?.kind === "downloadFailed" ? (
        <p role="alert" className={ERROR_CLASSES}>
          {t("download.failed")}
        </p>
      ) : null}
      {unreadable ? (
        <p role="alert" className={ERROR_CLASSES}>
          {tAccount("unavailable")}
        </p>
      ) : null}
      {dataExport !== null && dataExport.available ? (
        <section aria-labelledby={ids.download} className={CARD_CLASSES}>
          <h2 id={ids.download} className={SECTION_TITLE_CLASSES}>
            {t("download.title")}
          </h2>
          <p className={HELP_CLASSES}>
            {t("download.text", {
              date: formatDate(dataExport.expiresAt, locale),
              count: dataExport.downloadsLeft,
            })}
          </p>
          <p className={HELP_CLASSES}>{t("download.how")}</p>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setPhase({ kind: "downloadCode", exportId: dataExport.id });
            }}
            aria-disabled={!online || busy || undefined}
            className={SECONDARY_BUTTON_CLASSES}
          >
            {t("download.action")}
          </button>
        </section>
      ) : null}
      {requests !== null && requests.length > 0 ? (
        <RequestList requests={requests} />
      ) : null}
      <section aria-labelledby={ids.export} className={CARD_CLASSES}>
        <h2 id={ids.export} className={SECTION_TITLE_CLASSES}>
          {t("export.title")}
        </h2>
        <p className={HELP_CLASSES}>{t("export.text")}</p>
        <p className={HELP_CLASSES}>{t("export.how")}</p>
        {openAccess !== null ? (
          <p className={INFO_CLASSES}>{t("export.open")}</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setPhase({ kind: "freshCode", type: "access" });
            }}
            aria-disabled={!online || undefined}
            className={SECONDARY_BUTTON_CLASSES}
          >
            {t("export.action")}
          </button>
        )}
      </section>
      <section aria-labelledby={ids.delete} className={CARD_CLASSES}>
        <h2 id={ids.delete} className={SECTION_TITLE_CLASSES}>
          {t("delete.title")}
        </h2>
        <p className={HELP_CLASSES}>{t("delete.text")}</p>
        {openErasure !== null ? (
          <p className={INFO_CLASSES}>{t("delete.open")}</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setPhase({ kind: "confirmDeletion" });
            }}
            aria-disabled={!online || undefined}
            className={DESTRUCTIVE_BUTTON_CLASSES}
          >
            {t("delete.action")}
          </button>
        )}
      </section>
    </>
  );
}

function RequestList({ requests }: { requests: readonly DataRequest[] }) {
  const t = useTranslations("account.data.requests");
  const locale = useLocale();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={CARD_CLASSES}>
      <h2 id={titleId} className={SECTION_TITLE_CLASSES}>
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-4">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-col gap-1">
            <p className={LABEL_CLASSES}>
              {t("line", {
                type: t(`type.${request.type}`),
                status: t(`status.${request.status}`),
              })}
            </p>
            <p className={META_CLASSES}>
              {t("receivedAt", {
                date: formatDate(request.receivedAt, locale),
              })}
            </p>
            <p className={META_CLASSES}>
              {request.completedAt !== null
                ? t("completedAt", {
                    date: formatDate(request.completedAt, locale),
                  })
                : t("dueAt", { date: formatDate(request.dueAt, locale) })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 17 §6.3: the two lists, of the same weight, then a word to type. */
function ConfirmDeletion({
  online,
  onConfirmed,
  onCancel,
}: {
  online: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("account.data.confirm");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const ids = {
    gone: useId(),
    kept: useId(),
    word: useId(),
    wordError: useId(),
    next: useId(),
  };
  const [typed, setTyped] = useState("");
  const [wordError, setWordError] = useState(false);
  const word = t("word");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      return;
    }
    if (!isConfirmationWordTyped(typed, word)) {
      setWordError(true);
      return;
    }
    onConfirmed();
  }

  const privacyHref = `/${LEGAL_DOCUMENT_SLUGS.privacy_policy[locale]}`;

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t("title")}</h1>
      <div className={TWO_LISTS_CLASSES}>
        <section aria-labelledby={ids.gone} className={CARD_CLASSES}>
          <h2 id={ids.gone} className={SECTION_TITLE_CLASSES}>
            {t("goneTitle")}
          </h2>
          <ul className={LIST_CLASSES}>
            <li>{t("gone.details")}</li>
            <li>{t("gone.crm")}</li>
            <li>{t("gone.access")}</li>
          </ul>
        </section>
        <section aria-labelledby={ids.kept} className={CARD_CLASSES}>
          <h2 id={ids.kept} className={SECTION_TITLE_CLASSES}>
            {t("keptTitle")}
          </h2>
          <ul className={LIST_CLASSES}>
            <li>{t("kept.emails")}</li>
            <li>{t("kept.journal")}</li>
            <li>{t("kept.terms")}</li>
          </ul>
          <p className={HELP_CLASSES}>
            {t("durations")}{" "}
            <Link href={privacyHref} className={INLINE_LINK_CLASSES}>
              {t("durationsLink")}
            </Link>
          </p>
        </section>
      </div>
      <p className={HELP_CLASSES}>{t("newAccount")}</p>
      <p className={INFO_CLASSES}>{t("manual")}</p>
      <form noValidate onSubmit={submit} className={CARD_CLASSES}>
        <div className={FIELD_CLASSES}>
          <label htmlFor={ids.word} className={LABEL_CLASSES}>
            {t("wordLabel", { word })}
          </label>
          <input
            id={ids.word}
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            aria-invalid={wordError ? true : undefined}
            aria-describedby={wordError ? ids.wordError : undefined}
            onChange={(event) => {
              setTyped(event.target.value);
              setWordError(false);
            }}
            className={inputClasses(wordError)}
          />
        </div>
        {wordError ? (
          <p id={ids.wordError} role="alert" className={ERROR_CLASSES}>
            {t("wordError", { word })}
          </p>
        ) : null}
        <div className={ACTIONS_CLASSES}>
          <button
            type="button"
            onClick={onCancel}
            className={SECONDARY_BUTTON_CLASSES}
          >
            {tAccount("cancel")}
          </button>
          <button
            type="submit"
            aria-describedby={ids.next}
            aria-disabled={!online || undefined}
            className={DESTRUCTIVE_BUTTON_CLASSES}
          >
            {t("submit")}
          </button>
        </div>
        <p id={ids.next} className={HELP_CLASSES}>
          {t("next")}
        </p>
      </form>
    </>
  );
}

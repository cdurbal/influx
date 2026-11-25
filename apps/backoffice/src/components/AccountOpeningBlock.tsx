"use client";

// The block « Lancer la vérification » of the record of a member account (docs/mvp/06 RG51; 15 RG36;
// 17b §3.6; jalons/l2f, commit 20; D83 A): an agent who knows a member opens the verification himself, by
// line of network for a creator or for the brand. The same request, the same queue 4, the same decisions
// as a member's: the form names the reason of the closed list, an internal comment, and, for a brand that
// holds no internal block, its three fields; it says what the member will receive before anything leaves.
// « Audience vérifiée » is never offered (the rows of the database hold the two other levels only). Nothing
// is decided here and no badge is granted: the request waits for a constat. The comment is never echoed.
// A separate file so that AccountScreen.tsx only calls it (it is not to grow, L2C fiche § risks).
import {
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  type AccountOpeningsResponse,
} from "@influx/contracts/verification";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import {
  asksInternalDetails,
  COUNTRY_OPTIONS,
  EMPTY_OPENING_DRAFT,
  isBlockedBrand,
  openedNotice,
  OPENING_REASONS,
  openingOutcome,
  openingRefusal,
  queueAddressOf,
  reasonWords,
  recapLines,
  requestWords,
  sortedTargets,
  targetName,
  type OpeningDraft,
  type OpeningField,
  type OpeningTarget,
} from "./account-opening-view";
import { ActionFeedback } from "./ActionFeedback";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import {
  openVerificationForMember,
  readAccountOpenings,
} from "./backoffice-api";
import {
  FIELD_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TEXTAREA_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import { useAction } from "./use-action";

const t = messages.accountOpening;

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: AccountOpeningsResponse }
  | { kind: "error" };

type Done = { text: string; href: string };

function TextField({
  id,
  label,
  value,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  invalid: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={id} className={SMALL_LABEL_CLASSES}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={inputClasses(invalid)}
      />
    </div>
  );
}

function OpeningForm({
  accountId,
  target,
  onCancel,
  onOpened,
}: {
  accountId: string;
  target: OpeningTarget;
  onCancel: () => void;
  onOpened: (done: Done) => void;
}) {
  const ids = {
    reason: useId(),
    comment: useId(),
    legalName: useId(),
    country: useId(),
    number: useId(),
  };
  const fieldIds: Record<OpeningField, string> = {
    reason: ids.reason,
    comment: ids.comment,
    legalName: ids.legalName,
    country: ids.country,
    number: ids.number,
  };
  const reasonField = useRef<HTMLSelectElement>(null);
  const action = useAction();
  const [draft, setDraft] = useState<OpeningDraft>(EMPTY_OPENING_DRAFT);
  const [problem, setProblem] = useState<{
    field: OpeningField;
    text: string;
  } | null>(null);
  const details = asksInternalDetails(target);

  // the keyboard lands on the first field when the form opens
  useEffect(() => {
    reasonField.current?.focus();
  }, []);

  function set(patch: Partial<OpeningDraft>) {
    setDraft({ ...draft, ...patch });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.busy) {
      return;
    }
    const outcome = openingOutcome(target, draft);
    if (!outcome.ok) {
      setProblem({ field: outcome.field, text: outcome.error });
      document.getElementById(fieldIds[outcome.field])?.focus();
      return;
    }
    setProblem(null);
    void action.run(
      () => openVerificationForMember(accountId, outcome.body),
      (data) =>
        onOpened({
          text: openedNotice(target, data.created),
          href: queueAddressOf(target, data.requestId),
        }),
      openingRefusal,
    );
  }

  const mine = (field: OpeningField) =>
    problem?.field === field ? problem : null;

  return (
    <form
      noValidate
      onSubmit={submit}
      aria-labelledby="opening-form-title"
      className={SECTION_CLASSES}
    >
      <h3
        id="opening-form-title"
        className="font-display text-sm font-bold text-text-primary"
      >
        {t.formTitle(targetName(target))}
      </h3>
      <p className={HELP_CLASSES}>{t.formLead}</p>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.reason} className={SMALL_LABEL_CLASSES}>
          {t.reason}
        </label>
        <select
          ref={reasonField}
          id={ids.reason}
          value={draft.reasonCode}
          aria-invalid={mine("reason") !== null || undefined}
          onChange={(event) => set({ reasonCode: event.target.value })}
          className={`${SELECT_CLASSES} self-start`}
        >
          <option value="">{t.reasonPlaceholder}</option>
          {OPENING_REASONS.map((code) => (
            <option key={code} value={code}>
              {reasonWords(code)}
            </option>
          ))}
        </select>
        {mine("reason") === null ? null : (
          <ErrorNotice>{mine("reason")?.text}</ErrorNotice>
        )}
      </div>
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.comment} className={SMALL_LABEL_CLASSES}>
          {draft.reasonCode === "other" ? t.commentRequired : t.comment}
        </label>
        <textarea
          id={ids.comment}
          rows={2}
          value={draft.comment}
          maxLength={VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH + 200}
          aria-invalid={mine("comment") !== null || undefined}
          onChange={(event) => set({ comment: event.target.value })}
          className={TEXTAREA_CLASSES}
        />
        <p className={HELP_CLASSES}>{t.commentHelp}</p>
        {mine("comment") === null ? null : (
          <ErrorNotice>{mine("comment")?.text}</ErrorNotice>
        )}
      </div>
      {target.brand === null ? null : details ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-text-primary">
            {t.detailsTitle}
          </legend>
          <p className={HELP_CLASSES}>{t.detailsLead}</p>
          <TextField
            id={ids.legalName}
            label={t.legalName}
            value={draft.legalName}
            invalid={mine("legalName") !== null}
            onChange={(legalName) => set({ legalName })}
          />
          {mine("legalName") === null ? null : (
            <ErrorNotice>{mine("legalName")?.text}</ErrorNotice>
          )}
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.country} className={SMALL_LABEL_CLASSES}>
              {t.registrationCountry}
            </label>
            <select
              id={ids.country}
              value={draft.registrationCountryCode}
              aria-invalid={mine("country") !== null || undefined}
              onChange={(event) =>
                set({ registrationCountryCode: event.target.value })
              }
              className={`${SELECT_CLASSES} self-start`}
            >
              <option value="">{t.countryPlaceholder}</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          {mine("country") === null ? null : (
            <ErrorNotice>{mine("country")?.text}</ErrorNotice>
          )}
          <TextField
            id={ids.number}
            label={t.registrationNumber}
            value={draft.registrationNumber}
            invalid={mine("number") !== null}
            onChange={(registrationNumber) => set({ registrationNumber })}
          />
          {mine("number") === null ? null : (
            <ErrorNotice>{mine("number")?.text}</ErrorNotice>
          )}
        </fieldset>
      ) : (
        <p className={HELP_CLASSES}>{t.detailsPresent}</p>
      )}
      <p className="text-sm font-semibold text-text-primary">{t.recapTitle}</p>
      <ul className="list-disc pl-6 text-sm text-text-primary">
        {recapLines(target).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ActionFeedback action={action} />
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          aria-disabled={action.busy || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {action.busy ? t.busy : t.submit}
        </button>
      </div>
    </form>
  );
}

export function AccountOpeningBlock({
  accountId,
  role,
}: {
  accountId: string;
  role: "creator" | "advertiser";
}) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    let active = true;
    void readAccountOpenings(accountId).then((result) => {
      if (!active) {
        return;
      }
      if (result.kind === "ok") {
        setLoad({ kind: "ok", data: result.data });
      } else if (result.kind === "unauthenticated") {
        router.replace("/");
      } else {
        setLoad({ kind: "error" });
      }
    });
    return () => {
      active = false;
    };
  }, [accountId, reload, router]);

  const body = (() => {
    if (load.kind === "loading") {
      return (
        <p role="status" className={HELP_CLASSES}>
          {t.loading}
        </p>
      );
    }
    if (load.kind === "error") {
      return <ErrorNotice>{t.error}</ErrorNotice>;
    }
    const rows = sortedTargets(load.data.openings);
    if (rows.length === 0) {
      return (
        <p className={HELP_CLASSES}>
          {role === "creator" ? t.emptyCreator : t.emptyBrand}
        </p>
      );
    }
    const key = (row: OpeningTarget) => row.socialAccountId ?? row.level;
    const picked = rows.find((row) => key(row) === selected) ?? null;
    return (
      <>
        <DenseTableRegion label={t.tableLabel}>
          <table className={TABLE_CLASSES}>
            <caption className="sr-only">{t.tableLabel}</caption>
            <thead>
              <tr>
                {(["target", "request", "action"] as const).map((column) => (
                  <th key={column} scope="col" className={TH_CLASSES}>
                    {t.columns[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={key(row)} data-opening-row={row.level}>
                  <td className={TD_CLASSES}>
                    <span className="block font-semibold">
                      {targetName(row)}
                    </span>
                    {isBlockedBrand(row) ? (
                      <span className="block">{t.noDomain}</span>
                    ) : null}
                  </td>
                  <td className={TD_CLASSES}>
                    <span className="block">{requestWords(row)}</span>
                    {row.request === null ? null : (
                      <Link
                        href={`${queueAddressOf(row, row.request.id)}`}
                        className={LINK_CLASSES}
                      >
                        {t.openRequest}
                      </Link>
                    )}
                  </td>
                  <td className={TD_CLASSES}>
                    {isBlockedBrand(row) ? (
                      messages.common.none
                    ) : (
                      <button
                        type="button"
                        aria-label={t.launchOf(targetName(row))}
                        aria-expanded={selected === key(row)}
                        onClick={() => {
                          setDone(null);
                          setSelected(key(row));
                        }}
                        className={SMALL_SECONDARY_CLASSES}
                      >
                        {t.launch}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DenseTableRegion>
        {picked === null ? null : (
          <OpeningForm
            key={key(picked)}
            accountId={accountId}
            target={picked}
            onCancel={() => setSelected(null)}
            onOpened={(next) => {
              setSelected(null);
              setDone(next);
              setReload((count) => count + 1);
            }}
          />
        )}
      </>
    );
  })();

  return (
    <section aria-labelledby="opening-title" className={SECTION_CLASSES}>
      <h2 id="opening-title" className={SECTION_TITLE}>
        {t.title}
      </h2>
      <p className={HELP_CLASSES}>{t.lead}</p>
      {done === null ? null : (
        <p role="status" className={SUCCESS_CLASSES}>
          {done.text}{" "}
          <Link href={done.href} className={LINK_CLASSES}>
            {t.openRequest}
          </Link>
        </p>
      )}
      {body}
    </section>
  );
}

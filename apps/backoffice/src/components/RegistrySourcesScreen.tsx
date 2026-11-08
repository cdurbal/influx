"use client";

// The registry sources of a brand's registration (docs/mvp/06 RG52, RG101; D79 (12); 17b §3.11; jalons/l2e/
// registres.md; L2E-23): the free public registers the agents open by hand, one active source per country and
// GLEIF in fallback. Read by an agent and by an administrator (an agent reads the register he consults);
// written by an administrator only (RG101): an agent has no button to write, and the server refuses him
// anyway. The sources that wait for a hand check ("à confirmer") are apart, on top: an administrator activates
// one after checking by hand that its search is free. Nothing here fetches a page. No rule here: the database
// holds one active source per country and writes the former and the new value in the register.
import type { VerificationRegistrySourceAdminRow } from "@influx/contracts/verification";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, LEAD_CLASSES, TITLE_CLASSES } from "./auth-classes";
import { readRegistrySources } from "./backoffice-api";
import {
  DD_CLASSES,
  LINK_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import { RegistrySourceEditor } from "./RegistrySourceEditor";
import {
  canEditSources,
  partitionSources,
  sourceCountryWords,
  sourceLinkOf,
  type SourceRow,
} from "./registry-sources-view";
import { useMe } from "./Shell";
import { formatDay, formatDateTime } from "./view-model";

const t = messages.registrySources;

function SourcesTable({
  id,
  title,
  note,
  empty,
  rows,
  canEdit,
  onEdit,
}: {
  id: string;
  title: string;
  note?: string;
  empty?: string;
  rows: readonly SourceRow[];
  canEdit: boolean;
  onEdit: (row: SourceRow) => void;
}) {
  const columns = [
    t.columns.country,
    t.columns.name,
    t.columns.type,
    t.columns.checked,
    t.columns.updated,
    t.columns.state,
    ...(canEdit ? [t.columns.action] : []),
  ];
  return (
    <section aria-labelledby={id} className={SECTION_CLASSES}>
      <h2 id={id} className={SECTION_TITLE}>
        {title}
      </h2>
      {note === undefined ? null : <p className={HELP_CLASSES}>{note}</p>}
      {rows.length === 0 ? (
        <p className={DD_CLASSES}>{empty}</p>
      ) : (
        <DenseTableRegion label={t.tableLabel(title)}>
          <table className={TABLE_CLASSES}>
            <thead>
              <tr>
                {columns.map((header) => (
                  <th key={header} scope="col" className={TH_CLASSES}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const link = sourceLinkOf(row);
                return (
                  <tr key={row.id} data-source={row.id}>
                    <td className={TD_CLASSES}>{sourceCountryWords(row)}</td>
                    <td className={TD_CLASSES}>
                      <span className="font-semibold">{row.name}</span>
                      {link === null ? (
                        <span className={`${HELP_CLASSES} block`}>
                          {t.noLink}
                        </span>
                      ) : (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className={`${LINK_CLASSES} block`}
                        >
                          {t.open(row.name)}
                        </a>
                      )}
                    </td>
                    <td className={TD_CLASSES}>{t.types[row.sourceType]}</td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {formatDay(row.checkedOn)}
                    </td>
                    <td className={`${TD_CLASSES} tabular-nums`}>
                      {formatDateTime(row.updatedAt)}
                    </td>
                    <td className={TD_CLASSES}>
                      {row.isActive ? t.state.active : t.state.inactive}
                    </td>
                    {canEdit ? (
                      <td className={TD_CLASSES}>
                        <button
                          type="button"
                          id={`edit-source-${row.id}`}
                          onClick={() => onEdit(row)}
                          className={SMALL_SECONDARY_CLASSES}
                        >
                          {t.edit(row.name)}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DenseTableRegion>
      )}
    </section>
  );
}

export function RegistrySourcesScreen() {
  const me = useMe();
  const router = useRouter();
  const alive = useRef(false);
  const canEdit = canEditSources(me.role);
  const [rows, setRows] = useState<SourceRow[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await readRegistrySources();
    if (!alive.current) {
      return;
    }
    if (result.kind === "ok") {
      setRows(result.data.sources);
      setError(false);
    } else if (result.kind === "unauthenticated") {
      router.replace("/");
    } else {
      setError(true);
    }
  }, [router]);

  useEffect(() => {
    alive.current = true;
    // the first reading: the state it sets arrives with the answer, after the effect
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  function onSaved(source: VerificationRegistrySourceAdminRow) {
    setRows((current) =>
      current === null
        ? current
        : current.map((row) => (row.id === source.id ? source : row)),
    );
    setEditing(null);
    setSaved(t.saved(source.name));
    // the focus goes back to the button that opened the editor
    window.setTimeout(
      () => document.getElementById(`edit-source-${source.id}`)?.focus(),
      0,
    );
  }

  const editedRow =
    editing === null ? null : (rows?.find((row) => row.id === editing) ?? null);
  const parts = rows === null ? null : partitionSources(rows);

  return (
    <>
      <h1 className={TITLE_CLASSES}>{t.title}</h1>
      <p className={LEAD_CLASSES}>{t.lead}</p>
      <p className={HELP_CLASSES}>{canEdit ? t.leadAdmin : t.leadAgent}</p>
      <p className={HELP_CLASSES}>{t.addLimit}</p>
      {saved === null ? null : (
        <p role="status" className={SUCCESS_CLASSES}>
          {saved}
        </p>
      )}
      {error ? (
        <>
          <ErrorNotice>{t.error}</ErrorNotice>
          <button
            type="button"
            onClick={() => void load()}
            className={`${SMALL_PRIMARY_CLASSES} self-start`}
          >
            {t.retry}
          </button>
        </>
      ) : parts === null ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.loading}
        </p>
      ) : (
        <>
          {canEdit && editedRow !== null ? (
            <RegistrySourceEditor
              key={editedRow.id}
              row={editedRow}
              onSaved={onSaved}
              onCancel={() => setEditing(null)}
            />
          ) : null}
          <SourcesTable
            id="registry-sources-inactive"
            title={t.inactiveTitle}
            note={t.inactiveNote}
            empty={t.inactiveNone}
            rows={parts.inactive}
            canEdit={canEdit}
            onEdit={(row) => {
              setSaved(null);
              setEditing(row.id);
            }}
          />
          <SourcesTable
            id="registry-sources-active"
            title={t.activeTitle}
            rows={parts.active}
            canEdit={canEdit}
            onEdit={(row) => {
              setSaved(null);
              setEditing(row.id);
            }}
          />
        </>
      )}
    </>
  );
}

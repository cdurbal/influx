"use client";

import React, { useEffect, useState } from "react";
import { authFetch } from "@/lib/api-client";

interface LeadEvent {
  id: string;
  eventType: string;
  payload: {
    accountId?: string;
    email: string;
    role: string;
    language?: string;
    countryCode?: string;
    marketingConsent?: boolean;
  };
  status: "pending" | "synced" | "failed";
  attempts: number;
  lastError?: string | null;
  createdAt: string;
}

interface LeadsResponse {
  leads: LeadEvent[];
  total: number;
  synced: number;
  failed: number;
  pending: number;
}

export default function LeadsSupervisionPage() {
  const [data, setData] = useState<LeadsResponse>({
    leads: [],
    total: 0,
    synced: 0,
    failed: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/backoffice/leads");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err: unknown) {
      console.error("Erreur chargement leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleReplay = async (id: string) => {
    try {
      setReplayingId(id);
      setNotification(null);

      const res = await authFetch(`/api/backoffice/leads/${id}/replay`, {
        method: "POST",
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setNotification({
          type: "success",
          message: `Lead ${id.slice(0, 8)} rejoué et synchronisé avec succès.`,
        });
        await fetchLeads();
      } else {
        setNotification({
          type: "error",
          message: result.message || "Échec du rejeu du lead.",
        });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erreur réseau lors du rejeu.";
      setNotification({
        type: "error",
        message: msg,
      });
    } finally {
      setReplayingId(null);
    }
  };

  const getStatusBadge = (status: "pending" | "synced" | "failed") => {
    switch (status) {
      case "synced":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
            ● Synchronisé
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border">
            ▲ Échec
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
            ○ En attente
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface-page text-text-primary p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Entête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                Supervision Technique
              </span>
              <span className="text-xs text-text-tertiary">▮ Journalisé</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary mt-1">
              Supervision des Leads &amp; Outbox
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Synchronisation événementielle Brevo (segmentation) & Apollo
              (enrichissement B2B annonceurs)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-surface-card hover:bg-surface-hover text-text-primary border border-border-default rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Actualisation..." : "Rafraîchir"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            role="status"
            className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
              notification.type === "success"
                ? "bg-brand-subtle-bg border-brand-subtle-border text-brand-primary"
                : "bg-feedback-error-bg border-feedback-error-border text-feedback-error-text"
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-xs underline opacity-80 hover:opacity-100 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Cartes métriques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Total Inscrits
            </p>
            <p className="text-3xl font-extrabold text-text-primary mt-2">
              {data.total}
            </p>
          </div>
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-brand-primary uppercase tracking-wider">
              Synchronisés (Brevo/Apollo)
            </p>
            <p className="text-3xl font-extrabold text-brand-primary mt-2">
              {data.synced}
            </p>
          </div>
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-feedback-error-text uppercase tracking-wider">
              En Échec
            </p>
            <p className="text-3xl font-extrabold text-feedback-error-text mt-2">
              {data.failed}
            </p>
          </div>
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-feedback-warning-text uppercase tracking-wider">
              En Attente
            </p>
            <p className="text-3xl font-extrabold text-feedback-warning-text mt-2">
              {data.pending}
            </p>
          </div>
        </div>

        {/* Tableau des leads */}
        <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              File d&apos;attente des événements récents
            </h2>
            <span className="text-xs text-text-tertiary">
              {data.leads.length} événement(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-surface-muted text-xs font-semibold text-text-tertiary uppercase tracking-wider border-b border-border-default">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Utilisateur / E-mail
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Rôle
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Langue / Pays
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Statut Sync
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Tentatives
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-text-tertiary text-sm"
                    >
                      Aucun lead dans la file d&apos;attente.
                    </td>
                  </tr>
                ) : (
                  data.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-surface-hover transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-text-primary">
                          {lead.payload.email}
                        </div>
                        <div className="text-xs text-text-tertiary mt-0.5">
                          ID: {lead.id.slice(0, 13)}... · Créé le{" "}
                          {new Date(lead.createdAt).toLocaleTimeString(
                            "fr-FR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </div>
                        {lead.lastError && (
                          <div className="text-xs text-feedback-error-text mt-1 font-mono bg-feedback-error-bg p-1.5 rounded border border-feedback-error-border">
                            {lead.lastError}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            lead.payload.role === "advertiser"
                              ? "bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border"
                              : "bg-surface-muted text-text-secondary border border-border-default"
                          }`}
                        >
                          {lead.payload.role === "advertiser"
                            ? "Marque"
                            : "Créateur"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="uppercase font-semibold text-text-primary">
                          {lead.payload.language || "fr"}
                        </span>{" "}
                        / {lead.payload.countryCode || "FR"}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-text-tertiary">
                        {lead.attempts}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {lead.status === "failed" ? (
                          <button
                            onClick={() => handleReplay(lead.id)}
                            disabled={replayingId === lead.id}
                            className="px-3 py-1.5 text-xs font-semibold bg-feedback-error-text hover:bg-feedback-error-text/90 text-surface-page rounded-md transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                          >
                            {replayingId === lead.id ? "Rejeu..." : "Relancer"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReplay(lead.id)}
                            disabled={replayingId === lead.id}
                            className="px-3 py-1.5 text-xs font-medium bg-surface-muted hover:bg-surface-hover text-text-primary border border-border-default rounded-md transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {replayingId === lead.id ? "Rejeu..." : "Rejouer"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

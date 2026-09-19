"use client";

import React, { useEffect, useState } from "react";

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
      const res = await fetch("/api/backoffice/leads", {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
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

      const res = await fetch(`/api/backoffice/leads/${id}/replay`, {
        method: "POST",
        credentials: "include",
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
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Erreur réseau lors du rejeu.",
      });
    } finally {
      setReplayingId(null);
    }
  };

  const getStatusBadge = (status: "pending" | "synced" | "failed") => {
    switch (status) {
      case "synced":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ● Synchronisé
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            ▲ Échec
          </span>
        );
      case "pending":
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            ○ En attente
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
        {/* Entête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Supervision des Leads & Outbox
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Synchronisation événementielle Brevo (segmentation) & Apollo
              (enrichissement B2B annonceurs)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Actualisation..." : "Rafraîchir"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
              notification.type === "success"
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                : "bg-rose-950/40 border-rose-800 text-rose-200"
            }`}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Cartes métriques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Inscrits
            </p>
            <p className="text-3xl font-extrabold text-white mt-2">
              {data.total}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Synchronisés (Brevo/Apollo)
            </p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">
              {data.synced}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              En Échec
            </p>
            <p className="text-3xl font-extrabold text-rose-400 mt-2">
              {data.failed}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              En Attente
            </p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {data.pending}
            </p>
          </div>
        </div>

        {/* Tableau des leads */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-700/60 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              File d&apos;attente des événements récents
            </h2>
            <span className="text-xs text-slate-400">
              {data.leads.length} événement(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-850 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
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
              <tbody className="divide-y divide-slate-700/40">
                {data.leads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500 text-sm"
                    >
                      Aucun lead dans la file d&apos;attente.
                    </td>
                  </tr>
                ) : (
                  data.leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-750/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">
                          {lead.payload.email}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
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
                          <div className="text-xs text-rose-400 mt-1 font-mono bg-rose-950/30 p-1 rounded border border-rose-800/30">
                            {lead.lastError}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            lead.payload.role === "advertiser"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {lead.payload.role === "advertiser"
                            ? "Marque"
                            : "Créateur"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <span className="uppercase font-semibold text-slate-300">
                          {lead.payload.language || "fr"}
                        </span>{" "}
                        / {lead.payload.countryCode || "FR"}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(lead.status)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {lead.attempts}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {lead.status === "failed" ? (
                          <button
                            onClick={() => handleReplay(lead.id)}
                            disabled={replayingId === lead.id}
                            className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                          >
                            {replayingId === lead.id ? "Rejeu..." : "Relancer"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReplay(lead.id)}
                            disabled={replayingId === lead.id}
                            className="px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
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

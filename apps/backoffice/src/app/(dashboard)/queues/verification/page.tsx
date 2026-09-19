"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  type VerificationRequest,
  type VerificationStatus,
  type VerificationLevel,
} from "@influx/contracts";
import { VerificationDecisionDrawer } from "@/components/verification/VerificationDecisionDrawer";

export default function VerificationQueuePage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");

  const [selectedRequest, setSelectedRequest] =
    useState<VerificationRequest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Agent actuel (simulé pour l'affichage de verrou)
  const currentAgentId = "88888888-8888-4888-8888-888888888888";

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/backoffice/queues/verification", {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setRequests(json.queue || []);
      }
    } catch (err) {
      console.error("Erreur chargement file de vérification:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // Filtrage local dynamique
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (levelFilter !== "all" && r.requestedLevel !== levelFilter)
        return false;
      if (networkFilter !== "all" && r.network !== networkFilter) return false;
      return true;
    });
  }, [requests, statusFilter, levelFilter, networkFilter]);

  // Métriques
  const totalPending = requests.filter((r) => r.status === "pending").length;
  const totalInReview = requests.filter((r) => r.status === "in_review").length;
  const totalApproved = requests.filter((r) => r.status === "approved").length;

  const now = new Date().getTime();
  const totalOverdue = requests.filter((r) => {
    if (r.status !== "pending" && r.status !== "in_review") return false;
    return new Date(r.slaDueAt).getTime() < now;
  }).length;

  const handleOpenDrawer = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedRequest(null);
  };

  const handleActionSuccess = async () => {
    await fetchQueue();
  };

  const getStatusBadge = (
    status: VerificationStatus,
    claimedBy?: string | null,
  ) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✓ Approuvée
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            ✕ Refusée
          </span>
        );
      case "in_review":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            🔒 En cours {claimedBy ? `(${claimedBy.slice(0, 6)}...)` : ""}
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
              File d&apos;attribution des badges & vérifications
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Validation des preuves de propriété de compte (Niveau 1) et
              d&apos;audience (Niveau 2) · SLA 1 jour ouvré
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchQueue}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? "Actualisation..." : "Rafraîchir"}
            </button>
          </div>
        </div>

        {/* Cartes métriques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              En Attente (Sans Preneur)
            </p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {totalPending}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              En Cours (Verrou 30 min)
            </p>
            <p className="text-3xl font-extrabold text-blue-400 mt-2">
              {totalInReview}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
              Hors Délai SLA (&gt; 1j ouvré)
            </p>
            <p className="text-3xl font-extrabold text-rose-400 mt-2">
              {totalOverdue}
            </p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Badges Délivrés (Session)
            </p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">
              {totalApproved}
            </p>
          </div>
        </div>

        {/* Filtres de la file */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-400 font-semibold flex items-center gap-2">
              <span>Statut :</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="in_review">En cours</option>
                <option value="approved">Approuvées</option>
                <option value="rejected">Refusées</option>
              </select>
            </label>

            <label className="text-xs text-slate-400 font-semibold flex items-center gap-2">
              <span>Niveau :</span>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tous les niveaux</option>
                <option value="account_ownership">Niveau 1 (Propriété)</option>
                <option value="audience">Niveau 2 (Audience)</option>
              </select>
            </label>

            <label className="text-xs text-slate-400 font-semibold flex items-center gap-2">
              <span>Réseau :</span>
              <select
                value={networkFilter}
                onChange={(e) => setNetworkFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tous les réseaux</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
          </div>

          <span className="text-xs text-slate-400">
            {filteredRequests.length} demande(s) affichée(s)
          </span>
        </div>

        {/* Tableau des demandes */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-850 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Soumission / Ancienneté
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Réseau
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Niveau Demandé
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Créateur (ID)
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Statut / Verrou
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Échéance SLA
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      {loading
                        ? "Chargement de la file..."
                        : "Aucune demande de vérification correspondant aux critères."}
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((r) => {
                    const isOverdue =
                      (r.status === "pending" || r.status === "in_review") &&
                      new Date(r.slaDueAt).getTime() < now;

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-750/50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          <span className="font-semibold text-white block">
                            {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="text-slate-400">
                            {new Date(r.createdAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="capitalize font-medium text-slate-200">
                            {r.network}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
                              r.requestedLevel === "account_ownership"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {r.requestedLevel === "account_ownership"
                              ? "Niveau 1 : Propriété"
                              : "Niveau 2 : Audience"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-400">
                          {r.accountId.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(r.status, r.claimedByAgentId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          <span
                            className={
                              isOverdue
                                ? "text-rose-400 font-semibold"
                                : "text-slate-300"
                            }
                          >
                            {new Date(r.slaDueAt).toLocaleString("fr-FR")}
                          </span>
                          {isOverdue && (
                            <span className="ml-1 text-xs text-rose-500">
                              ⚑
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          <button
                            onClick={() => handleOpenDrawer(r)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                          >
                            Examiner ▮
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tiroir de décision */}
        <VerificationDecisionDrawer
          request={selectedRequest}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onSuccess={handleActionSuccess}
          currentAgentId={currentAgentId}
        />
      </div>
    </div>
  );
}

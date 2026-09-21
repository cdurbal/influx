"use client";

import React, { useEffect, useState, useCallback } from "react";
import { type Introduction } from "@influx/contracts";
import { IntroductionDecisionDrawer } from "@/components/introductions/IntroductionDecisionDrawer";

export default function IntroductionsQueuePage() {
  const [items, setItems] = useState<Introduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tiroir de décision
  const [selectedIntro, setSelectedIntro] = useState<Introduction | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Identité agent en session
  const currentAgentId = "88888888-8888-4888-8888-888888888888";
  const currentAgentName = "Alexandre Martin";

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetch("/api/backoffice/queues/introductions", {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(
          `Erreur serveur (${res.status}) lors du chargement de la file.`,
        );
      }

      const json = await res.json();
      setItems(json.items || []);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Filtrage côté client
  const filteredItems = items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (originFilter !== "all" && item.origin !== originFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = item.reference.toLowerCase().includes(q);
      const matchReason = item.originReason.toLowerCase().includes(q);
      const matchAdv = item.advertiserAccountId.toLowerCase().includes(q);
      const matchCreator = item.creatorAccountId.toLowerCase().includes(q);
      if (!matchRef && !matchReason && !matchAdv && !matchCreator) return false;
    }
    return true;
  });

  // Métriques
  const totalPending = items.filter(
    (i) => i.status === "pending_review",
  ).length;
  const totalInReview = items.filter((i) => i.status === "in_review").length;
  const nowTime = Date.now();
  const totalBreachedSla = items.filter(
    (i) =>
      ["pending_review", "in_review"].includes(i.status) &&
      new Date(i.slaDueAt).getTime() < nowTime,
  ).length;

  const handleOpenDecision = (intro: Introduction) => {
    setSelectedIntro(intro);
    setIsDrawerOpen(true);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* En-tête de page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
              File 8 · Intermédiation
            </span>
            <span className="text-xs text-text-muted">
              SLA standard : 1 jour ouvré
            </span>
          </div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">
            File de validation commerciale des mises en relation
          </h1>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Examen des demandes de contact et candidatures. Chaque demande
            validée est attribuée à un commercial titulaire pour la conduite des
            négociations dans la conversation à trois.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border border-border-default bg-surface-card hover:bg-surface-muted text-text-primary transition-colors disabled:opacity-50"
        >
          {loading ? "Actualisation..." : "Actualiser la file"}
        </button>
      </div>

      {/* Cartes de métriques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border-default bg-surface-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
              En attente (Pending)
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {totalPending}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            ⏳
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border-default bg-surface-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
              En cours d'examen (Verrouillés)
            </div>
            <div className="text-2xl font-black text-blue-600 mt-1">
              {totalInReview}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            🔒
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border-default bg-surface-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Alerte dépassement SLA
            </div>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {totalBreachedSla}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-lg">
            ⚠️
          </div>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="p-4 rounded-xl border border-border-default bg-surface-card flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Rechercher par référence, mot-clé ou identifiant..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[240px] p-2 rounded-lg border border-border-default bg-surface-page text-xs text-text-primary focus:ring-1 focus:ring-brand-primary"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 rounded-lg border border-border-default bg-surface-page text-xs text-text-primary"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending_review">En attente (pending_review)</option>
          <option value="in_review">En cours (in_review)</option>
        </select>

        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="p-2 rounded-lg border border-border-default bg-surface-page text-xs text-text-primary"
        >
          <option value="all">Toutes les origines</option>
          <option value="brand_contact_request">Demande Marque (1)</option>
          <option value="creator_application">Candidature Créateur (2)</option>
          <option value="influx_proposal">Proposition INFLUX (3)</option>
        </select>
      </div>

      {/* Message d'erreur */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Tableau des demandes */}
      <div className="border border-border-default rounded-xl bg-surface-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-border-default text-text-muted font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Référence</th>
                <th className="py-3 px-4">Origine</th>
                <th className="py-3 px-4">Parties prenantes</th>
                <th className="py-3 px-4">Échéance SLA</th>
                <th className="py-3 px-4">Verrou & Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    Chargement de la file de validation...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted">
                    Aucune demande de mise en relation dans cette file.
                  </td>
                </tr>
              ) : (
                filteredItems.map((intro) => {
                  const isSlaBreached =
                    ["pending_review", "in_review"].includes(intro.status) &&
                    new Date(intro.slaDueAt).getTime() < nowTime;

                  return (
                    <tr
                      key={intro.id}
                      className="hover:bg-surface-muted/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-text-primary">
                        {intro.reference}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] ${
                            intro.origin === "brand_contact_request"
                              ? "bg-purple-100 text-purple-800"
                              : intro.origin === "creator_application"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {intro.origin === "brand_contact_request" &&
                            "Marque (Demande)"}
                          {intro.origin === "creator_application" &&
                            "Créateur (Postulation)"}
                          {intro.origin === "influx_proposal" &&
                            "Proposition INFLUX"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="text-text-primary">
                            <span className="text-text-muted">
                              Marque ({intro.advertiserCountryAtIntro}) :
                            </span>{" "}
                            <span className="font-mono">
                              {intro.advertiserAccountId.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="text-text-primary">
                            <span className="text-text-muted">
                              Créateur ({intro.creatorCountryAtIntro}) :
                            </span>{" "}
                            <span className="font-mono">
                              {intro.creatorAccountId.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div
                          className={
                            isSlaBreached
                              ? "text-rose-600 font-bold"
                              : "text-text-muted"
                          }
                        >
                          {new Date(intro.slaDueAt).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {isSlaBreached && (
                            <span className="block text-[10px] text-rose-600 uppercase font-extrabold">
                              Dépassement SLA
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {intro.claimedByAgentId ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-blue-700 font-medium">
                              {intro.claimedByAgentId === currentAgentId
                                ? "Verrouillé par vous"
                                : `Verrouillé (${intro.claimedByAgentId.slice(0, 8)})`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted">Libre</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDecision(intro)}
                          className="px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-brand-primary hover:text-white text-text-primary font-bold transition-colors border border-border-default"
                        >
                          Examiner & Décider
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

      {/* Tiroir latéral de décision */}
      <IntroductionDecisionDrawer
        introduction={selectedIntro}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedIntro(null);
        }}
        onSuccess={() => {
          fetchQueue();
        }}
        currentAgentId={currentAgentId}
        currentAgentName={currentAgentName}
      />
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { type Introduction } from "@influx/contracts";
import { IntroductionDecisionDrawer } from "@/components/introductions/IntroductionDecisionDrawer";
import { authFetch } from "@/lib/api-client";

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

      const res = await authFetch("/api/backoffice/queues/introductions");

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
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* En-tête de page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-brand-subtle-bg text-text-brand border border-brand-subtle-border">
              File 8 · Intermédiation
            </span>
            <span className="text-xs text-text-tertiary">
              SLA standard : 1 jour ouvré
            </span>
          </div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            File de validation commerciale des mises en relation
          </h1>
          <p className="text-xs text-text-tertiary mt-1 max-w-2xl">
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
            <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              En attente (Pending)
            </div>
            <div className="text-2xl font-black text-feedback-warning-text mt-1">
              {totalPending}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-feedback-warning-bg text-feedback-warning-text flex items-center justify-center font-bold text-lg">
            ⏳
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border-default bg-surface-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              En cours d&apos;examen (Verrouillés)
            </div>
            <div className="text-2xl font-black text-feedback-info-text mt-1">
              {totalInReview}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-feedback-info-bg text-feedback-info-text flex items-center justify-center font-bold text-lg">
            🔒
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border-default bg-surface-card flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
              Alerte dépassement SLA
            </div>
            <div className="text-2xl font-black text-feedback-error-text mt-1">
              {totalBreachedSla}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-feedback-error-bg text-feedback-error-text flex items-center justify-center font-bold text-lg">
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
        <div className="p-3 bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Tableau des demandes */}
      <div className="border border-border-default rounded-xl bg-surface-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted border-b border-border-default text-text-tertiary font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Référence</th>
                <th className="py-3 px-4">Origine</th>
                <th className="py-3 px-4">Parties prenantes</th>
                <th className="py-3 px-4">Échéance SLA</th>
                <th className="py-3 px-4">Verrou &amp; Statut</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-text-tertiary"
                  >
                    Chargement de la file de validation...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-text-tertiary"
                  >
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
                      className="hover:bg-surface-hover transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-text-primary">
                        {intro.reference}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] border ${
                            intro.origin === "brand_contact_request"
                              ? "bg-bo-identified-bg text-bo-identified-accent border-brand-subtle-border"
                              : intro.origin === "creator_application"
                                ? "bg-feedback-info-bg text-feedback-info-text border-feedback-info-border"
                                : "bg-brand-subtle-bg text-text-brand border-brand-subtle-border"
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
                            <span className="text-text-tertiary">
                              Marque ({intro.advertiserCountryAtIntro}) :
                            </span>{" "}
                            <span className="font-mono">
                              {intro.advertiserAccountId.slice(0, 8)}...
                            </span>
                          </div>
                          <div className="text-text-primary">
                            <span className="text-text-tertiary">
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
                              ? "text-feedback-error-text font-bold"
                              : "text-text-tertiary"
                          }
                        >
                          {new Date(intro.slaDueAt).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {isSlaBreached && (
                            <span className="block text-[10px] text-feedback-error-text uppercase font-extrabold">
                              Dépassement SLA
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {intro.claimedByAgentId ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-feedback-info-icon" />
                            <span className="text-feedback-info-text font-medium">
                              {intro.claimedByAgentId === currentAgentId
                                ? "Verrouillé par vous"
                                : `Verrouillé (${intro.claimedByAgentId.slice(0, 8)})`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-tertiary">Libre</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDecision(intro)}
                          className="px-3 py-1.5 rounded-lg bg-surface-muted hover:bg-action-primary-bg hover:text-text-on-action text-text-primary font-bold transition-colors border border-border-default"
                        >
                          Examiner &amp; Décider
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

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  type VerificationQueueItem,
  type VerificationStatus,
  type VerificationQueueMetrics,
  type VerificationQueueResponse,
} from "@influx/contracts";
import { VerificationDecisionDrawer } from "@/components/verification/VerificationDecisionDrawer";
import { bo } from "@/locales/bo-labels";

export default function VerificationQueuePage() {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [metrics, setMetrics] = useState<VerificationQueueMetrics>({
    totalPending: 0,
    totalInReview: 0,
    totalBreached: 0,
    oldestPendingHours: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20); // Plafond RG34 / 17b §3.3

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtres côté serveur (B-E9)
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [populationTab, setPopulationTab] = useState<"creators" | "brands">(
    "creators",
  );

  const [selectedRequest, setSelectedRequest] =
    useState<VerificationQueueItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Agent actuel (simulé en développement)
  const currentAgentId = "88888888-8888-4888-8888-888888888888";
  const currentAgentName = "Alexandre Martin";

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (statusFilter !== "all") params.append("status", statusFilter);
      if (levelFilter !== "all") params.append("requestedLevel", levelFilter);
      if (networkFilter !== "all") params.append("network", networkFilter);

      const res = await fetch(
        `/api/backoffice/queues/verification?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!res.ok) {
        throw new Error(
          `Erreur serveur (${res.status}) lors du chargement de la file.`,
        );
      }

      const json: VerificationQueueResponse = await res.json();
      setItems(json.items || json.queue || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      if (json.metrics) {
        setMetrics(json.metrics);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : bo.verificationQueue.empty.error;
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, levelFilter, networkFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Réinitialiser la pagination lors d'un changement de filtre
  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleLevelChange = (val: string) => {
    setLevelFilter(val);
    setPage(1);
  };

  const handleNetworkChange = (val: string) => {
    setNetworkFilter(val);
    setPage(1);
  };

  const handleOpenDrawer = (item: VerificationQueueItem) => {
    setSelectedRequest(item);
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
    claimedByName?: string | null,
  ) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
            ✓ Approuvée
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border">
            ✕ Refusée
          </span>
        );
      case "in_review":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border">
            🔒 En cours {claimedByName ? `(${claimedByName})` : ""}
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

  const l = bo.verificationQueue;

  return (
    <div className="min-h-screen bg-surface-page text-text-primary p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Entête de page */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                File 4 · Catalogage Plat
              </span>
              <span className="text-xs text-text-tertiary">▮ Journalisé</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary mt-1">
              {l.title}
            </h1>
            <p className="text-sm text-text-secondary mt-1">{l.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchQueue}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium bg-surface-card hover:bg-surface-hover text-text-primary border border-border-default rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? l.refreshing : l.refresh}
            </button>
          </div>
        </div>

        {/* Deux onglets : Créateurs · Marques (17b §2.7 file 4, 08 RG61) */}
        <div className="flex border-b border-border-default">
          <button
            type="button"
            onClick={() => setPopulationTab("creators")}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              populationTab === "creators"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            {l.tabCreators}
          </button>
          <button
            type="button"
            onClick={() => setPopulationTab("brands")}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
              populationTab === "brands"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-tertiary hover:text-text-primary"
            }`}
          >
            {l.tabBrands}
          </button>
        </div>

        {/* Cartes métriques globales issues du serveur */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-feedback-warning-text uppercase tracking-wider">
              {l.metrics.pending}
            </p>
            <p className="text-3xl font-extrabold text-feedback-warning-text mt-2">
              {metrics.totalPending}
            </p>
          </div>
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-feedback-info-text uppercase tracking-wider">
              {l.metrics.inReview}
            </p>
            <p className="text-3xl font-extrabold text-feedback-info-text mt-2">
              {metrics.totalInReview}
            </p>
          </div>
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-feedback-error-text uppercase tracking-wider">
              {l.metrics.slaBreached}
            </p>
            <p className="text-3xl font-extrabold text-feedback-error-text mt-2">
              {metrics.totalBreached}
            </p>
          </div>
          <div className="bg-surface-card border border-border-default rounded-xl p-5">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              {l.metrics.oldestPending}
            </p>
            <p className="text-3xl font-extrabold text-text-primary mt-2">
              {metrics.oldestPendingHours > 0
                ? `${metrics.oldestPendingHours} h`
                : metrics.totalPending > 0
                  ? "< 1 h"
                  : l.metrics.oldestNone}
            </p>
          </div>
        </div>

        {/* Filtres de la file (côté serveur, B-E9) */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-card p-4 rounded-xl border border-border-default">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs text-text-secondary font-semibold flex items-center gap-2">
              <span>{l.filters.status}</span>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-3 py-1.5 bg-surface-page border border-border-default rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="all">{l.filters.allStatuses}</option>
                <option value="pending">{l.filters.pending}</option>
                <option value="in_review">{l.filters.inReview}</option>
                <option value="approved">{l.filters.approved}</option>
                <option value="rejected">{l.filters.rejected}</option>
              </select>
            </label>

            <label className="text-xs text-text-secondary font-semibold flex items-center gap-2">
              <span>{l.filters.level}</span>
              <select
                value={levelFilter}
                onChange={(e) => handleLevelChange(e.target.value)}
                className="px-3 py-1.5 bg-surface-page border border-border-default rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="all">{l.filters.allLevels}</option>
                <option value="account_ownership">{l.filters.ownership}</option>
                <option value="audience">{l.filters.audience}</option>
              </select>
            </label>

            <label className="text-xs text-text-secondary font-semibold flex items-center gap-2">
              <span>{l.filters.network}</span>
              <select
                value={networkFilter}
                onChange={(e) => handleNetworkChange(e.target.value)}
                className="px-3 py-1.5 bg-surface-page border border-border-default rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand-primary"
              >
                <option value="all">{l.filters.allNetworks}</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
          </div>

          <span className="text-xs text-text-tertiary">
            {total} {l.filters.displayedCount}
          </span>
        </div>

        {/* Message d'erreur serveur éventuel */}
        {errorMessage && (
          <div
            role="alert"
            className="p-4 bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text rounded-xl text-sm flex items-center justify-between"
          >
            <span>{errorMessage}</span>
            <button
              onClick={fetchQueue}
              className="px-3 py-1 bg-surface-card hover:bg-surface-hover text-text-primary border border-border-default rounded text-xs"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Tableau des demandes */}
        <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-surface-muted text-xs font-semibold text-text-tertiary uppercase tracking-wider border-b border-border-default">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    {l.table.colSubmission}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {l.table.colNetwork}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {l.table.colLevel}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {l.table.colCreator}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {l.table.colStatus}
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    {l.table.colSla}
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    {l.table.colActions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-text-tertiary"
                    >
                      {loading
                        ? l.empty.loading
                        : statusFilter !== "all" ||
                            levelFilter !== "all" ||
                            networkFilter !== "all"
                          ? l.empty.emptyFiltered
                          : l.empty.emptyQueue}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-surface-hover transition-colors ${
                          item.slaBreached
                            ? "border-l-4 border-feedback-error-text"
                            : ""
                        }`}
                      >
                        {/* Soumission / Ancienneté */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          <span className="font-semibold text-text-primary block">
                            {new Date(item.createdAt).toLocaleDateString(
                              "fr-FR",
                            )}
                          </span>
                          <span className="text-text-tertiary">
                            {new Date(item.createdAt).toLocaleTimeString(
                              "fr-FR",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                        </td>

                        {/* Réseau */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="capitalize font-medium text-text-primary">
                            {item.network}
                          </span>
                        </td>

                        {/* Niveau */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
                              item.requestedLevel === "account_ownership"
                                ? "bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border"
                                : "bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border"
                            }`}
                          >
                            {item.requestedLevel === "account_ownership"
                              ? "Niveau 1 : Propriété"
                              : "Niveau 2 : Audience"}
                          </span>
                        </td>

                        {/* Créateur (Alias + ID) */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          <span className="font-medium text-text-primary block">
                            {item.creatorAlias || "Créateur"}
                          </span>
                          <span className="font-mono text-text-tertiary text-xs">
                            {item.accountId.slice(0, 8)}...
                          </span>
                        </td>

                        {/* Statut / Verrou */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(item.status, item.claimedByAgentName)}
                        </td>

                        {/* Échéance SLA avec libellé explicite (B-E7) */}
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          {item.slaBreached ? (
                            <div className="flex flex-col">
                              <span className="text-feedback-error-text font-bold flex items-center gap-1">
                                <span>⚑</span>
                                <span>
                                  {l.sla.overdue.replace(
                                    "{hours}",
                                    String(item.slaOverdueHours),
                                  )}
                                </span>
                              </span>
                              <span className="text-text-tertiary text-xs">
                                Échéance :{" "}
                                {new Date(item.slaDueAt).toLocaleString(
                                  "fr-FR",
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-text-primary font-medium">
                                ○ {l.sla.onTime}
                              </span>
                              <span className="text-text-tertiary text-xs">
                                {new Date(item.slaDueAt).toLocaleString(
                                  "fr-FR",
                                )}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          <button
                            onClick={() => handleOpenDrawer(item)}
                            className="px-3.5 py-1.5 bg-surface-muted hover:bg-surface-hover text-text-primary hover:text-brand-primary border border-border-default rounded-lg font-medium transition-colors cursor-pointer"
                          >
                            {l.table.actionInspect}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination côté serveur (B-E9) */}
          <div className="p-4 border-t border-border-default flex items-center justify-between bg-surface-muted text-xs text-text-secondary">
            <span>
              {l.pagination.pageInfo
                .replace("{page}", String(page))
                .replace("{totalPages}", String(totalPages || 1))
                .replace("{total}", String(total))}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover text-text-primary border border-border-default rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {l.pagination.prev}
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover text-text-primary border border-border-default rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {l.pagination.next}
              </button>
            </div>
          </div>
        </div>

        {/* Tiroir de décision */}
        <VerificationDecisionDrawer
          request={selectedRequest}
          isOpen={isDrawerOpen}
          onClose={handleCloseDrawer}
          onSuccess={handleActionSuccess}
          currentAgentId={currentAgentId}
          currentAgentName={currentAgentName}
        />
      </div>
    </div>
  );
}

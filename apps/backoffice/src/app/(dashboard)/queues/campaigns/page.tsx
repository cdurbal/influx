"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  type CampaignBackofficeView,
  type CampaignQueueMetrics,
  type CampaignQueueResponse,
  type CampaignStatus,
} from "@influx/contracts";
import { CampaignDecisionDrawer } from "@/components/campaign/CampaignDecisionDrawer";
import { bo } from "@/locales/bo-labels";

export default function CampaignQueuePage() {
  const [items, setItems] = useState<CampaignBackofficeView[]>([]);
  const [metrics, setMetrics] = useState<CampaignQueueMetrics>({
    totalPending: 0,
    totalSensitive: 0,
    totalInReview: 0,
    oldestPendingHours: 0,
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sensitiveOnly, setSensitiveOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drawer
  const [selectedCampaign, setSelectedCampaign] =
    useState<CampaignBackofficeView | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Identité agent en session locale
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
      if (sensitiveOnly) params.append("sensitiveOnly", "true");
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(
        `/api/backoffice/campaigns?${params.toString()}`,
        {
          credentials: "include",
        },
      );

      if (!res.ok) {
        throw new Error(
          `Erreur serveur (${res.status}) lors du chargement des campagnes.`,
        );
      }

      const json: CampaignQueueResponse = await res.json();
      setItems(json.items || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
      if (json.metrics) {
        setMetrics(json.metrics);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : bo.campaignQueue.empty.error;
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, sensitiveOnly, searchQuery]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleSensitiveToggle = () => {
    setSensitiveOnly(!sensitiveOnly);
    setPage(1);
  };

  const handleOpenDrawer = (campaign: CampaignBackofficeView) => {
    setSelectedCampaign(campaign);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedCampaign(null);
  };

  const handleActionSuccess = async () => {
    await fetchQueue();
  };

  // Badge d'état visuel
  const getStatusBadge = (
    status: CampaignStatus,
    lockedByAgentId?: string | null,
  ) => {
    switch (status) {
      case "publiee":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
            ✓ Publiée
          </span>
        );
      case "refusee":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border">
            ✕ Refusée
          </span>
        );
      case "en_pause":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-text-secondary border border-border-default">
            ⏸ En pause
          </span>
        );
      case "cloturee":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-muted text-text-tertiary border border-border-default">
            Clôturée
          </span>
        );
      case "a_valider":
      default:
        if (lockedByAgentId) {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border">
              🔒 En cours d&apos;examen
            </span>
          );
        }
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
            ○ À valider
          </span>
        );
    }
  };

  // Calcul du délai SLA
  const renderSlaIndicator = (campaign: CampaignBackofficeView) => {
    const dateStr = campaign.submittedAt || campaign.createdAt;
    const submittedDate = new Date(dateStr);
    const ageHours = Math.round(
      (Date.now() - submittedDate.getTime()) / (1000 * 60 * 60),
    );

    // SLA : 24h standard, 48h si revue renforcée (RG85)
    const targetHours = campaign.isSensitive ? 48 : 24;
    const isBreached = ageHours > targetHours;

    if (campaign.status !== "a_valider") {
      return (
        <span className="text-xs text-text-tertiary">
          Traité ({ageHours}h après créat.)
        </span>
      );
    }

    if (isBreached) {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-xs text-feedback-error-text bg-feedback-error-bg px-2 py-0.5 rounded border border-feedback-error-border">
          <span>⚑</span>
          <span>HORS DÉLAI (+{ageHours - targetHours}h)</span>
        </span>
      );
    }

    if (ageHours > targetHours / 2) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-feedback-warning-text font-medium bg-feedback-warning-bg px-2 py-0.5 rounded border border-feedback-warning-border">
          <span>⏳</span>
          <span>
            {ageHours}h ({targetHours - ageHours}h restantes)
          </span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-xs text-brand-primary font-medium bg-brand-subtle-bg px-2 py-0.5 rounded border border-brand-subtle-border">
        <span>✓</span>
        <span>Dans les délais ({ageHours}h)</span>
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-brand-primary px-2 py-0.5 rounded bg-brand-subtle-bg border border-brand-subtle-border">
              FILE 7
            </span>
            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">
              {bo.campaignQueue.title}
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            {bo.campaignQueue.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchQueue()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-card border border-border-default text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50 self-start md:self-auto"
        >
          <span>↻</span>
          <span>
            {loading ? bo.campaignQueue.refreshing : bo.campaignQueue.refresh}
          </span>
        </button>
      </div>

      {/* Cartes métriques SLA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-surface-card border border-border-default space-y-1">
          <span className="text-xs text-text-tertiary block font-medium">
            {bo.campaignQueue.metrics.pending}
          </span>
          <span className="text-2xl font-extrabold text-text-primary">
            {metrics.totalPending}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-card border border-border-default space-y-1">
          <span className="text-xs text-text-tertiary block font-medium">
            {bo.campaignQueue.metrics.sensitive}
          </span>
          <span className="text-2xl font-extrabold text-feedback-warning-text flex items-center gap-2">
            <span>⚠</span>
            <span>{metrics.totalSensitive}</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-card border border-border-default space-y-1">
          <span className="text-xs text-text-tertiary block font-medium">
            {bo.campaignQueue.metrics.inReview}
          </span>
          <span className="text-2xl font-extrabold text-feedback-info-text">
            {metrics.totalInReview}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-surface-card border border-border-default space-y-1">
          <span className="text-xs text-text-tertiary block font-medium">
            {bo.campaignQueue.metrics.oldestPending}
          </span>
          <span className="text-2xl font-extrabold text-text-primary">
            {metrics.oldestPendingHours > 0
              ? `${metrics.oldestPendingHours} h`
              : bo.campaignQueue.metrics.oldestNone}
          </span>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="p-4 rounded-xl bg-surface-card border border-border-default flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtre de statut */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-tertiary font-medium">
              {bo.campaignQueue.filters.status}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="p-1.5 rounded-lg bg-surface-page border border-border-default text-text-primary text-xs font-medium"
            >
              <option value="all">
                {bo.campaignQueue.filters.allStatuses}
              </option>
              <option value="a_valider">
                {bo.campaignQueue.filters.pending}
              </option>
              <option value="publiee">
                {bo.campaignQueue.filters.published}
              </option>
              <option value="refusee">
                {bo.campaignQueue.filters.rejected}
              </option>
            </select>
          </div>

          {/* Toggle Secteur sensible */}
          <button
            type="button"
            onClick={handleSensitiveToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              sensitiveOnly
                ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                : "bg-surface-page text-text-secondary border-border-default hover:text-text-primary"
            }`}
          >
            <span>⚠</span>
            <span>{bo.campaignQueue.filters.sensitiveOnly}</span>
          </button>
        </div>

        {/* Champ de recherche */}
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder={bo.campaignQueue.filters.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-1.5 px-3 rounded-lg bg-surface-page border border-border-default text-xs text-text-primary placeholder:text-text-tertiary focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      {/* Message d'erreur serveur */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs">
          ✕ {errorMessage}
        </div>
      )}

      {/* Tableau des campagnes */}
      <div className="rounded-xl border border-border-default bg-surface-card overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-default bg-surface-muted/40 text-text-tertiary font-semibold uppercase tracking-wider text-[11px]">
              <th className="p-3.5 pl-6">{bo.campaignQueue.table.colAge}</th>
              <th className="p-3.5">{bo.campaignQueue.table.colBrand}</th>
              <th className="p-3.5">{bo.campaignQueue.table.colTitle}</th>
              <th className="p-3.5">{bo.campaignQueue.table.colCategory}</th>
              <th className="p-3.5">{bo.campaignQueue.table.colBudget}</th>
              <th className="p-3.5">{bo.campaignQueue.table.colStatus}</th>
              <th className="p-3.5 pr-6 text-right">
                {bo.campaignQueue.table.colActions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-tertiary">
                  {bo.campaignQueue.empty.loading}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-tertiary">
                  {bo.campaignQueue.empty.emptyQueue}
                </td>
              </tr>
            ) : (
              items.map((camp) => (
                <tr
                  key={camp.id}
                  className="hover:bg-surface-hover/60 transition-colors"
                >
                  {/* Ancienneté & SLA */}
                  <td className="p-3.5 pl-6">
                    <div className="space-y-1">
                      {renderSlaIndicator(camp)}
                      <span className="block text-[11px] text-text-tertiary">
                        {new Date(
                          camp.submittedAt || camp.createdAt,
                        ).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </td>

                  {/* Marque */}
                  <td className="p-3.5">
                    <div>
                      <span className="font-bold text-text-primary block">
                        {camp.brandSummary?.companyName || "Marque"}
                      </span>
                      <span className="text-[11px] text-text-tertiary">
                        {camp.brandSummary?.country || "FR"} ·{" "}
                        {camp.brandSummary?.publishedCampaignsCount || 0}{" "}
                        publiée(s)
                      </span>
                    </div>
                  </td>

                  {/* Titre & Type */}
                  <td className="p-3.5 max-w-xs">
                    <div>
                      <span className="font-semibold text-text-primary block truncate">
                        {camp.title}
                      </span>
                      <span className="text-[11px] text-text-tertiary block">
                        Type : {camp.campaignType}
                      </span>
                    </div>
                  </td>

                  {/* Catégorie & Sensibilité */}
                  <td className="p-3.5">
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-text-primary font-medium">
                        {camp.productCategory}
                      </span>
                      {camp.isSensitive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
                          ⚠ Sensible
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Budget */}
                  <td className="p-3.5 font-medium text-text-primary">
                    {camp.minCompensationMinor != null &&
                    camp.maxCompensationMinor != null
                      ? `${(camp.minCompensationMinor / 100).toLocaleString("fr-FR")} – ${(camp.maxCompensationMinor / 100).toLocaleString("fr-FR")} ${camp.currency}`
                      : "Dotation seule"}
                  </td>

                  {/* Statut & Verrou */}
                  <td className="p-3.5">
                    {getStatusBadge(camp.status, camp.lockedByAgentId)}
                  </td>

                  {/* Bouton d'action */}
                  <td className="p-3.5 pr-6 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenDrawer(camp)}
                      className="px-3 py-1.5 rounded-lg bg-brand-primary text-surface-page font-bold text-xs hover:bg-brand-hover transition-colors shadow-xs"
                    >
                      {bo.campaignQueue.table.actionInspect}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Barre de pagination */}
        <div className="p-4 border-t border-border-default bg-surface-page/40 flex items-center justify-between text-xs text-text-tertiary">
          <span>
            {bo.campaignQueue.filters.displayedCount.replace(
              "{count}",
              String(total),
            )}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-border-default bg-surface-card disabled:opacity-40 hover:bg-surface-hover"
            >
              Précédent
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded border border-border-default bg-surface-card disabled:opacity-40 hover:bg-surface-hover"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      {/* Tiroir de décision */}
      <CampaignDecisionDrawer
        campaign={selectedCampaign}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSuccess={handleActionSuccess}
        currentAgentId={currentAgentId}
        currentAgentName={currentAgentName}
      />
    </div>
  );
}

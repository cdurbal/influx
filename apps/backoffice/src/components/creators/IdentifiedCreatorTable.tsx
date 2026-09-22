"use client";

import React, { useState } from "react";
import {
  type IdentifiedCreatorCard,
  type CreatorSearchFilters,
  type SearchSortCode,
} from "@influx/contracts";
import { bo } from "@/locales/bo-labels";
import { InfluxProposalModal } from "./InfluxProposalModal";

export interface IdentifiedCreatorTableProps {
  creators: IdentifiedCreatorCard[];
  exactTotal?: number;
  loading: boolean;
  filters: CreatorSearchFilters;
  onFilterChange: (filters: CreatorSearchFilters) => void;
  onResetFilters: () => void;
  sort: SearchSortCode;
  onSortChange: (sort: SearchSortCode) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  campaignBridgeTitle?: string;
  onClearBridge?: () => void;
  onInspectCreator?: (creator: IdentifiedCreatorCard) => void;
  onProposalSuccess?: () => void;
}

export function IdentifiedCreatorTable({
  creators,
  exactTotal,
  loading,
  filters,
  onFilterChange,
  onResetFilters,
  sort,
  onSortChange,
  page,
  totalPages,
  onPageChange,
  campaignBridgeTitle,
  onClearBridge,
  onInspectCreator,
  onProposalSuccess,
}: IdentifiedCreatorTableProps) {
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<string[]>([]);
  const [showProposalModal, setShowProposalModal] = useState(false);

  // Toggle selection d'un créateur (max 20, 17b §3.3)
  const handleToggleSelect = (id: string) => {
    if (selectedCreatorIds.includes(id)) {
      setSelectedCreatorIds(selectedCreatorIds.filter((cid) => cid !== id));
    } else {
      if (selectedCreatorIds.length >= 20) {
        alert(bo.identifiedSearch.maxSelection);
        return;
      }
      setSelectedCreatorIds([...selectedCreatorIds, id]);
    }
  };

  // Sélectionner tous les éléments visibles de la page (jusqu'à 20 max)
  const handleToggleSelectAll = () => {
    const visibleIds = creators.map((c) => c.creatorAccountId);
    const allSelected = visibleIds.every((id) =>
      selectedCreatorIds.includes(id),
    );

    if (allSelected) {
      setSelectedCreatorIds(
        selectedCreatorIds.filter((id) => !visibleIds.includes(id)),
      );
    } else {
      const combined = Array.from(
        new Set([...selectedCreatorIds, ...visibleIds]),
      );
      if (combined.length > 20) {
        setSelectedCreatorIds(combined.slice(0, 20));
      } else {
        setSelectedCreatorIds(combined);
      }
    }
  };

  const selectedCreators = creators.filter((c) =>
    selectedCreatorIds.includes(c.creatorAccountId),
  );

  return (
    <div className="space-y-6">
      {/* 1. Marqueur de vue identifiée conforme 17b §3.3 (Bandeau + Bordure distinctive) */}
      <div
        role="alert"
        className="p-4 bg-surface-card border-l-4 border-l-brand-primary border-y border-r border-border-default rounded-r-xl shadow-sm flex items-start gap-3"
      >
        <span className="text-xl shrink-0 mt-0.5">👁️</span>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <strong className="text-text-brand font-bold uppercase tracking-wider">
              {bo.identifiedSearch.bannerWarning}
            </strong>
            <span className="text-text-tertiary">
              · Espace réservé aux agents INFLUX
            </span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            {bo.identifiedSearch.bannerDetail}
          </p>
        </div>
      </div>

      {/* 2. Bandeau Pont Campagne si actif */}
      {campaignBridgeTitle && (
        <div className="flex items-center justify-between p-3 bg-brand-subtle-bg border border-brand-subtle-border rounded-lg text-xs">
          <div className="flex items-center gap-2 text-text-brand font-medium">
            <span>🎯</span>
            <span>
              {bo.identifiedSearch.campaignBridgeBadge} : «{" "}
              {campaignBridgeTitle} »
            </span>
          </div>
          {onClearBridge && (
            <button
              onClick={onClearBridge}
              className="text-text-tertiary hover:text-text-primary underline text-[11px]"
            >
              {bo.identifiedSearch.clearBridge}
            </button>
          )}
        </div>
      )}

      {/* 3. Barre de filtres facettes & Statuts de profil */}
      <div className="p-4 bg-surface-card border border-border-default rounded-xl space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Thématique */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary font-medium">Thématique :</span>
            <select
              value={filters.primaryTopic || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  primaryTopic: e.target.value || undefined,
                })
              }
              className="bg-surface-raised border border-border-default rounded px-2 py-1 text-text-primary focus:outline-hidden"
            >
              <option value="">{bo.identifiedSearch.filters.allTopics}</option>
              <option value="beaute">Beauté</option>
              <option value="lifestyle">Lifestyle</option>
              <option value="tech">Tech</option>
              <option value="gaming">Gaming</option>
              <option value="food">Cuisine</option>
              <option value="travel">Voyage</option>
              <option value="mode">Mode</option>
              <option value="fitness">Sport</option>
            </select>
          </div>

          {/* Réseau */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary font-medium">Réseau :</span>
            <select
              value={filters.networks?.[0] || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  networks: e.target.value ? [e.target.value] : undefined,
                })
              }
              className="bg-surface-raised border border-border-default rounded px-2 py-1 text-text-primary focus:outline-hidden"
            >
              <option value="">
                {bo.identifiedSearch.filters.allNetworks}
              </option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          {/* Statut du profil (G2, 17b §3.3) */}
          <div className="flex items-center gap-1.5">
            <span className="text-text-tertiary font-medium">
              Statut profil :
            </span>
            <select
              value={filters.profileStatus || ""}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  profileStatus: (e.target.value || undefined) as any,
                })
              }
              className="bg-surface-raised border border-border-default rounded px-2 py-1 text-text-primary focus:outline-hidden"
            >
              <option value="">
                {bo.identifiedSearch.filters.allStatuses}
              </option>
              <option value="publie">
                {bo.identifiedSearch.filters.statusPublished}
              </option>
              <option value="brouillon">
                {bo.identifiedSearch.filters.statusDraft}
              </option>
              <option value="en_attente">
                {bo.identifiedSearch.filters.statusPending}
              </option>
              <option value="refuse">
                {bo.identifiedSearch.filters.statusRejected}
              </option>
              <option value="suspendu">
                {bo.identifiedSearch.filters.statusSuspended}
              </option>
            </select>
          </div>

          {/* Tri */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-text-tertiary font-medium">Tri :</span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SearchSortCode)}
              className="bg-surface-raised border border-border-default rounded px-2 py-1 text-text-primary focus:outline-hidden"
            >
              <option value="default">Pertinence déterministe</option>
              <option value="audience_desc">Audience décroissante</option>
              <option value="price_asc">Tarif croissant</option>
              <option value="verified_first">Vérifiés d'abord</option>
              <option value="new_profiles">Nouveaux profils</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onResetFilters}
            className="text-text-tertiary hover:text-text-primary underline text-[11px] ml-2"
          >
            {bo.identifiedSearch.filters.reset}
          </button>
        </div>
      </div>

      {/* 4. Barre d'état de sélection & Décompte exact (17b §3.3) */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-text-primary">
            <input
              type="checkbox"
              checked={
                creators.length > 0 &&
                creators.every((c) =>
                  selectedCreatorIds.includes(c.creatorAccountId),
                )
              }
              onChange={handleToggleSelectAll}
              className="rounded border-border-default bg-surface-raised text-brand-primary"
            />
            <span>Tout sélectionner</span>
          </label>
          <span className="text-text-tertiary font-mono">
            ({selectedCreatorIds.length} sélectionné / 20 max)
          </span>
        </div>

        <span className="text-text-secondary font-mono font-medium">
          {exactTotal !== undefined
            ? `${exactTotal} créateur(s) au total`
            : `${creators.length} créateurs affichés`}
        </span>
      </div>

      {/* 5. Tableau des créateurs en vue identifiée */}
      <div className="border border-border-default rounded-xl bg-surface-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted text-text-tertiary border-b border-border-default select-none">
              <tr>
                <th className="p-3 w-10 text-center">✓</th>
                <th className="p-3">{bo.identifiedSearch.table.colCreator}</th>
                <th className="p-3">
                  {bo.identifiedSearch.table.colTopicNetwork}
                </th>
                <th className="p-3">{bo.identifiedSearch.table.colAudience}</th>
                <th className="p-3">{bo.identifiedSearch.table.colPrice}</th>
                <th className="p-3">{bo.identifiedSearch.table.colBadges}</th>
                <th className="p-3">{bo.identifiedSearch.table.colStatus}</th>
                <th className="p-3 text-right">
                  {bo.identifiedSearch.table.colActions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-text-tertiary"
                  >
                    {bo.identifiedSearch.empty.loading}
                  </td>
                </tr>
              ) : creators.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center text-text-tertiary"
                  >
                    {bo.identifiedSearch.empty.noResultsFilters}
                  </td>
                </tr>
              ) : (
                creators.map((c) => {
                  const isSelected = selectedCreatorIds.includes(
                    c.creatorAccountId,
                  );
                  const primaryExact = c.exactNetworks?.[0];
                  const fullName =
                    c.legalFirstName && c.legalLastName
                      ? `${c.legalFirstName} ${c.legalLastName}`
                      : c.pseudonym || c.alias;

                  const hasAudienceBadge = c.networks.some(
                    (n) => n.hasVerifiedAudienceBadge,
                  );
                  const hasAccountBadge = c.networks.some(
                    (n) => n.hasVerifiedAccountBadge,
                  );

                  return (
                    <tr
                      key={c.creatorAccountId}
                      className={`hover:bg-surface-raised transition-colors ${
                        isSelected ? "bg-surface-raised/60" : ""
                      }`}
                    >
                      {/* Checkbox sélection */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            handleToggleSelect(c.creatorAccountId)
                          }
                          className="rounded border-border-default bg-surface-raised text-brand-primary"
                        />
                      </td>

                      {/* Créateur & Identité réelle (17b §3.3) */}
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary text-sm">
                            {fullName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-text-brand bg-brand-subtle-bg px-1.5 py-0.5 rounded border border-brand-subtle-border">
                              {c.alias}
                            </span>
                            {primaryExact && (
                              <a
                                href={primaryExact.profileUrl || "#"}
                                target="_blank"
                                rel="noreferrer"
                                title="Ouvre le profil public hors INFLUX ↗"
                                className="font-mono text-text-secondary hover:text-text-primary flex items-center gap-0.5"
                              >
                                <span>{primaryExact.handle}</span>
                                <span className="text-[10px]">↗</span>
                              </a>
                            )}
                          </div>
                          {c.email && (
                            <span className="text-[11px] text-text-tertiary mt-0.5">
                              {c.email} {c.phone ? `· ${c.phone}` : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Thématique & Réseau */}
                      <td className="p-3">
                        <span className="font-medium text-text-primary capitalize block">
                          {c.primaryTopic}
                        </span>
                        <span className="text-text-tertiary capitalize text-[11px]">
                          {c.networks.map((n) => n.network).join(", ")}
                        </span>
                      </td>

                      {/* Audience exacte */}
                      <td className="p-3 font-mono">
                        {primaryExact?.followersCount !== undefined &&
                        primaryExact?.followersCount !== null ? (
                          <span className="text-text-primary font-semibold">
                            {primaryExact.followersCount.toLocaleString(
                              "fr-FR",
                            )}
                          </span>
                        ) : (
                          <span className="text-text-secondary">
                            {c.networks[0]?.audienceBand || "—"}
                          </span>
                        )}
                        <span className="block text-[10px] text-text-tertiary">
                          {c.audience.primaryCountry} (
                          {c.audience.primaryCountryShareBand === "gte_80"
                            ? "> 80%"
                            : "50-80%"}
                          )
                        </span>
                      </td>

                      {/* Tarif */}
                      <td className="p-3 font-mono text-text-brand font-medium">
                        {c.offers?.[0] ? (
                          <span>
                            {c.offers[0].priceBand} {c.offers[0].currency}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">Sur devis</span>
                        )}
                      </td>

                      {/* Badges vérifiés */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          {hasAudienceBadge && (
                            <span className="text-[10px] font-medium text-feedback-success-text flex items-center gap-1">
                              ✓ Audience 90j
                            </span>
                          )}
                          {hasAccountBadge && (
                            <span className="text-[10px] text-text-secondary flex items-center gap-1">
                              ✓ Compte vérifié
                            </span>
                          )}
                          {!hasAudienceBadge && !hasAccountBadge && (
                            <span className="text-[11px] text-text-tertiary">
                              Non vérifié
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Statut du profil */}
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            c.profileStatus === "publie"
                              ? "bg-feedback-success-bg text-feedback-success-text border-feedback-success-border"
                              : c.profileStatus === "brouillon"
                                ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                                : c.profileStatus === "en_attente"
                                  ? "bg-feedback-info-bg text-feedback-info-text border-feedback-info-border"
                                  : "bg-feedback-error-bg text-feedback-error-text border-feedback-error-border"
                          }`}
                        >
                          {c.profileStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onInspectCreator && onInspectCreator(c)
                          }
                          className="px-2.5 py-1 bg-surface-raised hover:bg-surface-hover border border-border-default rounded text-[11px] font-medium text-text-primary transition-colors"
                        >
                          {bo.identifiedSearch.table.actionInspect}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border-default flex items-center justify-between text-xs bg-surface-muted">
            <span className="text-text-tertiary">
              Page {page} sur {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                className="px-2.5 py-1 rounded border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                className="px-2.5 py-1 rounded border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. Barre d'action collante en bas : Proposition INFLUX (17b §3.3) */}
      {selectedCreatorIds.length > 0 && (
        <div className="sticky bottom-4 z-40 bg-surface-card border border-border-selected p-4 rounded-xl shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-text-primary">
              {bo.identifiedSearch.selectionCounter.replace(
                "{count}",
                selectedCreatorIds.length.toString(),
              )}
            </span>
            <span className="text-xs text-text-tertiary">
              Sélection prête pour mise en relation directe
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedCreatorIds([])}
              className="text-xs text-text-tertiary hover:text-text-primary underline px-2 py-1"
            >
              Désélectionner tout
            </button>
            <button
              type="button"
              onClick={() => setShowProposalModal(true)}
              className="px-4 py-2 bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action font-bold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>
                Faire une Proposition INFLUX ({selectedCreatorIds.length})
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modale Proposition INFLUX */}
      {showProposalModal && (
        <InfluxProposalModal
          creators={selectedCreators}
          defaultCampaignId={filters.campaignId}
          onClose={() => setShowProposalModal(false)}
          onSuccess={() => {
            setSelectedCreatorIds([]);
            if (onProposalSuccess) onProposalSuccess();
          }}
        />
      )}
    </div>
  );
}

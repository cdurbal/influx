"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Eye,
  Pause,
  Play,
  Copy,
  Archive,
  Search,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  type CampaignBrandView,
  type CampaignStatus,
  CAMPAIGN_REJECTION_MESSAGES,
} from "@influx/contracts";
import { getCampaignLabels } from "./campaign-labels";
import { CampaignPreviewModal } from "./CampaignPreviewModal";

export interface CampaignListProps {
  locale?: string;
}

export function CampaignList({ locale = "fr" }: CampaignListProps) {
  const t = getCampaignLabels(locale);
  const isEn = locale === "en";

  const [campaigns, setCampaigns] = useState<CampaignBrandView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  // Filtres & Recherche
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modale aperçu créateur
  const [previewCampaign, setPreviewCampaign] =
    useState<CampaignBrandView | null>(null);

  // Modale de confirmation clôture définitive (RG9)
  const [closingCampaignId, setClosingCampaignId] = useState<string | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsAuthError(false);
      const res = await fetch("/api/campaigns/my", {
        credentials: "include",
      });
      if (res.status === 401) {
        setIsAuthError(true);
        setError(
          locale === "en"
            ? "You must be signed in with an advertiser account to view your campaigns."
            : "Vous devez être connecté avec votre compte annonceur pour accéder à vos campagnes.",
        );
        return;
      }
      if (!res.ok) {
        throw new Error(
          `Erreur (${res.status}) lors du chargement des campagnes.`,
        );
      }
      const json = await res.json();
      setCampaigns(json.campaigns || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Erreur lors du chargement.",
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const handleDemoLogin = async () => {
    setActionLoading(true);
    try {
      await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "contact@maisonsolene.fr",
          role: "advertiser",
        }),
        credentials: "include",
      });
      await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "contact@maisonsolene.fr",
          code: "123456",
          termsVersion: "2026-09-v1",
          hasNonCircumventionAcknowledged: true,
        }),
        credentials: "include",
      });
      await fetchCampaigns();
    } catch {
      // Ignorer
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Actions de cycle de vie
  const handlePause = async (campaignId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Erreur lors de la mise en pause");
      }
      await fetchCampaigns();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (campaignId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Erreur lors de la reprise");
      }
      await fetchCampaigns();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (campaignId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Erreur lors de la duplication");
      }
      const json = await res.json();
      window.location.href = `/${locale}/advertiser/campaigns/new?from=${json.campaign.id}`;
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
      setActionLoading(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!closingCampaignId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${closingCampaignId}/close`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || "Erreur lors de la clôture");
      }
      setClosingCampaignId(null);
      await fetchCampaigns();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  // Métriques
  const activeCount = useMemo(
    () =>
      campaigns.filter((c) =>
        ["publiee", "en_pause", "a_valider"].includes(c.status),
      ).length,
    [campaigns],
  );

  const totalApplications = useMemo(
    () => campaigns.reduce((acc, c) => acc + (c.applicationsCount || 0), 0),
    [campaigns],
  );

  const publishedCount = useMemo(
    () => campaigns.filter((c) => c.status === "publiee").length,
    [campaigns],
  );

  const pendingCount = useMemo(
    () => campaigns.filter((c) => c.status === "a_valider").length,
    [campaigns],
  );

  // Filtrage
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (
        statusFilter === "active" &&
        !["publiee", "en_pause", "a_valider"].includes(c.status)
      ) {
        return false;
      }
      if (statusFilter === "publiee" && c.status !== "publiee") return false;
      if (statusFilter === "a_valider" && c.status !== "a_valider")
        return false;
      if (statusFilter === "en_pause" && c.status !== "en_pause") return false;
      if (statusFilter === "cloturee" && c.status !== "cloturee") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchRef =
          c.internalReference?.toLowerCase().includes(q) ?? false;
        const matchCategory =
          c.productCategory?.toLowerCase().includes(q) ?? false;
        const matchType = c.campaignType?.toLowerCase().includes(q) ?? false;
        if (!matchTitle && !matchRef && !matchCategory && !matchType)
          return false;
      }

      return true;
    });
  }, [campaigns, statusFilter, searchQuery]);

  // Badge de statut premium
  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case "publiee":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-subtle-bg text-text-brand border border-brand-subtle-border shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-primary" />
            <span>{t.list.statusPublished}</span>
          </span>
        );
      case "a_valider":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border shadow-xs">
            <Clock
              className="w-3.5 h-3.5 text-feedback-warning-text animate-spin"
              style={{ animationDuration: "3s" }}
            />
            <span>{t.list.statusPendingReview}</span>
          </span>
        );
      case "en_pause":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-raised text-text-secondary border border-border-default shadow-xs">
            <PauseCircle className="w-3.5 h-3.5 text-text-secondary" />
            <span>{t.list.statusPaused}</span>
          </span>
        );
      case "cloturee":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-tertiary border border-border-default">
            <Archive className="w-3.5 h-3.5 text-text-tertiary" />
            <span>{t.list.statusClosed}</span>
          </span>
        );
      case "refusee":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border shadow-xs">
            <AlertCircle className="w-3.5 h-3.5 text-feedback-error-text" />
            <span>{t.list.statusRejected}</span>
          </span>
        );
      case "brouillon":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-page text-text-secondary border border-border-default">
            <span>○</span>
            <span>{t.list.statusDraft}</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. CARTES DE STATISTIQUES & EN-TÊTE RÉSUMÉ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Campagnes */}
        <div className="bg-surface-card border border-border-default rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              {isEn ? "Total Campaigns" : "Total Campagnes"}
            </span>
            <div className="text-2xl font-black text-text-primary tracking-tight">
              {campaigns.length}
            </div>
            <p className="text-[11px] text-text-secondary">
              {publishedCount}{" "}
              {isEn ? "currently published" : "en cours de diffusion"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-center text-text-brand">
            <Layers className="w-6 h-6 text-text-brand" />
          </div>
        </div>

        {/* Campagnes Actives (Jauge RG8) */}
        <div className="bg-surface-card border border-border-default rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1 flex-1 mr-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                {isEn ? "Active Allocation" : "Quota de diffusion"}
              </span>
              <span className="font-mono text-xs font-bold text-text-brand">
                {activeCount}/10
              </span>
            </div>
            <div className="text-2xl font-black text-text-primary tracking-tight">
              {activeCount}{" "}
              <span className="text-xs font-medium text-text-tertiary">
                / 10 max
              </span>
            </div>
            {/* Barre de jauge */}
            <div className="w-full bg-surface-raised rounded-full h-1.5 overflow-hidden mt-2">
              <div
                className={`h-full rounded-full transition-all ${
                  activeCount >= 10
                    ? "bg-feedback-warning-text"
                    : "bg-brand-primary"
                }`}
                style={{ width: `${Math.min((activeCount / 10) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-center text-text-brand shrink-0">
            <Clock className="w-6 h-6 text-text-brand" />
          </div>
        </div>

        {/* Candidatures Reçues */}
        <div className="bg-surface-card border border-border-default rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
              {isEn ? "Total Applications" : "Candidatures Reçues"}
            </span>
            <div className="text-2xl font-black text-text-primary tracking-tight">
              {totalApplications}
            </div>
            <p className="text-[11px] text-text-secondary">
              {pendingCount > 0
                ? `${pendingCount} ${isEn ? "pending review" : "en modération commerciale"}`
                : isEn
                  ? "Across all active campaigns"
                  : "Sur l'ensemble de vos briefs"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border-subtle flex items-center justify-center text-text-brand">
            <Users className="w-6 h-6 text-text-brand" />
          </div>
        </div>
      </div>

      {/* 2. BARRE D'ACTION ET OUTILS (RECHERCHE + FILTRES + CTA CRÉER) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card border border-border-default rounded-2xl p-4 shadow-sm">
        {/* Recherche instantanée */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder={
              isEn
                ? "Search by title, reference, category..."
                : "Rechercher par titre, référence, catégorie..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-page border border-border-default text-text-primary text-xs placeholder-text-tertiary focus:outline-none focus:border-brand-primary transition-colors"
          />
        </div>

        {/* Filtres rapides par statut */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === "all"
                ? "bg-brand-subtle-bg text-text-brand border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
            }`}
          >
            {isEn ? "All" : "Toutes"} ({campaigns.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("publiee")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === "publiee"
                ? "bg-brand-subtle-bg text-text-brand border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
            }`}
          >
            {isEn ? "Published" : "Publiées"} ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("a_valider")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === "a_valider"
                ? "bg-brand-subtle-bg text-text-brand border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
            }`}
          >
            {isEn ? "In Review" : "En modération"} ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("cloturee")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer shrink-0 ${
              statusFilter === "cloturee"
                ? "bg-brand-subtle-bg text-text-brand border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
            }`}
          >
            {isEn ? "Closed" : "Clôturées"}
          </button>
        </div>

        {/* Bouton Créer une campagne */}
        <Link
          href={`/${locale}/advertiser/campaigns/new`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action font-extrabold text-xs transition-colors shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.list.createNewButton}</span>
        </Link>
      </div>

      {/* Message d'erreur d'authentification ou serveur */}
      {isAuthError ? (
        <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-subtle-bg border border-brand-subtle-border flex items-center justify-center text-brand-primary shrink-0">
              <Sparkles className="w-5 h-5 text-brand-primary" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-text-primary">
                {locale === "en"
                  ? "Authentication required"
                  : "Session requise"}
              </h4>
              <p className="text-xs text-text-secondary">{error}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-action-primary-bg text-text-on-action font-bold text-xs hover:bg-action-primary-bg-hover transition-colors shadow-sm"
            >
              {locale === "en" ? "Sign in" : "Se connecter"}
            </Link>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={actionLoading}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-brand-subtle-border bg-brand-subtle-bg text-brand-primary text-xs font-semibold hover:bg-brand-subtle-border transition-colors cursor-pointer"
            >
              {actionLoading
                ? locale === "en"
                  ? "Connecting..."
                  : "Connexion en cours..."
                : locale === "en"
                  ? "Quick Demo Login (Maison Solène)"
                  : "Connexion rapide Démo (Maison Solène)"}
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs">
          ✕ {error}
        </div>
      ) : null}

      {/* 3. LISTE DES CAMPAGNES (PRÉSENTATION LIST-CARD PREMIUM AÉRÉE) */}
      {loading ? (
        <div className="p-16 text-center rounded-2xl bg-surface-card border border-border-default text-text-tertiary text-xs space-y-3">
          <Clock className="w-6 h-6 animate-spin mx-auto text-brand-primary" />
          <p>
            {isEn
              ? "Loading your campaigns..."
              : "Chargement de vos campagnes..."}
          </p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-surface-card border border-border-default space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-border-default flex items-center justify-center mx-auto text-text-brand text-2xl shadow-sm">
            🎯
          </div>
          <div>
            <h3 className="font-extrabold text-base text-text-primary">
              {searchQuery
                ? isEn
                  ? "No matching campaign found"
                  : "Aucune campagne trouvée pour cette recherche"
                : t.list.emptyTitle}
            </h3>
            <p className="text-xs text-text-tertiary mt-1 max-w-md mx-auto">
              {searchQuery
                ? isEn
                  ? "Try adjusting your search terms or status filters."
                  : "Essayez de modifier votre recherche ou vos filtres de statut."
                : t.list.emptySubtitle}
            </p>
          </div>
          {!searchQuery && (
            <Link
              href={`/${locale}/advertiser/campaigns/new`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action font-bold text-xs transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.list.createNewButton}</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((camp) => {
            const reasonInfo = camp.rejectionReason
              ? CAMPAIGN_REJECTION_MESSAGES[camp.rejectionReason]
              : null;

            return (
              <article
                key={camp.id}
                className="group relative rounded-2xl border border-border-default bg-surface-card hover:border-border-strong transition-all duration-base p-6 sm:p-7 shadow-sm hover:shadow-md space-y-5"
              >
                {/* Liseré subtil au hover */}
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* EN-TÊTE DE LA CARTE : BADGES + RÉFÉRENCE */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(camp.status)}
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-surface-raised text-text-secondary border border-border-subtle">
                      {camp.campaignType}
                    </span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium bg-surface-raised text-text-secondary border border-border-subtle">
                      {camp.productCategory}
                    </span>
                  </div>

                  {camp.internalReference && (
                    <span className="font-mono text-[11px] text-text-tertiary bg-surface-page px-2.5 py-1 rounded-md border border-border-subtle">
                      Réf : {camp.internalReference}
                    </span>
                  )}
                </div>

                {/* CORPS : TITRE & GRILLE D'INFORMATIONS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Titre et détails */}
                  <div className="lg:col-span-5 space-y-1.5">
                    <h3 className="text-lg font-bold text-text-primary tracking-tight group-hover:text-text-brand transition-colors">
                      {camp.title}
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {isEn
                        ? "Brief active for creators under verified commercial mediation."
                        : "Campagne active pour les créateurs qualifiés sous mandat d'intermédiation commerciale."}
                    </p>
                  </div>

                  {/* Calendrier & Échéances */}
                  <div className="lg:col-span-3 space-y-1 bg-surface-page/60 rounded-xl p-3 border border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-tertiary text-[11px] font-medium">
                      <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                      <span>
                        {isEn
                          ? "Application Deadline"
                          : "Candidatures jusqu'au"}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-text-primary font-mono">
                      {camp.applicationDeadline || "—"}
                    </div>
                    <div className="text-[10px] text-text-tertiary pt-0.5">
                      {isEn ? "Period: " : "Diffusion : "}
                      {camp.startsOn || "—"} → {camp.endsOn || "—"}
                    </div>
                  </div>

                  {/* Rémunération par créateur */}
                  <div className="lg:col-span-2 space-y-1 bg-surface-page/60 rounded-xl p-3 border border-border-subtle">
                    <div className="flex items-center gap-1.5 text-text-tertiary text-[11px] font-medium">
                      <CreditCard className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{isEn ? "Per Creator" : "Par créateur"}</span>
                    </div>
                    <div className="text-sm font-black text-text-primary tracking-tight">
                      {camp.minCompensationMinor != null &&
                      camp.maxCompensationMinor != null
                        ? `${(camp.minCompensationMinor / 100).toLocaleString("fr-FR")} – ${(camp.maxCompensationMinor / 100).toLocaleString("fr-FR")} ${camp.currency}`
                        : isEn
                          ? "Product gift"
                          : "Dotation seule"}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      {isEn ? "Indicative range" : "Fourchette indicative"}
                    </div>
                  </div>

                  {/* Candidatures reçues */}
                  <div className="lg:col-span-2 space-y-1 bg-surface-page/60 rounded-xl p-3 border border-border-subtle text-right lg:text-left">
                    <div className="flex items-center gap-1.5 text-text-tertiary text-[11px] font-medium justify-end lg:justify-start">
                      <Users className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{isEn ? "Applications" : "Candidatures"}</span>
                    </div>
                    <div className="text-sm font-black text-text-brand">
                      {camp.applicationsCount}{" "}
                      <span className="text-xs font-medium text-text-secondary">
                        {isEn ? "received" : "reçue(s)"}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      {isEn ? "Direct candidate pool" : "Bassin direct"}
                    </div>
                  </div>
                </div>

                {/* MOTIF DE REFUS (SI REFUSÉE PAR LE BACKOFFICE - RG10) */}
                {camp.status === "refusee" && reasonInfo && (
                  <div className="p-4 rounded-xl bg-feedback-error-bg border border-feedback-error-border text-xs text-feedback-error-text space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4" />
                      <span>{t.list.rejectionReasonTitle}</span>
                    </div>
                    <p className="leading-relaxed">
                      « {reasonInfo.messageFr} »
                    </p>
                    {camp.rejectionComment && (
                      <p className="text-[11px] opacity-90 italic pt-0.5">
                        Commentaire commercial : {camp.rejectionComment}
                      </p>
                    )}
                  </div>
                )}

                {/* PIED DE CARTE : BOUTONS D'ACTIONS PREMIUM */}
                <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Bouton Aperçu fiche créateur */}
                    <button
                      type="button"
                      onClick={() => setPreviewCampaign(camp)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-border-default text-text-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-brand-primary" />
                      <span>{t.list.actionPreview}</span>
                    </button>

                    {/* Bouton Mettre en pause */}
                    {camp.status === "publiee" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handlePause(camp.id)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-border-default text-text-secondary hover:text-text-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5 text-text-tertiary" />
                        <span>{t.list.actionPause}</span>
                      </button>
                    )}

                    {/* Bouton Reprendre la diffusion */}
                    {camp.status === "en_pause" && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleResume(camp.id)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-subtle-bg hover:bg-brand-subtle-border border border-brand-subtle-border text-text-brand text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 text-brand-primary" />
                        <span>{t.list.actionResume}</span>
                      </button>
                    )}

                    {/* Bouton Dupliquer */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDuplicate(camp.id)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-border-default text-text-secondary hover:text-text-primary text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-text-tertiary" />
                      <span>{t.list.actionDuplicate}</span>
                    </button>
                  </div>

                  {/* Bouton Clôturer définitivement */}
                  {camp.status !== "cloturee" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setClosingCampaignId(camp.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle hover:border-feedback-error-border text-text-tertiary hover:text-feedback-error-text text-[11px] font-medium transition-colors cursor-pointer"
                      title={t.list.actionClose}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{t.list.actionClose}</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 4. MODALE DE CONFIRMATION DE CLÔTURE DÉFINITIVE (RG9) */}
      {closingCampaignId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        >
          <div className="bg-surface-card w-full max-w-lg rounded-2xl border border-border-default shadow-2xl p-6 sm:p-7 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-feedback-error-bg border border-feedback-error-border flex items-center justify-center text-feedback-error-text shrink-0">
                <AlertCircle className="w-5 h-5 text-feedback-error-text" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-base text-text-primary tracking-tight">
                  {t.list.confirmCloseTitle}
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t.list.confirmCloseMessage}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setClosingCampaignId(null)}
                className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-surface-hover border border-border-default text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors cursor-pointer"
              >
                {t.list.confirmCloseCancel}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmClose}
                className="px-4 py-2 rounded-xl bg-feedback-error-bg hover:bg-feedback-error-border border border-feedback-error-border text-feedback-error-text text-xs font-bold transition-colors cursor-pointer shadow-sm"
              >
                {actionLoading
                  ? isEn
                    ? "Closing..."
                    : "Clôture en cours..."
                  : t.list.confirmCloseConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODALE APERÇU FICHE CRÉATEUR */}
      {previewCampaign && (
        <CampaignPreviewModal
          isOpen={Boolean(previewCampaign)}
          onClose={() => setPreviewCampaign(null)}
          campaign={previewCampaign}
          locale={locale}
        />
      )}
    </div>
  );
}

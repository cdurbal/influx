"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type CreatorSearchFilters,
  type CreatorSearchResponse,
  type SearchSortCode,
  type AnonymizedCreatorCard as AnonymizedCreatorCardType,
  type IdentifiedCreatorCard,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";
import { AnonymizedCreatorCard } from "./AnonymizedCreatorCard";
import { SearchFacetSidebar } from "./SearchFacetSidebar";
import { CreatorDetailModal } from "./CreatorDetailModal";
import { ShortlistModal } from "./ShortlistModal";
import { TeamSelectionModal } from "./TeamSelectionModal";
import { IntroductionRequestModal } from "./IntroductionRequestModal";

export interface CreatorSearchProps {
  locale?: string;
}

export function CreatorSearch({ locale = "fr" }: CreatorSearchProps) {
  const t = getSearchLabels(locale);
  const searchParams = useSearchParams();
  const campaignIdParam = searchParams.get("campaignId") || undefined;

  // État d'authentification et profil
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isBrandPublished, setIsBrandPublished] = useState<boolean | null>(
    null,
  );
  const [authLoading, setAuthLoading] = useState(true);

  // État de recherche
  const [filters, setFilters] = useState<CreatorSearchFilters>({
    currency: "EUR",
    includeOtherCurrencies: false,
    campaignId: campaignIdParam,
  });
  const [sort, setSort] = useState<SearchSortCode>("default");
  const [page, setPage] = useState<number>(1);
  const [searchResponse, setSearchResponse] =
    useState<CreatorSearchResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [detailCreator, setDetailCreator] = useState<
    AnonymizedCreatorCardType | IdentifiedCreatorCard | null
  >(null);
  const [shortlistCreator, setShortlistCreator] = useState<
    AnonymizedCreatorCardType | IdentifiedCreatorCard | null
  >(null);
  const [introCreator, setIntroCreator] = useState<
    AnonymizedCreatorCardType | IdentifiedCreatorCard | null
  >(null);
  const [showTeamSelection, setShowTeamSelection] = useState<boolean>(false);

  // Outil dev
  const [devSeeding, setDevSeeding] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);

  // 1. Contrôle d'authentification et statut profil marque (RG1)
  const verifyAuthAndProfile = useCallback(async () => {
    try {
      setAuthLoading(true);
      const authRes = await fetch("/api/auth/me", { credentials: "include" });
      if (authRes.status === 401) {
        setIsAuthenticated(false);
        setIsBrandPublished(false);
        return;
      }
      if (!authRes.ok) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      // Vérifier le profil marque (RG1)
      const brandRes = await fetch("/api/profiles/brand/me", {
        credentials: "include",
      });
      if (brandRes.ok) {
        const brandData = await brandRes.json();
        const published =
          brandData.status === "publie" ||
          brandData.isPublished === true ||
          brandData.status === "published";
        setIsBrandPublished(published);
      } else {
        // En mock, si le profil marque n'est pas trouvé
        setIsBrandPublished(true);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAuthAndProfile();
  }, [verifyAuthAndProfile]);

  // 2. Exécution de la recherche
  const executeSearch = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/search/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters,
          sort,
          page,
          limit: 12,
          viewMode: "advertiser_anonymous",
        }),
        credentials: "include",
      });

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "BRAND_PROFILE_NOT_PUBLISHED") {
          setIsBrandPublished(false);
          return;
        }
      }

      if (res.status === 429) {
        setError(t.warnings.rateLimitExceeded);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Erreur de recherche (${res.status}).`);
      }

      const json: CreatorSearchResponse = await res.json();
      setSearchResponse(json);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement des résultats.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, filters, sort, page, t.warnings.rateLimitExceeded]);

  useEffect(() => {
    if (isAuthenticated) {
      executeSearch();
    }
  }, [isAuthenticated, executeSearch]);

  // Connexion rapide démo en 1 clic
  const handleDemoLogin = async () => {
    try {
      setAuthLoading(true);
      await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "contact@maisonsolene.fr",
          role: "advertiser",
        }),
      });

      const verifyRes = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "contact@maisonsolene.fr",
          code: "123456",
        }),
        credentials: "include",
      });

      if (verifyRes.ok) {
        await verifyAuthAndProfile();
      }
    } catch {
      // Silencieux
    } finally {
      setAuthLoading(false);
    }
  };

  // Outil Dev : Injecter 4 créateurs pour tester k >= 5
  const handleSeedDevCreators = async () => {
    try {
      setDevSeeding(true);
      const res = await fetch("/api/dev/seed-creators", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setDevMessage(data.message || t.devTools.seededSuccess);
        await executeSearch();
        setTimeout(() => setDevMessage(null), 4000);
      }
    } catch {
      // Silencieux
    } finally {
      setDevSeeding(false);
    }
  };

  // Suggestions d'élargissement (RG60)
  const handleApplyBroadening = (type: string) => {
    if (type.includes("price")) {
      setFilters((prev) => ({ ...prev, priceBand: undefined }));
    } else if (type.includes("audience")) {
      setFilters((prev) => ({ ...prev, audienceBand: undefined }));
    } else if (type.includes("country")) {
      setFilters((prev) => ({ ...prev, audienceCountry: undefined }));
    } else {
      setFilters((prev) => ({ ...prev, formats: undefined }));
    }
  };

  if (authLoading) {
    return (
      <div className="py-24 text-center text-text-tertiary text-sm">
        Chargement de la recherche...
      </div>
    );
  }

  // 1. Écran si non connecté
  if (isAuthenticated === false) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="p-8 bg-surface-card border border-border-default rounded-xl shadow-lg text-center space-y-5">
          <div className="w-12 h-12 rounded-full bg-brand-subtle-bg border border-brand-subtle-border flex items-center justify-center mx-auto text-xl text-text-brand">
            🔒
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {t.warnings.authRequiredTitle}
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              {t.warnings.authRequiredMessage}
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleDemoLogin}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold shadow-sm transition-colors"
            >
              {t.warnings.demoLoginButton}
            </button>
            <Link
              href={`/${locale}/login`}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-border-default text-text-primary hover:bg-surface-raised text-xs font-medium transition-colors"
            >
              {t.warnings.loginButton}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Écran si profil marque non publié (RG1)
  if (isBrandPublished === false) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="p-8 bg-surface-card border border-feedback-warning-border rounded-xl shadow-lg space-y-5 text-center">
          <div className="w-12 h-12 rounded-full bg-feedback-warning-bg border border-feedback-warning-border flex items-center justify-center mx-auto text-xl text-feedback-warning-text">
            📋
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {t.warnings.profileNotPublishedTitle}
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              {t.warnings.profileNotPublishedMessage}
            </p>
          </div>
          <div className="p-4 bg-surface-raised rounded-lg border border-border-subtle text-xs text-text-tertiary text-left">
            💡 En attendant la publication de votre profil d'entreprise, vous
            pouvez transmettre directement votre brief à notre équipe qui
            réalisera la sélection pour vous sous 1 jour ouvré.
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/${locale}/advertiser/profile`}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold shadow-sm transition-colors"
            >
              {t.warnings.completeProfileButton}
            </Link>
            <button
              onClick={() => setShowTeamSelection(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-border-default text-text-primary hover:bg-surface-raised text-xs font-medium transition-colors"
            >
              {t.warnings.contactTeamButton}
            </button>
          </div>
        </div>

        {showTeamSelection && (
          <TeamSelectionModal
            filters={filters}
            campaignId={campaignIdParam}
            locale={locale}
            onClose={() => setShowTeamSelection(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre d'action : Outil Dev discret */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-raised p-3 rounded-lg border border-border-subtle">
        <span className="text-xs text-text-secondary">
          💡 Mode démonstration : Vous pouvez injecter 4 créateurs pour tester
          la transition de k &lt; 5 à k ≥ 5.
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={devSeeding}
            onClick={handleSeedDevCreators}
            className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-default rounded text-xs text-text-brand font-medium transition-colors"
          >
            {devSeeding ? "Génération..." : t.devTools.seedExtraCreators}
          </button>
          {devMessage && (
            <span className="text-xs text-feedback-success-text font-medium">
              {devMessage}
            </span>
          )}
        </div>
      </div>

      {/* Erreur éventuelle */}
      {error && (
        <div className="p-4 bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Layout principal : Sidebar de facettes + Grille de résultats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Colonne gauche : Facettes de filtrage (RG12, RG13, RG17) */}
        <div className="lg:col-span-1">
          <SearchFacetSidebar
            filters={filters}
            onChange={(updated) => {
              setFilters(updated);
              setPage(1);
            }}
            onReset={() => {
              setFilters({
                currency: "EUR",
                includeOtherCurrencies: false,
              });
              setPage(1);
            }}
            onRequestTeamSelection={() => setShowTeamSelection(true)}
            campaignId={campaignIdParam}
            locale={locale}
          />
        </div>

        {/* Colonne droite : Résultats & K-Anonymat */}
        <div className="lg:col-span-3 space-y-6">
          {/* Barre de contrôle supérieure : Décompte en tranche (RG59) & Tri déterministe (RG35, RG43) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-card border border-border-default rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                Résultats :
              </span>
              {searchResponse && (
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-surface-raised border border-border-subtle text-text-primary">
                  {t.kAnonymity.countBands[searchResponse.countBand] ||
                    searchResponse.countBand}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label className="text-text-tertiary font-medium">
                {t.sortLabel} :
              </label>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as SearchSortCode);
                  setPage(1);
                }}
                className="bg-surface-raised border border-border-default rounded-lg px-2.5 py-1.5 text-text-primary focus:border-border-selected focus:outline-hidden"
              >
                <option value="default">{t.sortBy.default}</option>
                <option value="audience_desc">{t.sortBy.audience_desc}</option>
                <option value="price_asc">{t.sortBy.price_asc}</option>
                <option value="verified_first">
                  {t.sortBy.verified_first}
                </option>
                <option value="new_profiles">{t.sortBy.new_profiles}</option>
              </select>
            </div>
          </div>

          {/* CAS 1 : k-anonymat sous le seuil k=5 (RG57, RG58, RG59, RG60) */}
          {searchResponse?.isBlockedByKAnonymity ? (
            <div className="p-8 bg-surface-card border border-border-default rounded-xl shadow-sm text-center space-y-6">
              <div className="w-14 h-14 rounded-full bg-brand-subtle-bg border border-brand-subtle-border flex items-center justify-center mx-auto text-2xl text-text-brand">
                🛡️
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-lg font-bold text-text-primary">
                  {t.kAnonymity.underThresholdTitle}
                </h3>
                {/* Message strict RG58 identique pour 0 et pour 4 résultats */}
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t.kAnonymity.underThresholdMessage}
                </p>
              </div>

              {/* Suggestions statiques d'élargissement (RG60) */}
              <div className="max-w-lg mx-auto p-4 bg-surface-raised rounded-lg border border-border-subtle text-left space-y-3">
                <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider block">
                  {t.kAnonymity.broadenSuggestionsTitle}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyBroadening("price")}
                    className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-default rounded-md text-xs text-text-primary transition-colors"
                  >
                    ↳ {t.kAnonymity.suggestions.remove_price_filter}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyBroadening("audience")}
                    className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-default rounded-md text-xs text-text-primary transition-colors"
                  >
                    ↳ {t.kAnonymity.suggestions.broaden_audience_band}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyBroadening("country")}
                    className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-default rounded-md text-xs text-text-primary transition-colors"
                  >
                    ↳ {t.kAnonymity.suggestions.add_neighbor_country}
                  </button>
                </div>
              </div>

              {/* Porte de sortie commerciale : Demande équipe INFLUX (RG61) */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowTeamSelection(true)}
                  className="px-6 py-3 bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action font-semibold text-xs rounded-lg shadow-md transition-colors inline-flex items-center gap-2"
                >
                  <span>🤝</span>
                  <span>{t.kAnonymity.requestTeamSelectionButton}</span>
                </button>
              </div>
            </div>
          ) : (
            /* CAS 2 : Résultats affichés au-dessus du seuil (k >= 5) */
            <>
              {loading ? (
                <div className="py-20 text-center text-sm text-text-tertiary">
                  Actualisation des résultats...
                </div>
              ) : searchResponse?.items && searchResponse.items.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {searchResponse.items.map((creator) => (
                    <AnonymizedCreatorCard
                      key={creator.creatorAccountId}
                      creator={creator}
                      locale={locale}
                      onViewDetail={(c) => setDetailCreator(c)}
                      onShortlist={(c) => setShortlistCreator(c)}
                      onIntroduce={(c) => setIntroCreator(c)}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-12 bg-surface-card border border-border-default rounded-xl text-center space-y-3">
                  <p className="text-sm text-text-secondary">
                    Aucun profil correspondant à ces critères.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowTeamSelection(true)}
                    className="text-xs text-text-brand hover:underline font-medium"
                  >
                    Confier votre recherche à notre équipe
                  </button>
                </div>
              )}

              {/* Pagination plafonnée à 5 pages max (RG63) */}
              {searchResponse && searchResponse.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 bg-surface-card border border-border-default rounded-xl text-xs">
                  <span className="text-text-tertiary">
                    {t.pagination.page} {searchResponse.page} {t.pagination.of}{" "}
                    {searchResponse.totalPages}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t.pagination.previous}
                    </button>
                    <button
                      type="button"
                      disabled={page >= searchResponse.totalPages || page >= 5}
                      onClick={() =>
                        setPage((p) =>
                          Math.min(searchResponse.totalPages, p + 1),
                        )
                      }
                      className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {t.pagination.next}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modale d'affichage détaillé étanche (RG50) */}
      {detailCreator && (
        <CreatorDetailModal
          creator={detailCreator}
          searchQueryId={searchResponse?.searchQueryId}
          locale={locale}
          onClose={() => setDetailCreator(null)}
          onShortlist={(c) => {
            setDetailCreator(null);
            setShortlistCreator(c);
          }}
          onIntroduce={(c) => {
            setDetailCreator(null);
            setIntroCreator(c);
          }}
        />
      )}

      {/* Modale d'ajout à une sélection privée (RG51) */}
      {shortlistCreator && (
        <ShortlistModal
          creator={shortlistCreator}
          locale={locale}
          onClose={() => setShortlistCreator(null)}
        />
      )}

      {/* Modale de demande de mise en relation (RG52) */}
      {introCreator && (
        <IntroductionRequestModal
          creator={introCreator}
          searchQueryId={searchResponse?.searchQueryId}
          defaultCampaignId={campaignIdParam}
          locale={locale}
          onClose={() => setIntroCreator(null)}
          onSuccess={() => executeSearch()}
        />
      )}

      {/* Modale de demande de sélection par l'équipe (RG61) */}
      {showTeamSelection && (
        <TeamSelectionModal
          filters={filters}
          campaignId={campaignIdParam}
          locale={locale}
          onClose={() => setShowTeamSelection(false)}
        />
      )}
    </div>
  );
}

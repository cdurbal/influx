"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  type IdentifiedCreatorCard,
  type CreatorSearchFilters,
  type CreatorSearchResponse,
  type SearchSortCode,
} from "@influx/contracts";
import { bo } from "@/locales/bo-labels";
import { IdentifiedCreatorTable } from "@/components/creators/IdentifiedCreatorTable";

function BackofficeCreatorSearchContent() {
  const searchParams = useSearchParams();
  const campaignIdParam = searchParams.get("campaignId") || undefined;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [filters, setFilters] = useState<CreatorSearchFilters>({
    currency: "EUR",
    includeOtherCurrencies: true,
    campaignId: campaignIdParam,
  });
  const [sort, setSort] = useState<SearchSortCode>("default");
  const [page, setPage] = useState<number>(1);
  const [searchResponse, setSearchResponse] =
    useState<CreatorSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState<string | undefined>();

  // 1. Contrôle de session agent backoffice
  const checkAgentAuth = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.role === "agent" || data.role === "admin") {
          setIsAuthenticated(true);
          return;
        }
      }
      setIsAuthenticated(false);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAgentAuth();
  }, [checkAgentAuth]);

  // Connexion rapide démo agent commercial (Alexandre INFLUX)
  const handleAgentDemoLogin = async () => {
    try {
      setAuthLoading(true);
      const res = await fetch("/api/auth/backoffice/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alexandre@influx.io",
          code: "123456",
        }),
        credentials: "include",
      });
      if (res.ok) {
        await checkAgentAuth();
      }
    } catch {
      // Silencieux
    } finally {
      setAuthLoading(false);
    }
  };

  // 2. Recherche en vue commerciale identifiée (RG71)
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
          viewMode: "agent_identified", // Mode privilégié agent
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || `Erreur de recherche identifiée (${res.status}).`,
        );
      }

      const json: CreatorSearchResponse = await res.json();
      setSearchResponse(json);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, filters, sort, page]);

  useEffect(() => {
    if (isAuthenticated) {
      executeSearch();
    }
  }, [isAuthenticated, executeSearch]);

  // Récupérer le titre de la campagne si pont actif
  useEffect(() => {
    if (campaignIdParam) {
      fetch(`/api/search/campaign-bridge/${campaignIdParam}`, {
        credentials: "include",
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.title) setCampaignTitle(data.title);
        })
        .catch(() => {});
    } else {
      setCampaignTitle(undefined);
    }
  }, [campaignIdParam]);

  if (authLoading) {
    return (
      <div className="py-24 text-center text-text-tertiary text-sm">
        Vérification des accès commerciaux...
      </div>
    );
  }

  // Si agent non connecté
  if (isAuthenticated === false) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="p-8 bg-surface-card border border-border-default rounded-xl shadow-lg text-center space-y-4">
          <span className="text-3xl">🔒</span>
          <div>
            <h1 className="text-base font-bold text-text-primary">
              Accès réservé aux agents INFLUX
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Cette recherche en vue identifiée requiert un compte commercial ou
              administrateur.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={handleAgentDemoLogin}
              className="px-4 py-2 bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold rounded-lg transition-colors"
            >
              Connexion Démo (Alexandre · Commercial)
            </button>
            <Link
              href="/login"
              className="px-4 py-2 border border-border-default hover:bg-surface-raised text-text-primary text-xs font-medium rounded-lg transition-colors"
            >
              Se connecter avec un compte existant
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-text-primary">
              {bo.identifiedSearch.title}
            </h1>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-surface-muted text-brand-primary border border-border-default uppercase">
              RG71 · Agent View
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {bo.identifiedSearch.subtitle}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Tableau de créateurs en vue identifiée */}
      <IdentifiedCreatorTable
        creators={(searchResponse?.items || []) as IdentifiedCreatorCard[]}
        exactTotal={searchResponse?.exactTotal}
        loading={loading}
        filters={filters}
        onFilterChange={(updated) => {
          setFilters(updated);
          setPage(1);
        }}
        onResetFilters={() => {
          setFilters({
            currency: "EUR",
            includeOtherCurrencies: true,
          });
          setPage(1);
        }}
        sort={sort}
        onSortChange={(newSort) => {
          setSort(newSort);
          setPage(1);
        }}
        page={page}
        totalPages={searchResponse?.totalPages || 1}
        onPageChange={(p) => setPage(p)}
        campaignBridgeTitle={campaignTitle}
        onClearBridge={() => {
          setFilters((prev) => ({ ...prev, campaignId: undefined }));
          setCampaignTitle(undefined);
        }}
        onProposalSuccess={() => executeSearch()}
      />
    </div>
  );
}

export default function BackofficeCreatorSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-text-tertiary text-sm">
          Chargement de la recherche identifiée...
        </div>
      }
    >
      <BackofficeCreatorSearchContent />
    </Suspense>
  );
}

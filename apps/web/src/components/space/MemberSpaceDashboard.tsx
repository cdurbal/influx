"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface MemberSpaceDashboardProps {
  locale: string;
}

interface AuthUser {
  id: string;
  email: string;
  role: "advertiser" | "creator" | "agent" | "admin";
  status: string;
}

export function MemberSpaceDashboard({ locale }: MemberSpaceDashboardProps) {
  const isEn = locale === "en";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loginLoading, setLoginLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "advertiser" | "creator">(
    "all",
  );

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const account = data.account || data.user || null;
        setUser(account);
        if (account?.role === "advertiser" || account?.role === "creator") {
          setActiveTab(account.role);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initialisation immédiate depuis le persona DEV MOCK si disponible
    try {
      const saved = localStorage.getItem("influx_mock_persona");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.role === "advertiser" || parsed?.role === "creator") {
          setUser({
            id: parsed.id || "user",
            email: parsed.email || "",
            role: parsed.role,
            status: "active",
          });
          setActiveTab(parsed.role);
        }
      }
    } catch {
      // Ignorer
    }

    checkAuth();
  }, [checkAuth]);

  const handleDemoLogin = async (role: "advertiser" | "creator") => {
    const email =
      role === "advertiser" ? "contact@maisonsolene.fr" : "lucas@lucastech.fr";
    setLoginLoading(role);
    try {
      // 1. Envoyer le code OTP
      await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      // 2. Vérifier le code OTP
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: "123456" }),
      });

      if (res.ok) {
        await checkAuth();
      }
    } catch {
      // Silencieux
    } finally {
      setLoginLoading(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      setActiveTab("all");
    } catch {
      // Silencieux
    }
  };

  const isAdvertiser = user?.role === "advertiser";
  const isCreator = user?.role === "creator";
  const isBackoffice = user?.role === "admin" || user?.role === "agent";

  // Règle d'affichage stricte :
  // - Pour les marques : UNIQUEMENT l'espace annonceur
  // - Pour les créateurs : UNIQUEMENT l'espace créateur
  // - Pour les visiteurs non-connectés ou agents backoffice : onglets de sélection
  const showAdvertiserSection =
    isAdvertiser ||
    (!isCreator && (activeTab === "all" || activeTab === "advertiser"));
  const showCreatorSection =
    isCreator ||
    (!isAdvertiser && (activeTab === "all" || activeTab === "creator"));
  const showFilterTabs = !user || isBackoffice;
  const showBackofficeGateway = !user || isBackoffice;

  return (
    <div className="space-y-8">
      {/* 1. Bandeau Utilisateur / Connexion Démo */}
      <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
        {loading ? (
          <div className="text-center py-4 text-xs text-text-tertiary">
            {isEn ? "Checking session..." : "Vérification de la session..."}
          </div>
        ) : user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-primary" />
                <span className="font-bold text-text-primary text-md">
                  {user.email}
                </span>
                <span className="rounded bg-brand-subtle-bg border border-brand-subtle-border px-2 py-0.5 text-xs font-semibold text-text-brand uppercase tracking-wider">
                  {user.role === "advertiser"
                    ? isEn
                      ? "Brand / Advertiser"
                      : "Marque / Annonceur"
                    : isEn
                      ? "Creator"
                      : "Créateur"}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {isEn
                  ? "Connected session. You have full access to your dedicated workspace."
                  : "Session active. Vous disposez des accès complets à vos espaces de travail."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={
                  user.role === "creator"
                    ? `/${locale}/creator/profile`
                    : `/${locale}/advertiser/profile`
                }
                className="rounded-lg bg-action-primary-bg px-4 py-2 text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                <span aria-hidden="true">👤</span>
                <span>
                  {user.role === "creator"
                    ? isEn
                      ? "My Creator Profile"
                      : "Mon Profil Créateur"
                    : isEn
                      ? "My Brand Profile"
                      : "Mon Profil Marque"}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                {isEn ? "Log out" : "Se déconnecter"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-text-primary text-md flex items-center gap-2">
                  <span>⚡</span>
                  <span>
                    {isEn
                      ? "Quick Demo Access (1-click)"
                      : "Connexion Rapide Démo (1 clic)"}
                  </span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  {isEn
                    ? "Log in instantly with pre-configured accounts to test brand campaigns, anonymized search, or creator opportunities."
                    : "Connectez-vous en un clic avec nos comptes de démonstration pour tester les parcours Marque et Créateur."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("advertiser")}
                  disabled={loginLoading !== null}
                  className="rounded-lg bg-action-primary-bg px-4 py-2 text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {loginLoading === "advertiser"
                    ? isEn
                      ? "Connecting..."
                      : "Connexion..."
                    : isEn
                      ? "💼 Login as Brand (Maison Solène)"
                      : "💼 Compte Marque (Maison Solène)"}
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLogin("creator")}
                  disabled={loginLoading !== null}
                  className="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loginLoading === "creator"
                    ? isEn
                      ? "Connecting..."
                      : "Connexion..."
                    : isEn
                      ? "🎨 Login as Creator (Lucas Tech)"
                      : "🎨 Compte Créateur (Lucas Tech)"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filtres / Onglets de Vue (uniquement si non connecté ou rôle backoffice) */}
      {showFilterTabs && (
        <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "all"
                ? "bg-action-primary-bg text-text-on-action"
                : "text-text-secondary hover:text-text-primary bg-surface-raised"
            }`}
          >
            {isEn ? "All Features" : "Toutes les fonctionnalités"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("advertiser")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "advertiser"
                ? "bg-action-primary-bg text-text-on-action"
                : "text-text-secondary hover:text-text-primary bg-surface-raised"
            }`}
          >
            {isEn ? "💼 Advertiser Space" : "💼 Espace Annonceur"}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("creator")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "creator"
                ? "bg-action-primary-bg text-text-on-action"
                : "text-text-secondary hover:text-text-primary bg-surface-raised"
            }`}
          >
            {isEn ? "🎨 Creator Space" : "🎨 Espace Créateur"}
          </button>
        </div>
      )}

      {/* 3. Section Annonceur / Marque (affichée uniquement pour les marques ou onglet annonceur) */}
      {showAdvertiserSection && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-text-primary flex items-center gap-2">
              <span>💼</span>
              <span>
                {isEn
                  ? "Brand & Advertiser Space"
                  : "Espace Annonceur / Marque"}
              </span>
            </h2>
            <span className="text-xs text-text-tertiary">
              {isEn
                ? "Lot 2 & Lot 3 (Missions 3.3 & 3.5)"
                : "Lot 2 & Lot 3 (Missions 3.3 & 3.5)"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Carte 1 : Recherche de créateurs */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">🎯</span>
                  <span className="rounded bg-brand-subtle-bg border border-brand-subtle-border px-2 py-0.5 text-xs font-medium text-text-brand">
                    k-Anonymat k=5
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn
                    ? "Anonymized Creator Search"
                    : "Recherche de Créateurs"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Search certified creators tailored to your audience criteria with strict k-anonymity (k=5), deterministic sorting, shortlist and intro requests."
                    : "Trouvez des créateurs certifiés avec filtres facettés F1-F17, k-anonymat strict (k=5), explications de tri, shortlists privées et demande d'intermédiation."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle">
                <Link
                  href={`/${locale}/advertiser/creators`}
                  className="block w-full rounded-lg bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm"
                >
                  {isEn ? "Explore Search →" : "Rechercher des créateurs →"}
                </Link>
              </div>
            </div>

            {/* Carte 2 : Gestion des campagnes */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">📋</span>
                  <span className="rounded bg-surface-raised border border-border-subtle px-2 py-0.5 text-xs font-medium text-text-secondary">
                    Tableau de bord
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn ? "My Campaigns & Briefs" : "Gestion de mes Campagnes"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Manage your active campaigns, track received applications, inspect rejection reasons with recommendations, pause, resume or duplicate."
                    : "Suivez vos campagnes, inspectez les motifs de refus typés avec recommandations, suivez les candidatures et gérez le cycle de vie."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle flex gap-2">
                <Link
                  href={`/${locale}/advertiser/campaigns`}
                  className="flex-1 rounded-lg border border-border-default px-3 py-2 text-center text-xs font-semibold text-text-primary hover:bg-surface-raised transition-colors"
                >
                  {isEn ? "Dashboard" : "Mes campagnes"}
                </Link>
                <Link
                  href={`/${locale}/advertiser/campaigns/new`}
                  className="flex-1 rounded-lg bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm"
                >
                  {isEn ? "+ New brief" : "+ Nouvelle"}
                </Link>
              </div>
            </div>

            {/* Carte 3 : Profil marque */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">🏢</span>
                  <span className="rounded bg-feedback-success-bg border border-feedback-success-border px-2 py-0.5 text-xs font-medium text-feedback-success-text">
                    Badge Marque
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn ? "Brand Profile & Badge" : "Profil Marque & Badge"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Complete your company public profile, indicate your commercial point of contact (D40 symmetric masking) and request the verified badge."
                    : "Complétez l'identité de votre entreprise, définissez vos attentes, renseignez votre interlocuteur (masquage D40) et demandez le badge Marque Vérifiée."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle">
                <Link
                  href={`/${locale}/advertiser/profile`}
                  className="block w-full rounded-lg border border-border-default px-3 py-2 text-center text-xs font-semibold text-text-primary hover:bg-surface-raised transition-colors"
                >
                  {isEn ? "Edit Brand Profile →" : "Éditer mon profil marque →"}
                </Link>
              </div>
            </div>

            {/* Carte 4 : Messagerie à trois */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">💬</span>
                  <span className="rounded bg-brand-subtle-bg border border-brand-subtle-border px-2 py-0.5 text-xs font-medium text-text-brand">
                    Mission 4.6
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn ? "Three-Party Messaging" : "Messagerie à Trois"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Direct supervised messaging with your creators. Benefit from dedicated commercial assistance and anti-circumvention protection."
                    : "Échangez directement avec vos créateurs partenaires. Bénéficiez de l'accompagnement d'Alexandre et de la détection bienveillante de coordonnées."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle">
                <Link
                  href={`/${locale}/advertiser/messages`}
                  className="block w-full rounded-lg bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm"
                >
                  {isEn ? "Open Messages →" : "Accéder aux messages →"}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Section Créateur (affichée uniquement pour les créateurs ou onglet créateur) */}
      {showCreatorSection && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-text-primary flex items-center gap-2">
              <span>🎨</span>
              <span>{isEn ? "Creator Space" : "Espace Créateur"}</span>
            </h2>
            <span className="text-xs text-text-tertiary">
              {isEn
                ? "Lot 2 & Lot 3 (Mission 3.7)"
                : "Lot 2 & Lot 3 (Mission 3.7)"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Carte 1 : Fil des campagnes ouvertes */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">🚀</span>
                  <span className="rounded bg-brand-subtle-bg border border-brand-subtle-border px-2 py-0.5 text-xs font-medium text-text-brand">
                    Mission 3.7
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn ? "Open Campaigns Feed" : "Fil des Campagnes Ouvertes"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Browse opportunities published by verified brands. Filter by topic, network, formats and direct eligibility. Check estimated net earnings."
                    : "Parcourez les opportunités ouvertes par les marques vérifiées. Filtrez par thématique, réseau, format et éligibilité directe avec calcul du net estimé."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle">
                <Link
                  href={`/${locale}/creator/campaigns`}
                  className="block w-full rounded-lg bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm"
                >
                  {isEn
                    ? "Browse Campaigns Feed →"
                    : "Voir le fil des campagnes →"}
                </Link>
              </div>
            </div>

            {/* Carte 2 : Profil créateur */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">👤</span>
                  <span className="rounded bg-surface-raised border border-border-subtle px-2 py-0.5 text-xs font-medium text-text-secondary">
                    3 Couches A / I / N
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn
                    ? "Creator Profile & Rate Card"
                    : "Profil Créateur & Tarifs"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Configure your 3 sealed profile layers: Anonymous Layer A for public brands, Revealed Layer I, and Internal Layer N. Set your standard rate card."
                    : "Gérez vos 3 couches étanches (Anonyme A, Révélée I, Interne N). Renseignez votre grille tarifaire au barème standard sans commission applicative."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle">
                <Link
                  href={`/${locale}/creator/profile`}
                  className="block w-full rounded-lg border border-border-default px-3 py-2 text-center text-xs font-semibold text-text-primary hover:bg-surface-raised transition-colors"
                >
                  {isEn
                    ? "Edit Creator Profile →"
                    : "Éditer mon profil créateur →"}
                </Link>
              </div>
            </div>

            {/* Carte 3 : Fiches de campagnes démo directes */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">🔍</span>
                  <span className="rounded bg-feedback-info-bg border border-feedback-info-border px-2 py-0.5 text-xs font-medium text-feedback-info-text">
                    Briefs en direct
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn ? "Featured Brand Briefs" : "Fiches de Briefs Ouverts"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Direct access to real seeded campaign briefs to inspect deliverables, usage rights, zero direct contact D40 rule, and estimated remuneration."
                    : "Accédez directement aux deux campagnes en ligne pour inspecter les livrables, droits d'usage, fiche marque sans contact direct (D40) et calendrier."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle flex flex-col gap-2">
                <Link
                  href={`/${locale}/creator/campaigns/c1111111-1111-4111-8111-111111111111`}
                  className="rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors truncate"
                >
                  🌿 Soin Botanique Bio (Maison Solène) →
                </Link>
                <Link
                  href={`/${locale}/creator/campaigns/c2222222-2222-4222-8222-222222222222`}
                  className="rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-hover transition-colors truncate"
                >
                  ⚡ Chargeur GaN 120W (TechGear) →
                </Link>
              </div>
            </div>

            {/* Carte 4 : Messagerie à trois */}
            <div className="flex flex-col justify-between rounded-xl border border-border-default bg-surface-card p-5 shadow-sm hover:border-border-strong transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-heading-3">💬</span>
                  <span className="rounded bg-brand-subtle-bg border border-brand-subtle-border px-2 py-0.5 text-xs font-medium text-text-brand">
                    Mission 4.6
                  </span>
                </div>
                <h3 className="font-semibold text-text-primary text-md">
                  {isEn ? "Three-Party Messaging" : "Messagerie à Trois"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Direct supervised messaging with verified brands alongside your dedicated INFLUX commercial advisor."
                    : "Échangez directement avec les marques vérifiées. Cadrage sécurisé des livrables et accompagnement d'Alexandre."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-border-subtle">
                <Link
                  href={`/${locale}/creator/messages`}
                  className="block w-full rounded-lg bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm"
                >
                  {isEn ? "Open Messages →" : "Accéder aux messages →"}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. Passerelle Backoffice Commercial (affiché aux visiteurs démo ou agents/admins) */}
      {showBackofficeGateway && (
        <div className="rounded-xl border border-brand-subtle-border bg-brand-subtle-bg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-text-primary">
                {isEn
                  ? "🛡️ Commercial Backoffice (Port 3002)"
                  : "🛡️ Espace Backoffice Commercial (Port 3002)"}
              </span>
              <span className="rounded bg-surface-card border border-border-subtle px-2 py-0.5 text-xs text-text-tertiary">
                File 7 & Recherche Identifiée
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              {isEn
                ? "Access File 7 (Campaign Moderation) and Identified Creator Search reserved for INFLUX commercial agents."
                : "Accédez à la File 7 de modération commerciale des campagnes et à la recherche identifiée des créateurs (agents INFLUX)."}
            </p>
          </div>

          <a
            href={
              process.env.NEXT_PUBLIC_BACKOFFICE_URL
                ? `${process.env.NEXT_PUBLIC_BACKOFFICE_URL}/queues/campaigns`
                : "http://localhost:3002/queues/campaigns"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-surface-card border border-border-selected px-4 py-2 text-xs font-semibold text-text-brand hover:bg-surface-raised transition-colors"
          >
            {isEn ? "Open Backoffice ↗" : "Ouvrir le Backoffice ↗"}
          </a>
        </div>
      )}
    </div>
  );
}

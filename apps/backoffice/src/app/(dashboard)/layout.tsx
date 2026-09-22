"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bo } from "@/locales/bo-labels";
import {
  ensureAgentSession,
  loginAgentDemo,
  clearStoredAgentToken,
} from "@/lib/api-client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    ensureAgentSession().then((authenticated) => {
      setIsAuthenticated(authenticated);
    });
  }, []);

  const handleQuickLogin = async () => {
    setIsLoggingIn(true);
    const result = await loginAgentDemo();
    setIsLoggingIn(false);
    if (result.success) {
      setIsAuthenticated(true);
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignorer
    }
    clearStoredAgentToken();
    window.location.href = "/login";
  };

  const navItems = [
    { label: bo.nav.dashboard, href: "#", badge: null },
    {
      label: "File 4 · Badges",
      href: "/queues/verification",
      badge: "Niv. 1 & 2",
      active: pathname.startsWith("/queues/verification"),
    },
    {
      label: "File 7 · Campagnes",
      href: "/queues/campaigns",
      badge: "Modération",
      active: pathname.startsWith("/queues/campaigns"),
    },
    {
      label: "File 8 · Mises en relation",
      href: "/queues/introductions",
      badge: "Validation",
      active: pathname.startsWith("/queues/introductions"),
    },
    {
      label: "Négociations (Fil à 3)",
      href: "/messages",
      badge: "Supervisé",
      active: pathname.startsWith("/messages"),
    },
    { label: bo.nav.accounts, href: "#", badge: null },
    {
      label: "Créateurs (Identifié)",
      href: "/creators/search",
      badge: "Vue réelle",
      active: pathname.startsWith("/creators/search"),
    },
    { label: bo.nav.deals, href: "#", badge: null },
    { label: bo.nav.alerts, href: "#", badge: null },
    { label: bo.nav.admin, href: "#", badge: null },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      {/* 17b §1.4 & §6.4 : Bandeau permanent d'environnement non-production */}
      <div
        role="region"
        aria-label="Bandeau d'environnement"
        className="w-full bg-feedback-warning-bg text-feedback-warning-text border-b border-feedback-warning-border py-1 px-4 text-center text-xs font-semibold tracking-wider uppercase select-none"
      >
        {bo.env.nonProdBanner}
      </div>

      {/* Bandeau d'alerte si non authentifié */}
      {isAuthenticated === false && (
        <div className="w-full bg-feedback-error-bg text-feedback-error-text border-b border-feedback-error-border py-2 px-6 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>
              Session agent non détectée. Vous devez être authentifié pour
              accéder aux données des files.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleQuickLogin}
              disabled={isLoggingIn}
              className="px-3 py-1 rounded bg-action-primary-bg text-text-on-action font-bold hover:bg-action-primary-bg-hover transition-colors cursor-pointer"
            >
              {isLoggingIn ? "Connexion..." : "Connexion Démo (Alexandre)"}
            </button>
            <Link
              href="/login"
              className="text-text-primary underline hover:text-white"
            >
              Page de connexion
            </Link>
          </div>
        </div>
      )}

      {/* Barre supérieure */}
      <header className="h-14 border-b border-border-default bg-surface-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-text-primary">
              INFLUX
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
              Backoffice
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            Journalisé
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="font-semibold text-text-primary block">
              Alexandre Martin
            </span>
            <span className="text-text-tertiary">
              Commercial INFLUX · Rôle : agent
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border flex items-center justify-center font-bold text-xs">
            AM
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Se déconnecter"
            className="text-[11px] text-text-tertiary hover:text-feedback-error-text transition-colors cursor-pointer ml-1"
          >
            Quitter
          </button>
        </div>
      </header>

      {/* Disposition principale avec Rail de navigation (17b §1.2) */}
      <div className="flex-1 flex">
        {/* Rail de navigation */}
        <aside
          aria-label="Rail de navigation principal"
          className="w-60 shrink-0 border-r border-border-default bg-surface-card p-4 flex flex-col justify-between hidden md:flex"
        >
          <nav className="flex flex-col gap-1.5 text-xs">
            {navItems.map((item) => {
              const isActive =
                item.active ?? (item.href !== "#" && pathname === item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? "bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border shadow-xs"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                        isActive
                          ? "bg-brand-primary text-surface-page"
                          : "bg-surface-muted text-text-tertiary border border-border-default"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 bg-surface-muted rounded-lg border border-border-subtle text-[11px] text-text-tertiary">
            <p className="font-semibold text-text-secondary mb-1">
              Actions attribuées
            </p>
            <p>
              Toute décision ou ouverture de pièce fait foi dans le registre
              d&apos;audit (15 RG1, RG35).
            </p>
          </div>
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}

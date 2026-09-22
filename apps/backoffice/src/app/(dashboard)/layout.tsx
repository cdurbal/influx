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

  // Sections de navigation style Linear
  const navSections = [
    {
      title: "Vue d'ensemble",
      items: [
        {
          label: "Tableau de Bord",
          href: "/",
          badge: "Live",
          badgeColor: "green",
          active: pathname === "/",
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Files d'Attente (16 Files)",
      items: [
        {
          label: "Hub des 16 Files",
          href: "/queues",
          badge: "5 Groupes",
          badgeColor: "default",
          active: pathname === "/queues",
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
              <path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5" />
              <path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5" />
            </svg>
          ),
        },
        {
          label: "File 4 · Badges & Certif.",
          href: "/queues/verification",
          badge: "Niv. 1 & 2",
          badgeColor: "purple",
          active: pathname.startsWith("/queues/verification"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          ),
        },
        {
          label: "File 7 · Campagnes Marques",
          href: "/queues/campaigns",
          badge: "Modération",
          badgeColor: "amber",
          active: pathname.startsWith("/queues/campaigns"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 11 18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          ),
        },
        {
          label: "File 8 · Mises en Relation",
          href: "/queues/introductions",
          badge: "CA Prioritaire",
          badgeColor: "green",
          active: pathname.startsWith("/queues/introductions"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Pipeline & Négociations",
      items: [
        {
          label: "Pipeline Kanban Affaires",
          href: "/deals",
          badge: "7 Étapes",
          badgeColor: "default",
          active: pathname.startsWith("/deals"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
          ),
        },
        {
          label: "Négociations (Fil à 3)",
          href: "/messages",
          badge: "Supervisé",
          badgeColor: "default",
          active: pathname.startsWith("/messages"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Outils & Découverte",
      items: [
        {
          label: "Créateurs (Vue Réelle)",
          href: "/creators/search",
          badge: "Identifié",
          badgeColor: "purple",
          active: pathname.startsWith("/creators/search"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          ),
        },
        {
          label: "E-mails Brevo",
          href: "/emails",
          badge: "Outreach",
          badgeColor: "default",
          active: pathname.startsWith("/emails"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          ),
        },
        {
          label: "Leads Outbox",
          href: "/leads",
          badge: "Sync",
          badgeColor: "default",
          active: pathname.startsWith("/leads"),
          icon: (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#08090b] text-[#f4f4f5]">
      {/* 1. Header supérieur moderne Linear */}
      <header className="h-[52px] border-b border-[rgba(255,255,255,0.07)] bg-[rgba(13,14,18,0.85)] backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between z-30 sticky top-0">
        {/* Logo & Indicateurs */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-decoration-none group"
          >
            <div className="w-7 h-7 rounded-lg bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.3)] flex items-center justify-center text-[#22c55e] shadow-[0_0_10px_rgba(34,197,94,0.2)]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-white group-hover:text-[#22c55e] transition-colors">
                INFLUX
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.05)] text-[#a1a1aa] border border-[rgba(255,255,255,0.08)]">
                Console
              </span>
            </div>
          </Link>

          <span className="text-[rgba(255,255,255,0.15)] hidden sm:inline">
            |
          </span>

          {/* Voyant en direct */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#8a8f98] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.06)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e] animate-pulse" />
            <span>En direct</span>
            <span className="text-[rgba(255,255,255,0.2)]">·</span>
            <span>Journalisé (SHA-256)</span>
          </div>
        </div>

        {/* Droite : Bandeau Démo discret & Profil agent */}
        <div className="flex items-center gap-3">
          {/* Badge démo non-prod élégant */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-medium text-[#fbbf24] bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.25)] px-2.5 py-0.5 rounded-full">
            <span>⚡</span>
            <span>
              {bo.env.nonProdBanner ||
                "Environnement Démo Commerciale (Mode Mocké)"}
            </span>
          </div>

          {/* Profil utilisateur Alexandre Martin */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-[rgba(255,255,255,0.08)]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#059669] to-[#047857] text-white flex items-center justify-center font-bold text-[10px] shadow-sm border border-[rgba(255,255,255,0.15)]">
              AM
            </div>
            <div className="hidden sm:block text-left">
              <span className="font-medium text-xs text-[#f4f4f5] block leading-none">
                Alexandre Martin
              </span>
              <span className="text-[10px] text-[#8a8f98] leading-tight">
                Commercial · Agent
              </span>
            </div>

            {/* Bouton déconnexion */}
            <button
              type="button"
              onClick={handleLogout}
              title="Se déconnecter"
              className="text-[11px] text-[#8a8f98] hover:text-[#f87171] hover:bg-[rgba(239,68,68,0.1)] p-1.5 rounded-md transition-colors cursor-pointer ml-1"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Alerte si non authentifié */}
      {isAuthenticated === false && (
        <div className="w-full bg-[rgba(239,68,68,0.1)] text-[#fca5a5] border-b border-[rgba(239,68,68,0.25)] py-2 px-6 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>
              Session agent non détectée. Veuillez vous connecter pour manipuler
              les données.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleQuickLogin}
              disabled={isLoggingIn}
              className="px-3 py-1 rounded bg-[#22c55e] text-black font-semibold hover:bg-[#16a34a] transition-colors cursor-pointer"
            >
              {isLoggingIn ? "Connexion..." : "Connexion Démo (Alexandre)"}
            </button>
            <Link
              href="/login"
              className="text-white underline hover:text-[#22c55e]"
            >
              Page de login
            </Link>
          </div>
        </div>
      )}

      {/* 2. Contenu principal avec Sidebar Linear */}
      <div className="flex-1 flex overflow-hidden">
        {/* Rail de navigation gauche (Rigide 240px) */}
        <aside
          aria-label="Navigation principale"
          className="w-60 shrink-0 border-r border-[rgba(255,255,255,0.07)] bg-[rgba(13,14,18,0.95)] backdrop-blur-xl p-3 flex flex-col justify-between hidden md:flex overflow-y-auto"
        >
          <div className="flex flex-col gap-5">
            {navSections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#636875]">
                  {section.title}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
                    const isActive = item.active;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "bg-[rgba(255,255,255,0.07)] text-white shadow-xs border border-[rgba(255,255,255,0.12)]"
                            : "text-[#949ca8] hover:text-[#f4f4f5] hover:bg-[rgba(255,255,255,0.03)] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={
                              isActive ? "text-[#22c55e]" : "text-[#717682]"
                            }
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              item.badgeColor === "green"
                                ? "bg-[rgba(34,197,94,0.12)] text-[#4ade80] border border-[rgba(34,197,94,0.3)]"
                                : item.badgeColor === "purple"
                                  ? "bg-[rgba(168,85,247,0.12)] text-[#c084fc] border border-[rgba(168,85,247,0.3)]"
                                  : item.badgeColor === "amber"
                                    ? "bg-[rgba(245,158,11,0.12)] text-[#fbbf24] border border-[rgba(245,158,11,0.3)]"
                                    : "bg-[rgba(255,255,255,0.05)] text-[#8a8f98] border border-[rgba(255,255,255,0.08)]"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Encadré d'audit juridique (Doc 15, RG1/RG35) */}
          <div className="p-3 bg-[rgba(255,255,255,0.02)] rounded-lg border border-[rgba(255,255,255,0.06)] text-[11px] text-[#717682] mt-4">
            <div className="flex items-center gap-1.5 text-white font-medium mb-1">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#22c55e]"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Registre d&apos;Audit Actif</span>
            </div>
            <p className="leading-snug">
              Toute décision ou ouverture de pièce est journalisée sous
              signature cryptographique (RG1, RG35).
            </p>
          </div>
        </aside>

        {/* 3. Surface de page principale */}
        <main className="flex-1 overflow-y-auto bg-[#08090b] min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

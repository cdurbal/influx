"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { bo } from "@/locales/bo-labels";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { label: bo.nav.dashboard, href: "#", badge: null },
    {
      label: bo.nav.queues,
      href: "/queues/verification",
      badge: "File 4",
      active: pathname.startsWith("/queues"),
    },
    { label: bo.nav.accounts, href: "#", badge: null },
    { label: bo.nav.creatorSearch, href: "#", badge: null },
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

      {/* Barre supérieure */}
      <header className="h-14 border-b border-border-default bg-surface-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-text-primary">
              INFLUX
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-surface-muted text-brand-primary border border-border-default">
              Backoffice
            </span>
          </div>
          <span className="text-xs text-text-tertiary">▮ Journalisé</span>
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
        </div>
      </header>

      {/* Disposition principale avec Rail de navigation (17b §1.2) */}
      <div className="flex-1 flex">
        {/* Rail de navigation */}
        <aside
          aria-label="Rail de navigation principal"
          className="w-56 border-r border-border-default bg-surface-card/60 p-4 flex flex-col justify-between hidden md:flex"
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
                      ? "bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
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

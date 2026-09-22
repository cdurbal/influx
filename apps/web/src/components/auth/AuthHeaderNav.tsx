"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";

interface AuthHeaderNavProps {
  locale: string;
  initialRole?: "advertiser" | "creator";
}

export function AuthHeaderNav({ locale, initialRole }: AuthHeaderNavProps) {
  const pathname = usePathname() || "";
  const isEn = locale === "en";

  const isAdvertiserRoute = pathname.includes("/advertiser");
  const isCreatorRoute = pathname.includes("/creator");

  const [role, setRole] = useState<"advertiser" | "creator" | null>(() => {
    if (initialRole) return initialRole;
    if (isAdvertiserRoute) return "advertiser";
    if (isCreatorRoute) return "creator";
    return null;
  });

  useEffect(() => {
    if (isAdvertiserRoute) {
      setRole("advertiser");
      return;
    }
    if (isCreatorRoute) {
      setRole("creator");
      return;
    }

    // Si on est sur /space ou une autre route neutre, récupérer le rôle actif depuis la session / persona
    try {
      const saved = localStorage.getItem("influx_mock_persona");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.role === "advertiser" || parsed.role === "creator") {
          setRole(parsed.role);
          return;
        }
      }
    } catch {
      // Ignore JSON error
    }

    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const userRole = data?.account?.role || data?.user?.role;
        if (userRole === "advertiser" || userRole === "creator") {
          setRole(userRole);
        }
      })
      .catch(() => {});
  }, [pathname, isAdvertiserRoute, isCreatorRoute]);

  // Si annonceur (par route ou par compte connecté)
  const isAdvertiser =
    role === "advertiser" || (isAdvertiserRoute && !isCreatorRoute);

  return (
    <nav aria-label="Espace membre" className="flex items-center gap-2 ml-2">
      <Link
        href="/space"
        className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors shadow-xs"
      >
        <span aria-hidden="true">🏠</span>
        <span>{isEn ? "Member Space (Hub)" : "Mon Espace (Hub)"}</span>
      </Link>

      {isAdvertiser ? (
        <>
          <Link
            href="/advertiser/creators"
            className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pathname.includes("/advertiser/creators")
                ? "bg-brand-subtle-bg text-text-brand font-semibold border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <span>🔍</span>
            <span>{isEn ? "Creator Search" : "Recherche de Créateurs"}</span>
          </Link>
          <Link
            href="/advertiser/campaigns"
            className={`hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pathname.includes("/advertiser/campaigns")
                ? "bg-brand-subtle-bg text-text-brand font-semibold border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <span>{isEn ? "My Campaigns" : "Mes Campagnes"}</span>
          </Link>
          <Link
            href="/advertiser/messages"
            className={`hidden lg:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pathname.includes("/advertiser/messages")
                ? "bg-brand-subtle-bg text-text-brand font-semibold border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <span>💬</span>
            <span>{isEn ? "Messages" : "Messagerie à 3"}</span>
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/creator/campaigns"
            className={`hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pathname.includes("/creator/campaigns")
                ? "bg-brand-subtle-bg text-text-brand font-semibold border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <span>{isEn ? "Opportunities" : "Opportunités"}</span>
          </Link>
          <Link
            href="/creator/messages"
            className={`hidden lg:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pathname.includes("/creator/messages")
                ? "bg-brand-subtle-bg text-text-brand font-semibold border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <span>💬</span>
            <span>{isEn ? "Messages" : "Messagerie à 3"}</span>
          </Link>
          <Link
            href="/creator/profile"
            className={`hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              pathname.includes("/creator/profile")
                ? "bg-brand-subtle-bg text-text-brand font-semibold border border-brand-subtle-border"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            }`}
          >
            <span>{isEn ? "My Profile" : "Mon Profil"}</span>
          </Link>
        </>
      )}
    </nav>
  );
}

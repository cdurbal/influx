"use client";

import React, { useState } from "react";

export interface TwitterVerifiedBadgeProps {
  type?: "audience" | "identity" | "full";
  verifiedDate?: string | null;
  className?: string;
}

/**
 * Badge de vérification officiel style Twitter / X (rosette bleue dentelée avec coche blanche)
 * avec tooltip explicatif complet au survol (hover / focus).
 */
export function TwitterVerifiedBadge({
  type = "full",
  verifiedDate,
  className = "w-5 h-5",
}: TwitterVerifiedBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const title =
    type === "audience"
      ? "Audience certifiée par INFLUX"
      : type === "identity"
        ? "Identité certifiée par INFLUX"
        : "Profil & Audience certifiés INFLUX";

  const description =
    type === "audience"
      ? "Les statistiques de portée, de démographie et d'engagement de ce créateur ont été auditées et validées par nos équipes commerciales (< 90 jours)."
      : type === "identity"
        ? "L'identité et la propriété des réseaux sociaux de ce créateur ont été vérifiées et authentifiées."
        : "Identité authentifiée et audience auditée : statistiques réelles, engagement vérifié et absence totale de faux abonnés.";

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="button"
      aria-label={`${title} : ${description}`}
    >
      {/* Rosette bleue dentelée officielle style Twitter / X */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`${className} text-[#1d9bf0] fill-current shrink-0 cursor-pointer hover:scale-110 transition-transform`}
      >
        <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.28 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.18 2.9.81 3.91s2.52 1.28 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.47 2.9.2 3.91-.81s1.28-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.33 2.33 4.99-4.99 1.42 1.41-6.41 6.41z" />
      </svg>

      {/* Tooltip explicatif au survol (popover sombre premium) */}
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-neutral-900/95 text-white border border-neutral-700/80 rounded-xl shadow-2xl backdrop-blur-md z-50 text-left pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Petite flèche */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-neutral-900/95" />

          <div className="flex items-center gap-1.5 mb-1.5">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="w-4 h-4 text-[#1d9bf0] fill-current shrink-0"
            >
              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.28 2.52-.8 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.18 2.9.81 3.91s2.52 1.28 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.47 2.9.2 3.91-.81s1.28-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.33 2.33 4.99-4.99 1.42 1.41-6.41 6.41z" />
            </svg>
            <span className="font-bold text-xs text-white">{title}</span>
          </div>

          <p className="text-[11px] text-neutral-300 leading-relaxed">
            {description}
          </p>

          <div className="mt-2 pt-2 border-t border-neutral-800 text-[10px] text-neutral-400 flex items-center justify-between">
            <span className="text-emerald-400 font-medium">
              ✓ Audit vérifié
            </span>
            <span>
              {verifiedDate ? `Vérifié le ${verifiedDate}` : "< 90 jours"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

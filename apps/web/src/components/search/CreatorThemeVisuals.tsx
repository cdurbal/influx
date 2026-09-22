"use client";

import React from "react";
import {
  Laptop,
  Sparkles,
  Shirt,
  Dumbbell,
  UtensilsCrossed,
  Plane,
  Gamepad2,
  TrendingUp,
  Palette,
  Heart,
  Briefcase,
  Compass,
  type LucideIcon,
} from "lucide-react";

export interface ThemeConfig {
  label: string;
  icon: LucideIcon;
  gradientClass: string;
  accentClass: string;
  badgeBg: string;
  svgPattern: React.ReactNode;
}

export const THEME_CONFIGS: Record<string, ThemeConfig> = {
  tech: {
    label: "High-Tech & Hardware",
    icon: Laptop,
    gradientClass: "from-cyan-950/80 via-slate-900 to-surface-card",
    accentClass: "text-cyan-400",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="grid-tech"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
              className="text-cyan-500"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-tech)" />
      </svg>
    ),
  },
  beauty: {
    label: "Beauté & Skincare",
    icon: Sparkles,
    gradientClass: "from-rose-950/70 via-stone-900 to-surface-card",
    accentClass: "text-rose-400",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="20%"
          cy="30%"
          r="60"
          fill="currentColor"
          className="text-rose-500/20 blur-xl"
        />
        <circle
          cx="80%"
          cy="70%"
          r="80"
          fill="currentColor"
          className="text-amber-500/15 blur-2xl"
        />
      </svg>
    ),
  },
  fashion: {
    label: "Mode & Prêt-à-porter",
    icon: Shirt,
    gradientClass: "from-violet-950/70 via-neutral-900 to-surface-card",
    accentClass: "text-violet-400",
    badgeBg: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="stripes-fashion"
            width="20"
            height="20"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="20"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-violet-500/30"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#stripes-fashion)" />
      </svg>
    ),
  },
  fitness: {
    label: "Fitness, Sport & Santé",
    icon: Dumbbell,
    gradientClass: "from-emerald-950/80 via-neutral-900 to-surface-card",
    accentClass: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="85%"
          cy="25%"
          r="70"
          fill="currentColor"
          className="text-emerald-500/20 blur-xl"
        />
      </svg>
    ),
  },
  food: {
    label: "Cuisine & Gastronomie",
    icon: UtensilsCrossed,
    gradientClass: "from-amber-950/80 via-neutral-900 to-surface-card",
    accentClass: "text-amber-400",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="15%"
          cy="40%"
          r="60"
          fill="currentColor"
          className="text-amber-500/20 blur-xl"
        />
      </svg>
    ),
  },
  travel: {
    label: "Voyage & Aventure",
    icon: Plane,
    gradientClass: "from-sky-950/80 via-neutral-900 to-surface-card",
    accentClass: "text-sky-400",
    badgeBg: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="75%"
          cy="30%"
          r="80"
          fill="currentColor"
          className="text-sky-500/20 blur-xl"
        />
      </svg>
    ),
  },
  gaming: {
    label: "Gaming & Esport",
    icon: Gamepad2,
    gradientClass: "from-purple-950/80 via-neutral-900 to-surface-card",
    accentClass: "text-purple-400",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="dots-gaming"
            width="16"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="2"
              cy="2"
              r="1.5"
              fill="currentColor"
              className="text-purple-400/40"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots-gaming)" />
      </svg>
    ),
  },
  finance: {
    label: "Finance, Web3 & Business",
    icon: TrendingUp,
    gradientClass: "from-emerald-950/70 via-slate-900 to-surface-card",
    accentClass: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 80 Q 80 20, 160 50 T 320 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-emerald-400/30"
        />
      </svg>
    ),
  },
  lifestyle: {
    label: "Lifestyle & Quotidien",
    icon: Heart,
    gradientClass: "from-teal-950/70 via-neutral-900 to-surface-card",
    accentClass: "text-teal-400",
    badgeBg: "bg-teal-500/10 text-teal-300 border-teal-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="30%"
          cy="40%"
          r="70"
          fill="currentColor"
          className="text-teal-500/20 blur-xl"
        />
      </svg>
    ),
  },
  art: {
    label: "Art, Design & Photo",
    icon: Palette,
    gradientClass: "from-fuchsia-950/70 via-neutral-900 to-surface-card",
    accentClass: "text-fuchsia-400",
    badgeBg: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="70%"
          cy="30%"
          r="70"
          fill="currentColor"
          className="text-fuchsia-500/20 blur-xl"
        />
      </svg>
    ),
  },
  b2b: {
    label: "B2B, Entrepreneuriat & Tech",
    icon: Briefcase,
    gradientClass: "from-blue-950/80 via-neutral-900 to-surface-card",
    accentClass: "text-blue-400",
    badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    svgPattern: (
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="50%"
          cy="30%"
          r="70"
          fill="currentColor"
          className="text-blue-500/20 blur-xl"
        />
      </svg>
    ),
  },
};

const DEFAULT_THEME: ThemeConfig = {
  label: "Création de contenu",
  icon: Compass,
  gradientClass: "from-neutral-900 via-neutral-950 to-surface-card",
  accentClass: "text-brand-primary",
  badgeBg: "bg-brand-subtle-bg text-text-brand border-brand-subtle-border",
  svgPattern: null,
};

export function getThemeConfig(topic?: string | null): ThemeConfig {
  if (!topic) return DEFAULT_THEME;
  const key = topic.toLowerCase().trim();
  return THEME_CONFIGS[key] || DEFAULT_THEME;
}

export function NetworkIconBadge({
  network,
  className = "shrink-0",
  size = 15,
}: {
  network: string;
  className?: string;
  size?: number;
}) {
  const net = network.toLowerCase();
  const iconStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
  };

  if (net.includes("insta")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={iconStyle}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} shrink-0`}
        aria-hidden="true"
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    );
  }
  if (net.includes("youtube") || net.includes("yt")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={iconStyle}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} shrink-0`}
        aria-hidden="true"
      >
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" />
      </svg>
    );
  }
  if (net.includes("linkedin")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={iconStyle}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} shrink-0`}
        aria-hidden="true"
      >
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect width="4" height="12" x="2" y="9" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  }
  if (net.includes("twitter") || net.includes(" x")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={iconStyle}
        fill="currentColor"
        className={`${className} shrink-0`}
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (net.includes("tiktok")) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={iconStyle}
        fill="currentColor"
        className={`${className} shrink-0`}
        aria-hidden="true"
      >
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.41a6.33 6.33 0 0 0-.85-.06A6.34 6.34 0 0 0 3.1 15.69a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.5a8.28 8.28 0 0 0 4.81 1.54v-3.35z" />
      </svg>
    );
  }
  return (
    <Compass
      size={size}
      style={iconStyle}
      className={`${className} shrink-0`}
    />
  );
}

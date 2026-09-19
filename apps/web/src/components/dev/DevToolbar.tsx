"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  User,
  Zap,
} from "lucide-react";
import { type AccountRole } from "@influx/contracts";

interface Persona {
  id: string;
  name: string;
  role: AccountRole;
  email: string;
  tag: string;
}

const PERSONAS: Persona[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Maison Solène",
    role: "advertiser",
    email: "contact@maisonsolene.fr",
    tag: "Marque • Cosmétique Bio",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "TechGear France",
    role: "advertiser",
    email: "partenariats@techgear.fr",
    tag: "Marque • High-Tech",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Lucas Tech",
    role: "creator",
    email: "lucas@lucastech.fr",
    tag: "Créateur • Badge Niveau 1",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Sophie Mode",
    role: "creator",
    email: "sophie@lifestyle-mode.com",
    tag: "Créatrice • En attente de badge",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Maxime Voyage",
    role: "creator",
    email: "maxime@outdoor-travel.com",
    tag: "Créateur • Badge Niveau 2",
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    name: "Alexandre INFLUX",
    role: "agent",
    email: "alexandre@influx.io",
    tag: "Agent Commercial Intermédiaire",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    name: "Sarah Admin",
    role: "admin",
    email: "sarah.admin@influx.io",
    tag: "Administrateur Plateforme",
  },
];

export function DevToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    // Read persisted persona from localStorage
    const saved = localStorage.getItem("influx_mock_persona");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Persona;
        setActivePersona(parsed);
      } catch {
        // Ignore JSON error
      }
    }
  }, []);

  const handleSelectPersona = (persona: Persona | null) => {
    if (persona) {
      localStorage.setItem("influx_mock_persona", JSON.stringify(persona));
      document.cookie = `influx_session_user=${encodeURIComponent(JSON.stringify(persona))}; path=/; max-age=86400`;
      setActivePersona(persona);
      showFeedback(`Connecté en tant que : ${persona.name} (${persona.role})`);
    } else {
      localStorage.removeItem("influx_mock_persona");
      document.cookie =
        "influx_session_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setActivePersona(null);
      showFeedback("Session effacée : Mode Visiteur anonyme");
    }
    setIsOpen(false);
  };

  const handleResetData = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("http://localhost:4000/api/dev/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        showFeedback("✓ Données mockées réinitialisées au seed d’origine");
      } else {
        showFeedback("Réinitialisé en mémoire locale");
      }
    } catch {
      showFeedback("Réinitialisé (API non jointe)");
    } finally {
      setIsResetting(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  return (
    <aside
      aria-label="Barre de développement et sélection de persona"
      className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 font-base text-sm"
    >
      {/* Feedback Toast */}
      {feedbackMessage ? (
        <div className="animate-fade-in rounded-md border border-brand-subtle-border bg-surface-raised px-3 py-1.5 text-xs text-brand-primary shadow-lg">
          {feedbackMessage}
        </div>
      ) : null}

      {/* Main Container */}
      <div className="flex flex-col overflow-hidden rounded-lg border border-border-default bg-surface-raised shadow-2xl backdrop-blur-md">
        {/* Header Bar */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-brand">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>DEV MOCK</span>
          </div>

          <div className="h-4 w-px bg-border-subtle" />

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-xs text-text-primary hover:text-brand-primary"
            title="Changer de persona mocké"
          >
            <User
              className="h-3.5 w-3.5 text-text-secondary"
              aria-hidden="true"
            />
            <span className="max-w-xs truncate font-medium">
              {activePersona ? activePersona.name : "Visiteur anonyme"}
            </span>
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-text-tertiary" />
            )}
          </button>

          <button
            type="button"
            onClick={handleResetData}
            disabled={isResetting}
            title="Réinitialiser les données du mock store"
            className="rounded p-1 text-text-tertiary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
          >
            <RotateCcw
              className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen ? (
          <div className="max-h-80 w-72 overflow-y-auto border-t border-border-subtle bg-surface-card p-1">
            <div className="px-2 py-1 text-xs font-semibold tracking-wider text-text-tertiary uppercase">
              Changer de compte actif
            </div>

            {/* Anonymous Visitor Option */}
            <button
              type="button"
              onClick={() => handleSelectPersona(null)}
              className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              <div>
                <div className="font-medium">Visiteur anonyme</div>
                <div className="text-xs text-text-tertiary">Déconnecté</div>
              </div>
              {!activePersona ? (
                <Check className="h-3.5 w-3.5 text-brand-primary" />
              ) : null}
            </button>

            <div className="my-1 border-t border-border-subtle" />

            {/* Persona List */}
            {PERSONAS.map((p) => {
              const isSelected = activePersona?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPersona(p)}
                  className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-surface-brand-subtle text-text-brand"
                      : "text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-text-tertiary">
                      {p.tag}
                    </div>
                  </div>
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

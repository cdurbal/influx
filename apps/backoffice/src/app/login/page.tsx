"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { bo } from "@/locales/bo-labels";

export default function BackofficeLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickPersona = (role: "agent" | "admin") => {
    if (role === "agent") {
      setEmail("alexandre@influx.io");
      setPassword("agentpassword");
      setCode("123456");
    } else {
      setEmail("sarah.admin@influx.io");
      setPassword("adminpassword");
      setCode("000000");
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !code) {
      setError(
        "Veuillez renseigner tous les champs (Email, Mot de passe et Code TOTP).",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/backoffice/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          code: code.trim(),
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Échec de l'authentification backoffice.",
        );
      }

      // Redirection vers la file de vérification (File 4)
      window.location.href = "/queues/verification";
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de la connexion.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-page text-text-primary flex flex-col justify-between">
      {/* 17b §1.4 & §6.4 : Bandeau d'environnement non-production */}
      <div
        role="region"
        aria-label="Bandeau d'environnement"
        className="w-full bg-feedback-warning-bg text-feedback-warning-text border-b border-feedback-warning-border py-1 px-4 text-center text-xs font-semibold tracking-wider uppercase select-none"
      >
        {bo.env.nonProdBanner}
      </div>

      <div className="flex-1 flex justify-center items-center p-4">
        <div className="w-full max-w-md bg-surface-card border border-border-default rounded-xl p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col items-center gap-2 mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-primary font-black text-xl text-surface-page">
              IN
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              INFLUX Backoffice
            </h1>
            <p className="text-sm text-text-secondary">
              Espace sécurisé réservé aux agents et administrateurs (D37 · aal2)
            </p>
          </div>

          {/* Boutons dev de remplissage rapide */}
          <div className="mb-6 p-3 bg-surface-muted rounded-lg border border-border-subtle flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Comptes de test pré-configurés
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPersona("agent")}
                className="px-2.5 py-1.5 text-xs font-medium bg-surface-raised hover:bg-surface-hover border border-border-default rounded text-text-primary transition-colors text-left cursor-pointer"
              >
                Agent Alexandre (123456)
              </button>
              <button
                type="button"
                onClick={() => handleQuickPersona("admin")}
                className="px-2.5 py-1.5 text-xs font-medium bg-surface-raised hover:bg-surface-hover border border-border-default rounded text-text-primary transition-colors text-left cursor-pointer"
              >
                Admin Sarah (000000)
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-semibold text-text-secondary"
              >
                Adresse e-mail professionnelle
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alexandre@influx.io"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-page border border-border-default text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-xs font-semibold text-text-secondary"
              >
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-page border border-border-default text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="totp"
                  className="text-xs font-semibold text-text-secondary"
                >
                  Code TOTP (Application d&apos;authentification)
                </label>
                <button
                  type="button"
                  onClick={() => setCode("123456")}
                  className="text-[11px] text-brand-primary hover:underline cursor-pointer"
                >
                  Mock 123456
                </button>
              </div>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-page border border-border-default text-text-primary font-mono tracking-widest text-center text-lg placeholder-text-tertiary focus:outline-none focus:border-brand-primary"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-sm"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full py-2.5 px-4 rounded-lg bg-brand-primary hover:bg-brand-accent text-surface-page font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-md"
            >
              {loading ? "Connexion en cours..." : "Accéder au Backoffice"}
            </button>
          </form>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-text-tertiary border-t border-border-default">
        INFLUX Platform · Accès restreint aux personnels autorisés · Journal
        d&apos;audit actif ▮
      </footer>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { bo } from "@/locales/bo-labels";

export default function BackofficeLoginPage() {
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
    <div className="relative min-h-screen bg-surface-page text-text-primary flex flex-col justify-between overflow-hidden">
      {/* Halo d'ambiance premium en fond */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-radial from-brand-subtle-border/40 to-transparent blur-3xl -z-10"
      />

      {/* 17b §1.4 & §6.4 : Bandeau d'environnement non-production */}
      <div
        role="region"
        aria-label="Bandeau d'environnement"
        className="w-full bg-feedback-warning-bg text-feedback-warning-text border-b border-feedback-warning-border py-1 px-4 text-center text-xs font-semibold tracking-wider uppercase select-none"
      >
        {bo.env.nonProdBanner}
      </div>

      <div className="flex-1 flex justify-center items-center p-4 sm:p-6 z-10">
        <div className="w-full max-w-md bg-surface-card border border-border-default rounded-2xl p-6 sm:p-8 shadow-2xl relative">
          {/* Ligne d'accentuation métallique supérieure */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand-primary/50 to-transparent" />

          <div className="flex flex-col items-center gap-2.5 mb-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-subtle-bg border border-brand-subtle-border text-brand-primary font-black text-xl shadow-sm">
              IN
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-text-primary">
                  INFLUX Backoffice
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-surface-muted text-brand-primary border border-border-default">
                  SecOps
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-1 max-w-xs mx-auto">
                Console de supervision commerciale &amp; conformité (D37 · aal2)
              </p>
            </div>
          </div>

          {/* Boutons dev de remplissage rapide */}
          <div className="mb-6 p-3 bg-surface-muted rounded-xl border border-border-subtle flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                Accès rapide (Environnement de test)
              </span>
              <span className="text-[10px] text-text-brand font-medium">
                Auto-fill
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickPersona("agent")}
                className="px-2.5 py-2 text-xs font-medium bg-surface-raised hover:bg-surface-hover border border-border-default rounded-lg text-text-primary transition-colors text-left cursor-pointer flex flex-col gap-0.5"
              >
                <span className="font-semibold text-text-primary">
                  Alexandre (Agent)
                </span>
                <span className="text-[10px] text-text-tertiary font-mono">
                  TOTP: 123456
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickPersona("admin")}
                className="px-2.5 py-2 text-xs font-medium bg-surface-raised hover:bg-surface-hover border border-border-default rounded-lg text-text-primary transition-colors text-left cursor-pointer flex flex-col gap-0.5"
              >
                <span className="font-semibold text-text-primary">
                  Sarah (Admin)
                </span>
                <span className="text-[10px] text-text-tertiary font-mono">
                  TOTP: 000000
                </span>
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-page border border-border-default text-text-primary text-xs placeholder-text-tertiary focus:outline-none focus:border-brand-primary transition-colors"
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-page border border-border-default text-text-primary text-xs placeholder-text-tertiary focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="totp"
                  className="text-xs font-semibold text-text-secondary"
                >
                  Code TOTP (Authentification 2FA)
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-page border border-border-default text-text-primary font-mono tracking-widest text-center text-lg placeholder-text-tertiary focus:outline-none focus:border-brand-primary transition-colors"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs leading-relaxed"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full py-2.5 px-4 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? "Connexion sécurisée..." : "Accéder au Backoffice"}
            </button>
          </form>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-text-tertiary border-t border-border-default flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
        <span>
          INFLUX Platform · Accès restreint · Journal d&apos;audit actif
        </span>
      </footer>
    </div>
  );
}

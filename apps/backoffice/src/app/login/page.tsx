"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

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

      // Redirection vers le tableau de bord de supervision des leads
      window.location.href = "/leads";
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col items-center gap-2 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-600 font-black text-xl text-white">
            IN
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            INFLUX Backoffice
          </h1>
          <p className="text-sm text-slate-400">
            Espace sécurisé réservé aux agents et administrateurs (D37 · aal2)
          </p>
        </div>

        {/* Boutons dev de remplissage rapide */}
        <div className="mb-6 p-3 bg-slate-850 rounded-lg border border-slate-700/60 flex flex-col gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Comptes de test pré-configurés
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickPersona("agent")}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors text-left"
            >
              Agent Alexandre (123456)
            </button>
            <button
              type="button"
              onClick={() => handleQuickPersona("admin")}
              className="px-2.5 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-colors text-left"
            >
              Admin Sarah (000000)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-semibold text-slate-300"
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
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-slate-300"
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
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="totp"
                className="text-xs font-semibold text-slate-300"
              >
                Code TOTP (Application d&apos;authentification)
              </label>
              <button
                type="button"
                onClick={() => setCode("123456")}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
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
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono tracking-widest text-center text-lg placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            {loading ? "Connexion en cours..." : "Accéder au Backoffice"}
          </button>
        </form>
      </div>
    </div>
  );
}

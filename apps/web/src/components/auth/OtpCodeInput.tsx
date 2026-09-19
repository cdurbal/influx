"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  onAutoFillMock?: () => void;
  label?: string;
}

export function OtpCodeInput({
  value,
  onChange,
  disabled = false,
  error = null,
  onAutoFillMock,
  label = "Code de validation (6 chiffres)",
}: OtpCodeInputProps) {
  const handleAutoFill = () => {
    onChange("123456");
    if (onAutoFillMock) {
      onAutoFillMock();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="otp-input"
        className="text-sm font-medium text-text-primary"
      >
        {label}
      </label>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          id="otp-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="123456"
          disabled={disabled}
          className="w-full sm:w-48 px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-lg border border-border-default bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          autoFocus
        />
        <button
          type="button"
          onClick={handleAutoFill}
          disabled={disabled}
          className="px-3 py-2 text-xs font-semibold rounded border border-dashed border-primary-500/60 bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors self-start sm:self-auto cursor-pointer"
        >
          Auto-remplir le code mock (123456)
        </button>
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
    </div>
  );
}

export interface MemberAuthFlowProps {
  mode: "login" | "signup";
  profile?: "advertiser" | "creator";
  locale: string;
}

export function MemberAuthFlow({ mode, profile, locale }: MemberAuthFlowProps) {
  const router = useRouter();
  const isEn = locale === "en";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"advertiser" | "creator">(
    profile || "advertiser",
  );
  const [code, setCode] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false); // Non pré-cochée (D37)
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes("@")) {
      setError(
        isEn
          ? "Please provide a valid email address."
          : "Veuillez saisir une adresse e-mail valide.",
      );
      return;
    }

    if (mode === "signup" && !acceptedTerms) {
      setError(
        isEn
          ? "You must accept the Terms of Service to register."
          : "Vous devez accepter les CGU et la clause de non-contournement pour vous inscrire.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          role,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message ||
            (isEn
              ? "Unable to send verification code."
              : "Impossible d'envoyer le code de vérification."),
        );
      }

      setStep("otp");
    } catch (err: any) {
      setError(
        err.message ||
          (isEn ? "An error occurred." : "Une erreur est survenue."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError(
        isEn
          ? "Please enter the 6-digit verification code."
          : "Veuillez saisir le code à 6 chiffres.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          termsVersion: "2026-09-v1",
          hasNonCircumventionAcknowledged: true,
          marketingConsent,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message ||
            (isEn ? "Invalid or expired code." : "Code invalide ou expiré."),
        );
      }

      // Redirection vers l'espace profil approprié (D37)
      const targetRole = data.user?.role || role;
      const targetUrl = `/${locale}/${targetRole}/profile`;
      window.location.href = targetUrl;
    } catch (err: any) {
      setError(
        err.message ||
          (isEn ? "Verification failed." : "Échec de la validation."),
      );
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-surface-card border border-border-default rounded-xl p-6 sm:p-8 shadow-sm">
      {step === "email" ? (
        <form onSubmit={handleSendOtp} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-text-primary">
              {mode === "signup"
                ? isEn
                  ? `Create your ${role === "advertiser" ? "brand" : "creator"} account`
                  : `Créer un compte ${role === "advertiser" ? "marque" : "créateur"}`
                : isEn
                  ? "Passwordless sign-in"
                  : "Connexion sans mot de passe"}
            </h2>
            <p className="text-sm text-text-secondary">
              {isEn
                ? "Receive a 6-digit one-time code by email to sign in."
                : "Recevez un code à 6 chiffres par e-mail pour accéder à votre espace."}
            </p>
          </div>

          {mode === "login" && !profile && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text-primary">
                {isEn ? "I am logging in as:" : "Je me connecte en tant que :"}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("advertiser")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    role === "advertiser"
                      ? "border-primary-500 bg-primary-500/10 text-primary-400 font-semibold"
                      : "border-border-default bg-surface-raised text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {isEn ? "Brand / Advertiser" : "Marque / Annonceur"}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("creator")}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    role === "creator"
                      ? "border-primary-500 bg-primary-500/10 text-primary-400 font-semibold"
                      : "border-border-default bg-surface-raised text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {isEn ? "Creator" : "Créateur"}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="email-input"
              className="text-sm font-medium text-text-primary"
            >
              {isEn ? "Email address" : "Adresse e-mail"}
            </label>
            <input
              id="email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                role === "advertiser"
                  ? "contact@entreprise.com"
                  : "contact@createur.com"
              }
              className="px-4 py-3 rounded-lg border border-border-default bg-surface-page text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {mode === "signup" && (
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  required
                  className="mt-1 h-4 w-4 rounded border-border-default text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <span className="text-xs text-text-secondary leading-relaxed">
                  {isEn ? (
                    <>
                      I accept the{" "}
                      <span className="text-text-primary font-medium">
                        Terms of Service
                      </span>{" "}
                      and acknowledge the{" "}
                      <span className="text-text-primary font-medium">
                        non-circumvention clause
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      J&apos;accepte les{" "}
                      <span className="text-text-primary font-medium">
                        Conditions Générales d&apos;Utilisation
                      </span>{" "}
                      et reconnais la{" "}
                      <span className="text-text-primary font-medium">
                        clause de non-contournement
                      </span>
                      .
                    </>
                  )}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border-default text-primary-600 focus:ring-primary-500 cursor-pointer"
                />
                <span className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "I agree to receive INFLUX product updates and newsletters."
                    : "J&apos;accepte de recevoir des actualités et des opportunités d&apos;INFLUX."}
                </span>
              </label>
            </div>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading
              ? isEn
                ? "Sending code..."
                : "Envoi du code..."
              : isEn
                ? "Send one-time code"
                : "Recevoir mon code par e-mail"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-text-primary">
              {isEn ? "Enter verification code" : "Saisissez votre code"}
            </h2>
            <p className="text-sm text-text-secondary">
              {isEn ? (
                <>
                  A 6-digit code was sent to{" "}
                  <strong className="text-text-primary">{email}</strong> (valid
                  for 10 minutes).
                </>
              ) : (
                <>
                  Un code à 6 chiffres a été envoyé à{" "}
                  <strong className="text-text-primary">{email}</strong>{" "}
                  (valable 10 minutes).
                </>
              )}
            </p>
          </div>

          <OtpCodeInput
            value={code}
            onChange={setCode}
            disabled={loading}
            error={error}
            label={isEn ? "6-digit code" : "Code à 6 chiffres"}
          />

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3 px-4 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading
                ? isEn
                  ? "Verifying..."
                  : "Validation en cours..."
                : isEn
                  ? "Verify and continue"
                  : "Valider et continuer"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
                setCode("");
              }}
              disabled={loading}
              className="text-xs text-text-secondary hover:text-text-primary underline text-center cursor-pointer"
            >
              {isEn ? "Change email address" : "Modifier l'adresse e-mail"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default OtpCodeInput;

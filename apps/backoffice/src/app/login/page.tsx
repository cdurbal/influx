"use client";

import React, { useState } from "react";
import { setStoredAgentToken } from "@/lib/api-client";

export default function BackofficeLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<
    "agent" | "admin" | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickPersona = (role: "agent" | "admin") => {
    setSelectedPersona(role);
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
      setError("Veuillez renseigner tous les champs obligatoires.");
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
        throw new Error(data.message || "Identifiants ou code TOTP invalides.");
      }

      if (data.token) {
        setStoredAgentToken(data.token);
      }

      window.location.href = "/";
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erreur lors de la tentative de connexion.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        /* Reset de sécurité & Polices */
        .linear-login-root {
          min-height: 100vh;
          width: 100%;
          background-color: #08090b;
          color: #f4f4f5;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          padding: 32px 16px;
          box-sizing: border-box;
          position: relative;
          overflow-x: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* Halo lumineux Linear supérieur */
        .linear-glow-top {
          position: absolute;
          top: -160px;
          left: 50%;
          transform: translateX(-50%);
          width: 680px;
          height: 380px;
          background: radial-gradient(circle, rgba(94, 106, 210, 0.22) 0%, rgba(34, 197, 94, 0.08) 45%, transparent 70%);
          filter: blur(80px);
          pointer-events: none;
          z-index: 1;
        }

        /* Trame de fond subtile */
        .linear-grid-bg {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
          background-size: 28px 28px;
          mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 1) 20%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 1) 20%, transparent 75%);
          pointer-events: none;
          z-index: 1;
        }

        /* Enveloppe de la carte centrale (strict 380px) */
        .linear-card-wrapper {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 380px;
          margin: auto 0;
        }

        /* Carte centrale Linear */
        .linear-card {
          position: relative;
          width: 100%;
          box-sizing: border-box;
          background: rgba(16, 17, 21, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 16px;
          padding: 32px 28px 28px 28px;
          box-shadow: 
            0 24px 64px -12px rgba(0, 0, 0, 0.85),
            0 0 0 1px rgba(255, 255, 255, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
        }

        /* Hairline supérieure lumineuse Linear */
        .linear-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 15%;
          right: 15%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
          pointer-events: none;
        }

        /* Bouton persona / SSO */
        .linear-persona-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 12px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          color: #f4f4f5;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          text-align: left;
          box-sizing: border-box;
        }
        .linear-persona-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateY(-1px);
        }
        .linear-persona-btn.active-agent {
          background: rgba(34, 197, 94, 0.08);
          border-color: rgba(34, 197, 94, 0.45);
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.15);
        }
        .linear-persona-btn.active-admin {
          background: rgba(168, 85, 247, 0.08);
          border-color: rgba(168, 85, 247, 0.45);
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.15);
        }

        /* Champs formulaire */
        .linear-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .linear-field-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 500;
          color: #949ca8;
          letter-spacing: 0.01em;
        }
        .linear-input-text {
          width: 100%;
          height: 38px;
          box-sizing: border-box;
          padding: 0 12px;
          border-radius: 8px;
          background-color: #0b0c0f;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
        }
        .linear-input-text:focus {
          border-color: rgba(255, 255, 255, 0.35);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06), inset 0 1px 2px rgba(0, 0, 0, 0.4);
        }
        .linear-input-text::placeholder {
          color: #4b5260;
        }

        /* Bouton de soumission Linear style (Blanc ultra-épuré) */
        .linear-btn-submit {
          width: 100%;
          height: 40px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.8);
          color: #08090a;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 0 20px rgba(255, 255, 255, 0.15);
        }
        .linear-btn-submit:hover:not(:disabled) {
          background: #eaeaea;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 25px rgba(255, 255, 255, 0.25);
        }
        .linear-btn-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .linear-btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <div className="linear-login-root">
        {/* Lueur et grille de fond */}
        <div className="linear-glow-top" aria-hidden="true" />
        <div className="linear-grid-bg" aria-hidden="true" />

        {/* 1. Header supérieur épuré */}
        <div
          style={{
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "5px 12px",
            borderRadius: "9999px",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
            fontSize: "11px",
            color: "#8a8f98",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 8px #22c55e",
            }}
          />
          <span style={{ fontWeight: 500, color: "#d1d5db" }}>
            INFLUX Console
          </span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <span style={{ color: "#22c55e", fontWeight: 500 }}>
            Production v1.0
          </span>
        </div>

        {/* 2. Carte centrale */}
        <div className="linear-card-wrapper">
          <div className="linear-card">
            {/* Header de la carte */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  marginBottom: "12px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                }}
              >
                {/* Icône Linear / Influx Prism */}
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <h1
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  margin: 0,
                  color: "#ffffff",
                }}
              >
                Connexion Backoffice
              </h1>
              <p
                style={{
                  fontSize: "12px",
                  color: "#8a8f98",
                  marginTop: "6px",
                  marginBottom: 0,
                  lineHeight: 1.4,
                }}
              >
                Console d&apos;intermédiation &amp; gestion des contrats
              </p>
            </div>

            {/* 3. Boutons SSO 1-Clic (Profils rapides) */}
            <div style={{ marginBottom: "18px" }}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "8px",
                }}
              >
                Accès rapide (1-Clic)
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {/* Profil Agent */}
                <button
                  type="button"
                  onClick={() => handleQuickPersona("agent")}
                  className={`linear-persona-btn ${
                    selectedPersona === "agent" ? "active-agent" : ""
                  }`}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #059669 0%, #047857 100%)",
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      AM
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#ffffff",
                        }}
                      >
                        Alexandre Martin
                      </div>
                      <div style={{ fontSize: "10px", color: "#8a8f98" }}>
                        Commercial · Agent
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color:
                        selectedPersona === "agent" ? "#22c55e" : "#52525b",
                      fontWeight: 600,
                    }}
                  >
                    {selectedPersona === "agent" ? "✓ Prêt" : "Agent"}
                  </span>
                </button>

                {/* Profil Admin */}
                <button
                  type="button"
                  onClick={() => handleQuickPersona("admin")}
                  className={`linear-persona-btn ${
                    selectedPersona === "admin" ? "active-admin" : ""
                  }`}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      SC
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#ffffff",
                        }}
                      >
                        Sarah Connor
                      </div>
                      <div style={{ fontSize: "10px", color: "#8a8f98" }}>
                        Super-Admin · Audit
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      color:
                        selectedPersona === "admin" ? "#c084fc" : "#52525b",
                      fontWeight: 600,
                    }}
                  >
                    {selectedPersona === "admin" ? "✓ Prêt" : "Admin"}
                  </span>
                </button>
              </div>
            </div>

            {/* Séparateur */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                margin: "16px 0",
                gap: "10px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                }}
              />
              <span
                style={{
                  fontSize: "10px",
                  color: "#52525b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                ou saisie directe
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                }}
              />
            </div>

            {/* Formulaire */}
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {/* E-mail */}
              <div className="linear-field-group">
                <label htmlFor="email" className="linear-field-label">
                  Adresse e-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedPersona(null);
                  }}
                  placeholder="nom@influx.io"
                  className="linear-input-text"
                />
              </div>

              {/* Mot de passe */}
              <div className="linear-field-group">
                <div className="linear-field-label">
                  <label htmlFor="password">Mot de passe</label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#71717a",
                      fontSize: "10px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setSelectedPersona(null);
                  }}
                  placeholder="••••••••••••"
                  className="linear-input-text"
                  style={{
                    letterSpacing: showPassword ? "normal" : "0.15em",
                  }}
                />
              </div>

              {/* TOTP */}
              <div className="linear-field-group">
                <div className="linear-field-label">
                  <label htmlFor="totp">Code 2FA (TOTP)</label>
                  <button
                    type="button"
                    onClick={() => setCode("123456")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#22c55e",
                      fontSize: "10px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Remplir 123456
                  </button>
                </div>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setSelectedPersona(null);
                  }}
                  placeholder="000 000"
                  className="linear-input-text"
                  style={{
                    fontFamily: "monospace",
                    letterSpacing: "0.25em",
                    textAlign: "center",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                />
              </div>

              {/* Erreur */}
              {error && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    color: "#fca5a5",
                    fontSize: "11px",
                    lineHeight: 1.4,
                  }}
                >
                  {error}
                </div>
              )}

              {/* Bouton de connexion Linear CTA */}
              <button
                type="submit"
                disabled={loading}
                className="linear-btn-submit"
                style={{ marginTop: "4px" }}
              >
                {loading ? (
                  <span>Authentification...</span>
                ) : (
                  <>
                    <span>Accéder à la console</span>
                    <span style={{ fontSize: "14px" }}>→</span>
                  </>
                )}
              </button>
            </form>

            {/* Sécurité */}
            <div
              style={{
                marginTop: "18px",
                paddingTop: "14px",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "10px",
                color: "#52525b",
              }}
            >
              <span>🔒 2FA TOTP</span>
              <span>·</span>
              <span>🛡️ Journal d&apos;Audit SHA-256</span>
              <span>·</span>
              <span>⚡ TLS 1.3</span>
            </div>
          </div>
        </div>

        {/* 4. Footer de la page */}
        <footer
          style={{
            zIndex: 10,
            fontSize: "11px",
            color: "#52525b",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div>
            INFLUX Platform · Espace sécurisé réservé aux équipes internes
          </div>
        </footer>
      </div>
    </>
  );
}

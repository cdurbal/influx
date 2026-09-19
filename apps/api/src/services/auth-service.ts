import { randomUUID } from "node:crypto";
import {
  type Account,
  type UserSession,
  type TermsAcceptance,
} from "../../../../packages/contracts/src/account";
import {
  type MemberRole,
  type SendOtpResponse,
  type VerifyOtpRequest,
  OTP_DEFAULT_CODE,
  OTP_EXPIRATION_SECONDS,
  OTP_MAX_ATTEMPTS,
} from "../../../../packages/contracts/src/auth";
import { MockStore } from "../mocks/mock-store";

export interface OtpRecord {
  email: string;
  role: MemberRole;
  code: string;
  expiresAt: number;
  attempts: number;
}

export interface SessionRecord {
  token: string;
  user: UserSession;
  accountId: string;
  createdAt: number;
  expiresAt: number;
  isBackoffice?: boolean;
  aal?: "aal1" | "aal2";
}

export interface BackofficeLoginParams {
  email: string;
  password?: string;
  code?: string;
  totpCode?: string;
  totp?: string;
}

export class AuthService {
  private store: MockStore;
  private otpStore: Map<string, OtpRecord> = new Map();
  private sessions: Map<string, SessionRecord> = new Map();
  private termsAcceptances: Map<string, TermsAcceptance> = new Map();

  constructor(store?: MockStore) {
    this.store = store ?? MockStore.getInstance();
  }

  /**
   * Envoi d'un code OTP à 6 chiffres par e-mail
   * Durée de validité : 10 minutes (D37)
   */
  async sendOtp(email: string, role: MemberRole): Promise<SendOtpResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    if (role !== "advertiser" && role !== "creator") {
      throw new Error(`Rôle invalide pour la connexion membre: ${role}`);
    }

    const code = OTP_DEFAULT_CODE;
    const expiresAt = Date.now() + OTP_EXPIRATION_SECONDS * 1000;

    this.otpStore.set(normalizedEmail, {
      email: normalizedEmail,
      role,
      code,
      expiresAt,
      attempts: 0,
    });

    return {
      success: true,
      message: "Code OTP envoyé avec succès",
      expiresInSeconds: OTP_EXPIRATION_SECONDS,
    };
  }

  /**
   * Vérification du code OTP
   * Invalidé après 5 tentatives ou après usage
   */
  async verifyOtp(params: VerifyOtpRequest): Promise<{
    token: string;
    user: UserSession;
    account: Account;
  }> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const otp = this.otpStore.get(normalizedEmail);

    if (!otp) {
      throw new Error("Aucun code OTP en attente pour cette adresse e-mail");
    }

    if (Date.now() > otp.expiresAt) {
      this.otpStore.delete(normalizedEmail);
      throw new Error("Code OTP expiré");
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      this.otpStore.delete(normalizedEmail);
      throw new Error(
        "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
      );
    }

    if (otp.code !== params.code.trim()) {
      otp.attempts += 1;
      if (otp.attempts >= OTP_MAX_ATTEMPTS) {
        this.otpStore.delete(normalizedEmail);
        throw new Error(
          "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.",
        );
      }
      throw new Error("Code OTP incorrect");
    }

    // Code valide : invalidation immédiate après usage (D37)
    this.otpStore.delete(normalizedEmail);

    // Recherche d'un compte existant ou création d'un nouveau compte
    let account: Account | undefined;
    for (const acc of this.store.accounts.values()) {
      if (acc.email.toLowerCase() === normalizedEmail) {
        account = acc;
        break;
      }
    }

    const now = new Date().toISOString();

    if (account) {
      if (account.status === "suspended" || account.status === "closed") {
        throw new Error("Ce compte est suspendu ou fermé");
      }
      account.emailStatus = "verified";
      account.updatedAt = now;
      this.store.accounts.set(account.id, account);
    } else {
      const newAccountId = randomUUID();
      account = {
        id: newAccountId,
        email: normalizedEmail,
        role: otp.role,
        status: "active",
        preferredLanguage: "fr",
        countryCode: "FR",
        emailStatus: "verified",
        createdAt: now,
        updatedAt: now,
      };
      this.store.accounts.set(account.id, account);
    }

    // Enregistrement de l'acceptation des CGU (D37)
    const termsRecord: TermsAcceptance = {
      id: randomUUID(),
      accountId: account.id,
      termsVersion: params.termsVersion || "2026-09-v1",
      acceptedAt: now,
      hasNonCircumventionAcknowledged:
        params.hasNonCircumventionAcknowledged ?? true,
    };
    this.termsAcceptances.set(termsRecord.id, termsRecord);
    if (
      (this.store as any).termsAcceptances &&
      typeof (this.store as any).termsAcceptances.set === "function"
    ) {
      (this.store as any).termsAcceptances.set(termsRecord.id, termsRecord);
    }

    // Création du jeton de session (30 jours glissants)
    const token = `influx_sess_${randomUUID().replace(/-/g, "")}`;
    const userSession: UserSession = {
      accountId: account.id,
      email: account.email,
      role: account.role,
      preferredLanguage: (account.preferredLanguage as "fr" | "en") || "fr",
      displayName: account.email.split("@")[0] || "Membre",
    };

    const sessionRecord: SessionRecord = {
      token,
      user: userSession,
      accountId: account.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    };
    this.sessions.set(token, sessionRecord);

    return {
      token,
      user: userSession,
      account,
    };
  }

  /**
   * Récupération d'une session active
   */
  async getSession(token: string): Promise<{
    user: UserSession;
    account: Account;
  } | null> {
    if (!token) return null;

    const sessionRecord = this.sessions.get(token);
    if (!sessionRecord) return null;

    if (Date.now() > sessionRecord.expiresAt) {
      this.sessions.delete(token);
      return null;
    }

    const account = this.store.accounts.get(sessionRecord.accountId);
    if (
      !account ||
      account.status === "suspended" ||
      account.status === "closed"
    ) {
      this.sessions.delete(token);
      return null;
    }

    if (sessionRecord.isBackoffice) {
      // Inactivité 30 min glissante, plafonnée à 8h depuis la création (D37)
      const maxExpiry = sessionRecord.createdAt + 8 * 60 * 60 * 1000;
      sessionRecord.expiresAt = Math.min(
        Date.now() + 30 * 60 * 1000,
        maxExpiry,
      );
    } else {
      // Renouvellement silencieux (30 jours glissants pour les membres)
      sessionRecord.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }

    return {
      user: sessionRecord.user,
      account,
    };
  }

  /**
   * Connexion Backoffice (Agent / Admin)
   * Mot de passe + TOTP (D37 : mot de passe + TOTP obligatoire, aal2)
   */
  async loginBackoffice(params: BackofficeLoginParams): Promise<{
    token: string;
    user: UserSession;
    account: Account;
  }> {
    const normalizedEmail = params.email.trim().toLowerCase();
    const code = (params.code || params.totpCode || params.totp || "").trim();

    // 1. Vérification du code TOTP mocké statique (000000 ou 123456)
    if (code !== "000000" && code !== "123456") {
      throw new Error("Code TOTP invalide");
    }

    // 2. Recherche du compte
    let account: Account | undefined;
    for (const acc of this.store.accounts.values()) {
      if (acc.email.toLowerCase() === normalizedEmail) {
        account = acc;
        break;
      }
    }

    if (!account) {
      throw new Error("Compte backoffice introuvable");
    }

    // 3. Vérification du rôle backoffice
    if (account.role !== "agent" && account.role !== "admin") {
      throw new Error(
        "Accès refusé : ce compte ne possède pas de droits backoffice",
      );
    }

    // 4. Vérification du statut du compte
    if (account.status === "suspended" || account.status === "closed") {
      throw new Error("Ce compte backoffice est suspendu ou fermé");
    }

    // 5. Création de la session avec privilèges backoffice (8h max, aal2)
    const token = `influx_bo_${randomUUID().replace(/-/g, "")}`;
    const userSession: UserSession = {
      accountId: account.id,
      email: account.email,
      role: account.role,
      preferredLanguage: (account.preferredLanguage as "fr" | "en") || "fr",
      displayName:
        account.email.split("@")[0] ||
        (account.role === "admin" ? "Admin INFLUX" : "Agent INFLUX"),
    };

    const sessionRecord: SessionRecord = {
      token,
      user: userSession,
      accountId: account.id,
      createdAt: Date.now(),
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      isBackoffice: true,
      aal: "aal2",
    };
    this.sessions.set(token, sessionRecord);

    return {
      token,
      user: userSession,
      account,
    };
  }

  /**
   * Révocation de session
   */
  async logout(token: string): Promise<boolean> {
    return this.sessions.delete(token);
  }

  /**
   * Réinitialisation de l'état (pour tests et dev reset)
   */
  reset(): void {
    this.otpStore.clear();
    this.sessions.clear();
    this.termsAcceptances.clear();
  }

  getTermsAcceptances(): TermsAcceptance[] {
    return Array.from(this.termsAcceptances.values());
  }
}

export const authService = new AuthService();

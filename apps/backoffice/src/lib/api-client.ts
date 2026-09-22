"use client";

const AGENT_TOKEN_KEY = "influx_agent_token";

export function getStoredAgentToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AGENT_TOKEN_KEY);
}

export function setStoredAgentToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AGENT_TOKEN_KEY, token);
}

export function clearStoredAgentToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AGENT_TOKEN_KEY);
}

/**
 * Connexion agent par défaut (Alexandre Martin, agent commercial INFLUX)
 */
export async function loginAgentDemo(): Promise<{
  success: boolean;
  token?: string;
  user?: any;
  account?: any;
}> {
  try {
    const res = await fetch("/api/auth/backoffice/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "alexandre@influx.io",
        password: "agentpassword",
        code: "123456",
      }),
      credentials: "include",
    });

    if (!res.ok) {
      return { success: false };
    }

    const data = await res.json();
    if (data.token) {
      setStoredAgentToken(data.token);
    }
    return {
      success: true,
      token: data.token,
      user: data.user,
      account: data.account,
    };
  } catch {
    return { success: false };
  }
}

/**
 * Vérifie l'état de la session de l'agent.
 * Si aucune session valide n'existe, tente une auto-connexion agent démo transparente.
 */
export async function ensureAgentSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const token = getStoredAgentToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch("/api/auth/me", {
      headers,
      credentials: "include",
    });

    if (res.ok) {
      const data = await res.json();
      const role = data.account?.role || data.user?.role || data.role;
      if (role === "agent" || role === "admin") {
        return true;
      }
    }

    // Auto-connexion démo transparente si la session est absente ou expirée
    const loginResult = await loginAgentDemo();
    return loginResult.success;
  } catch {
    return false;
  }
}

/**
 * Fetch authentifié pour toutes les requêtes du backoffice :
 * 1. Injecte systématiquement `credentials: "include"`
 * 2. Injecte l'en-tête `Authorization: Bearer <token>` si disponible
 * 3. En cas de 401 (session expirée ou absente), tente une auto-connexion démo transparente
 *    et rejoue la requête une fois.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = getStoredAgentToken();

  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });

  // Si 401 (session invalide ou manquante sur Railway), tenter une reconnexion transparente
  if (response.status === 401) {
    const recovered = await loginAgentDemo();
    if (recovered.success && recovered.token) {
      headers.set("Authorization", `Bearer ${recovered.token}`);
      // Rejouer la requête avec le nouveau token
      return fetch(input, {
        ...init,
        headers,
        credentials: "include",
      });
    }
  }

  return response;
}

/**
 * Fachada estável para tokens JWT usados pelo `apiClient` (interceptors).
 * Fonte da verdade: `useAuthTokenStore` (Zustand + persist criptografado).
 *
 * NextAuth (cookie) continua válido para o dashboard; `POST /api/v1/auth/refresh`
 * alimenta estes valores quando em uso.
 */

import { useAuthTokenStore } from "@/shared/stores/use-auth-token-store";

/**
 * Chaves legadas (texto claro em `localStorage`); migradas uma vez para o blob criptografado.
 *
 * Mantêm o prefixo antigo de propósito: são lidas do navegador de quem já usou o
 * produto sob o nome anterior. Renomear aqui deixaria esses tokens órfãos em texto
 * claro, sem nunca serem migrados nem apagados.
 */
const LEGACY_ACCESS_KEY = "bucomax_access_token";
const LEGACY_REFRESH_KEY = "bucomax_refresh_token";

let legacyMigrated = false;

function migrateLegacyTokensOnce(): void {
  if (legacyMigrated || typeof window === "undefined") return;
  legacyMigrated = true;
  try {
    const legacyAccess = localStorage.getItem(LEGACY_ACCESS_KEY);
    const legacyRefresh = localStorage.getItem(LEGACY_REFRESH_KEY);
    if (!legacyAccess && !legacyRefresh) return;

    const { accessToken, refreshToken, setTokens } = useAuthTokenStore.getState();
    if (!accessToken && !refreshToken) {
      setTokens(legacyAccess, legacyRefresh);
    }
    localStorage.removeItem(LEGACY_ACCESS_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  } catch {
    // ignore
  }
}

export function setAuthTokens(access: string | null, refresh: string | null): void {
  migrateLegacyTokensOnce();
  useAuthTokenStore.getState().setTokens(access, refresh);
}

export function getAccessToken(): string | null {
  migrateLegacyTokensOnce();
  return useAuthTokenStore.getState().accessToken;
}

export function getRefreshToken(): string | null {
  migrateLegacyTokensOnce();
  return useAuthTokenStore.getState().refreshToken;
}

export function clearAuthTokens(): void {
  setAuthTokens(null, null);
}

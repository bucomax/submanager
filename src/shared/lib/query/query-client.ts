import { QueryClient } from "@tanstack/react-query";

/** Dados de painel mudam por ação do usuário; 30s evita refetch em cascata ao navegar. */
const DEFAULT_STALE_TIME_MS = 30_000;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        // apiClient já faz retry/toast de erro; repetir aqui duplicaria toasts.
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * Servidor: instância nova por chamada (sem estado compartilhado entre requests).
 * Browser: singleton, para que serviços fora do React (ex.: troca de tenant) possam limpar o cache.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return createQueryClient();
  browserClient ??= createQueryClient();
  return browserClient;
}

/** Troca de tenant ou logout: nenhum dado do contexto anterior pode sobreviver no cache. */
export function clearQueryCache(): void {
  if (typeof window === "undefined") return;
  browserClient?.clear();
}

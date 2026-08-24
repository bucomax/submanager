import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as Sentry from "@sentry/nextjs";
import { normalizeApiError, shouldSilenceApiErrorToast } from "@/lib/api/axios-error";
import { routing } from "@/i18n/routing";
import { getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/api/token-storage";
import { toast } from "@/lib/toast";
import { severityForHttpStatus, shouldReportHttpStatus } from "@/lib/observability/error-taxonomy";
import { REQUEST_ID_HEADER } from "@/lib/observability/request-id";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";
import type { ApiErrorEnvelope } from "@/shared/types/api/v1";

/** Alinha mensagens da API v1 ao locale da UI (segmento `[locale]` ou padrão). */
function acceptLanguageForApiRequest(): string {
  if (typeof window === "undefined") return routing.defaultLocale;
  const seg = window.location.pathname.split("/").filter(Boolean)[0];
  if (seg === "en") return "en";
  if (seg === "pt-BR") return "pt-BR";
  return routing.defaultLocale;
}

/**
 * Cliente HTTP da aplicação (browser e futuros usos server com cuidado).
 * - `withCredentials`: cookies do NextAuth na mesma origem.
 * - `Authorization`: preenchido quando houver access JWT em `token-storage` (API stateless).
 */
export const apiClient = axios.create({
  baseURL:
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "")
      : "",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  try {
    const { data } = await axios.post<{ data?: { accessToken?: string; refreshToken?: string } }>(
      "/api/v1/auth/refresh",
      { refreshToken: rt },
      { headers: { "Content-Type": "application/json" }, withCredentials: true },
    );
    const access = data.data?.accessToken ?? null;
    const nextRefresh = data.data?.refreshToken ?? rt;
    if (access) setAuthTokens(access, nextRefresh);
    return access;
  } catch {
    setAuthTokens(null, null);
    return null;
  }
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  config.headers.set("Accept-Language", acceptLanguageForApiRequest());
  return config;
});

function requestHadBearer(config: InternalAxiosRequestConfig | undefined): boolean {
  if (!config?.headers) return false;
  const h = config.headers;
  const auth =
    typeof h.get === "function"
      ? h.get("Authorization")
      : (h as unknown as Record<string, string>).Authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ");
}

apiClient.interceptors.response.use(
  (response) => {
    const cfg = response.config as InternalAxiosRequestConfig & { toastSuccessMessage?: string };
    if (typeof window !== "undefined" && cfg.toastSuccessMessage?.trim()) {
      toast.success(cfg.toastSuccessMessage.trim());
    }
    return response;
  },
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      requestHadBearer(original) &&
      !(original as { _retry?: boolean })._retry
    ) {
      (original as { _retry?: boolean })._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccess = await refreshPromise;
      if (newAccess) {
        original.headers.set("Authorization", `Bearer ${newAccess}`);
        return apiClient(original);
      }
    }

    const cfg = original as (InternalAxiosRequestConfig & { skipErrorToast?: boolean }) | undefined;
    if (
      typeof window !== "undefined" &&
      original &&
      !cfg?.skipErrorToast &&
      !shouldSilenceApiErrorToast(error)
    ) {
      const err = normalizeApiError(error);
      if (err.message !== "Request aborted") {
        toast.error(err.message);
      }
    }

    if (typeof window !== "undefined" && status && shouldReportHttpStatus(status)) {
      const route = original?.url ?? "unknown";
      const requestId = error.response?.headers?.[REQUEST_ID_HEADER] ?? null;
      const eventId = Sentry.withScope((scope) => {
        scope.setLevel(severityForHttpStatus(status));
        scope.setTags({
          "error.code": error.response?.data?.error?.code ?? "UNKNOWN",
          "api.route": route,
          request_id: requestId ?? "none",
        });
        // Agrupa por rota e código, não por mensagem — mensagem varia por locale.
        scope.setFingerprint([
          "api-client",
          original?.method ?? "get",
          route,
          error.response?.data?.error?.code ?? "UNKNOWN",
        ]);
        return Sentry.captureException(error);
      });

      useLastErrorStore.getState().setLastError({
        sentryEventId: eventId ?? null,
        requestId,
        route: window.location.pathname,
        capturedAt: Date.now(),
      });
    }

    return Promise.reject(error);
  },
);

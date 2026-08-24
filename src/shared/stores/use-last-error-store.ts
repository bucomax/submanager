import { create } from "zustand";

/**
 * Último erro da sessão, para o widget de feedback oferecer o vínculo com o
 * evento do Sentry. Não é persistido: anexar erro de outra aba ou de ontem a um
 * relato de hoje aponta o triador para o lugar errado.
 */
export const LAST_ERROR_TTL_MS = 10 * 60 * 1000;

export type CapturedError = {
  sentryEventId: string | null;
  requestId: string | null;
  route: string;
  capturedAt: number;
};

type LastErrorState = {
  lastError: CapturedError | null;
  setLastError: (error: CapturedError) => void;
  clearLastError: () => void;
  readFreshError: (nowMs: number) => CapturedError | null;
};

export const useLastErrorStore = create<LastErrorState>()((set, get) => ({
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  clearLastError: () => set({ lastError: null }),
  readFreshError: (nowMs) => {
    const { lastError } = get();
    if (!lastError) return null;
    return nowMs - lastError.capturedAt <= LAST_ERROR_TTL_MS ? lastError : null;
  },
}));

/**
 * Throttle em memória por processo: no máximo 1 execução por chave a cada `windowMs`.
 * Complementa o lock distribuído (que é no-op sem Redis): cada instância limita as próprias execuções.
 * Estado vive só no processo (reinicia no cold start) — suficiente para conter rajadas de GET.
 */
export type ProcessThrottle = {
  /** `true` = pode executar agora (e registra a execução); `false` = ainda dentro da janela. */
  tryRun(key: string, now?: number): boolean;
};

const MAX_TRACKED_KEYS = 1_000;

export function createProcessThrottle(windowMs: number): ProcessThrottle {
  const lastRunAt = new Map<string, number>();

  return {
    tryRun(key, now = Date.now()) {
      const last = lastRunAt.get(key);
      if (last !== undefined && now - last < windowMs) return false;

      if (lastRunAt.size >= MAX_TRACKED_KEYS) {
        // Limpeza oportunista de entradas expiradas para o mapa não crescer sem limite.
        for (const [trackedKey, at] of lastRunAt) {
          if (now - at >= windowMs) lastRunAt.delete(trackedKey);
        }
      }
      lastRunAt.set(key, now);
      return true;
    },
  };
}

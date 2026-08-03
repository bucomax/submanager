"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Rascunho editável semeado por um valor vindo do servidor.
 *
 * Enquanto `source` mantiver a mesma identidade, o rascunho guarda as edições locais.
 * Quando o servidor devolve um valor novo (carga inicial, recarregar, salvar), o rascunho
 * volta a acompanhar o servidor.
 *
 * Substitui o padrão `useEffect(() => setDraft(source), [source])`, que dispara um render
 * extra e é sinalizado por `react-hooks/set-state-in-effect`: aqui o valor é derivado no
 * próprio render.
 */
export function useSyncedDraft<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState<{ source: T; value: T } | null>(null);

  const value = draft !== null && Object.is(draft.source, source) ? draft.value : source;

  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setDraft((previous) => {
        const current =
          previous !== null && Object.is(previous.source, source) ? previous.value : source;
        return {
          source,
          value: typeof next === "function" ? (next as (prev: T) => T)(current) : next,
        };
      }),
    [source],
  );

  return [value, update];
}

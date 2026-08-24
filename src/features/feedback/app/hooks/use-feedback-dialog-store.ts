"use client";

import { create } from "zustand";
import { useLastErrorStore, type CapturedError } from "@/shared/stores/use-last-error-store";
import type { FeedbackType } from "@/features/feedback/app/types/api";

type FeedbackDialogState = {
  open: boolean;
  forcedType: FeedbackType | null;
  attachedError: CapturedError | null;
  openDialog: (forcedType?: FeedbackType) => void;
  closeDialog: () => void;
};

/**
 * Store própria (não a de layout/sidebar): a tela de erro abre o dialog fora da
 * árvore da sidebar, então o gatilho e o próprio dialog precisam de um estado
 * global compartilhado entre os dois pontos de montagem.
 */
export const useFeedbackDialogStore = create<FeedbackDialogState>()((set) => ({
  open: false,
  forcedType: null,
  attachedError: null,
  openDialog: (forcedType) =>
    set({
      open: true,
      forcedType: forcedType ?? null,
      // Congela o erro no instante da abertura (evento, não render): reavaliar a
      // cada render faria o vínculo aparecer e sumir enquanto o usuário digita, e
      // chamar Date.now() durante o render violaria react-hooks/purity.
      attachedError: useLastErrorStore.getState().readFreshError(Date.now()),
    }),
  closeDialog: () => set({ open: false, forcedType: null, attachedError: null }),
}));

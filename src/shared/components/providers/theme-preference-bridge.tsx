"use client";

import { NEXT_THEME_LOCAL_STORAGE_KEY } from "@/shared/constants/next-theme-storage";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { usePersistedAppStore } from "@/shared/stores/use-persisted-app-store";
/**
 * Após reidratar o Zustand, aplica `themePreference` no `next-themes`.
 *
 * Conflito que isso evita: o `next-themes` lê `localStorage["next-theme"]` cedo, mas o
 * store criptografado pode reidratar com o padrão `"system"` (bucket vazio ou primeiro
 * acesso). Sem migração, o bridge forçava `system` e anulava claro/escuro já escolhido.
 * `setTheme` do pacote muda de identidade quando o tema muda — não pode ir nas deps do efeito.
 */
export function ThemePreferenceBridge() {
  const themePreference = usePersistedAppStore((s) => s.themePreference);
  const setThemePreference = usePersistedAppStore((s) => s.setThemePreference);
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);

  // Ref não pode ser escrita durante o render; este efeito roda antes do efeito de aplicação
  // abaixo, então `setThemeRef.current` já está atualizado quando ele lê.
  useEffect(() => {
    setThemeRef.current = setTheme;
  }, [setTheme]);

  const [hydrated, setHydrated] = useState(
    () => typeof window !== "undefined" && usePersistedAppStore.persist.hasHydrated(),
  );
  const doneLegacySyncRef = useRef(false);

  useEffect(() => {
    const unsub = usePersistedAppStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!doneLegacySyncRef.current) {
      doneLegacySyncRef.current = true;
      try {
        const raw = localStorage.getItem(NEXT_THEME_LOCAL_STORAGE_KEY);
        const lsTheme = raw === "light" || raw === "dark" ? raw : null;
        if (lsTheme != null && themePreference === "system") {
          setThemePreference(lsTheme);
          return;
        }
      } catch {
        /* localStorage indisponível */
      }
    }

    setThemeRef.current(themePreference);
  }, [hydrated, themePreference, setThemePreference]);

  return null;
}

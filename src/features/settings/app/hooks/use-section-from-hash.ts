"use client";

import { useSyncExternalStore } from "react";

import {
  sectionFromHash,
  type SettingsSectionId,
} from "@/features/settings/app/utils/section-hash";

function subscribeToHash(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSection(): SettingsSectionId | null {
  return sectionFromHash(window.location.hash);
}

function getServerHashSection(): SettingsSectionId | null {
  return null;
}

/**
 * Seção pedida pelo fragmento da URL (`/settings#team`).
 *
 * O hash não chega ao servidor: `useSyncExternalStore` devolve `null` no SSR e na
 * hidratação, e o React relê o snapshot logo depois — sem descompasso de hidratação e
 * sem precisar de um `useEffect` que faz setState só para ler `window.location.hash`.
 */
export function useSectionFromHash(): SettingsSectionId | null {
  return useSyncExternalStore(subscribeToHash, getHashSection, getServerHashSection);
}

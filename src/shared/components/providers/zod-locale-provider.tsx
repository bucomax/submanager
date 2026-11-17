"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";
import { z } from "zod";
import { en, ptBR } from "zod/locales";

/**
 * Alinha as mensagens padrão do Zod 4 ao idioma da UI (somente client-side;
 * `z.config` é global e não deve ser chamado no servidor).
 */
export function ZodLocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  useEffect(() => {
    z.config(locale === "pt-BR" ? ptBR() : en());
  }, [locale]);

  return children;
}

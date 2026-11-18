"use client";

import { useUpdateClient } from "@/features/clients/app/hooks/use-update-client";
import { toast } from "@/lib/toast";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Rascunho + salvamento da descrição do caso (`caseDescription`) na ficha. */
export function useClientCaseNotes(
  clientId: string,
  client: ClientDetailClientDto | null | undefined,
) {
  const t = useTranslations("clients.detail");
  const { updateClientById, updating: saving } = useUpdateClient();

  /** Identidade da versão do cliente carregada — muda a cada recarga que altera o registro. */
  const clientVersion = client ? `${client.id}:${client.updatedAt}` : null;
  const storedCaseDescription = client?.caseDescription ?? null;
  const serverKey = `${clientVersion}|${storedCaseDescription ?? ""}`;

  const [draft, setDraft] = useState(storedCaseDescription ?? "");
  const [syncedKey, setSyncedKey] = useState(serverKey);
  // Registro recarregado: o rascunho volta ao valor do servidor (ajuste no render, sem efeito).
  if (syncedKey !== serverKey) {
    setSyncedKey(serverKey);
    if (clientVersion !== null) setDraft(storedCaseDescription ?? "");
  }

  const trimmedDraft = draft.trim();
  const dirty =
    clientVersion !== null && (trimmedDraft === "" ? null : trimmedDraft) !== storedCaseDescription;

  async function save() {
    try {
      await updateClientById(clientId, { caseDescription: trimmedDraft === "" ? null : trimmedDraft });
      toast.success(t("caseNotes.saved"));
    } catch {
      /* erro: toast global no apiClient */
    }
  }

  return { draft, setDraft, dirty, saving, save };
}

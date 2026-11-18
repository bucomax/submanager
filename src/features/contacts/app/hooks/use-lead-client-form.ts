"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { getClientDetail, updateClient } from "@/features/clients/app/services/clients.service";
import { contactKeys } from "@/features/contacts/app/hooks/query-keys";
import { convertConversationToClient } from "@/features/contacts/app/services/contacts.service";
import type { ClientFormState } from "@/features/contacts/app/types/lead-client-form";
import { toast } from "@/lib/toast";
import { useSyncedDraft } from "@/shared/hooks/use-synced-draft";
import { isQueryLoading } from "@/shared/utils/query-loading";
import type { ClientDetailClientDto, ClientDto } from "@/types/api/clients-v1";
import type { ConversationCardDto } from "@/types/api/contacts-v1";

function toFormState(client: ClientDetailClientDto): ClientFormState {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    documentId: client.documentId ?? "",
    caseDescription: client.caseDescription ?? "",
  };
}

/** Formulário de cliente do painel do lead: carrega o cliente (se cadastrado) ou semeia da conversa, e salva/converte. */
export function useLeadClientForm({
  open,
  conversation,
  onConverted,
}: {
  open: boolean;
  conversation: ConversationCardDto;
  onConverted: (client: ClientDto) => void;
}) {
  const t = useTranslations("contacts");
  const [saveHint, setSaveHint] = useState("");
  const { clientId, clientName, displayName, externalId } = conversation;

  const clientQuery = useQuery({
    queryKey: contactKeys.leadClient(clientId),
    queryFn: ({ signal }) => getClientDetail(clientId!, undefined, { signal }),
    enabled: open && Boolean(clientId),
    staleTime: 0,
  });

  const serverForm = useMemo<ClientFormState | null>(() => {
    if (clientId) return clientQuery.data ? toFormState(clientQuery.data.client) : null;
    return {
      name: clientName ?? displayName,
      phone: externalId,
      email: "",
      documentId: "",
      caseDescription: "",
    };
  }, [clientId, clientQuery.data, clientName, displayName, externalId]);
  const [form, setForm] = useSyncedDraft(serverForm);

  const saveMutation = useMutation({
    mutationFn: async (values: ClientFormState) => {
      const payload = {
        name: values.name,
        phone: values.phone,
        documentId: values.documentId || null,
        caseDescription: values.caseDescription || null,
      };
      if (clientId) {
        await updateClient(clientId, { ...payload, email: values.email || undefined });
        return;
      }
      const client = await convertConversationToClient(conversation.id, {
        ...payload,
        email: values.email,
      });
      onConverted(client);
    },
    onSuccess: () => {
      setSaveHint(t("chat.leadSaved"));
      toast.success(t("chat.leadSaved"));
    },
  });
  const { mutateAsync } = saveMutation;

  async function save() {
    if (!form) return;
    try {
      await mutateAsync(form);
    } catch {
      // apiClient já mostra toast.error
    }
  }

  return {
    form,
    setForm,
    loadingClient: Boolean(clientId) && isQueryLoading(clientQuery),
    saving: saveMutation.isPending,
    saveHint,
    save,
  };
}

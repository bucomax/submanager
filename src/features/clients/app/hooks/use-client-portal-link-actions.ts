"use client";

import { useCreatePatientPortalLink } from "@/features/clients/app/hooks/use-create-patient-portal-link";
import { toast } from "@/lib/toast";
import type { ClientDetailClientDto } from "@/types/api/clients-v1";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Envio do link do portal por e-mail ou abertura/cópia do link na ficha. */
export function useClientPortalLinkActions(client: ClientDetailClientDto | null | undefined) {
  const t = useTranslations("clients.detail");
  const [busy, setBusy] = useState<"email" | "copy" | null>(null);
  const { createPortalLink } = useCreatePatientPortalLink();

  async function sendPortalLink(mode: "email" | "copy") {
    if (busy || !client) return;
    const sendEmail = mode === "email";
    if (sendEmail && !client.email?.trim()) {
      toast.error(t("portalLink.emailRequired"));
      return;
    }
    setBusy(mode);
    try {
      const result = await createPortalLink(client.id, sendEmail);
      if (result.emailSent) {
        toast.success(t("portalLink.emailSent"));
      } else {
        window.open(result.enterUrl, "_blank", "noopener,noreferrer");
        try {
          await navigator.clipboard.writeText(result.enterUrl);
          toast.success(t("portalLink.copyAndOpened"));
        } catch {
          window.prompt(t("portalLink.copyManually"), result.enterUrl);
          toast.success(t("portalLink.openedTabClipboardManual"));
        }
      }
    } catch {
      /* erro: toast global no apiClient */
    } finally {
      setBusy(null);
    }
  }

  return { busy, sendPortalLink };
}

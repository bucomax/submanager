"use client";

import { useCreatePatientPortalLink } from "@/features/clients/app/hooks/use-create-patient-portal-link";
import { toast } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function useCopyPortalLink() {
  const t = useTranslations("clients.list.actions");
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const { createPortalLink } = useCreatePatientPortalLink();

  async function copyPortalLink(clientId: string) {
    if (busyClientId) return;
    setBusyClientId(clientId);
    try {
      const { enterUrl } = await createPortalLink(clientId, false);
      try {
        await navigator.clipboard.writeText(enterUrl);
        toast.success(t("portalLinkCopied"));
      } catch {
        toast.error(t("portalLinkError"));
      }
    } catch {
      /* erro: toast global no apiClient */
    } finally {
      setBusyClientId(null);
    }
  }

  return { copyPortalLink, busyClientId };
}

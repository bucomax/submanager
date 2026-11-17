"use client";

import { createPatientPortalLink } from "@/features/clients/app/services/clients.service";
import { toast } from "@/lib/toast";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

export function useCopyPortalLink() {
  const t = useTranslations("clients.list.actions");
  const [busyClientId, setBusyClientId] = useState<string | null>(null);

  const copyPortalLink = useCallback(
    async (clientId: string) => {
      if (busyClientId) return;
      setBusyClientId(clientId);
      try {
        const { enterUrl } = await createPatientPortalLink(clientId, { sendEmail: false });
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
    },
    [busyClientId, t],
  );

  return { copyPortalLink, busyClientId };
}

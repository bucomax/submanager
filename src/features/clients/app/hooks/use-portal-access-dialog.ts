"use client";

import { useCreatePatientPortalLink } from "@/features/clients/app/hooks/use-create-patient-portal-link";
import { useQrLinkDialog } from "@/features/clients/app/hooks/use-qr-link-dialog";

/** Link de acesso ao portal do paciente (sem envio de e-mail). */
export function usePortalAccessDialog(clientId: string) {
  const { createPortalLink } = useCreatePatientPortalLink();
  return useQrLinkDialog(async () => {
    const data = await createPortalLink(clientId, false);
    return { url: data.enterUrl, expiresAt: data.expiresAt };
  });
}

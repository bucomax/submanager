"use client";

import { useQrLinkDialog } from "@/features/clients/app/hooks/use-qr-link-dialog";
import { createPatientSelfRegisterInvite } from "@/features/clients/app/services/clients.service";

/** Convite de auto-cadastro (opcionalmente amarrado a um paciente existente). */
export function useSelfRegisterInviteDialog(clientId?: string) {
  return useQrLinkDialog(async () => {
    const data = await createPatientSelfRegisterInvite(clientId ? { clientId } : undefined);
    return { url: data.registerUrl, expiresAt: data.expiresAt };
  });
}

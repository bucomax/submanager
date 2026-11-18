"use client";

import { createPatientPortalLink } from "@/features/clients/app/services/clients.service";
import { useMutation } from "@tanstack/react-query";

type CreatePortalLinkVariables = { clientId: string; sendEmail: boolean };

/** Gera (e opcionalmente envia por e-mail) o link mágico do portal do paciente. */
export function useCreatePatientPortalLink() {
  const mutation = useMutation({
    mutationFn: ({ clientId, sendEmail }: CreatePortalLinkVariables) =>
      createPatientPortalLink(clientId, { sendEmail }),
  });

  return {
    isPending: mutation.isPending,
    createPortalLink: (clientId: string, sendEmail: boolean) =>
      mutation.mutateAsync({ clientId, sendEmail }),
  };
}

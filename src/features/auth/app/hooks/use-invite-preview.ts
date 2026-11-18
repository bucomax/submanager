"use client";

import { useQuery } from "@tanstack/react-query";
import { authKeys } from "../hooks/query-keys";
import { fetchInviteSetPasswordPreview } from "../services/password.service";

/** Metadados do convite para exibir no formulário; `null` se o token falta ou é inválido (sem toast). */
export function useInvitePreview(token: string) {
  const query = useQuery({
    queryKey: authKeys.invitePreview(token),
    queryFn: ({ signal }) => fetchInviteSetPasswordPreview(token, { signal }),
    enabled: Boolean(token),
  });
  return query.data ?? null;
}

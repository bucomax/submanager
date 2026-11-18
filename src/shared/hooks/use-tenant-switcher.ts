"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { defineKeys } from "@/shared/lib/query/query-keys";
import { listTenants, setActiveTenant } from "@/shared/services/tenant.service";

const tenantKeys = defineKeys("tenants");

/** Lista de tenants do usuário + troca do tenant ativo (hard reload descarta o estado do tenant anterior). */
export function useTenantSwitcher(activeTenantId: string | null | undefined) {
  const { update } = useSession();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: tenantKeys.scope("list"),
    queryFn: ({ signal }) => listTenants({ signal }),
  });

  // Sem useMutation: `setActiveTenant` limpa o cache do React Query (mutations incluídas).
  async function selectTenant(tenantId: string) {
    if (tenantId === activeTenantId) return;
    setPendingId(tenantId);
    setSwitchError(null);
    try {
      await setActiveTenant(tenantId);
      await update();
      // Hard reload para descartar todo estado client-side do tenant anterior
      window.location.replace("/dashboard");
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Falha ao trocar tenant");
    } finally {
      setPendingId(null);
    }
  }

  const failed = query.isError;
  const loadError = switchError ?? (query.error ? query.error.message || "Erro ao carregar tenants" : null);

  return {
    // `null` enquanto carrega; falha vira lista vazia (como antes).
    tenants: query.data ?? (failed ? [] : null),
    loadError,
    pendingId,
    selectTenant,
  };
}

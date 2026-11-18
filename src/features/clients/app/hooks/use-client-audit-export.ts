"use client";

import { clientKeys } from "@/features/clients/app/hooks/query-keys";
import { toast } from "@/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

type AuditExportErrorBody = { success?: boolean; error?: { message?: string } };

/** Resposta não-ok da API (a mensagem vem do envelope de erro). */
class AuditExportRejectedError extends Error {}

async function downloadAuditCsv(clientId: string): Promise<void> {
  const res = await fetch(`/api/v1/clients/${clientId}/audit-export`, { credentials: "include" });
  if (!res.ok) {
    const body: AuditExportErrorBody = await res.json().catch(() => ({}));
    throw new AuditExportRejectedError(body.error?.message ?? "");
  }
  const cd = res.headers.get("Content-Disposition");
  let filename = `audit-export-${clientId.slice(0, 8)}.csv`;
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta a auditoria do paciente em CSV; a própria exportação gera evento, então refaz a timeline. */
export function useClientAuditExport(clientId: string) {
  const t = useTranslations("clients.detail");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => downloadAuditCsv(clientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clientKeys.timelineAll(clientId) });
    },
    onError: (error) => {
      toast.error(
        error instanceof AuditExportRejectedError && error.message
          ? error.message
          : t("timeline.exportError"),
      );
    },
  });

  return {
    exporting: mutation.isPending,
    downloadAuditExport: () => mutation.mutate(),
  };
}

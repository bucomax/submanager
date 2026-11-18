import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { jsonError } from "@/lib/api-response";
import { runClientAuditExport } from "@/application/use-cases/client/run-client-audit-export";
import type { ClientTimelineEventCategory } from "@/types/api/clients-v1";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { clientAuditExportQuerySchema } from "@/lib/validators/client-audit-export-query";

export const dynamic = "force-dynamic";

const MAX_RANGE_MS = 730 * 24 * 60 * 60 * 1000;

function resolveExportRange(
  fromIso: string | undefined,
  toIso: string | undefined,
): { from: Date; to: Date } {
  const now = new Date();
  if (fromIso && toIso) {
    return { from: new Date(fromIso), to: new Date(toIso) };
  }
  if (fromIso) {
    return { from: new Date(fromIso), to: now };
  }
  if (toIso) {
    const to = new Date(toIso);
    return { from: new Date(to.getTime() - MAX_RANGE_MS), to };
  }
  return {
    from: new Date(now.getTime() - MAX_RANGE_MS),
    to: now,
  };
}

/**
 * Exportação CSV da linha do tempo (auditoria) do paciente.
 * Requer `tenant_admin` ou `super_admin`.
 */
export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const url = new URL(request.url);
  const parsedQ = clientAuditExportQuerySchema.safeParse({
    format: url.searchParams.get("format") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    categories: url.searchParams.get("categories") || undefined,
  });
  if (!parsedQ.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsedQ.error, apiT as (key: string) => string),
      422,
    );
  }

  const { clientId } = params;
  const q = parsedQ.data;

  const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
  }

  const { from, to } = resolveExportRange(q.from, q.to);
  if (from.getTime() > to.getTime()) {
    return jsonError("VALIDATION_ERROR", apiT("errors.auditExportFromAfterTo"), 422);
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return jsonError("VALIDATION_ERROR", apiT("errors.auditExportRangeTooLarge"), 422);
  }

  const categoryFilter: Set<ClientTimelineEventCategory> | null =
    q.categories != null && q.categories.length > 0 ? new Set(q.categories) : null;

  const { csv } = await runClientAuditExport({
    tenantId,
    clientId,
    actorUserId: session.user.id,
    from,
    to,
    categoryFilter,
  });

  const safeName = `audit-export-${clientId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}, { role: "admin", forbiddenMessageKey: "errors.auditExportPermissionDenied" });

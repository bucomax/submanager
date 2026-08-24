import type { Session } from "next-auth";
import { prisma } from "@/infrastructure/database/prisma";
import { getApiT, type ApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";
import { tagRequestId } from "@/lib/observability/request-id";
import { getSession } from "./session";

async function resolveApiT(request: Request | undefined, t?: ApiT): Promise<ApiT> {
  return t ?? (await getApiT(request));
}

export async function requireSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session;
}

export async function requireSessionOr401(request?: Request, t?: ApiT) {
  // Primeira instrução: precisa marcar antes de qualquer `return`, inclusive o 401,
  // para que o evento de erro no envelope carregue o mesmo request_id do browser.
  tagRequestId(request);

  const session = await requireSession();
  if (!session) {
    const tr = await resolveApiT(request, t);
    return { session: null, response: jsonError("UNAUTHORIZED", tr("errors.sessionInvalid"), 401) };
  }

  const { rateLimit } = await import("@/lib/api/rate-limit");
  const limited = await rateLimit("api", session.user.id);
  if (limited) return { session: null, response: limited };

  return { session, response: null };
}

export function requireSuperAdmin(session: Session) {
  return session.user.globalRole === "super_admin";
}

export async function superAdminOr403(session: Session, request?: Request, t?: ApiT) {
  if (!requireSuperAdmin(session)) {
    const tr = await resolveApiT(request, t);
    return jsonError("FORBIDDEN", tr("errors.superAdminOnly"), 403);
  }
  return null;
}

/** `super_admin` ou `tenant_admin` do tenant informado. */
export async function assertTenantInvitePermission(session: Session, tenantId: string, request?: Request, t?: ApiT) {
  if (session.user.globalRole === "super_admin") {
    return null;
  }
  const m = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!m || m.role !== "tenant_admin") {
    const tr = await resolveApiT(request, t);
    return jsonError("FORBIDDEN", tr("errors.invitePermissionDenied"), 403);
  }
  return null;
}

/**
 * `super_admin` ou `tenant_admin` do tenant.
 * @param forbiddenMessageKey — chave `errors.*` no namespace `api` quando a permissão falha (padrão: gestão de membros).
 */
export async function assertTenantAdminOrSuper(
  session: Session,
  tenantId: string,
  request?: Request,
  t?: ApiT,
  forbiddenMessageKey: string = "errors.manageMembersPermissionDenied",
) {
  if (session.user.globalRole === "super_admin") {
    return null;
  }
  const m = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!m || m.role !== "tenant_admin") {
    const tr = await resolveApiT(request, t);
    return jsonError("FORBIDDEN", tr(forbiddenMessageKey as Parameters<ApiT>[0]), 403);
  }
  return null;
}

/** Operações escopadas ao tenant ativo da sessão (`POST /auth/context`). */
export async function getActiveTenantIdOr400(session: Session, request?: Request, t?: ApiT) {
  const tenantId = session.user.tenantId ?? null;
  if (!tenantId) {
    const tr = await resolveApiT(request, t);
    return { tenantId: null, response: jsonError("TENANT_REQUIRED", tr("errors.tenantRequired"), 400) };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, isActive: true },
  });
  if (!tenant) {
    const tr = await resolveApiT(request, t);
    return { tenantId: null, response: jsonError("NOT_FOUND", tr("errors.tenantNotFound"), 404) };
  }
  if (!tenant.isActive) {
    const tr = await resolveApiT(request, t);
    return { tenantId: null, response: jsonError("TENANT_INACTIVE", tr("errors.tenantInactive"), 403) };
  }
  return { tenantId, response: null };
}

/** Membro do tenant ativo ou `super_admin` com contexto naquele tenant. */
export async function assertActiveTenantMembership(session: Session, tenantId: string, request?: Request, t?: ApiT) {
  if (session.user.globalRole === "super_admin") return null;
  const m = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId } },
  });
  if (!m) {
    const tr = await resolveApiT(request, t);
    return jsonError("FORBIDDEN", tr("errors.forbiddenTenantAccess"), 403);
  }
  return null;
}

import { z } from "zod";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { prisma } from "@/infrastructure/database/prisma";
import { seedConversations } from "../../../../../../../packages/prisma/seed/seed-conversations";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ tenantId: z.string().min(1) });

/**
 * Rota temporária, super_admin-only: apaga as conversas demo existentes do
 * tenant e recria com o fixture atual (packages/prisma/seed/seed-conversations.ts).
 * Remover após uso.
 */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const { tenantId } = parsed.data;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return jsonError("NOT_FOUND", "Tenant não encontrado.", 404);
  }

  const deleted = await prisma.conversation.deleteMany({ where: { tenantId } });

  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId },
    include: { user: { select: { id: true, email: true, name: true } } },
    take: 2,
  });

  if (memberships.length === 0) {
    return jsonError("NOT_FOUND", "Tenant não tem membros para associar como atores do seed.", 422);
  }

  const adminUser = memberships[0]!.user;
  const secondaryUser = memberships[1]?.user ?? adminUser;

  const result = await seedConversations(prisma, {
    tenantId,
    actors: {
      admin: { id: adminUser.id, email: adminUser.email ?? "", name: adminUser.name ?? "" },
      user: { id: secondaryUser.id, email: secondaryUser.email ?? "", name: secondaryUser.name ?? "" },
    },
  });

  return jsonSuccess({ deletedCount: deleted.count, ...result });
}

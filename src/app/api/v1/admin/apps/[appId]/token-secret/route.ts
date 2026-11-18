import { logger } from "@/lib/observability/logger";
import { withSessionRoute } from "@/lib/api/route-handler";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { deriveAppTokenKey } from "@/lib/auth/app-scoped-token";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";

export const dynamic = "force-dynamic";

/**
 * Chave HS256 derivada (HKDF) deste app, para o fornecedor verificar o token do iframe.
 * Cada app tem a sua; o segredo base nunca sai do servidor. Apenas super_admin.
 */
export const GET = withSessionRoute<{ appId: string }>(async ({ session, apiT, params }) => {
  const { appId } = params;
  const app = await appPrismaRepository.findById(appId);
  if (!app) return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);

  logger.info("[app-token-secret] revealed", { appId, actorUserId: session.user.id });

  return jsonSuccess(
    {
      appId,
      algorithm: "HS256",
      secretHex: Buffer.from(deriveAppTokenKey(appId)).toString("hex"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}, { role: "super_admin" });
